import { Command } from '@nestjs/cqrs';

/** Сменить пароль пользователя. Проверяет старый пароль и минимальную длину нового. */
export class ChangePasswordCommand extends Command<void> {
  constructor(
    public readonly userId: string,
    public readonly oldPassword: string,
    public readonly newPassword: string,
  ) {
    super();
  }
}
