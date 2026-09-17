import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { AVATAR_MIME_TYPE_EXTENSIONS, getAvatarStorageDir } from '../avatar-storage.config';
import { AvatarFile, GetAvatarFileQuery } from './get-avatar-file.query';

const MIME_TYPE_BY_EXTENSION = Object.fromEntries(
  Object.entries(AVATAR_MIME_TYPE_EXTENSIONS).map(([mimeType, ext]) => [ext, mimeType]),
);

/** Имена файлов генерирует `UpdateAvatarHandler`: `randomUUID()` + расширение по mimetype. */
const AVATAR_FILE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.[a-z]+)$/;

@QueryHandler(GetAvatarFileQuery)
export class GetAvatarFileHandler implements IQueryHandler<GetAvatarFileQuery> {
  private readonly storageDir = path.resolve(process.cwd(), getAvatarStorageDir());

  async execute({ fileName }: GetAvatarFileQuery): Promise<AvatarFile> {
    // Строгий формат имени исключает обход директории (`../`) и отдачу посторонних файлов.
    const mimeType = MIME_TYPE_BY_EXTENSION[AVATAR_FILE_NAME.exec(fileName)?.[1] ?? ''];
    if (!mimeType) {
      throw new NotFoundException('Аватар не найден');
    }

    const storagePath = path.join(this.storageDir, fileName);
    const stat = await fs.stat(storagePath).catch(() => null);
    if (!stat?.isFile()) {
      throw new NotFoundException('Аватар не найден');
    }

    return { storagePath, mimeType };
  }
}
