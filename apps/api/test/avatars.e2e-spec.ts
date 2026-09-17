import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

const PASSWORD = 'correct-horse-battery-staple';

// Минимальный валидный PNG 1×1 — содержимое проверяется побайтово при отдаче.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
  'base64',
);

describe('Avatars (e2e)', () => {
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

  it('загруженный аватар доступен по avatarUrl без авторизации', async () => {
    const email = `user-${randomUUID()}@example.com`;
    const { accessToken } = (
      await request(http).post('/auth/register').send({ email, password: PASSWORD }).expect(201)
    ).body as { accessToken: string };

    const { avatarUrl } = (
      await request(http)
        .post('/profile/avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', PNG, { filename: 'avatar.png', contentType: 'image/png' })
        .expect(201)
    ).body as { avatarUrl: string };

    const res = await request(http)
      .get(avatarUrl)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.compare(res.body as Buffer, PNG)).toBe(0);
  });

  it('несуществующий аватар — 404', async () => {
    await request(http).get(`/avatars/${randomUUID()}.png`).expect(404);
  });

  it('имя не в формате аватара — 404', async () => {
    await request(http).get('/avatars/..%2F..%2Fpackage.json').expect(404);
  });
});
