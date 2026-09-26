import { MeetingFileUploadError, type MeetingFile } from '~/composables/useMeetingFiles';

type UploadFn = (file: File, onProgress?: (percent: number) => void) => Promise<MeetingFile>;

/** Состояние формы загрузки файла встречи: выбор файла, drag&drop, прогресс, ошибка. */
export function useMeetingFileUpload(upload: UploadFn, onUploaded: (file: MeetingFile) => void) {
  const fileInput = ref<HTMLInputElement>();
  const isDraggingOver = ref(false);
  const isUploading = ref(false);
  const uploadProgress = ref(0);
  const uploadError = ref<string | null>(null);

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
      const uploaded = await upload(file, (percent) => (uploadProgress.value = percent));
      onUploaded(uploaded);
    } catch (error) {
      uploadError.value =
        error instanceof MeetingFileUploadError && error.statusCode === 413
          ? 'Файл слишком большой. Выберите файл меньшего размера.'
          : 'Не удалось загрузить файл. Проверьте соединение и попробуйте ещё раз.';
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
    if (isUploading.value) return;
    void uploadFile(event.dataTransfer?.files?.[0]);
  }

  return {
    fileInput,
    isDraggingOver,
    isUploading,
    uploadProgress,
    uploadError,
    openFilePicker,
    onFileInputChange,
    onDrop,
  };
}
