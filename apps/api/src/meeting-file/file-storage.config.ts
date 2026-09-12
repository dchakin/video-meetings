export const DEFAULT_FILE_STORAGE_DIR = 'storage/meeting-files';
export const DEFAULT_FILE_MAX_SIZE_BYTES = 10 * 1024 * 1024;

/** Директория хранения загруженных файлов (относительно cwd процесса, вне `dist`). */
export function getFileStorageDir(): string {
  return process.env.FILE_STORAGE_DIR ?? DEFAULT_FILE_STORAGE_DIR;
}

/** Максимальный размер загружаемого файла в байтах. */
export function getFileMaxSizeBytes(): number {
  const parsed = Number(process.env.FILE_MAX_SIZE_BYTES);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_FILE_MAX_SIZE_BYTES;
}
