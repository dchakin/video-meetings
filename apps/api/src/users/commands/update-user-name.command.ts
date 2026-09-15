import { Command } from '@nestjs/cqrs';
import { UserProfile } from '../users.types';

/** Обновить имя пользователя. 404, если пользователя нет. */
export class UpdateUserNameCommand extends Command<UserProfile> {
  constructor(
    public readonly userId: string,
    public readonly name: string,
  ) {
    super();
  }
}
