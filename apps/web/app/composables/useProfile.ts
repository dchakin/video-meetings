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
  const profile = useProfileState();

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

  return { profile, load, updateName, changePassword, updateAvatar };
}
