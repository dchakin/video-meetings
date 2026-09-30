<script setup lang="ts">
import { TranscriptionStatus, type MeetingFile } from '~/composables/useMeetingFiles';
import { MeetingSummaryStatus } from '~/composables/useMeetingSummary';

const props = defineProps<{ meetingId: string; files: MeetingFile[] }>();

const toast = useToast();
const { summary, isGenerating, generate, refresh } = useMeetingSummary(props.meetingId);

const hasReadyTranscription = computed(() =>
  props.files.some((file) => file.transcriptionStatus === TranscriptionStatus.DONE),
);

const isDone = computed(() => summary.value?.status === MeetingSummaryStatus.DONE);
const isError = computed(() => summary.value?.status === MeetingSummaryStatus.ERROR);

const buttonLabel = computed(() =>
  isDone.value || isError.value ? 'Перегенерировать выжимку' : 'Сгенерировать выжимку',
);

const isStarting = ref(false);

async function onGenerate() {
  isStarting.value = true;
  try {
    await generate();
  } catch {
    toast.add({
      title: 'Не удалось запустить генерацию',
      description: 'Проверьте соединение и попробуйте ещё раз.',
      color: 'error',
      icon: 'i-lucide-circle-alert',
    });
    await refresh().catch(() => undefined);
  } finally {
    isStarting.value = false;
  }
}
</script>

<template>
  <section class="mt-10">
    <div class="flex items-center justify-between gap-3">
      <h2 class="font-display text-lg font-semibold text-highlighted">Выжимка встречи</h2>
      <UButton
        icon="i-lucide-sparkles"
        size="sm"
        :label="buttonLabel"
        :loading="isStarting || isGenerating"
        :disabled="!hasReadyTranscription || isStarting || isGenerating"
        @click="onGenerate"
      />
    </div>

    <p v-if="!hasReadyTranscription && !isGenerating" class="mt-2 text-sm text-muted">
      Выжимку можно сгенерировать после готовой транскрибации хотя бы одного файла.
    </p>

    <UAlert
      v-if="isGenerating"
      class="mt-4"
      color="info"
      variant="subtle"
      icon="i-lucide-loader-circle"
      title="Выжимка генерируется…"
      description="Статус обновится автоматически."
    />

    <UAlert
      v-else-if="isError"
      class="mt-4"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Не удалось сгенерировать выжимку"
      description="Попробуйте перегенерировать её ещё раз."
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
