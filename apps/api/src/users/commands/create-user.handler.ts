import { ConflictException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Prisma, User } from '@prisma/client';
import { normalizeEmail } from '../../common/email.util';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserCommand } from './create-user.command';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand, User> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ email, passwordHash }: CreateUserCommand): Promise<User> {
    try {
      return await this.prisma.user.create({
        data: { email: normalizeEmail(email), passwordHash },
      });
    } catch (error) {
      // Гонка параллельных регистраций на один email: полагаемся на уникальный
      // индекс БД вместо `findUnique` + `create` (TOCTOU), но всё равно отдаём 409.
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === UNIQUE_CONSTRAINT_VIOLATION) {
          throw new ConflictException('Email уже зарегистрирован');
        }
      }
      throw error;
    }
  }
}
