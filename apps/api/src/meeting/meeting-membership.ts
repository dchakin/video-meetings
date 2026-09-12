import { Meeting } from '@prisma/client';
import { JwtPayload } from '../auth/auth.types';

/** Владелец или участник (сверка по email) — общее правило доступа к встрече и её файлам. */
export function isMeetingMember(meeting: Meeting, user: JwtPayload): boolean {
  return meeting.ownerId === user.sub || meeting.participants.includes(user.email);
}
