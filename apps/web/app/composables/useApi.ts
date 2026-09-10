/**
 * Авторизованный клиент API: базовый URL из `runtimeConfig.public.apiBase`,
 * заголовок `Authorization: Bearer <JWT>` из cookie, автоматический выход
 * и редирект на `/login` при ответе `401`.
 */
export function useApi() {
  const config = useRuntimeConfig();
  const { token, logout } = useAuth();

  return $fetch.create({
    baseURL: config.public.apiBase,
    onRequest({ options }) {
      if (token.value) {
        options.headers.set('Authorization', `Bearer ${token.value}`);
      }
    },
    async onResponseError({ response }) {
      if (response.status === 401) {
        logout();
        await navigateTo('/login');
      }
    },
  });
}
