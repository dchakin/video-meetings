import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { JwtPayload } from '../auth.types';

/** Запрос, к которому guard прикрепил данные аутентифицированного пользователя. */
export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

/** Пропускает запрос только с валидным `Authorization: Bearer <JWT>`. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Отсутствует токен доступа');
    }

    try {
      request.user = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Недействительный токен доступа');
    }

    return true;
  }

  private extractToken(request: Request): string | undefined {
    const [scheme, value] = request.headers.authorization?.split(' ') ?? [];
    return scheme === 'Bearer' && value ? value : undefined;
  }
}
