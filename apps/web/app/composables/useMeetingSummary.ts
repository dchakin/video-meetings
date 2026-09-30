import type { FetchError } from 'ofetch';

/** Статус выжимки встречи — зеркало enum `MeetingSummaryStatus` из API. */
export enum MeetingSummaryStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  ERROR = 'ERROR',
}

/** Интервал опроса выжимки, пока она генерируется. */
const SUMMARY_POLL_INTERVAL_MS = 3000;

const HTTP_NOT_FOUND = 404;

export interface MeetingSummaryActionItem {
  description: string;
  /** Как назван во встрече; `null`, если исполнитель не назван. */
  assignee: string | null;
}

/** Выжимка встречи — форма ответа API `GET /meetings/:id/summary`. */
export interface MeetingSummary {
  id: string;
  meetingId: string;
  status: MeetingSummaryStatus;
  summary: string | null;
  actionItems: MeetingSummaryActionItem[];
  decisions: string[];
  createdAt: string;
  updatedAt: string;
}

/** Загрузка выжимки встречи, ручной запуск генерации и опрос, пока статус «в процессе». */
export function useMeetingSummary(meetingId: string) {
  const api = useApi();

  const { data: summary, refresh } = useAsyncData(
    `meeting-${meetingId}-summary`,
    async () => {
      try {
        return await api<MeetingSummary>(`/meetings/${meetingId}/summary`);
      } catch (error) {
        // 404 — выжимка ещё не создавалась, это не ошибка.
        if ((error as FetchError).statusCode === HTTP_NOT_FOUND) return null;
        throw error;
      }
    },
    { default: () => null },
  );

  const isGenerating = computed(() => summary.value?.status === MeetingSummaryStatus.IN_PROGRESS);

  /** Запускает генерацию; ответ API (статус «в процессе») сразу попадает в состояние. */
  async function generate() {
    summary.value = await api<MeetingSummary>(`/meetings/${meetingId}/summary`, {
      method: 'POST',
    });
  }

  let intervalId: ReturnType<typeof setInterval> | null = null;

  function stopPolling() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  watch(
    isGenerating,
    (generating) => {
      // Опрос нужен только в браузере: на сервере `setInterval` в Nuxt 4.5+ выбрасывает ошибку.
      if (!import.meta.client) return;
      if (generating && intervalId === null) {
        intervalId = setInterval(
          () => void refresh().catch(() => undefined),
          SUMMARY_POLL_INTERVAL_MS,
        );
      } else if (!generating) {
        stopPolling();
      }
    },
    { immediate: true },
  );
  onUnmounted(stopPolling);

  return { summary, isGenerating, generate, refresh };
}
