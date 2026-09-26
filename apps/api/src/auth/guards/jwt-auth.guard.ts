import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { GetUserTokenVersionQuery } from '../../users/queries';
import { JwtPayload } from '../auth.types';

/** Запрос, к которому guard прикрепил данные аутентифицированного пользователя. */
export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

/**
 * Пропускает запрос только с валидным `Authorization: Bearer <JWT>`, чей `tokenVersion`
 * совпадает с текущим значением у пользователя в БД — иначе токены, выданные до смены
 * пароля, оставались бы действительными до истечения TTL.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly queryBus: QueryBus,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Отсутствует токен доступа');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Недействительный токен доступа');
    }

    const tokenVersion = await this.queryBus.execute(new GetUserTokenVersionQuery(payload.sub));
    if (tokenVersion === null || tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Недействительный токен доступа');
    }

    request.user = payload;
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const [scheme, value] = request.headers.authorization?.split(' ') ?? [];
    return scheme === 'Bearer' && value ? value : undefined;
  }
}
