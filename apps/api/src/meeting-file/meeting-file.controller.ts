import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream } from 'node:fs';
import type { Response } from 'express';
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

  @Get(':fileId/download')
  async download(
    @CurrentUser() user: JwtPayload,
    @Param('meetingId') meetingId: string,
    @Param('fileId') fileId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.files.getForMember(user, meetingId, fileId);
    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    });
    return new StreamableFile(createReadStream(file.storagePath));
  }

  @Delete(':fileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('meetingId') meetingId: string,
    @Param('fileId') fileId: string,
  ): Promise<void> {
    await this.files.deleteAsOwner(user, meetingId, fileId);
  }
}
