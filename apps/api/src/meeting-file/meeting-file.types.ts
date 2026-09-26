import { TranscriptionStatus } from '@prisma/client';

/** Публичное представление файла встречи — без внутреннего storagePath. */
export interface MeetingFileResponse {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
  uploadedById: string;
  /** `null` — транскрибация неприменима (файл не video/mp4 и не audio/mpeg). */
  transcriptionStatus: TranscriptionStatus | null;
  /** Заполняется только после успешного завершения транскрибации (`transcriptionStatus === DONE`). */
  transcriptionText: string | null;
}
