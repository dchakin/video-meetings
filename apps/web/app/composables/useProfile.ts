/** Профиль текущего пользователя — форма ответа API `/profile`. */
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

/** Общее реактивное состояние профиля текущего пользователя между всеми компонентами. */
function useProfileState() {
  return useState<UserProfile | null>('profile', () => null);
}

/** Работа с профилем текущего пользователя через авторизованный клиент API. */
export function useProfile() {
  const api = useApi();
  const config = useRuntimeConfig();
  const profile = useProfileState();

  /** Имя может быть не заполнено — тогда показываем локальную часть email. */
  const displayName = computed(
    () => profile.value?.name || profile.value?.email.split('@')[0] || '',
  );

  /** `avatarUrl` от API — относительный путь, поэтому собираем абсолютный URL сами. */
  const avatarSrc = computed(() =>
    profile.value?.avatarUrl ? `${config.public.apiBase}${profile.value.avatarUrl}` : undefined,
  );

  const load = async () => {
    profile.value = await api<UserProfile>('/profile');
    return profile.value;
  };

  const updateName = async (name: string) => {
    profile.value = await api<UserProfile>('/profile', { method: 'PATCH', body: { name } });
    return profile.value;
  };

  const changePassword = (oldPassword: string, newPassword: string) =>
    api('/profile/password', { method: 'PATCH', body: { oldPassword, newPassword } });

  const updateAvatar = async (file: File) => {
    const body = new FormData();
    body.append('file', file);
    profile.value = await api<UserProfile>('/profile/avatar', { method: 'POST', body });
    return profile.value;
  };

  return { profile, displayName, avatarSrc, load, updateName, changePassword, updateAvatar };
}
