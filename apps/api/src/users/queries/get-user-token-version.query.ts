import { Query } from '@nestjs/cqrs';

/** Текущий `tokenVersion` пользователя. `null`, если пользователя нет. */
export class GetUserTokenVersionQuery extends Query<number | null> {
  constructor(public readonly userId: string) {
    super();
  }
}
