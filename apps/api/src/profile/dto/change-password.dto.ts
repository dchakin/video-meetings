import { IsString, MaxLength, MinLength } from 'class-validator';

/** Тело запроса PATCH /profile/password. */
export class ChangePasswordDto {
  @IsString()
  oldPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}
