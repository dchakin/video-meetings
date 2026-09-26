import { IsByteLength, IsNotEmpty, IsString } from 'class-validator';

/** bcrypt учитывает только первые 72 БАЙТА пароля — лимит проверяем в байтах, не символах. */
const MIN_PASSWORD_BYTES = 8;
const MAX_PASSWORD_BYTES = 72;

/** Тело запроса PATCH /profile/password. */
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @IsByteLength(1, MAX_PASSWORD_BYTES)
  oldPassword!: string;

  @IsString()
  @IsByteLength(MIN_PASSWORD_BYTES, MAX_PASSWORD_BYTES)
  newPassword!: string;
}
