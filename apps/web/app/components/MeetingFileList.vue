<script setup lang="ts">
import type { MeetingFile } from '~/composables/useMeetingFiles';

const props = defineProps<{ files: MeetingFile[]; downloading: string | null }>();
const emit = defineEmits<{ download: [file: MeetingFile] }>();

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  const units = ['КБ', 'МБ', 'ГБ'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unitIndex]}`;
}
</script>

<template>
  <ul class="divide-y divide-default">
    <li
      v-for="file in props.files"
      :key="file.id"
      class="flex items-center justify-between gap-4 py-3"
    >
      <div class="flex min-w-0 items-center gap-3">
        <UIcon name="i-lucide-file" class="size-5 shrink-0 text-muted" />
        <div class="min-w-0">
          <p class="truncate font-medium text-highlighted">{{ file.fileName }}</p>
          <p class="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
            <span>{{ formatSize(file.size) }}</span>
            <span aria-hidden="true">·</span>
            <span>{{ dateFormatter.format(new Date(file.createdAt)) }}</span>
          </p>
        </div>
      </div>

      <UButton
        icon="i-lucide-download"
        label="Скачать"
        color="neutral"
        variant="outline"
        size="sm"
        :loading="downloading === file.id"
        @click="emit('download', file)"
      />
    </li>
  </ul>
</template>
