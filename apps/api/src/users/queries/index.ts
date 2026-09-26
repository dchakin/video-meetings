import { FindUserByEmailHandler } from './find-user-by-email.handler';
import { GetAvatarFileHandler } from './get-avatar-file.handler';
import { GetUserProfileHandler } from './get-user-profile.handler';
import { GetUserTokenVersionHandler } from './get-user-token-version.handler';

export const USERS_QUERY_HANDLERS = [
  FindUserByEmailHandler,
  GetUserProfileHandler,
  GetAvatarFileHandler,
  GetUserTokenVersionHandler,
];

export * from './find-user-by-email.query';
export * from './get-avatar-file.query';
export * from './get-user-profile.query';
export * from './get-user-token-version.query';
