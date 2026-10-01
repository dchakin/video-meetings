import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '../auth/auth.module';
import { TranscriptionModule } from '../transcription/transcription.module';
import { MeetingFileController } from './meeting-file.controller';
import { MeetingFileService } from './meeting-file.service';

@Module({
  imports: [AuthModule, CqrsModule, TranscriptionModule],
  controllers: [MeetingFileController],
  providers: [MeetingFileService],
})
export class MeetingFileModule {}
