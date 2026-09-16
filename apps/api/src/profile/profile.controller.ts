import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/auth.types';
import { getAvatarMaxSizeBytes } from '../users/avatar-storage.config';
import {
  ChangePasswordCommand,
  UpdateAvatarCommand,
  UpdateUserNameCommand,
} from '../users/commands';
import { GetUserProfileQuery } from '../users/queries';
import { UserProfile } from '../users/users.types';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileNameDto } from './dto/update-profile-name.dto';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  getProfile(@CurrentUser() user: JwtPayload): Promise<UserProfile> {
    return this.queryBus.execute(new GetUserProfileQuery(user.sub));
  }

  @Patch()
  updateName(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileNameDto,
  ): Promise<UserProfile> {
    return this.commandBus.execute(new UpdateUserNameCommand(user.sub, dto.name));
  }

  @Patch('password')
  changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto): Promise<void> {
    return this.commandBus.execute(
      new ChangePasswordCommand(user.sub, dto.oldPassword, dto.newPassword),
    );
  }

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
