import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Meeting, MeetingFile } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { JwtPayload } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { getFileStorageDir } from './file-storage.config';
import { MeetingFileResponse } from './meeting-file.types';

@Injectable()
export class MeetingFileService {
  private readonly storageDir = path.resolve(process.cwd(), getFileStorageDir());

  constructor(private readonly prisma: PrismaService) {}

  async upload(
    user: JwtPayload,
    meetingId: string,
    file: Express.Multer.File | undefined,
  ): Promise<MeetingFileResponse> {
    if (!file) {
      throw new BadRequestException('Файл не передан');
    }

    const meeting = await this.getMeetingOrThrow(meetingId);
    if (meeting.ownerId !== user.sub) {
      throw new NotFoundException('Встреча не найдена');
    }

    await fs.mkdir(this.storageDir, { recursive: true });
    const storedName = `${randomUUID()}${path.extname(file.originalname)}`;
    const storagePath = path.join(this.storageDir, storedName);
    await fs.writeFile(storagePath, file.buffer);

    try {
      const created = await this.prisma.meetingFile.create({
        data: {
          meetingId,
          fileName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          storagePath,
          uploadedById: user.sub,
        },
      });

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

  private async getMeetingOrThrow(meetingId: string): Promise<Meeting> {
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) {
      throw new NotFoundException('Встреча не найдена');
    }
    return meeting;
  }

  private async getMeetingForMemberOrThrow(user: JwtPayload, meetingId: string): Promise<Meeting> {
    const meeting = await this.getMeetingOrThrow(meetingId);
    const isOwner = meeting.ownerId === user.sub;
    const isParticipant = meeting.participants.includes(user.email);
    if (!isOwner && !isParticipant) {
      // Скрываем существование встречи от посторонних — как и MeetingService.findOneByOwner.
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
    };
  }
}
