import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from './auth.types';
import { AuthenticatedRequest } from './guards/jwt-auth.guard';

/** Достаёт payload аутентифицированного пользователя, положенный `JwtAuthGuard`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload => {
    return context.switchToHttp().getRequest<AuthenticatedRequest>().user;
  },
);
