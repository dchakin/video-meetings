import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GetUserProfileHandler } from './get-user-profile.handler';
import { GetUserProfileQuery } from './get-user-profile.query';

describe('GetUserProfileHandler', () => {
  let prisma: { user: { findUnique: jest.Mock } };
  let handler: GetUserProfileHandler;

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn() } };
    handler = new GetUserProfileHandler(prisma as unknown as PrismaService);
  });

  it('возвращает профиль с заданным именем', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'jane.doe@example.com',
      name: 'Jane',
      avatarUrl: null,
    });

    await expect(handler.execute(new GetUserProfileQuery('user-1'))).resolves.toEqual({
      id: 'user-1',
      email: 'jane.doe@example.com',
      name: 'Jane',
      avatarUrl: null,
    });
  });

  it('подставляет локальную часть email, если имя не задано', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'jane.doe@example.com',
      name: null,
      avatarUrl: null,
    });

    const result = await handler.execute(new GetUserProfileQuery('user-1'));

    expect(result.name).toBe('jane.doe');
  });

  it('несуществующий пользователь — 404', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(handler.execute(new GetUserProfileQuery('missing'))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
