import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MeetingFileController } from './meeting-file.controller';
import { MeetingFileService } from './meeting-file.service';

@Module({
  imports: [AuthModule],
  controllers: [MeetingFileController],
  providers: [MeetingFileService],
})
export class MeetingFileModule {}
