<script setup lang="ts">
import type { FetchError } from 'ofetch';
import type { FormError, FormErrorEvent, FormSubmitEvent } from '@nuxt/ui';

definePageMeta({ middleware: 'auth' });

useHead({ title: 'Профиль' });

const config = useRuntimeConfig();
const { profile, load, updateName, updateAvatar, changePassword } = useProfile();
const toast = useToast();

const { pending, error, refresh } = await useAsyncData('profile', () => load());

/** Имя может быть не заполнено — тогда показываем локальную часть email. */
const displayName = computed(() => profile.value?.name || profile.value?.email.split('@')[0] || '');

/** `avatarUrl` от API — относительный путь, поэтому собираем абсолютный URL сами. */
const avatarSrc = computed(() =>
  profile.value?.avatarUrl ? `${config.public.apiBase}${profile.value.avatarUrl}` : undefined,
);

function extractErrorMessage(err: unknown, fallback: string): string {
  const error_ = err as FetchError<{ message?: string | string[] }>;
  const message = error_.data?.message;
  return Array.isArray(message) ? message.join(', ') : (message ?? fallback);
}

// Неудачная валидация формы: перевести фокус на первое поле с ошибкой.
async function onFormError(event: FormErrorEvent) {
  const id = event.errors?.[0]?.id;
  if (!id) return;
  await nextTick();
  const el = document.getElementById(id);
  el?.focus();
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// --- Аватар: правила должны совпадать с ALLOWED_AVATAR_MIME_TYPES / getAvatarMaxSizeBytes в API ---
const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024;

const avatarInput = ref<HTMLInputElement | null>(null);
const avatarPreview = ref<string | null>(null);
const avatarUploading = ref(false);

function openAvatarDialog() {
  avatarInput.value?.click();
}

async function onAvatarSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // разрешить повторный выбор того же файла

  if (!file) return;

  if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
    toast.add({
      title: 'Неподдерживаемый формат файла',
      description: 'Допустимые форматы: JPEG, PNG, WebP',
      color: 'error',
      icon: 'i-lucide-circle-alert',
    });
    return;
  }

  if (file.size > AVATAR_MAX_SIZE_BYTES) {
    toast.add({
      title: 'Файл слишком большой',
      description: 'Максимальный размер аватара — 5 МБ',
      color: 'error',
      icon: 'i-lucide-circle-alert',
    });
    return;
  }

  const previewUrl = URL.createObjectURL(file);
  avatarPreview.value = previewUrl;
  avatarUploading.value = true;
  try {
    await updateAvatar(file);
    toast.add({ title: 'Аватар обновлён', color: 'success', icon: 'i-lucide-check' });
  } catch (err) {
    toast.add({
      title: 'Не удалось обновить аватар',
      description: extractErrorMessage(err, 'Попробуйте позже.'),
      color: 'error',
      icon: 'i-lucide-circle-alert',
    });
  } finally {
    URL.revokeObjectURL(previewUrl);
    avatarPreview.value = null;
    avatarUploading.value = false;
  }
}

// --- Имя: правила должны совпадать с UpdateProfileNameDto в API (1–100 символов) ---
interface NameState {
  name: string;
}

const nameState = reactive<NameState>({ name: '' });
const nameLoading = ref(false);

watch(
  () => profile.value?.name,
  (name) => {
    nameState.name = name ?? '';
  },
  { immediate: true },
);

function validateName(s: NameState): FormError[] {
  const errors: FormError[] = [];
  const trimmed = s.name.trim();

  if (!trimmed) {
    errors.push({ name: 'name', message: 'Укажите имя' });
  } else if (trimmed.length > 100) {
    errors.push({ name: 'name', message: 'Максимум 100 символов' });
  }

  return errors;
}

async function onNameSubmit(event: FormSubmitEvent<NameState>) {
  nameLoading.value = true;
  try {
    await updateName(event.data.name.trim());
    toast.add({ title: 'Имя обновлено', color: 'success', icon: 'i-lucide-check' });
  } catch (err) {
    toast.add({
      title: 'Не удалось обновить имя',
      description: extractErrorMessage(err, 'Попробуйте позже.'),
      color: 'error',
      icon: 'i-lucide-circle-alert',
    });
  } finally {
    nameLoading.value = false;
  }
}

