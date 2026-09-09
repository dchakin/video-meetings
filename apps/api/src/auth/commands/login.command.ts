import { Command } from '@nestjs/cqrs';
import { AuthResult } from '../auth.types';

/** Логин существующего пользователя: сверяет пароль и возвращает JWT. Пользователя не создаёт. */
export class LoginCommand extends Command<AuthResult> {
  constructor(
    public readonly email: string,
    public readonly password: string,
  ) {
    super();
  }
}
