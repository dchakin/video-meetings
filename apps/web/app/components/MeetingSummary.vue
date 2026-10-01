<script setup lang="ts">
import { hasPendingTranscription, type MeetingFile } from '~/composables/useMeetingFiles';
import { MeetingSummaryStatus } from '~/composables/useMeetingSummary';

const props = defineProps<{ meetingId: string; files: MeetingFile[] }>();

const toast = useToast();
const isTranscribing = computed(() => hasPendingTranscription(props.files));
const { summary, isGenerating, retryGeneration, refresh } = useMeetingSummary(
  props.meetingId,
  isTranscribing,
);

const isDone = computed(() => summary.value?.status === MeetingSummaryStatus.DONE);
const isError = computed(() => summary.value?.status === MeetingSummaryStatus.ERROR);
const isWaitingForTranscription = computed(() => isTranscribing.value && !isGenerating.value);
/** Блок нужен, только когда есть что показать или что ожидать. */
const isVisible = computed(() => Boolean(summary.value) || isTranscribing.value);

const isRetrying = ref(false);

async function onRetry() {
  isRetrying.value = true;
  try {
    await retryGeneration();
  } catch {
    toast.add({
      title: 'Не удалось запустить генерацию',
      description: 'Проверьте соединение и попробуйте ещё раз.',
      color: 'error',
      icon: 'i-lucide-circle-alert',
    });
    await refresh().catch(() => undefined);
  } finally {
    isRetrying.value = false;
  }
}
</script>

<template>
  <section v-if="isVisible" class="mt-10">
    <h2 class="font-display text-lg font-semibold text-highlighted">Выжимка встречи</h2>

    <UAlert
      v-if="isGenerating"
      class="mt-4"
      color="info"
      variant="subtle"
      icon="i-lucide-loader-circle"
      title="Анализируем встречу…"
      description="Выжимка, задачи и решения появятся автоматически."
    />

    <UAlert
      v-else-if="isWaitingForTranscription"
      class="mt-4"
      color="neutral"
      variant="subtle"
      icon="i-lucide-audio-lines"
      title="Ждём завершения транскрибации"
      description="Как только файлы будут расшифрованы, мы подготовим выжимку, задачи и решения."
    />

    <UAlert
      v-else-if="isError"
      class="mt-4"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Не удалось подготовить выжимку"
      description="Попробуйте ещё раз."
      :actions="[
        {
          label: 'Повторить',
          icon: 'i-lucide-refresh-cw',
          color: 'error',
          variant: 'outline',
          size: 'sm',
          loading: isRetrying,
          disabled: isRetrying,
          onClick: onRetry,
        },
      ]"
    />

    <div v-else-if="isDone && summary" class="mt-4 space-y-6">
      <div>
        <h3 class="text-sm font-semibold text-highlighted">Summary</h3>
        <p v-if="summary.summary" class="mt-1 whitespace-pre-line text-sm text-default">
          {{ summary.summary }}
        </p>
        <p v-else class="mt-1 text-sm text-muted">Нет</p>
      </div>

      <div>
        <h3 class="text-sm font-semibold text-highlighted">Action items</h3>
        <ul v-if="summary.actionItems.length" class="mt-1 space-y-2">
          <li
            v-for="(item, index) in summary.actionItems"
            :key="index"
            class="flex items-start gap-2 text-sm"
          >
            <UIcon name="i-lucide-circle-check" class="mt-0.5 size-4 shrink-0 text-muted" />
            <span class="text-default">
              {{ item.description }}
              <span v-if="item.assignee" class="text-muted">— {{ item.assignee }}</span>
            </span>
          </li>
        </ul>
        <p v-else class="mt-1 text-sm text-muted">Нет</p>
      </div>

      <div>
        <h3 class="text-sm font-semibold text-highlighted">Принятые решения</h3>
        <ul v-if="summary.decisions.length" class="mt-1 list-disc space-y-1 pl-5 text-sm">
          <li v-for="(decision, index) in summary.decisions" :key="index" class="text-default">
            {{ decision }}
          </li>
        </ul>
        <p v-else class="mt-1 text-sm text-muted">Нет</p>
      </div>
    </div>
  </section>
</template>
