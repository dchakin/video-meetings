import { UnauthorizedException } from '@nestjs/common';
import { CommandHandler, ICommandHandler, QueryBus } from '@nestjs/cqrs';
import * as bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS } from '../../common/password.util';
import { FindUserByEmailQuery } from '../../users/queries';
import { AuthResult } from '../auth.types';
import { TokenService } from '../tokens/token.service';
import { LoginCommand } from './login.command';

/**
 * Хеш-заглушка для сравнения, когда пользователь не найден — иначе ответ на
 * несуществующий email приходит заметно быстрее (нет вызова bcrypt.compare),
 * что позволяет перебором отличать существующие email от несуществующих.
 * Cost должен совпадать с реальными хешами (`BCRYPT_ROUNDS`), иначе разница
 * во времени compare() между настоящим и фиктивным хешем выдаёт то же самое.
 */
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<LoginCommand, AuthResult> {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly tokens: TokenService,
  ) {}

  async execute({ email, password }: LoginCommand): Promise<AuthResult> {
    const user = await this.queryBus.execute(new FindUserByEmailQuery(email));

    const passwordMatches = await bcrypt.compare(
      password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    return this.tokens.issue({ sub: user.id, email: user.email, tokenVersion: user.tokenVersion });
  }
}
