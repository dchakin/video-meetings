import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { ProfileController } from './profile.controller';

/**
 * HTTP-слой профиля пользователя: диспатчит команды/запросы `users` через CQRS,
 * сам с БД не работает (см. `users.module.ts`).
 */
@Module({
  imports: [CqrsModule, AuthModule, UsersModule],
  controllers: [ProfileController],
})
export class ProfileModule {}
