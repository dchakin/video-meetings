/** Статус транскрибации файла встречи — зеркало enum `TranscriptionStatus` из API. */
export enum TranscriptionStatus {
  QUEUED = 'QUEUED',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  ERROR = 'ERROR',
}

/** Интервал опроса списка файлов встречи, пока есть незавершённая транскрибация. */
const TRANSCRIPTION_POLL_INTERVAL_MS = 5000;

/** Файл встречи — форма ответа API `GET /meetings/:id/files`. */
export interface MeetingFile {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploadedById: string;
  /** `null` — файл не подлежит транскрибации (формат отличен от mp4/mp3). */
  transcriptionStatus: TranscriptionStatus | null;
  /** Текст транскрипции; заполнен только при `transcriptionStatus === DONE`. */
  transcriptionText: string | null;
}

/** Есть ли среди файлов хотя бы один с незавершённой транскрибацией. */
function hasPendingTranscription(files: MeetingFile[]): boolean {
  return files.some(
    (file) =>
      file.transcriptionStatus === TranscriptionStatus.QUEUED ||
      file.transcriptionStatus === TranscriptionStatus.IN_PROGRESS,
  );
}

/**
 * Периодически перезапрашивает список файлов встречи, пока хотя бы у одного из них
 * транскрибация не завершена (статус `QUEUED` или `IN_PROGRESS`). Опрос останавливается
 * автоматически, когда незавершённых файлов не остаётся, а также при размонтировании
 * компонента.
 */
export function useTranscriptionPolling(
  files: Ref<MeetingFile[] | null | undefined>,
  refresh: () => Promise<unknown>,
) {
  let intervalId: ReturnType<typeof setInterval> | null = null;

  function stopPolling() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function syncPolling() {
    // Опрос нужен только в браузере: на сервере `setInterval` в Nuxt 4.5+ выбрасывает ошибку.
    if (!import.meta.client) return;
    const isPending = hasPendingTranscription(files.value ?? []);
    if (isPending && intervalId === null) {
      intervalId = setInterval(() => void refresh(), TRANSCRIPTION_POLL_INTERVAL_MS);
    } else if (!isPending) {
      stopPolling();
    }
  }

  watch(files, syncPolling, { immediate: true, deep: true });
  onUnmounted(stopPolling);

  return { stopPolling };
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
