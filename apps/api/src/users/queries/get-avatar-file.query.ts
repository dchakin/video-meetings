import { Query } from '@nestjs/cqrs';

/** Файл аватара на диске, готовый к отдаче клиенту. */
export interface AvatarFile {
  storagePath: string;
  mimeType: string;
}

/** Найти сохранённый файл аватара по имени (часть `avatarUrl` после `/avatars/`). 404, если файла нет. */
export class GetAvatarFileQuery extends Query<AvatarFile> {
  constructor(public readonly fileName: string) {
    super();
  }
}
