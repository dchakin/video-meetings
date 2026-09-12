/** Публичное представление файла встречи — без внутреннего storagePath. */
export interface MeetingFileResponse {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
  uploadedById: string;
}
