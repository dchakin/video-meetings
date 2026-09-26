import { Meeting } from '@prisma/client';
import { JwtPayload } from '../auth/auth.types';

/**
 * Владелец или участник (сверка по email) — общее правило доступа к встрече и её файлам.
 *
 * Известный риск (см. apps/api/CLAUDE.md, раздел `meeting`, сознательно не устранён):
 * участник добавляется по email без проверки владения им, поэтому пользователь,
 * зарегистрировавшийся на ещё не занятый email участника после того как его туда
 * вписал владелец встречи, получает доступ к встрече и её файлам.
 */
export function isMeetingMember(meeting: Meeting, user: JwtPayload): boolean {
  return isMeetingOwner(meeting, user) || meeting.participants.includes(user.email);
}

/** Только владелец — используется там, где на управление встречей (upload/delete) права уже, чем у участника. */
export function isMeetingOwner(meeting: Meeting, user: JwtPayload): boolean {
  return meeting.ownerId === user.sub;
}
