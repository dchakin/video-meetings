import { Query } from '@nestjs/cqrs';
import { User } from '@prisma/client';

/** Найти пользователя по email. Возвращает `null`, если его нет. Ничего не создаёт. */
export class FindUserByEmailQuery extends Query<User | null> {
  constructor(public readonly email: string) {
    super();
  }
}
