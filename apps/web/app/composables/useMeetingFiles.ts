/** Файл встречи — форма ответа API `GET /meetings/:id/files`. */
export interface MeetingFile {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploadedById: string;
}

/** Ошибка загрузки файла со статусом HTTP-ответа (когда он известен). */
export class MeetingFileUploadError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'MeetingFileUploadError';
  }
}

/** Работа с файлами встречи через авторизованный клиент API. */
export function useMeetingFiles(meetingId: string) {
  const api = useApi();
  const config = useRuntimeConfig();
  const { token, logout } = useAuth();

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

  /**
   * Загружает файл с отслеживанием прогресса (0-100). `$fetch` не отдаёт прогресс
   * отправки, поэтому используется `XMLHttpRequest` напрямую.
   */
  function upload(file: File, onProgress?: (percent: number) => void): Promise<MeetingFile> {
    return new Promise((resolve, reject) => {
      const body = new FormData();
      body.append('file', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${config.public.apiBase}/meetings/${meetingId}/files`);
      if (token.value) {
        xhr.setRequestHeader('Authorization', `Bearer ${token.value}`);
      }

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          onProgress?.(Math.round((event.loaded / event.total) * 100));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText) as MeetingFile);
          } catch {
            reject(new MeetingFileUploadError('Malformed response body'));
          }
          return;
        }

        if (xhr.status === 401) {
          logout();
          void navigateTo('/login');
        }
        reject(new MeetingFileUploadError(`Upload failed with status ${xhr.status}`, xhr.status));
      });

      xhr.addEventListener('error', () => {
        reject(new MeetingFileUploadError('Network error during upload'));
      });

      xhr.send(body);
    });
  }

  const remove = (file: MeetingFile) =>
    api(`/meetings/${meetingId}/files/${file.id}`, { method: 'DELETE' });

  return { list, download, upload, remove };
}