// --- Пароль: правила должны совпадать с ChangePasswordDto в API (newPassword — 8–72 символов) ---
interface PasswordState {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const passwordState = reactive<PasswordState>({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
});
const passwordLoading = ref(false);
const passwordServerError = ref<string | null>(null);
const passwordServerErrorRef = ref<HTMLElement | null>(null);

function validatePassword(s: PasswordState): FormError[] {
  const errors: FormError[] = [];

  if (!s.oldPassword) {
    errors.push({ name: 'oldPassword', message: 'Укажите текущий пароль' });
  }

  if (!s.newPassword) {
    errors.push({ name: 'newPassword', message: 'Укажите новый пароль' });
  } else if (s.newPassword.length < 8) {
    errors.push({ name: 'newPassword', message: 'Минимум 8 символов' });
  } else if (s.newPassword.length > 72) {
    errors.push({ name: 'newPassword', message: 'Максимум 72 символа' });
  }

  if (!s.confirmPassword) {
    errors.push({ name: 'confirmPassword', message: 'Повторите новый пароль' });
  } else if (s.confirmPassword !== s.newPassword) {
    errors.push({ name: 'confirmPassword', message: 'Пароли не совпадают' });
  }

  return errors;
}

async function onPasswordSubmit(event: FormSubmitEvent<PasswordState>) {
  passwordServerError.value = null;
  passwordLoading.value = true;
  try {
    await changePassword(event.data.oldPassword, event.data.newPassword);
    passwordState.oldPassword = '';
    passwordState.newPassword = '';
    passwordState.confirmPassword = '';
    toast.add({ title: 'Пароль изменён', color: 'success', icon: 'i-lucide-check' });
  } catch (err) {
    const fetchError = err as FetchError;
    passwordServerError.value =
      fetchError.statusCode === 401
        ? 'Неверный текущий пароль'
        : extractErrorMessage(err, 'Не удалось изменить пароль. Попробуйте позже.');
    await nextTick();
    passwordServerErrorRef.value?.focus();
    passwordServerErrorRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } finally {
    passwordLoading.value = false;
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
      v-if="error"
      class="mt-6"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Не удалось загрузить профиль"
      description="Проверьте, что API доступен, и попробуйте обновить страницу."
      :actions="[
        { label: 'Повторить', color: 'error', variant: 'outline', onClick: () => refresh() },
      ]"
    />

    <template v-else>
      <h1 class="mt-6 font-display text-3xl font-semibold tracking-tight text-highlighted">
        Профиль
      </h1>

      <UCard class="mt-6">
        <div v-if="pending" class="flex items-center gap-4">
          <USkeleton class="size-16 rounded-full" />
          <div class="space-y-2">
            <USkeleton class="h-5 w-40" />
            <USkeleton class="h-4 w-56" />
          </div>
        </div>

        <div v-else class="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div class="flex flex-col items-center gap-2">
            <button
              type="button"
              class="group relative overflow-hidden rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary"
              :disabled="avatarUploading"
              @click="openAvatarDialog"
            >
              <UAvatar
                :src="avatarPreview ?? avatarSrc"
                :alt="displayName"
                icon="i-lucide-user"
                size="xl"
              />
              <span
                class="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
                :class="{ 'opacity-100': avatarUploading }"
              >
                <UIcon
                  :name="avatarUploading ? 'i-lucide-loader-2' : 'i-lucide-camera'"
                  class="size-5"
                  :class="{ 'animate-spin': avatarUploading }"
                />
              </span>
            </button>

            <input
              ref="avatarInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="hidden"
              @change="onAvatarSelected"
            >

            <UButton
              label="Изменить фото"
              color="neutral"
              variant="link"
              size="xs"
              :disabled="avatarUploading"
              @click="openAvatarDialog"
            />
          </div>

          <div class="flex-1 space-y-6">
            <p class="flex items-center gap-1.5 text-sm text-muted">
              <UIcon name="i-lucide-mail" class="size-4" />
              <span>{{ profile?.email }}</span>
            </p>

            <UForm
              :state="nameState"
              :validate="validateName"
              class="max-w-sm space-y-3"
              @submit="onNameSubmit"
              @error="onFormError"
            >
              <UFormField name="name" label="Имя" required>
                <UInput
                  v-model="nameState.name"
                  placeholder="Ваше имя"
                  icon="i-lucide-user"
                  class="w-full"
                />
              </UFormField>

              <UButton type="submit" label="Сохранить имя" size="sm" :loading="nameLoading" />
            </UForm>
          </div>
        </div>
      </UCard>

      <UCard class="mt-6">
        <template #header>
          <h2 class="font-display text-lg font-semibold text-highlighted">Смена пароля</h2>
        </template>

        <UForm
          :state="passwordState"
          :validate="validatePassword"
          class="max-w-sm space-y-5"
          @submit="onPasswordSubmit"
          @error="onFormError"
        >
          <div
            v-if="passwordServerError"
            ref="passwordServerErrorRef"
            role="alert"
            tabindex="-1"
            class="rounded-lg outline-none"
          >
            <UAlert
              color="error"
              variant="subtle"
              icon="i-lucide-circle-alert"
              :title="passwordServerError"
            />
          </div>

          <UFormField name="oldPassword" label="Текущий пароль" required>
            <UInput
              v-model="passwordState.oldPassword"
              type="password"
              autocomplete="current-password"
              icon="i-lucide-lock"
              class="w-full"
            />
          </UFormField>

          <UFormField name="newPassword" label="Новый пароль" hint="8–72 символа" required>
            <UInput
              v-model="passwordState.newPassword"
              type="password"
              autocomplete="new-password"
              icon="i-lucide-lock"
              class="w-full"
            />
          </UFormField>

          <UFormField name="confirmPassword" label="Повторите новый пароль" required>
            <UInput
              v-model="passwordState.confirmPassword"
              type="password"
              autocomplete="new-password"
              icon="i-lucide-lock"
              class="w-full"
            />
          </UFormField>

          <UButton type="submit" label="Изменить пароль" :loading="passwordLoading" />
        </UForm>
      </UCard>
    </template>
  </UContainer>
</template>
