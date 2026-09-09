/** Результат успешной аутентификации — то, что возвращают эндпоинты auth. */
export interface AuthResult {
  accessToken: string;
}

/** Payload, который кладётся в JWT. */
export interface JwtPayload {
  sub: string;
  email: string;
}
