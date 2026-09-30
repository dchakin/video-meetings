import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OpenRouterModule } from '../open-router/open-router.module';
import { MeetingSummaryController } from './meeting-summary.controller';
import { MeetingSummaryService } from './meeting-summary.service';

@Module({
  imports: [AuthModule, OpenRouterModule],
  controllers: [MeetingSummaryController],
  providers: [MeetingSummaryService],
})
export class MeetingSummaryModule {}
