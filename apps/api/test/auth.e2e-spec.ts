import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

const REGISTER = '/auth/register';
const LOGIN = '/auth/login';

const PASSWORD = 'correct-horse-battery-staple';
const uniqueEmail = (): string => `user-${randomUUID()}@example.com`;

function accessTokenOf(res: request.Response): string {
  const token = (res.body as { accessToken?: unknown }).accessToken;
  expect(typeof token).toBe('string');
  return token as string;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const segments = token.split('.');
  expect(segments).toHaveLength(3);
  return JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >;
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let http: App;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe(`POST ${REGISTER}`, () => {
    it('creates a user and returns a JWT token', async () => {
      const email = uniqueEmail();

      const res = await request(http).post(REGISTER).send({ email, password: PASSWORD });

      expect(res.status).toBe(201);

      const payload = decodeJwtPayload(accessTokenOf(res));
      expect(payload.sub).toBeTruthy();
      expect(payload.email).toBe(email);
    });

    it('persists the user so login with the same credentials succeeds', async () => {
      const email = uniqueEmail();

      await request(http).post(REGISTER).send({ email, password: PASSWORD }).expect(201);

      const loginRes = await request(http).post(LOGIN).send({ email, password: PASSWORD });

      expect(loginRes.status).toBe(200);
      const payload = decodeJwtPayload(accessTokenOf(loginRes));
      expect(payload.email).toBe(email);
    });

    it('rejects registration with an already used email — 409', async () => {
      const email = uniqueEmail();

      await request(http).post(REGISTER).send({ email, password: PASSWORD }).expect(201);

      await request(http).post(REGISTER).send({ email, password: PASSWORD }).expect(409);
    });

    it('rejects an invalid email — 400', async () => {
      await request(http)
        .post(REGISTER)
        .send({ email: 'not-an-email', password: PASSWORD })
        .expect(400);
    });

    it('rejects a too short password — 400', async () => {
      await request(http)
        .post(REGISTER)
        .send({ email: uniqueEmail(), password: 'short' })
        .expect(400);
    });

    it('rejects a request without required fields — 400', async () => {
      await request(http).post(REGISTER).send({}).expect(400);
      await request(http).post(REGISTER).send({ email: uniqueEmail() }).expect(400);
      await request(http).post(REGISTER).send({ password: PASSWORD }).expect(400);
    });
  });

  describe(`POST ${LOGIN}`, () => {
    const email = uniqueEmail();

    beforeAll(async () => {
      await request(http).post(REGISTER).send({ email, password: PASSWORD }).expect(201);
    });

    it('returns a JWT token for an existing user', async () => {
      const res = await request(http).post(LOGIN).send({ email, password: PASSWORD });

      expect(res.status).toBe(200);

      const payload = decodeJwtPayload(accessTokenOf(res));
      expect(payload.sub).toBeTruthy();
      expect(payload.email).toBe(email);
    });

    it('does not create a user: login with an unknown email fails with 401 and the email stays free to register', async () => {
      const freshEmail = uniqueEmail();

      await request(http).post(LOGIN).send({ email: freshEmail, password: PASSWORD }).expect(401);
      await request(http).post(LOGIN).send({ email: freshEmail, password: PASSWORD }).expect(401);
      await request(http)
        .post(REGISTER)
        .send({ email: freshEmail, password: PASSWORD })
        .expect(201);
    });

    it('rejects a wrong password — 401', async () => {
      await request(http).post(LOGIN).send({ email, password: 'wrong-password' }).expect(401);
    });

    it('rejects an invalid request body — 400', async () => {
      await request(http).post(LOGIN).send({}).expect(400);
      await request(http)
        .post(LOGIN)
        .send({ email: 'not-an-email', password: PASSWORD })
        .expect(400);
    });
  });
});
