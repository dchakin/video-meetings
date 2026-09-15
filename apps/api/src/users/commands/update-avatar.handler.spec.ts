import { BadRequestException, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { PrismaService } from '../../prisma/prisma.service';
import { AvatarFileInput } from '../users.types';
import { UpdateAvatarCommand } from './update-avatar.command';
import { UpdateAvatarHandler } from './update-avatar.handler';

jest.mock('node:fs', () => ({
  ...jest.requireActual('node:fs'),
  promises: {
    ...jest.requireActual('node:fs').promises,
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
  },
}));

describe('UpdateAvatarHandler', () => {
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };
  let handler: UpdateAvatarHandler;

  const validFile: AvatarFileInput = {
    buffer: Buffer.from('image-bytes'),
    originalName: 'avatar.png',
    mimeType: 'image/png',
    size: 1024,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = { user: { findUnique: jest.fn(), update: jest.fn() } };
    handler = new UpdateAvatarHandler(prisma as unknown as PrismaService);
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.unlink as jest.Mock).mockResolvedValue(undefined);
  });

  it('сохраняет файл и обновляет avatarUrl, если старого аватара не было', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'jane.doe@example.com',
      name: null,
      avatarUrl: null,
    });
    prisma.user.update.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'user-1', email: 'jane.doe@example.com', name: null, ...data }),
    );

    const profile = await handler.execute(new UpdateAvatarCommand('user-1', validFile));

    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.unlink).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    const updateArgs = prisma.user.update.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 'user-1' });
    expect(updateArgs.data.avatarUrl).toMatch(/^\/avatars\/.+\.png$/);
    expect(profile.avatarUrl).toBe(updateArgs.data.avatarUrl);
  });

  it('удаляет предыдущий файл аватара при замене', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'jane.doe@example.com',
      name: null,
      avatarUrl: '/avatars/old-avatar.jpg',
    });
    prisma.user.update.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'user-1', email: 'jane.doe@example.com', name: null, ...data }),
    );

    await handler.execute(new UpdateAvatarCommand('user-1', validFile));

    expect(fs.unlink).toHaveBeenCalledTimes(1);
    expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('old-avatar.jpg'));
  });

  it('несуществующий пользователь — 404, файл не сохраняется', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      handler.execute(new UpdateAvatarCommand('missing', validFile)),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('отклоняет файл неверного формата — 400', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'jane.doe@example.com',
      name: null,
      avatarUrl: null,
    });

    await expect(
      handler.execute(
        new UpdateAvatarCommand('user-1', { ...validFile, mimeType: 'application/pdf' }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('отклоняет файл, превышающий допустимый размер — 400', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'jane.doe@example.com',
      name: null,
      avatarUrl: null,
    });

    await expect(
      handler.execute(new UpdateAvatarCommand('user-1', { ...validFile, size: 6 * 1024 * 1024 })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
