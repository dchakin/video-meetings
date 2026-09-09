<script setup lang="ts">
import type { FetchError } from 'ofetch';
import type { FormError, FormSubmitEvent } from '@nuxt/ui';

const { register } = useAuth();
const toast = useToast();

interface RegisterState {
  email: string;
  password: string;
  confirmPassword: string;
}

const state = reactive<RegisterState>({
  email: '',
  password: '',
  confirmPassword: '',
});

const showPassword = ref(false);
const loading = ref(false);
const serverError = ref<string | null>(null);

// Правила должны совпадать с AuthCredentialsDto в API: валидный email,
// пароль от 8 до 72 символов.
function validate(s: RegisterState): FormError[] {
  const errors: FormError[] = [];

  if (!s.email) {
    errors.push({ name: 'email', message: 'Укажите email' });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) {
    errors.push({ name: 'email', message: 'Некорректный email' });
  }

  if (!s.password) {
    errors.push({ name: 'password', message: 'Укажите пароль' });
  } else if (s.password.length < 8) {
    errors.push({ name: 'password', message: 'Минимум 8 символов' });
  } else if (s.password.length > 72) {
    errors.push({ name: 'password', message: 'Максимум 72 символа' });
  }

  if (s.confirmPassword !== s.password) {
    errors.push({ name: 'confirmPassword', message: 'Пароли не совпадают' });
  }

  return errors;
}

async function onSubmit(event: FormSubmitEvent<RegisterState>) {
  serverError.value = null;
  loading.value = true;
  try {
    await register({ email: event.data.email, password: event.data.password });
    toast.add({
      title: 'Аккаунт создан',
      description: 'Добро пожаловать в Video Meetings!',
      color: 'success',
      icon: 'i-lucide-check',
    });
    await navigateTo('/');
  } catch (error) {
    const err = error as FetchError<{ message?: string | string[] }>;
    if (err.statusCode === 409) {
      serverError.value = 'Пользователь с таким email уже зарегистрирован';
    } else {
      const message = err.data?.message;
      serverError.value = Array.isArray(message)
        ? message.join(', ')
        : (message ?? 'Не удалось выполнить регистрацию. Попробуйте позже.');
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div
    class="relative flex min-h-dvh items-center justify-center overflow-hidden bg-default px-4 py-12"
  >
    <AuthBackdrop />

    <div class="relative w-full max-w-md">
      <div
        class="rounded-3xl border border-default/60 bg-default/80 p-8 shadow-2xl shadow-primary/5 backdrop-blur-xl sm:p-10"
      >
        <div class="flex flex-col items-center text-center">
          <div
            class="flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-primary/60 text-inverted shadow-lg shadow-primary/30 ring-1 ring-inset ring-white/20"
          >
            <UIcon name="i-lucide-video" class="size-7" />
          </div>
          <p class="mt-5 text-xs font-medium uppercase tracking-[0.2em] text-primary">
            Video Meetings
          </p>
          <h1 class="mt-2 font-display text-2xl font-semibold text-highlighted">
            Создайте аккаунт
          </h1>
          <p class="mt-2 text-sm text-muted">
            Планируйте видеовстречи и управляйте ими в одном месте
          </p>
        </div>

        <UForm :state="state" :validate="validate" class="mt-8 space-y-5" @submit="onSubmit">
          <UAlert
            v-if="serverError"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="serverError"
          />

          <UFormField name="email" label="Email" required>
            <UInput
              v-model="state.email"
              type="email"
              autocomplete="email"
              autofocus
              placeholder="you@example.com"
              icon="i-lucide-mail"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <UFormField name="password" label="Пароль" hint="8–72 символа" required>
            <UInput
              v-model="state.password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="new-password"
              placeholder="Придумайте пароль"
              icon="i-lucide-lock"
              size="lg"
              class="w-full"
              :ui="{ trailing: 'pe-1' }"
            >
              <template #trailing>
                <UButton
                  color="neutral"
                  variant="link"
                  size="sm"
                  :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  :aria-label="showPassword ? 'Скрыть пароль' : 'Показать пароль'"
                  @click="showPassword = !showPassword"
                />
              </template>
            </UInput>
          </UFormField>

          <UFormField name="confirmPassword" label="Повторите пароль" required>
            <UInput
              v-model="state.confirmPassword"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="new-password"
              placeholder="Повторите пароль"
              icon="i-lucide-lock"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <UButton
            type="submit"
            label="Зарегистрироваться"
            trailing-icon="i-lucide-arrow-right"
            size="lg"
            block
            :loading="loading"
            :ui="{ base: 'font-medium' }"
          />
        </UForm>

        <p class="mt-8 text-center text-sm text-muted">
          Уже есть аккаунт?
          <ULink to="/login" class="font-medium text-primary">Войти</ULink>
        </p>
      </div>
    </div>
  </div>
</template>
