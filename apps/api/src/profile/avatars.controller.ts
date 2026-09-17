import { Controller, Get, Param, Res, StreamableFile } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import { GetAvatarFileQuery } from '../users/queries';

/**
 * Публичная отдача аватаров по `avatarUrl` (`/avatars/<file>`). Без `JwtAuthGuard`:
 * `<img src>` не передаёт заголовок `Authorization`, а имена файлов — случайные UUID.
 */
@Controller('avatars')
export class AvatarsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':fileName')
  async getAvatar(
    @Param('fileName') fileName: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.queryBus.execute(new GetAvatarFileQuery(fileName));
    res.set({
      'Content-Type': file.mimeType,
      'X-Content-Type-Options': 'nosniff',
      // При замене аватара создаётся файл с новым именем — содержимое по URL не меняется.
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    return new StreamableFile(createReadStream(file.storagePath));
  }
}
