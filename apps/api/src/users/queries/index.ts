import { FindUserByEmailHandler } from './find-user-by-email.handler';

export const USERS_QUERY_HANDLERS = [FindUserByEmailHandler];

export * from './find-user-by-email.query';
