import { BadRequestException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { JwtPayload } from '../auth/auth.types';
import { UpdateAvatarCommand } from '../users/commands';
import { UserProfile } from '../users/users.types';
import { ProfileController } from './profile.controller';

describe('ProfileController', () => {
  let commandBus: { execute: jest.Mock };
  let controller: ProfileController;

  const user: JwtPayload = { sub: 'user-1', email: 'jane.doe@example.com' };
  const file: Express.Multer.File = {
    buffer: Buffer.from('image-bytes'),
    originalname: 'avatar.png',
    mimetype: 'image/png',
    size: 1024,
  } as Express.Multer.File;
  const profile: UserProfile = {
    id: 'user-1',
    email: 'jane.doe@example.com',
    name: 'jane.doe',
    avatarUrl: '/avatars/generated.png',
  };

  beforeEach(() => {
    commandBus = { execute: jest.fn().mockResolvedValue(profile) };
    controller = new ProfileController(commandBus as unknown as CommandBus);
  });

  it('загружает аватар и диспатчит UpdateAvatarCommand', async () => {
    const result = await controller.uploadAvatar(user, file);

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    const command = commandBus.execute.mock.calls[0][0] as UpdateAvatarCommand;
    expect(command).toBeInstanceOf(UpdateAvatarCommand);
    expect(command.userId).toBe('user-1');
    expect(command.file).toEqual({
      buffer: file.buffer,
      originalName: 'avatar.png',
      mimeType: 'image/png',
      size: 1024,
    });
    expect(result).toBe(profile);
  });

  it('отклоняет запрос без файла — 400', () => {
    expect(() => controller.uploadAvatar(user, undefined)).toThrow(BadRequestException);
    expect(commandBus.execute).not.toHaveBeenCalled();
  });
});
