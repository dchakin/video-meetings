import { ChangePasswordHandler } from './change-password.handler';
import { CreateUserHandler } from './create-user.handler';
import { UpdateAvatarHandler } from './update-avatar.handler';
import { UpdateUserNameHandler } from './update-user-name.handler';

export const USERS_COMMAND_HANDLERS = [
  CreateUserHandler,
  UpdateUserNameHandler,
  ChangePasswordHandler,
  UpdateAvatarHandler,
];

export * from './change-password.command';
export * from './create-user.command';
export * from './update-avatar.command';
export * from './update-user-name.command';
