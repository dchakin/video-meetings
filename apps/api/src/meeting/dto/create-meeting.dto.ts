import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { normalizeEmail } from '../../common/email.util';

const MAX_TITLE_LENGTH = 200;
const MAX_PARTICIPANTS = 50;
const MAX_PARTICIPANT_EMAIL_LENGTH = 254;

export class CreateMeetingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_TITLE_LENGTH)
  title!: string;

  @IsDateString()
  date!: string;

  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((v) => (typeof v === 'string' ? normalizeEmail(v) : v))
      : value,
  )
  @IsArray()
  @ArrayMaxSize(MAX_PARTICIPANTS)
  @IsEmail({}, { each: true })
  @MaxLength(MAX_PARTICIPANT_EMAIL_LENGTH, { each: true })
  participants!: string[];
}
