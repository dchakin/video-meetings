import { Command } from '@nestjs/cqrs';
import { User } from '@prisma/client';

/** Создать пользователя с уже готовым хешем пароля. 409, если email занят. */
export class CreateUserCommand extends Command<User> {
  constructor(
    public readonly email: string,
    public readonly passwordHash: string,
  ) {
    super();
  }
}
