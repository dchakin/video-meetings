// `@nestjs/config`-модуль читает `.env` только при построении графа модулей Nest — уже
// после того, как декораторы контроллеров (в т.ч. `FileInterceptor(...)` с лимитом размера)
// вычисляются при импорте файлов. Гарантируем `process.env` из `.env` независимо от порядка импортов.
import 'dotenv/config';

export const DEFAULT_FILE_STORAGE_DIR = 'storage/meeting-files';
export const DEFAULT_FILE_MAX_SIZE_BYTES = 10 * 1024 * 1024;
// `MeetingFile.size` — Prisma `Int` (PostgreSQL int4), максимум 2^31 - 1.
const MAX_INT32 = 2147483647;

/** Директория хранения загруженных файлов (относительно cwd процесса, вне `dist`). */
export function getFileStorageDir(): string {
  return process.env.FILE_STORAGE_DIR ?? DEFAULT_FILE_STORAGE_DIR;
}

/** Максимальный размер загружаемого файла в байтах. */
export function getFileMaxSizeBytes(): number {
  const parsed = Number(process.env.FILE_MAX_SIZE_BYTES);
  const value = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_FILE_MAX_SIZE_BYTES;
  return Math.min(value, MAX_INT32);
}
