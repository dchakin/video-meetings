import { Command } from '@nestjs/cqrs';
import { AvatarFileInput, UserProfile } from '../users.types';

/** Загрузить/заменить аватар пользователя. 404, если пользователя нет. */
export class UpdateAvatarCommand extends Command<UserProfile> {
  constructor(
    public readonly userId: string,
    public readonly file: AvatarFileInput,
  ) {
    super();
  }
}
