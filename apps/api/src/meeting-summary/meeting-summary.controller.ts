import {
  Controller,
  HttpCode,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { MeetingSummary } from '@prisma/client';
import { JwtPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MeetingSummaryService } from './meeting-summary.service';

@Controller('meetings/:meetingId/summary')
@UseGuards(JwtAuthGuard)
export class MeetingSummaryController {
  constructor(private readonly summaries: MeetingSummaryService) {}

  @Get()
  getSummary(
    @CurrentUser() user: JwtPayload,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
  ): Promise<MeetingSummary> {
    return this.summaries.getSummary(user, meetingId);
  }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  startGeneration(
    @CurrentUser() user: JwtPayload,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
  ): Promise<MeetingSummary> {
    return this.summaries.startGeneration(user, meetingId);
  }
}
