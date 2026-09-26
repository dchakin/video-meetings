<script setup lang="ts">
import type { FetchError } from 'ofetch';
import type { FormError, FormSubmitEvent } from '@nuxt/ui';

const props = defineProps<{
  changePassword: (oldPassword: string, newPassword: string) => Promise<unknown>;
}>();

const toast = useToast();
const { serverError, serverErrorRef, setServerError, onFormError } = useFormServerError();

// Правила должны совпадать с ChangePasswordDto в API (newPassword — 8–72 символов).
interface PasswordState {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const state = reactive<PasswordState>({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
});
const loading = ref(false);

function validate(s: PasswordState): FormError[] {
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

async function onSubmit(event: FormSubmitEvent<PasswordState>) {
  loading.value = true;
  try {
    await props.changePassword(event.data.oldPassword, event.data.newPassword);
    state.oldPassword = '';
    state.newPassword = '';
    state.confirmPassword = '';
    toast.add({ title: 'Пароль изменён', color: 'success', icon: 'i-lucide-check' });
  } catch (err) {
    const fetchError = err as FetchError;
    await setServerError(
      fetchError.statusCode === 401
        ? 'Неверный текущий пароль'
        : extractErrorMessage(err, 'Не удалось изменить пароль. Попробуйте позже.'),
    );
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-display text-lg font-semibold text-highlighted">Смена пароля</h2>
    </template>

    <UForm
      :state="state"
      :validate="validate"
      class="max-w-sm space-y-5"
      @submit="onSubmit"
      @error="onFormError"
    >
      <div
        v-if="serverError"
        ref="serverErrorRef"
        role="alert"
        tabindex="-1"
        class="rounded-lg outline-none"
      >
        <UAlert color="error" variant="subtle" icon="i-lucide-circle-alert" :title="serverError" />
      </div>

      <UFormField name="oldPassword" label="Текущий пароль" required>
        <UInput
          v-model="state.oldPassword"
          type="password"
          autocomplete="current-password"
          icon="i-lucide-lock"
          class="w-full"
        />
      </UFormField>

      <UFormField name="newPassword" label="Новый пароль" hint="8–72 символа" required>
        <UInput
          v-model="state.newPassword"
          type="password"
          autocomplete="new-password"
          icon="i-lucide-lock"
          class="w-full"
        />
      </UFormField>

      <UFormField name="confirmPassword" label="Повторите новый пароль" required>
        <UInput
          v-model="state.confirmPassword"
          type="password"
          autocomplete="new-password"
          icon="i-lucide-lock"
          class="w-full"
        />
      </UFormField>

      <UButton type="submit" label="Изменить пароль" :loading="loading" />
    </UForm>
  </UCard>
</template>
