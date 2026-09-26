<script setup lang="ts">
const props = defineProps<{
  src?: string;
  alt: string;
  upload: (file: File) => Promise<void>;
}>();

// Правила должны совпадать с ALLOWED_AVATAR_MIME_TYPES / getAvatarMaxSizeBytes в API.
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

const toast = useToast();
const inputEl = ref<HTMLInputElement | null>(null);
const preview = ref<string | null>(null);
const uploading = ref(false);

function openDialog() {
  inputEl.value?.click();
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // разрешить повторный выбор того же файла

  if (!file) return;

  if (!ALLOWED_TYPES.includes(file.type)) {
    toast.add({
      title: 'Неподдерживаемый формат файла',
      description: 'Допустимые форматы: JPEG, PNG, WebP',
      color: 'error',
      icon: 'i-lucide-circle-alert',
    });
    return;
  }

  if (file.size > MAX_SIZE_BYTES) {
    toast.add({
      title: 'Файл слишком большой',
      description: 'Максимальный размер аватара — 5 МБ',
      color: 'error',
      icon: 'i-lucide-circle-alert',
    });
    return;
  }

  const previewUrl = URL.createObjectURL(file);
  preview.value = previewUrl;
  uploading.value = true;
  try {
    await props.upload(file);
  } catch {
    // ошибка уже показана вызывающей стороной
  } finally {
    URL.revokeObjectURL(previewUrl);
    preview.value = null;
    uploading.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <button
      type="button"
      class="group relative overflow-hidden rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary"
      :disabled="uploading"
      @click="openDialog"
    >
      <UAvatar :src="preview ?? src" :alt="alt" icon="i-lucide-user" size="xl" />
      <span
        class="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
        :class="{ 'opacity-100': uploading }"
      >
        <UIcon
          :name="uploading ? 'i-lucide-loader-2' : 'i-lucide-camera'"
          class="size-5"
          :class="{ 'animate-spin': uploading }"
        />
      </span>
    </button>

    <input
      ref="inputEl"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      class="hidden"
      @change="onFileSelected"
    >

    <UButton
      label="Изменить фото"
      color="neutral"
      variant="link"
      size="xs"
      :disabled="uploading"
      @click="openDialog"
    />
  </div>
</template>
