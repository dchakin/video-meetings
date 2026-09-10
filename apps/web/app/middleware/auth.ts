/**
 * Приватные маршруты: неавторизованного пользователя уводим на `/login`,
 * чтобы защищённые страницы (напр. главная со списком встреч) были доступны
 * только после входа.
 */
export default defineNuxtRouteMiddleware(() => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated.value) {
    return navigateTo('/login', { replace: true });
  }
});
