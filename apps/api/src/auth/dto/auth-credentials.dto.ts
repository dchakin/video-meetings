import { Transform } from 'class-transformer';
import { IsByteLength, IsEmail, IsString } from 'class-validator';
import { normalizeEmail } from '../../common/email.util';

/** bcrypt учитывает только первые 72 БАЙТА пароля — лимит проверяем в байтах, не символах. */
const MIN_PASSWORD_BYTES = 8;
const MAX_PASSWORD_BYTES = 72;

/** Тело запросов POST /auth/register и POST /auth/login. */
export class AuthCredentialsDto {
  @Transform(({ value }: { value: string }) => normalizeEmail(value))
  @IsEmail()
  email!: string;

  @IsString()
  @IsByteLength(MIN_PASSWORD_BYTES, MAX_PASSWORD_BYTES)
  password!: string;
}
