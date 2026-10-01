import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Meeting,
  MeetingSummary,
  MeetingSummaryStatus,
  Prisma,
  TranscriptionStatus,
} from '@prisma/client';
import { JwtPayload } from '../auth/auth.types';
import { isMeetingMember } from '../meeting/meeting-membership';
import { PrismaService } from '../prisma/prisma.service';
import { MeetingSummaryAgentService } from './agent/meeting-summary-agent.service';

@Injectable()
export class MeetingSummaryService {
  private readonly logger = new Logger(MeetingSummaryService.name);
  /** Встречи, у которых во время генерации появились новые транскрипции — после неё нужен повторный прогон. */
  private readonly meetingsNeedingRerun = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly summaryAgent: MeetingSummaryAgentService,
  ) {}

  /** Возвращает сохранённую выжимку (без повторной генерации); 404, если встречи или выжимки нет. */
  async getSummary(user: JwtPayload, meetingId: string): Promise<MeetingSummary> {
    await this.getMeetingForMemberOrThrow(user, meetingId);

    const summary = await this.prisma.meetingSummary.findUnique({ where: { meetingId } });
    if (!summary) {
      throw new NotFoundException('Выжимка не найдена');
    }
    return summary;
  }

  /**
   * Переводит выжимку в «в процессе» и запускает генерацию без ожидания (не блокирует ответ).
   * 400 — нет ни одной готовой транскрипции; 409 — генерация уже идёт.
   */
  async startGeneration(user: JwtPayload, meetingId: string): Promise<MeetingSummary> {
    await this.getMeetingForMemberOrThrow(user, meetingId);

    const doneTranscriptions = await this.collectDoneTranscriptions(meetingId);
    if (doneTranscriptions.length === 0) {
      throw new BadRequestException('Нет готовых транскрипций для генерации выжимки');
    }

    const inProgress = await this.claimGeneration(meetingId);
    this.generateInBackground(meetingId);

    return inProgress;
  }

  /**
   * Автозапуск после транскрибации: стартует, только когда у встречи не осталось файлов в очереди/в работе
   * и есть хотя бы одна готовая транскрипция. Если генерация уже идёт — откладывает повторный прогон.
   */
  async startAutoGeneration(meetingId: string): Promise<void> {
    const hasPending = await this.prisma.meetingFile.count({
      where: {
        meetingId,
        transcriptionStatus: {
          in: [TranscriptionStatus.QUEUED, TranscriptionStatus.IN_PROGRESS],
        },
      },
    });
    if (hasPending > 0) {
      return;
    }
    const doneTranscriptions = await this.collectDoneTranscriptions(meetingId);
    if (doneTranscriptions.length === 0) {
      return;
    }

    try {
      await this.claimGeneration(meetingId);
    } catch (error) {
      if (error instanceof ConflictException) {
        this.meetingsNeedingRerun.add(meetingId);
        return;
      }
      throw error;
    }
    this.generateInBackground(meetingId);
  }

  /** Генерирует выжимку и сохраняет её; при любом сбое переводит статус в ERROR без записи данных. */
  async generate(meetingId: string): Promise<void> {
    try {
      const transcriptions = await this.collectDoneTranscriptions(meetingId);
      const { summary, actionItems, decisions } = await this.summaryAgent.run(transcriptions);

      // Перезаписывает все поля — повторная генерация полностью заменяет прежнюю выжимку.
      await this.prisma.meetingSummary.update({
        where: { meetingId },
        data: { status: MeetingSummaryStatus.DONE, summary, actionItems, decisions },
      });
    } catch (error) {
      await this.prisma.meetingSummary.update({
        where: { meetingId },
        data: { status: MeetingSummaryStatus.ERROR },
      });
      throw error;
    }
  }

  /** Атомарно занимает выжимку под генерацию: параллельный запуск отклоняется с 409. */
  private async claimGeneration(meetingId: string): Promise<MeetingSummary> {
    const claimed = await this.prisma.meetingSummary.updateMany({
      where: { meetingId, status: { not: MeetingSummaryStatus.IN_PROGRESS } },
      data: { status: MeetingSummaryStatus.IN_PROGRESS },
    });

    if (claimed.count === 0) {
      try {
        return await this.prisma.meetingSummary.create({
          data: { meetingId, status: MeetingSummaryStatus.IN_PROGRESS },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('Генерация выжимки уже идёт');
        }
        throw error;
      }
    }

    return this.prisma.meetingSummary.findUniqueOrThrow({ where: { meetingId } });
  }

  private generateInBackground(meetingId: string): void {
    this.generate(meetingId)
      .catch((error) => {
        // `generate` уже перевела статус в ERROR — здесь только логируем, чтобы отказ промиса не завершил процесс.
        this.logger.error(
          `Генерация выжимки встречи ${meetingId} не удалась: ${(error as Error).message}`,
        );
      })
      .finally(() => this.rerunIfRequested(meetingId));
  }

  private rerunIfRequested(meetingId: string): void {
    if (!this.meetingsNeedingRerun.delete(meetingId)) {
      return;
    }
    this.startAutoGeneration(meetingId).catch((error) => {
      this.logger.error(
        `Повторный автозапуск выжимки встречи ${meetingId} не удался: ${(error as Error).message}`,
      );
    });
  }

  private async collectDoneTranscriptions(meetingId: string): Promise<string[]> {
    const files = await this.prisma.meetingFile.findMany({
      where: { meetingId, transcriptionStatus: TranscriptionStatus.DONE },
      orderBy: { createdAt: 'asc' },
      select: { transcriptionText: true },
    });
    return files.flatMap((file) => (file.transcriptionText ? [file.transcriptionText] : []));
  }

  private async getMeetingForMemberOrThrow(user: JwtPayload, meetingId: string): Promise<Meeting> {
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting || !isMeetingMember(meeting, user)) {
      throw new NotFoundException('Встреча не найдена');
    }
    return meeting;
  }
}
