import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { USERS_COMMAND_HANDLERS } from './commands';
import { USERS_QUERY_HANDLERS } from './queries';

/**
 * Модуль пользователей: создание, поиск и профиль пользователя.
 * Наружу общается только через CQRS (`CreateUserCommand`, `FindUserByEmailQuery`,
 * `GetUserProfileQuery`, `UpdateUserNameCommand`, `ChangePasswordCommand`) — своих
 * провайдеров не экспортирует.
 * Потребители — модули `auth` и `profile`.
 */
@Module({
  imports: [CqrsModule],
  providers: [...USERS_COMMAND_HANDLERS, ...USERS_QUERY_HANDLERS],
})
export class UsersModule {}
