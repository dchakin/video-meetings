/** Файл встречи — форма ответа API `GET /meetings/:id/files`. */
export interface MeetingFile {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploadedById: string;
}

/** Работа с файлами встречи через авторизованный клиент API. */
export function useMeetingFiles(meetingId: string) {
  const api = useApi();

  const list = () => api<MeetingFile[]>(`/meetings/${meetingId}/files`);

  /** Скачивает файл через авторизованный запрос и отдаёт браузеру как обычную загрузку. */
  async function download(file: MeetingFile) {
    const blob = await api<Blob>(`/meetings/${meetingId}/files/${file.id}/download`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    try {
      link.click();
    } finally {
      link.remove();
      URL.revokeObjectURL(url);
    }
  }

  return { list, download };
}
