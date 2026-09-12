<script setup lang="ts">
import type { FetchError } from 'ofetch';
import type { MeetingFile } from '~/composables/useMeetingFiles';

definePageMeta({ middleware: 'auth' });

const route = useRoute();
const meetingId = route.params.id as string;

const { user } = useAuth();
const { get } = useMeetings();
const { list, download } = useMeetingFiles(meetingId);

const {
  data: meeting,
  pending: meetingPending,
  error: meetingError,
  refresh: refreshMeeting,
} = await useAsyncData(`meeting-${meetingId}`, () => get(meetingId));

/** 404 — встречи нет или нет доступа; любой другой сбой — сетевая/серверная ошибка. */
const meetingNotFound = computed(
  () => (meetingError.value as FetchError | null)?.statusCode === 404,
);

useHead({ title: () => meeting.value?.title ?? 'Встреча' });

const isOwner = computed(() => Boolean(meeting.value && meeting.value.ownerId === user.value?.sub));

const {
  data: files,
  pending: filesPending,
  error: filesError,
  refresh: refreshFiles,
} = await useAsyncData(`meeting-${meetingId}-files`, () => list(), {
  default: () => [],
});

const dateLabel = computed(() =>
  meeting.value
    ? new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(meeting.value.date))
    : '',
);

const toast = useToast();
const downloadingId = ref<string | null>(null);

async function onDownload(file: MeetingFile) {
  downloadingId.value = file.id;
  try {
    await download(file);
  } catch {
    toast.add({
      title: 'Не удалось скачать файл',
      description: 'Проверьте соединение и попробуйте ещё раз.',
      color: 'error',
      icon: 'i-lucide-circle-alert',
    });
  } finally {
    downloadingId.value = null;
  }
}
</script>

<template>
  <UContainer class="py-10 sm:py-14">
    <UButton
      to="/"
      icon="i-lucide-arrow-left"
      label="Мои встречи"
      color="neutral"
      variant="link"
      class="px-0"
    />

    <UAlert
      v-if="meetingNotFound"
      class="mt-6"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Встреча не найдена"
      description="Она не существует или у вас нет к ней доступа."
    />

    <UAlert
      v-else-if="meetingError"
      class="mt-6"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Не удалось загрузить встречу"
      description="Проверьте, что API доступен, и попробуйте обновить страницу."
      :actions="[
        { label: 'Повторить', color: 'error', variant: 'outline', onClick: () => refreshMeeting() },
      ]"
    />

    <template v-else>
      <header class="mt-6">
        <USkeleton v-if="meetingPending" class="h-9 w-64" />
        <h1 v-else class="font-display text-3xl font-semibold tracking-tight text-highlighted">
          {{ meeting?.title }}
        </h1>

        <p v-if="!meetingPending" class="mt-2 flex items-center gap-1.5 text-sm text-muted">
          <UIcon name="i-lucide-calendar" class="size-4" />
          <span>{{ dateLabel }}</span>
        </p>
      </header>

      <section class="mt-10">
        <div class="flex items-center justify-between gap-3">
          <h2 class="font-display text-lg font-semibold text-highlighted">Файлы встречи</h2>
          <UButton
            v-if="isOwner"
            icon="i-lucide-upload"
            label="Загрузить файл"
            size="sm"
            disabled
            title="Загрузка файлов появится в следующем обновлении"
          />
        </div>

        <UAlert
          v-if="filesError"
          class="mt-4"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="Не удалось загрузить список файлов"
          description="Проверьте, что API доступен, и попробуйте обновить страницу."
          :actions="[
            {
              label: 'Повторить',
              color: 'error',
              variant: 'outline',
              onClick: () => refreshFiles(),
            },
          ]"
        />

        <div v-else-if="filesPending" class="mt-4 space-y-3">
          <USkeleton v-for="i in 3" :key="i" class="h-12 rounded-lg" />
        </div>

        <div
          v-else-if="!files.length"
          class="mt-4 flex flex-col items-center rounded-xl border border-dashed border-default px-6 py-12 text-center"
        >
          <div class="flex size-12 items-center justify-center rounded-full bg-elevated text-muted">
            <UIcon name="i-lucide-file" class="size-6" />
          </div>
          <p class="mt-4 font-medium text-highlighted">Файлов пока нет</p>
        </div>

        <MeetingFileList
          v-else
          :files="files"
          :downloading="downloadingId"
          @download="onDownload"
        />
      </section>
    </template>
  </UContainer>
</template>
