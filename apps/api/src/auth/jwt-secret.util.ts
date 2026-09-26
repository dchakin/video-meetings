import { ConfigService } from '@nestjs/config';

const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Требует явный `JWT_SECRET` минимум 32 символа — без дефолта. Дефолт вроде
 * `dev-secret-change-me` рано или поздно уезжает в прод: любой, кто его знает
 * (а он был в этом же репозитории), может подделать JWT с произвольным `sub`.
 */
export function getJwtSecretOrThrow(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');
  if (!secret || secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET должен быть задан и содержать не менее ${MIN_JWT_SECRET_LENGTH} символов`,
    );
  }
  return secret;
}
