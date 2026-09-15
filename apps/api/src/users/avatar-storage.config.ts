// См. комментарий в `meeting-file/file-storage.config.ts`: `@nestjs/config` читает `.env`
// только при построении графа модулей Nest — гарантируем `process.env` из `.env` заранее.
import 'dotenv/config';

export const DEFAULT_AVATAR_STORAGE_DIR = 'storage/avatars';
export const DEFAULT_AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const AVATAR_URL_PREFIX = '/avatars/';

/**
 * Расширение файла выбирается по проверенному mimetype, а не по присланному клиентом
 * originalName — иначе можно сохранить произвольные байты под расширением вроде `.html`
 * и получить их исполнение при раздаче статики (stored XSS).
 */
export const AVATAR_MIME_TYPE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};
export const ALLOWED_AVATAR_MIME_TYPES = Object.keys(AVATAR_MIME_TYPE_EXTENSIONS);

/** Директория хранения аватаров (относительно cwd процесса, вне `dist`). */
export function getAvatarStorageDir(): string {
  return process.env.AVATAR_STORAGE_DIR ?? DEFAULT_AVATAR_STORAGE_DIR;
}

/** Максимальный размер загружаемого аватара в байтах. */
export function getAvatarMaxSizeBytes(): number {
  const parsed = Number(process.env.AVATAR_MAX_SIZE_BYTES);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_AVATAR_MAX_SIZE_BYTES;
}
