import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { Meeting, MeetingFile, TranscriptionStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { JwtPayload } from '../auth/auth.types';
import { isMeetingMember, isMeetingOwner } from '../meeting/meeting-membership';
import { PrismaService } from '../prisma/prisma.service';
import { TRANSCRIBABLE_MEETING_FILE_MIME_TYPES } from '../transcription/transcription.constants';
import { WhisperTranscriptionService } from '../transcription/whisper-transcription.service';
import {
  ALLOWED_MEETING_FILE_MIME_TYPES,
  getFileStorageDir,
  MAX_FILES_PER_MEETING,
  MAX_TOTAL_SIZE_BYTES_PER_MEETING,
  MEETING_FILE_MIME_TYPE_EXTENSIONS,
} from './file-storage.config';
import { TranscriptionFinishedEvent } from './events/transcription-finished.event';
import { MeetingFileResponse } from './meeting-file.types';

/**
 * `busboy` (используется `multer`) декодирует поле `filename` в multipart-запросе как
 * latin1 независимо от реальной кодировки — так велит спецификация multipart form-data
 * для полей без RFC 5987 (`filename*`). Браузеры при этом отправляют имя файла в UTF-8,
 * поэтому нелатинские символы (кириллица и т.п.) приходят битыми и требуют перекодировки.
 */
function decodeOriginalFileName(originalName: string): string {
  return Buffer.from(originalName, 'latin1').toString('utf8');
}

@Injectable()
export class MeetingFileService {
  private readonly storageDir = path.resolve(process.cwd(), getFileStorageDir());
  private readonly logger = new Logger(MeetingFileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whisperTranscriptionService: WhisperTranscriptionService,
    private readonly eventBus: EventBus,
  ) {}

  async upload(
    user: JwtPayload,
    meetingId: string,
    file: Express.Multer.File | undefined,
  ): Promise<MeetingFileResponse> {
    if (!file) {
      throw new BadRequestException('Файл не передан');
    }

    await this.getMeetingForOwnerOrThrow(user, meetingId);

    if (!ALLOWED_MEETING_FILE_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Неподдерживаемый тип файла');
    }

    await this.assertQuotaOrThrow(meetingId, file.size);

    const fileName = decodeOriginalFileName(file.originalname);

    await fs.mkdir(this.storageDir, { recursive: true });
    const storedName = `${randomUUID()}${MEETING_FILE_MIME_TYPE_EXTENSIONS[file.mimetype]}`;
    const storagePath = path.join(this.storageDir, storedName);
    await fs.writeFile(storagePath, file.buffer);

    try {
      const created = await this.prisma.meetingFile.create({
        data: {
          meetingId,
          fileName,
          mimeType: file.mimetype,
          size: file.size,
          storagePath,
          uploadedById: user.sub,
          transcriptionStatus: this.isTranscribableMimeType(file.mimetype)
            ? TranscriptionStatus.QUEUED
            : null,
        },
      });

      this.triggerTranscriptionInBackground(created);

      return this.toResponse(created);
    } catch (error) {
      // Запись в БД не удалась — не оставляем файл-сироту без ссылки на него.
      await fs.unlink(storagePath).catch(() => undefined);
      throw error;
    }
  }

  async listForMember(user: JwtPayload, meetingId: string): Promise<MeetingFileResponse[]> {
    await this.getMeetingForMemberOrThrow(user, meetingId);

    const files = await this.prisma.meetingFile.findMany({
      where: { meetingId },
      orderBy: { createdAt: 'desc' },
    });

    return files.map((file) => this.toResponse(file));
  }

  async getForMember(user: JwtPayload, meetingId: string, fileId: string): Promise<MeetingFile> {
    await this.getMeetingForMemberOrThrow(user, meetingId);
    return this.getFileOrThrow(meetingId, fileId);
  }

  async deleteAsOwner(user: JwtPayload, meetingId: string, fileId: string): Promise<void> {
    await this.getMeetingForOwnerOrThrow(user, meetingId);
    const file = await this.getFileOrThrow(meetingId, fileId);

    await this.prisma.meetingFile.delete({ where: { id: file.id } });
    await fs.unlink(file.storagePath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    });
  }

  private isTranscribableMimeType(mimeType: string): boolean {
    return TRANSCRIBABLE_MEETING_FILE_MIME_TYPES.includes(mimeType);
  }

  /**
   * Запускает транскрибацию файла в фоне, не блокируя ответ на запрос загрузки. Промис
   * намеренно не возвращается вызывающему коду (`upload`) — сбой обрабатывается внутри
   * `runTranscription` и отражается статусом файла в БД, а не отклонением ответа на upload.
   */
  private triggerTranscriptionInBackground(file: MeetingFile): void {
    if (!this.isTranscribableMimeType(file.mimeType)) {
      return;
    }

    this.runTranscription(file).catch((error) => {
      // `runTranscription` уже перевела статус файла в ERROR — здесь только логируем,
      // чтобы необработанный отказ промиса не завершил процесс.
      this.logger.error(`Транскрибация файла ${file.id} не удалась: ${(error as Error).message}`);
    });
  }

  private async runTranscription(file: MeetingFile): Promise<void> {
    await this.updateTranscriptionStatus(file.id, TranscriptionStatus.IN_PROGRESS);

    try {
      const transcriptionText = await this.whisperTranscriptionService.transcribeFile(
        file.storagePath,
        file.mimeType,
      );
      await this.prisma.meetingFile.update({
        where: { id: file.id },
        data: { transcriptionStatus: TranscriptionStatus.DONE, transcriptionText },
      });
    } catch (error) {
      await this.updateTranscriptionStatus(file.id, TranscriptionStatus.ERROR);
      throw error;
    } finally {
      // Событие и при ERROR: упавший файл может быть последним незавершённым — остальные ждут автовыжимки.
      this.eventBus.publish(new TranscriptionFinishedEvent(file.meetingId));
    }
  }

  private async updateTranscriptionStatus(
    fileId: string,
    transcriptionStatus: TranscriptionStatus,
  ): Promise<void> {
    await this.prisma.meetingFile.update({ where: { id: fileId }, data: { transcriptionStatus } });
  }

  /** Ограничивает число и суммарный объём файлов встречи — защита от DoS диска/памяти/БД. */
  private async assertQuotaOrThrow(meetingId: string, incomingSize: number): Promise<void> {
    const aggregate = await this.prisma.meetingFile.aggregate({
      where: { meetingId },
      _count: true,
      _sum: { size: true },
    });

    if (aggregate._count >= MAX_FILES_PER_MEETING) {
      throw new BadRequestException(`Достигнут лимит файлов на встречу (${MAX_FILES_PER_MEETING})`);
    }

    const totalSize = (aggregate._sum.size ?? 0) + incomingSize;
    if (totalSize > MAX_TOTAL_SIZE_BYTES_PER_MEETING) {
      throw new BadRequestException('Превышен суммарный лимит объёма файлов встречи');
    }
  }

  private async getFileOrThrow(meetingId: string, fileId: string): Promise<MeetingFile> {
    const file = await this.prisma.meetingFile.findFirst({ where: { id: fileId, meetingId } });
    if (!file) {
      throw new NotFoundException('Файл не найден');
    }
    return file;
  }

  private async getMeetingForOwnerOrThrow(user: JwtPayload, meetingId: string): Promise<Meeting> {
    const meeting = await this.getMeetingOrThrow(meetingId);
    if (!isMeetingOwner(meeting, user)) {
      // Скрываем существование встречи от тех, кто не вправе ей управлять — как и upload/delete.
      throw new NotFoundException('Встреча не найдена');
    }
    return meeting;
  }

  private async getMeetingOrThrow(meetingId: string): Promise<Meeting> {
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) {
      throw new NotFoundException('Встреча не найдена');
    }
    return meeting;
  }

  private async getMeetingForMemberOrThrow(user: JwtPayload, meetingId: string): Promise<Meeting> {
    const meeting = await this.getMeetingOrThrow(meetingId);
    if (!isMeetingMember(meeting, user)) {
      // Скрываем существование встречи от посторонних — как и MeetingService.findOneForMember.
      throw new NotFoundException('Встреча не найдена');
    }
    return meeting;
  }

  private toResponse(file: MeetingFile): MeetingFileResponse {
    return {
      id: file.id,
      fileName: file.fileName,
      mimeType: file.mimeType,
      size: file.size,
      createdAt: file.createdAt,
      uploadedById: file.uploadedById,
      transcriptionStatus: file.transcriptionStatus,
      transcriptionText: file.transcriptionText,
    };
  }
}
