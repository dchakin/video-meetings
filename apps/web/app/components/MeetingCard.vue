<script setup lang="ts">
import type { Meeting } from '~/composables/useMeetings';

const props = defineProps<{ meeting: Meeting }>();

const dateLabel = computed(() =>
  new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(props.meeting.date)),
);

const participantsLabel = computed(() => {
  const n = props.meeting.participants.length;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} участник`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} участника`;
  return `${n} участников`;
});
</script>

<template>
  <div
    class="flex h-full flex-col rounded-xl border border-default bg-elevated/40 p-4 transition-colors hover:border-primary/50"
  >
    <div class="flex items-start justify-between gap-3">
      <h3 class="font-medium text-highlighted">{{ meeting.title }}</h3>
      <UIcon name="i-lucide-video" class="mt-0.5 size-4 shrink-0 text-primary" />
    </div>

    <p class="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
      <UIcon name="i-lucide-calendar" class="size-3.5 shrink-0" />
      <span>{{ dateLabel }}</span>
    </p>

    <p
      v-if="meeting.participants.length"
      class="mt-3 flex items-center gap-1.5 text-sm text-dimmed"
    >
      <UIcon name="i-lucide-users" class="size-3.5 shrink-0" />
      <span>{{ participantsLabel }}</span>
    </p>
  </div>
</template>
