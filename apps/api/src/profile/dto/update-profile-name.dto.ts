import { IsString, MaxLength, MinLength } from 'class-validator';

/** Тело запроса PATCH /profile. */
export class UpdateProfileNameDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;
}
