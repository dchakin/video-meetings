import {
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/auth.types';
import { getFileMaxSizeBytes } from './file-storage.config';
import { MeetingFileService } from './meeting-file.service';
import { MeetingFileResponse } from './meeting-file.types';

@Controller('meetings/:meetingId/files')
@UseGuards(JwtAuthGuard)
export class MeetingFileController {
  constructor(private readonly files: MeetingFileService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: getFileMaxSizeBytes() } }))
  upload(
    @CurrentUser() user: JwtPayload,
    @Param('meetingId') meetingId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<MeetingFileResponse> {
    return this.files.upload(user, meetingId, file);
  }

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Param('meetingId') meetingId: string,
  ): Promise<MeetingFileResponse[]> {
    return this.files.listForMember(user, meetingId);
  }
}
