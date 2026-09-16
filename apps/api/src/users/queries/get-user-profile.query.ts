import { Query } from '@nestjs/cqrs';
import { UserProfile } from '../users.types';

/** Получить профиль пользователя по id. 404, если пользователя нет. */
export class GetUserProfileQuery extends Query<UserProfile> {
  constructor(public readonly userId: string) {
    super();
  }
}
