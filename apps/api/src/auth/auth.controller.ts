import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AuthResult } from './auth.types';
import { LoginCommand, RegisterCommand } from './commands';
import { AuthCredentialsDto } from './dto/auth-credentials.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('register')
  register(@Body() { email, password }: AuthCredentialsDto): Promise<AuthResult> {
    return this.commandBus.execute(new RegisterCommand(email, password));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() { email, password }: AuthCredentialsDto): Promise<AuthResult> {
    return this.commandBus.execute(new LoginCommand(email, password));
  }
}
