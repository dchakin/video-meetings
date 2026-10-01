import type { FetchError } from 'ofetch';

/** Статус выжимки встречи — зеркало enum `MeetingSummaryStatus` из API. */
export enum MeetingSummaryStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  ERROR = 'ERROR',
}

/** Интервал опроса выжимки, пока идёт транскрибация/генерация. */
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

/**
 * Сколько ждать автозапуска генерации после завершения транскрибации: выжимка стартует на бэкенде
 * сама, но если готовых транскрипций нет (все упали) — статус так и не появится.
 */
const AUTO_START_WAIT_MS = 15000;

/**
 * Загрузка выжимки встречи. Генерацию запускает бэкенд сам после транскрибации, поэтому опрос идёт,
 * пока транскрибация не завершена, пока ждём автозапуска и пока статус «в процессе».
 */
export function useMeetingSummary(meetingId: string, isTranscribing: Ref<boolean>) {
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
  const isAwaitingAutoStart = ref(false);
  let updatedAtBeforeWait: string | null = null;
  let awaitTimeoutId: ReturnType<typeof setTimeout> | null = null;

  function stopAwaiting() {
    isAwaitingAutoStart.value = false;
    if (awaitTimeoutId !== null) {
      clearTimeout(awaitTimeoutId);
      awaitTimeoutId = null;
    }
  }

  function startAwaiting() {
    if (!import.meta.client) return;
    updatedAtBeforeWait = summary.value?.updatedAt ?? null;
    isAwaitingAutoStart.value = true;
    awaitTimeoutId = setTimeout(stopAwaiting, AUTO_START_WAIT_MS);
  }

  /** Повторно запускает генерацию (после ошибки); ответ API (статус «в процессе») сразу попадает в состояние. */
  async function retryGeneration() {
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

  const shouldPoll = computed(
    () => isTranscribing.value || isGenerating.value || isAwaitingAutoStart.value,
  );

  watch(isTranscribing, (transcribing, wasTranscribing) => {
    if (wasTranscribing && !transcribing) startAwaiting();
  });

  // Автозапуск замечен (идёт генерация или выжимка обновилась) — дальше опрашиваем по статусу.
  watch(summary, (current) => {
    if (!isAwaitingAutoStart.value) return;
    if (current?.status === MeetingSummaryStatus.IN_PROGRESS) stopAwaiting();
    else if (current && current.updatedAt !== updatedAtBeforeWait) stopAwaiting();
  });

  watch(
    shouldPoll,
    (polling) => {
      // Опрос нужен только в браузере: на сервере `setInterval` в Nuxt 4.5+ выбрасывает ошибку.
      if (!import.meta.client) return;
      if (polling && intervalId === null) {
        intervalId = setInterval(
          () => void refresh().catch(() => undefined),
          SUMMARY_POLL_INTERVAL_MS,
        );
      } else if (!polling) {
        stopPolling();
      }
    },
    { immediate: true },
  );
  onUnmounted(() => {
    stopPolling();
    stopAwaiting();
  });

  return { summary, isGenerating, retryGeneration, refresh };
}
