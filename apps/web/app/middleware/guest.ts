/**
 * Гость-only маршруты (страницы аутентификации): уже вошедшего пользователя
 * уводим на главную, чтобы он не видел формы входа/регистрации.
 */
export default defineNuxtRouteMiddleware(() => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated.value) {
    return navigateTo('/', { replace: true });
  }
});
