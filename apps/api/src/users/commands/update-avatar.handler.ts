import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ALLOWED_AVATAR_MIME_TYPES,
  AVATAR_URL_PREFIX,
  getAvatarMaxSizeBytes,
  getAvatarStorageDir,
} from '../avatar-storage.config';
import { toUserProfile } from '../users.types';
import { UpdateAvatarCommand } from './update-avatar.command';

@CommandHandler(UpdateAvatarCommand)
export class UpdateAvatarHandler implements ICommandHandler<UpdateAvatarCommand> {
  private readonly storageDir = path.resolve(process.cwd(), getAvatarStorageDir());

  constructor(private readonly prisma: PrismaService) {}

  async execute({ userId, file }: UpdateAvatarCommand) {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      throw new NotFoundException('Пользователь не найден');
    }

    if (!ALLOWED_AVATAR_MIME_TYPES.includes(file.mimeType)) {
      throw new BadRequestException('Неверный формат файла. Разрешены: JPEG, PNG, WebP');
    }

    if (file.size > getAvatarMaxSizeBytes()) {
      throw new BadRequestException('Файл слишком большой. Максимум 5 МБ');
    }

    await fs.mkdir(this.storageDir, { recursive: true });
    const storedName = `${randomUUID()}${path.extname(file.originalName)}`;
    await fs.writeFile(path.join(this.storageDir, storedName), file.buffer);

    if (existing.avatarUrl?.startsWith(AVATAR_URL_PREFIX)) {
      const oldPath = path.join(
        this.storageDir,
        existing.avatarUrl.slice(AVATAR_URL_PREFIX.length),
      );
      await fs.unlink(oldPath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      });
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: `${AVATAR_URL_PREFIX}${storedName}` },
    });
    return toUserProfile(user);
  }
}
