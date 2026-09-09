import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthResult, JwtPayload } from '../auth.types';

/** Общая для command-обработчиков логика выпуска JWT. */
@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}

  async issue(payload: JwtPayload): Promise<AuthResult> {
    return { accessToken: await this.jwt.signAsync(payload) };
  }
}
