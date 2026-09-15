import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../prisma/prisma.service';
import { toUserProfile } from '../users.types';
import { UpdateUserNameCommand } from './update-user-name.command';

@CommandHandler(UpdateUserNameCommand)
export class UpdateUserNameHandler implements ICommandHandler<UpdateUserNameCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ userId, name }: UpdateUserNameCommand) {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      throw new NotFoundException('Пользователь не найден');
    }

    const user = await this.prisma.user.update({ where: { id: userId }, data: { name } });
    return toUserProfile(user);
  }
}
