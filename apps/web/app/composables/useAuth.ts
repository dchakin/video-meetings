/** Результат успешной аутентификации — то, что возвращают эндпоинты API auth. */
export interface AuthResult {
  accessToken: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

/** Данные пользователя, извлечённые из payload JWT. */
export interface AuthUser {
  sub: string;
  email: string;
}

/** Декодирует payload JWT (`header.payload.signature`) без проверки подписи. */
function decodeToken(token: string | null): AuthUser | null {
  if (!token) return null;

  const segment = token.split('.')[1];
  if (!segment) return null;

  try {
    const json = atob(segment.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as Partial<AuthUser>;

    if (typeof payload.sub === 'string' && typeof payload.email === 'string') {
      return { sub: payload.sub, email: payload.email };
    }
    return null;
  } catch {
    return null;
  }
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
  const user = computed(() => decodeToken(token.value));

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

  return { token, user, isAuthenticated, register, login, logout };
}
