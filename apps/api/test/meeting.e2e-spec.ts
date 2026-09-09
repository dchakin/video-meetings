import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

const REGISTER = '/auth/register';
const MEETINGS = '/meetings';

const PASSWORD = 'correct-horse-battery-staple';
const uniqueEmail = (): string => `user-${randomUUID()}@example.com`;

interface MeetingResponse {
  id: string;
  title: string;
  date: string;
  participants: string[];
}

function meetingPayload(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    title: 'Weekly sync',
    date: '2026-10-01T10:00:00.000Z',
    participants: ['alice@example.com', 'bob@example.com'],
    ...overrides,
  };
}

describe('Meetings (e2e)', () => {
  let app: INestApplication<App>;
  let http: App;

  /** Регистрирует нового пользователя и возвращает его access-токен. */
  async function registerUser(): Promise<string> {
    const res = await request(http)
      .post(REGISTER)
      .send({ email: uniqueEmail(), password: PASSWORD })
      .expect(201);
    return (res.body as { accessToken: string }).accessToken;
  }

  const auth = (token: string): string => `Bearer ${token}`;

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

  describe(`POST ${MEETINGS}`, () => {
    // тест #1
    it('создаёт встречу и возвращает её с id, title, date и participants[]', async () => {
      const token = await registerUser();
      const payload = meetingPayload();

      const res = await request(http)
        .post(MEETINGS)
        .set('Authorization', auth(token))
        .send(payload);

      expect(res.status).toBe(201);

      const body = res.body as MeetingResponse;
      expect(typeof body.id).toBe('string');
      expect(body.id.length).toBeGreaterThan(0);
      expect(body.title).toBe(payload.title);
      expect(new Date(body.date).toISOString()).toBe(payload.date);
      expect(body.participants).toEqual(payload.participants);
    });

    it('созданная встреча затем доступна в GET /meetings и GET /meetings/:id', async () => {
      const token = await registerUser();

      const created = (
        await request(http)
          .post(MEETINGS)
          .set('Authorization', auth(token))
          .send(meetingPayload({ title: 'Roadmap review' }))
          .expect(201)
      ).body as MeetingResponse;

      const list = (await request(http).get(MEETINGS).set('Authorization', auth(token)).expect(200))
        .body as MeetingResponse[];
      expect(list.map((m) => m.id)).toContain(created.id);

      const one = (
        await request(http)
          .get(`${MEETINGS}/${created.id}`)
          .set('Authorization', auth(token))
          .expect(200)
      ).body as MeetingResponse;
      expect(one.id).toBe(created.id);
      expect(one.title).toBe('Roadmap review');
    });

    it('требует авторизацию — 401 без токена', async () => {
      await request(http).post(MEETINGS).send(meetingPayload()).expect(401);
    });

    it('отклоняет некорректное тело запроса — 400', async () => {
      const token = await registerUser();

      await request(http).post(MEETINGS).set('Authorization', auth(token)).send({}).expect(400);

      await request(http)
        .post(MEETINGS)
        .set('Authorization', auth(token))
        .send(meetingPayload({ title: '' }))
        .expect(400);

      await request(http)
        .post(MEETINGS)
        .set('Authorization', auth(token))
        .send(meetingPayload({ date: 'not-a-date' }))
        .expect(400);

      await request(http)
        .post(MEETINGS)
        .set('Authorization', auth(token))
        .send(meetingPayload({ participants: 'alice@example.com' }))
        .expect(400);
    });
  });

  describe(`GET ${MEETINGS}`, () => {
    // тест #2
    it('возвращает только встречи текущего пользователя', async () => {
      const alice = await registerUser();
      const bob = await registerUser();

      const aliceMeeting = (
        await request(http)
          .post(MEETINGS)
          .set('Authorization', auth(alice))
          .send(meetingPayload({ title: 'Alice 1:1' }))
          .expect(201)
      ).body as MeetingResponse;

      const bobMeeting = (
        await request(http)
          .post(MEETINGS)
          .set('Authorization', auth(bob))
          .send(meetingPayload({ title: 'Bob 1:1' }))
          .expect(201)
      ).body as MeetingResponse;

      const aliceList = (
        await request(http).get(MEETINGS).set('Authorization', auth(alice)).expect(200)
      ).body as MeetingResponse[];

      const ids = aliceList.map((m) => m.id);
      expect(ids).toContain(aliceMeeting.id);
      expect(ids).not.toContain(bobMeeting.id);
    });

    it('требует авторизацию — 401 без токена', async () => {
      await request(http).get(MEETINGS).expect(401);
    });
  });

  describe(`GET ${MEETINGS}/:id`, () => {
    it('возвращает встречу по её ID', async () => {
      const token = await registerUser();

      const created = (
        await request(http)
          .post(MEETINGS)
          .set('Authorization', auth(token))
          .send(meetingPayload())
          .expect(201)
      ).body as MeetingResponse;

      const res = await request(http)
        .get(`${MEETINGS}/${created.id}`)
        .set('Authorization', auth(token));

      expect(res.status).toBe(200);
      expect((res.body as MeetingResponse).id).toBe(created.id);
    });

    it('возвращает 404, если встреча не найдена', async () => {
      const token = await registerUser();

      // Сначала убеждаемся, что ресурс встреч вообще работает (иначе 404 был бы ложным),
      // затем запрашиваем заведомо отсутствующий id.
      await request(http)
        .post(MEETINGS)
        .set('Authorization', auth(token))
        .send(meetingPayload())
        .expect(201);

      await request(http)
        .get(`${MEETINGS}/${randomUUID()}`)
        .set('Authorization', auth(token))
        .expect(404);
    });

    it('возвращает 404 для чужой встречи', async () => {
      const owner = await registerUser();
      const stranger = await registerUser();

      const created = (
        await request(http)
          .post(MEETINGS)
          .set('Authorization', auth(owner))
          .send(meetingPayload())
          .expect(201)
      ).body as MeetingResponse;

      await request(http)
        .get(`${MEETINGS}/${created.id}`)
        .set('Authorization', auth(stranger))
        .expect(404);
    });

    it('требует авторизацию — 401 без токена', async () => {
      await request(http).get(`${MEETINGS}/${randomUUID()}`).expect(401);
    });
  });
});
