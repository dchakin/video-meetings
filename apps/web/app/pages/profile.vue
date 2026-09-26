<script setup lang="ts">
import type { FormError, FormSubmitEvent } from '@nuxt/ui';

definePageMeta({ middleware: 'auth' });

useHead({ title: 'Профиль' });

const { profile, displayName, avatarSrc, load, updateName, updateAvatar, changePassword } =
  useProfile();
const toast = useToast();
const { showError } = useErrorToast();
const { onFormError } = useFormServerError();

const { pending, error, refresh } = await useAsyncData('profile', () => load());

async function onAvatarUpload(file: File) {
  try {
    await updateAvatar(file);
    toast.add({ title: 'Аватар обновлён', color: 'success', icon: 'i-lucide-check' });
  } catch (err) {
    showError('Не удалось обновить аватар', err, 'Попробуйте позже.');
    throw err;
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
    showError('Не удалось обновить имя', err, 'Попробуйте позже.');
  } finally {
    nameLoading.value = false;
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
          <AvatarUploader :src="avatarSrc" :alt="displayName" :upload="onAvatarUpload" />

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

      <ChangePasswordForm class="mt-6" :change-password="changePassword" />
    </template>
  </UContainer>
</template>
