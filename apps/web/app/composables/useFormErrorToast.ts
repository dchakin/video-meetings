import type { FetchError } from 'ofetch';
import type { FormErrorEvent } from '@nuxt/ui';

/** Достаёт человекочитаемое сообщение об ошибке API из тела ответа `{ message }`. */
export function extractErrorMessage(err: unknown, fallback: string): string {
  const error = err as FetchError<{ message?: string | string[] }>;
  const message = error.data?.message;
  return Array.isArray(message) ? message.join(', ') : (message ?? fallback);
}

/** Показ toast об ошибке с сообщением, извлечённым из ответа API. */
export function useErrorToast() {
  const toast = useToast();

  function showError(title: string, err: unknown, fallback: string) {
    toast.add({
      title,
      description: extractErrorMessage(err, fallback),
      color: 'error',
      icon: 'i-lucide-circle-alert',
    });
  }

  return { showError };
}

/**
 * Alert-ошибка формы (сообщение + фокус/скролл к алерту) и обработчик `@error`
 * у `UForm`, переводящий фокус на первое невалидное поле.
 */
export function useFormServerError() {
  const serverError = ref<string | null>(null);
  const serverErrorRef = ref<HTMLElement | null>(null);

  async function setServerError(message: string) {
    serverError.value = message;
    await nextTick();
    serverErrorRef.value?.focus();
    serverErrorRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Неудачная валидация формы: перевести фокус на первое поле с ошибкой.
  // nextTick — чтобы поля успели выйти из disabled после снятия loading у UForm.
  async function onFormError(event: FormErrorEvent) {
    const id = event.errors?.[0]?.id;
    if (!id) return;
    await nextTick();
    const el = document.getElementById(id);
    el?.focus();
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return { serverError, serverErrorRef, setServerError, onFormError };
}
