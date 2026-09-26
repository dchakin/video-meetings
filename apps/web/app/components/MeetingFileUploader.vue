<script setup lang="ts">
import type { MeetingFile } from '~/composables/useMeetingFiles';

const props = defineProps<{
  upload: (file: File, onProgress?: (percent: number) => void) => Promise<MeetingFile>;
}>();
const emit = defineEmits<{ uploaded: [file: MeetingFile] }>();

const {
  fileInput,
  isDraggingOver,
  isUploading,
  uploadProgress,
  uploadError,
  openFilePicker,
  onFileInputChange,
  onDrop,
} = useMeetingFileUpload(props.upload, (file) => emit('uploaded', file));

defineExpose({ openFilePicker, isUploading });
</script>

<template>
  <div>
    <input ref="fileInput" type="file" class="hidden" @change="onFileInputChange" >

    <div
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
  </div>
</template>
