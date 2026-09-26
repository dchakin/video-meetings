import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TranscriptionModule } from '../transcription/transcription.module';
import { MeetingFileController } from './meeting-file.controller';
import { MeetingFileService } from './meeting-file.service';

@Module({
  imports: [AuthModule, TranscriptionModule],
  controllers: [MeetingFileController],
  providers: [MeetingFileService],
})
export class MeetingFileModule {}
