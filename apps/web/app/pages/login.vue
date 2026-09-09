<script setup lang="ts">
import type { FetchError } from 'ofetch';
import type { FormError, FormSubmitEvent } from '@nuxt/ui';

const { login } = useAuth();
const toast = useToast();

interface LoginState {
  email: string;
  password: string;
}

const state = reactive<LoginState>({ email: '', password: '' });

const showPassword = ref(false);
const loading = ref(false);
const serverError = ref<string | null>(null);

function validate(s: LoginState): FormError[] {
  const errors: FormError[] = [];

  if (!s.email) {
    errors.push({ name: 'email', message: 'Укажите email' });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) {
    errors.push({ name: 'email', message: 'Некорректный email' });
  }

  if (!s.password) {
    errors.push({ name: 'password', message: 'Укажите пароль' });
  }

  return errors;
}

async function onSubmit(event: FormSubmitEvent<LoginState>) {
  serverError.value = null;
  loading.value = true;
  try {
    await login({ email: event.data.email, password: event.data.password });
    toast.add({
      title: 'Вход выполнен',
      color: 'success',
      icon: 'i-lucide-check',
    });
    await navigateTo('/');
  } catch (error) {
    const err = error as FetchError<{ message?: string | string[] }>;
    if (err.statusCode === 401) {
      serverError.value = 'Неверный email или пароль';
    } else {
      const message = err.data?.message;
      serverError.value = Array.isArray(message)
        ? message.join(', ')
        : (message ?? 'Не удалось выполнить вход. Попробуйте позже.');
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
          <h1 class="mt-2 font-display text-2xl font-semibold text-highlighted">С возвращением</h1>
          <p class="mt-2 text-sm text-muted">Войдите, чтобы продолжить работу со встречами</p>
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

          <UFormField name="password" label="Пароль" required>
            <UInput
              v-model="state.password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="Ваш пароль"
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

          <UButton
            type="submit"
            label="Войти"
            trailing-icon="i-lucide-arrow-right"
            size="lg"
            block
            :loading="loading"
            :ui="{ base: 'font-medium' }"
          />
        </UForm>

        <p class="mt-8 text-center text-sm text-muted">
          Нет аккаунта?
          <ULink to="/register" class="font-medium text-primary">Зарегистрироваться</ULink>
        </p>
      </div>
    </div>
  </div>
</template>
