import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangePasswordCommand } from './change-password.command';

const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;

@CommandHandler(ChangePasswordCommand)
export class ChangePasswordHandler implements ICommandHandler<ChangePasswordCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ userId, oldPassword, newPassword }: ChangePasswordCommand): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    const oldPasswordMatches = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!oldPasswordMatches) {
      throw new UnauthorizedException('Неверный текущий пароль');
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length > MAX_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `Пароль должен быть от ${MIN_PASSWORD_LENGTH} до ${MAX_PASSWORD_LENGTH} символов`,
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }
}
