<script setup lang="ts">
import type { FetchError } from 'ofetch';
import type { FormError, FormErrorEvent, FormSubmitEvent } from '@nuxt/ui';

definePageMeta({ middleware: 'guest' });

useHead({ title: 'Регистрация' });

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
const serverErrorRef = ref<HTMLElement | null>(null);

// Индикатор надёжности пароля: 0 — пусто, 1 — слабый … 4 — надёжный.
const passwordStrength = computed(() => {
  const value = state.password;
  if (!value) return 0;

  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/\d/.test(value) && /[a-zA-Zа-яА-ЯёЁ]/.test(value)) score++;
  if (/[^\w\s]/.test(value) || (/[a-zа-яё]/.test(value) && /[A-ZА-ЯЁ]/.test(value))) score++;

  return Math.min(score, 4);
});

const strengthMeta = computed(() => {
  return (
    [
      { label: 'Слабый', color: 'bg-error' },
      { label: 'Слабый', color: 'bg-error' },
      { label: 'Средний', color: 'bg-warning' },
      { label: 'Хороший', color: 'bg-warning' },
      { label: 'Надёжный', color: 'bg-success' },
    ][passwordStrength.value] ?? { label: 'Слабый', color: 'bg-error' }
  );
});

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

  if (!s.confirmPassword) {
    errors.push({ name: 'confirmPassword', message: 'Повторите пароль' });
  } else if (s.confirmPassword !== s.password) {
    errors.push({ name: 'confirmPassword', message: 'Пароли не совпадают' });
  }

  return errors;
}

// Неудачная валидация: перевести фокус на первое поле с ошибкой.
// nextTick — чтобы поля успели выйти из disabled после снятия loading у UForm.
async function onError(event: FormErrorEvent) {
  const id = event.errors?.[0]?.id;
  if (!id) return;
  await nextTick();
  const el = document.getElementById(id);
  el?.focus();
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    await nextTick();
    serverErrorRef.value?.focus();
    serverErrorRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

        <UForm
          :state="state"
          :validate="validate"
          class="mt-8 space-y-5"
          @submit="onSubmit"
          @error="onError"
        >
          <div
            v-if="serverError"
            ref="serverErrorRef"
            role="alert"
            tabindex="-1"
            class="rounded-lg outline-none"
          >
            <UAlert
              color="error"
              variant="subtle"
              icon="i-lucide-circle-alert"
              :title="serverError"
            />
          </div>

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
                  type="button"
                  color="neutral"
                  variant="link"
                  :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  :aria-label="showPassword ? 'Скрыть пароль' : 'Показать пароль'"
                  :ui="{ base: 'p-2', leadingIcon: 'size-5' }"
                  @click="showPassword = !showPassword"
                />
              </template>
            </UInput>

            <template v-if="passwordStrength > 0" #help>
              <span class="flex flex-col gap-1.5">
                <span class="flex gap-1" aria-hidden="true">
                  <span
                    v-for="i in 4"
                    :key="i"
                    class="h-1 flex-1 rounded-full transition-colors"
                    :class="i <= passwordStrength ? strengthMeta.color : 'bg-accented'"
                  />
                </span>
                <span role="status" aria-live="polite">
                  Надёжность пароля: {{ strengthMeta.label }}
                </span>
              </span>
            </template>
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
