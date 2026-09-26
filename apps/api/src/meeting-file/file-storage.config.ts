// `@nestjs/config`-модуль читает `.env` только при построении графа модулей Nest — уже
// после того, как декораторы контроллеров (в т.ч. `FileInterceptor(...)` с лимитом размера)
// вычисляются при импорте файлов. Гарантируем `process.env` из `.env` независимо от порядка импортов.
import 'dotenv/config';

export const DEFAULT_FILE_STORAGE_DIR = 'storage/meeting-files';
export const DEFAULT_FILE_MAX_SIZE_BYTES = 10 * 1024 * 1024;
// `MeetingFile.size` — Prisma `Int` (PostgreSQL int4), максимум 2^31 - 1.
const MAX_INT32 = 2147483647;

/** Ограничения на файлы одной встречи — защита от неограниченного расхода диска/БД. */
export const MAX_FILES_PER_MEETING = 50;
export const MAX_TOTAL_SIZE_BYTES_PER_MEETING = 200 * 1024 * 1024;

/**
 * Разрешённые типы файлов встреч и расширение, под которым файл сохраняется на диске.
 * Расширение выбирается по проверенному mimetype, а не по присланному клиентом
 * originalName — иначе можно сохранить произвольные байты под расширением вроде `.html`
 * или `.svg` и получить их исполнение/XSS при раздаче. HTML и SVG сознательно не входят
 * в список — оба могут исполнять script при открытии напрямую в браузере.
 */
export const MEETING_FILE_MIME_TYPE_EXTENSIONS: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/zip': '.zip',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  // Форматы записи встреч — для них после загрузки автоматически запускается локальная
  // транскрибация через Whisper (см. `transcription/whisper-transcription.service.ts`).
  'video/mp4': '.mp4',
  'audio/mpeg': '.mp3',
};
export const ALLOWED_MEETING_FILE_MIME_TYPES = Object.keys(MEETING_FILE_MIME_TYPE_EXTENSIONS);

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
