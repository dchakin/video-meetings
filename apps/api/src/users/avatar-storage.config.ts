// См. комментарий в `meeting-file/file-storage.config.ts`: `@nestjs/config` читает `.env`
// только при построении графа модулей Nest — гарантируем `process.env` из `.env` заранее.
import 'dotenv/config';

export const DEFAULT_AVATAR_STORAGE_DIR = 'storage/avatars';
export const DEFAULT_AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const AVATAR_URL_PREFIX = '/avatars/';
export const ALLOWED_AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Директория хранения аватаров (относительно cwd процесса, вне `dist`). */
export function getAvatarStorageDir(): string {
  return process.env.AVATAR_STORAGE_DIR ?? DEFAULT_AVATAR_STORAGE_DIR;
}

/** Максимальный размер загружаемого аватара в байтах. */
export function getAvatarMaxSizeBytes(): number {
  const parsed = Number(process.env.AVATAR_MAX_SIZE_BYTES);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_AVATAR_MAX_SIZE_BYTES;
}
