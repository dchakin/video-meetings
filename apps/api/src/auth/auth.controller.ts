import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Throttle } from '@nestjs/throttler';
import { AuthResult } from './auth.types';
import { LoginCommand, RegisterCommand } from './commands';
import { AuthCredentialsDto } from './dto/auth-credentials.dto';

/** Узкий лимит на брутфорс/перебор учётных данных и массовую регистрацию. */
const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('register')
  @Throttle(AUTH_THROTTLE)
  register(@Body() { email, password }: AuthCredentialsDto): Promise<AuthResult> {
    return this.commandBus.execute(new RegisterCommand(email, password));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  login(@Body() { email, password }: AuthCredentialsDto): Promise<AuthResult> {
    return this.commandBus.execute(new LoginCommand(email, password));
  }
}
