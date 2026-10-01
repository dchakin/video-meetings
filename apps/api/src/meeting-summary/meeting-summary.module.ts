import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '../auth/auth.module';
import { OpenRouterModule } from '../open-router/open-router.module';
import { MeetingSummaryAgentService } from './agent/meeting-summary-agent.service';
import { StartSummaryOnTranscriptionFinishedHandler } from './events/start-summary-on-transcription-finished.handler';
import { MeetingSummaryController } from './meeting-summary.controller';
import { MeetingSummaryService } from './meeting-summary.service';

@Module({
  imports: [AuthModule, CqrsModule, OpenRouterModule],
  controllers: [MeetingSummaryController],
  providers: [
    MeetingSummaryService,
    MeetingSummaryAgentService,
    StartSummaryOnTranscriptionFinishedHandler,
  ],
})
export class MeetingSummaryModule {}
