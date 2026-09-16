import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/auth.types';
import { getAvatarMaxSizeBytes } from '../users/avatar-storage.config';
import { UpdateAvatarCommand } from '../users/commands';
import { UserProfile } from '../users/users.types';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: getAvatarMaxSizeBytes() } }))
  uploadAvatar(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<UserProfile> {
    if (!file) {
      throw new BadRequestException('Файл не передан');
    }

    return this.commandBus.execute(
      new UpdateAvatarCommand(user.sub, {
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      }),
    );
  }
}
