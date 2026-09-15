import { CreateUserHandler } from './create-user.handler';
import { UpdateUserNameHandler } from './update-user-name.handler';

export const USERS_COMMAND_HANDLERS = [CreateUserHandler, UpdateUserNameHandler];

export * from './create-user.command';
export * from './update-user-name.command';
