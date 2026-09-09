import { LoginHandler } from './login.handler';
import { RegisterHandler } from './register.handler';

export const AUTH_COMMAND_HANDLERS = [RegisterHandler, LoginHandler];

export * from './login.command';
export * from './register.command';
