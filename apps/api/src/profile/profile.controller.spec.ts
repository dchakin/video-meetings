import { BadRequestException } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtPayload } from '../auth/auth.types';
import {
  ChangePasswordCommand,
  UpdateAvatarCommand,
  UpdateUserNameCommand,
} from '../users/commands';
import { GetUserProfileQuery } from '../users/queries';
import { UserProfile } from '../users/users.types';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileNameDto } from './dto/update-profile-name.dto';
import { ProfileController } from './profile.controller';

describe('ProfileController', () => {
  let commandBus: { execute: jest.Mock };
  let queryBus: { execute: jest.Mock };
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
    queryBus = { execute: jest.fn().mockResolvedValue(profile) };
    controller = new ProfileController(
      commandBus as unknown as CommandBus,
      queryBus as unknown as QueryBus,
    );
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

  it('возвращает профиль текущего пользователя через GetUserProfileQuery', async () => {
    const result = await controller.getProfile(user);

    expect(queryBus.execute).toHaveBeenCalledTimes(1);
    const query = queryBus.execute.mock.calls[0][0] as GetUserProfileQuery;
    expect(query).toBeInstanceOf(GetUserProfileQuery);
    expect(query.userId).toBe('user-1');
    expect(result).toBe(profile);
  });

  it('обновляет имя и диспатчит UpdateUserNameCommand', async () => {
    const dto: UpdateProfileNameDto = { name: 'Jane' };
    const result = await controller.updateName(user, dto);

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    const command = commandBus.execute.mock.calls[0][0] as UpdateUserNameCommand;
    expect(command).toBeInstanceOf(UpdateUserNameCommand);
    expect(command.userId).toBe('user-1');
    expect(command.name).toBe('Jane');
    expect(result).toBe(profile);
  });

  it('меняет пароль и диспатчит ChangePasswordCommand', async () => {
    commandBus.execute.mockResolvedValueOnce(undefined);
    const dto: ChangePasswordDto = { oldPassword: 'old-password', newPassword: 'new-password' };
    await controller.changePassword(user, dto);

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    const command = commandBus.execute.mock.calls[0][0] as ChangePasswordCommand;
    expect(command).toBeInstanceOf(ChangePasswordCommand);
    expect(command.userId).toBe('user-1');
    expect(command.oldPassword).toBe('old-password');
    expect(command.newPassword).toBe('new-password');
  });
});
