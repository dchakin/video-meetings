import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangePasswordCommand } from './change-password.command';
import { ChangePasswordHandler } from './change-password.handler';

describe('ChangePasswordHandler', () => {
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };
  let handler: ChangePasswordHandler;

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn(), update: jest.fn() } };
    handler = new ChangePasswordHandler(prisma as unknown as PrismaService);
  });

  it('меняет пароль при верном старом пароле и валидном новом', async () => {
    const oldPasswordHash = await bcrypt.hash('old-password', 10);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'jane.doe@example.com',
      passwordHash: oldPasswordHash,
    });
    prisma.user.update.mockResolvedValue({});

    await handler.execute(new ChangePasswordCommand('user-1', 'old-password', 'new-password'));

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    const updateArgs = prisma.user.update.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 'user-1' });
    expect(await bcrypt.compare('new-password', updateArgs.data.passwordHash)).toBe(true);
  });

  it('несуществующий пользователь — 404, обновление не выполняется', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      handler.execute(new ChangePasswordCommand('missing', 'old-password', 'new-password')),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('неверный старый пароль — 401, обновление не выполняется', async () => {
    const oldPasswordHash = await bcrypt.hash('old-password', 10);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'jane.doe@example.com',
      passwordHash: oldPasswordHash,
    });

    await expect(
      handler.execute(new ChangePasswordCommand('user-1', 'wrong-password', 'new-password')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('слишком короткий новый пароль — 400, обновление не выполняется', async () => {
    const oldPasswordHash = await bcrypt.hash('old-password', 10);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'jane.doe@example.com',
      passwordHash: oldPasswordHash,
    });

    await expect(
      handler.execute(new ChangePasswordCommand('user-1', 'old-password', 'short')),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('слишком длинный новый пароль — 400, обновление не выполняется', async () => {
    const oldPasswordHash = await bcrypt.hash('old-password', 10);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'jane.doe@example.com',
      passwordHash: oldPasswordHash,
    });

    await expect(
      handler.execute(new ChangePasswordCommand('user-1', 'old-password', 'a'.repeat(73))),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
