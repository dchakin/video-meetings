import { User } from '@prisma/client';

/** Публичная форма профиля пользователя — без `passwordHash`. */
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

/** Приводит User к UserProfile, подставляя вместо пустого имени локальную часть email. */
export function toUserProfile(user: User): UserProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name || user.email.split('@')[0],
    avatarUrl: user.avatarUrl,
  };
}
