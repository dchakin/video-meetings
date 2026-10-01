import { Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { TranscriptionFinishedEvent } from '../../meeting-file/events/transcription-finished.event';
import { MeetingSummaryService } from '../meeting-summary.service';

/** После транскрибации файла запускает автогенерацию выжимки (сервис сам проверяет, что все файлы готовы). */
@EventsHandler(TranscriptionFinishedEvent)
export class StartSummaryOnTranscriptionFinishedHandler implements IEventHandler<TranscriptionFinishedEvent> {
  private readonly logger = new Logger(StartSummaryOnTranscriptionFinishedHandler.name);

  constructor(private readonly summaries: MeetingSummaryService) {}

  async handle(event: TranscriptionFinishedEvent): Promise<void> {
    try {
      await this.summaries.startAutoGeneration(event.meetingId);
    } catch (error) {
      this.logger.error(
        `Автозапуск выжимки встречи ${event.meetingId} не удался: ${(error as Error).message}`,
      );
    }
  }
}
