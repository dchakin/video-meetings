import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/** Тело запросов POST /auth/register и POST /auth/login. */
export class AuthCredentialsDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
