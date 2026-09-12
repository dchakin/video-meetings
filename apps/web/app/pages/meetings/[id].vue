<script setup lang="ts">
import type { FetchError } from 'ofetch';
import { MeetingFileUploadError, type MeetingFile } from '~/composables/useMeetingFiles';

definePageMeta({ middleware: 'auth' });

const route = useRoute();
const meetingId = route.params.id as string;

const { user } = useAuth();
const { get } = useMeetings();
const { list, download, upload, remove } = useMeetingFiles(meetingId);

// Запросы стартуют одновременно — await Promise.all ждёт оба, а не один за другим.
const meetingAsync = useAsyncData(`meeting-${meetingId}`, () => get(meetingId));
const filesAsync = useAsyncData(`meeting-${meetingId}-files`, () => list(), {
  default: () => [],
});
await Promise.all([meetingAsync, filesAsync]);

const {
  data: meeting,
  pending: meetingPending,
  error: meetingError,
  refresh: refreshMeeting,
} = meetingAsync;
const { data: files, pending: filesPending, error: filesError, refresh: refreshFiles } = filesAsync;

/** 404 — встречи нет или нет доступа; любой другой сбой — сетевая/серверная ошибка. */
const meetingNotFound = computed(
  () => (meetingError.value as FetchError | null)?.statusCode === 404,
);

useHead({ title: () => meeting.value?.title ?? 'Встреча' });

const isOwner = computed(() => Boolean(meeting.value && meeting.value.ownerId === user.value?.sub));

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

const fileInput = ref<HTMLInputElement>();
const isDraggingOver = ref(false);
const isUploading = ref(false);
const uploadProgress = ref(0);
const uploadError = ref<string | null>(null);
const deletingId = ref<string | null>(null);

function openFilePicker() {
  fileInput.value?.click();
}

async function uploadFile(file: File | undefined) {
  uploadError.value = null;
  if (!file) {
    uploadError.value = 'Файл не выбран.';
    return;
  }

  isUploading.value = true;
  uploadProgress.value = 0;
  try {
    await upload(file, (percent) => (uploadProgress.value = percent));
    await refreshFiles();
  } catch (error) {
    if (error instanceof MeetingFileUploadError && error.statusCode === 413) {
      uploadError.value = 'Файл слишком большой. Выберите файл меньшего размера.';
    } else {
      uploadError.value = 'Не удалось загрузить файл. Проверьте соединение и попробуйте ещё раз.';
    }
  } finally {
    isUploading.value = false;
  }
}

function onFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement;
  void uploadFile(input.files?.[0]);
  input.value = '';
}

function onDrop(event: DragEvent) {
  isDraggingOver.value = false;
  void uploadFile(event.dataTransfer?.files?.[0]);
}

async function onRemove(file: MeetingFile) {
  deletingId.value = file.id;
  try {
    await remove(file);
    await refreshFiles();
  } catch {
    toast.add({
      title: 'Не удалось удалить файл',
      description: 'Проверьте соединение и попробуйте ещё раз.',
      color: 'error',
      icon: 'i-lucide-circle-alert',
    });
  } finally {
    deletingId.value = null;
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
            :loading="isUploading"
            @click="openFilePicker"
          />
        </div>

        <input
          v-if="isOwner"
          ref="fileInput"
          type="file"
          class="hidden"
          @change="onFileInputChange"
        >

        <div
          v-if="isOwner"
          class="mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors"
          :class="isDraggingOver ? 'border-primary bg-primary/5' : 'border-default'"
          @dragover.prevent="isDraggingOver = true"
          @dragleave.prevent="isDraggingOver = false"
          @drop.prevent="onDrop"
        >
          <UIcon name="i-lucide-upload-cloud" class="size-6 text-muted" />
          <p class="mt-2 text-sm text-muted">
            Перетащите файл сюда или
            <UButton
              variant="link"
              size="sm"
              class="px-1"
              label="выберите на устройстве"
              :disabled="isUploading"
              @click="openFilePicker"
            />
          </p>

          <div v-if="isUploading" class="mt-3 w-full max-w-xs">
            <UProgress :model-value="uploadProgress" size="sm" />
            <p class="mt-1 text-xs text-muted">Загрузка… {{ uploadProgress }}%</p>
          </div>
        </div>

        <UAlert
          v-if="uploadError"
          class="mt-4"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="uploadError"
          :close="{ onClick: () => (uploadError = null) }"
        />

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
          :deletable="isOwner"
          :deleting="deletingId"
          @download="onDownload"
          @remove="onRemove"
        />
      </section>
    </template>
  </UContainer>
</template>
