/** Результат успешной аутентификации — то, что возвращают эндпоинты API auth. */
export interface AuthResult {
  accessToken: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

/**
 * Клиент аутентификации: обращается к API (`runtimeConfig.public.apiBase`)
 * и хранит JWT в cookie `access_token`.
 */
export function useAuth() {
  const config = useRuntimeConfig();
  const token = useCookie<string | null>('access_token', {
    default: () => null,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  });

  const isAuthenticated = computed(() => Boolean(token.value));

  async function request(path: '/auth/register' | '/auth/login', body: AuthCredentials) {
    const result = await $fetch<AuthResult>(path, {
      baseURL: config.public.apiBase,
      method: 'POST',
      body,
    });
    token.value = result.accessToken;
    return result;
  }

  const register = (credentials: AuthCredentials) => request('/auth/register', credentials);
  const login = (credentials: AuthCredentials) => request('/auth/login', credentials);

  function logout() {
    token.value = null;
  }

  return { token, isAuthenticated, register, login, logout };
}
