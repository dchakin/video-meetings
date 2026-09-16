import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserNameCommand } from './update-user-name.command';
import { UpdateUserNameHandler } from './update-user-name.handler';

describe('UpdateUserNameHandler', () => {
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };
  let handler: UpdateUserNameHandler;

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn(), update: jest.fn() } };
    handler = new UpdateUserNameHandler(prisma as unknown as PrismaService);
  });

  it('обновляет имя и возвращает профиль', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'jane.doe@example.com',
      name: 'Jane',
      avatarUrl: null,
    });
    prisma.user.update.mockResolvedValue({
      id: 'user-1',
      email: 'jane.doe@example.com',
      name: 'Jane Doe',
      avatarUrl: null,
    });

    const result = await handler.execute(new UpdateUserNameCommand('user-1', 'Jane Doe'));

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { name: 'Jane Doe' },
    });
    expect(result).toEqual({
      id: 'user-1',
      email: 'jane.doe@example.com',
      name: 'Jane Doe',
      avatarUrl: null,
    });
  });

  it('несуществующий пользователь — 404, обновление не выполняется', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      handler.execute(new UpdateUserNameCommand('missing', 'Jane Doe')),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
