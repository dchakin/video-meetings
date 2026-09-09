import { Command } from '@nestjs/cqrs';
import { AuthResult } from '../auth.types';

/** Регистрация нового пользователя: создаёт запись в БД и возвращает JWT. */
export class RegisterCommand extends Command<AuthResult> {
  constructor(
    public readonly email: string,
    public readonly password: string,
  ) {
    super();
  }
}
