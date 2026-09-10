import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import * as bcrypt from 'bcryptjs';
import { CreateUserCommand } from '../../users/commands';
import { AuthResult } from '../auth.types';
import { TokenService } from '../tokens/token.service';
import { RegisterCommand } from './register.command';

const BCRYPT_ROUNDS = 10;

@CommandHandler(RegisterCommand)
export class RegisterHandler implements ICommandHandler<RegisterCommand, AuthResult> {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly tokens: TokenService,
  ) {}

  async execute({ email, password }: RegisterCommand): Promise<AuthResult> {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.commandBus.execute(new CreateUserCommand(email, passwordHash));

    return this.tokens.issue({ sub: user.id, email: user.email });
  }
}
