import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { USERS_COMMAND_HANDLERS } from './commands';
import { USERS_QUERY_HANDLERS } from './queries';

/**
 * Модуль пользователей: создание и поиск пользователя.
 * Наружу общается только через CQRS (`CreateUserCommand`, `FindUserByEmailQuery`) — своих
 * провайдеров не экспортирует. Потребитель — модуль `auth`.
 */
@Module({
  imports: [CqrsModule],
  providers: [...USERS_COMMAND_HANDLERS, ...USERS_QUERY_HANDLERS],
})
export class UsersModule {}
