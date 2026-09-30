import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MeetingSummaryStatus, TranscriptionStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { OpenRouterService } from './../src/open-router/open-router.service';
import { WhisperTranscriptionService } from './../src/transcription/whisper-transcription.service';

const PASSWORD = 'correct-horse-battery-staple';
const POLL_INTERVAL_MS = 20;
const MAX_POLL_ATTEMPTS = 100;

interface UserSession {
  email: string;
  token: string;
}

interface SummaryResponse {
  status: MeetingSummaryStatus;
  summary: string | null;
  actionItems: { description: string; assignee: string | null }[];
  decisions: string[];
}

const VALID_MODEL_RESPONSE = JSON.stringify({
  summary: 'Обсудили релиз',
  actionItems: [{ description: 'Подготовить релиз', assignee: 'Иван' }],
  decisions: ['Релиз в пятницу'],
});

describe('Meeting summary (e2e)', () => {
  let app: INestApplication<App>;
  let http: App;
  let mockWhisper: { transcribeFile: jest.Mock };
  let mockOpenRouter: { ask: jest.Mock };

  const auth = (token: string): string => `Bearer ${token}`;
  const summaryUrl = (meetingId: string): string => `/meetings/${meetingId}/summary`;

  async function registerUser(): Promise<UserSession> {
    const email = `user-${randomUUID()}@example.com`;
    const res = await request(http)
      .post('/auth/register')
      .send({ email, password: PASSWORD })
      .expect(201);
    return { email, token: (res.body as { accessToken: string }).accessToken };
  }

  async function createMeeting(token: string): Promise<string> {
    const res = await request(http)
      .post('/meetings')
      .set('Authorization', auth(token))
      .send({ title: 'Weekly sync', date: '2026-10-01T10:00:00.000Z', participants: [] })
      .expect(201);
    return (res.body as { id: string }).id;
  }

  async function sleep(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  /** Загружает mp3 и ждёт, пока транскрибация (whisper замокан) станет DONE. */
  async function createMeetingWithDoneTranscription(token: string): Promise<string> {
    mockWhisper.transcribeFile.mockResolvedValue('Привет, мир!');
    const meetingId = await createMeeting(token);
    const uploaded = (
      await request(http)
        .post(`/meetings/${meetingId}/files`)
        .set('Authorization', auth(token))
        .attach('file', Buffer.from('fake mp3 content'), 'record.mp3')
        .expect(201)
    ).body as { id: string };

    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
      const files = (
        await request(http)
          .get(`/meetings/${meetingId}/files`)
          .set('Authorization', auth(token))
          .expect(200)
      ).body as { id: string; transcriptionStatus: TranscriptionStatus }[];
      if (files.find((f) => f.id === uploaded.id)?.transcriptionStatus === 'DONE') {
        return meetingId;
      }
      await sleep();
    }
    throw new Error('Транскрибация не стала DONE за отведённое время');
  }

  async function waitForSummaryStatus(
    token: string,
    meetingId: string,
    expected: MeetingSummaryStatus,
  ): Promise<SummaryResponse> {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
      const body = (
        await request(http).get(summaryUrl(meetingId)).set('Authorization', auth(token)).expect(200)
      ).body as SummaryResponse;
      if (body.status === expected) {
        return body;
      }
      await sleep();
    }
    throw new Error(`Выжимка не достигла статуса ${expected} за отведённое время`);
  }

  beforeAll(async () => {
    mockWhisper = { transcribeFile: jest.fn() };
    mockOpenRouter = { ask: jest.fn() };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(WhisperTranscriptionService)
      .useValue(mockWhisper)
      .overrideProvider(OpenRouterService)
      .useValue(mockOpenRouter)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockWhisper.transcribeFile.mockReset();
    mockOpenRouter.ask.mockReset();
  });

  it('запуск -> IN_PROGRESS -> GET возвращает DONE с тремя разделами', async () => {
    const owner = await registerUser();
    const meetingId = await createMeetingWithDoneTranscription(owner.token);
    let finishGeneration!: (response: string) => void;
    mockOpenRouter.ask.mockReturnValue(
      new Promise<string>((resolve) => {
        finishGeneration = resolve;
      }),
    );

    const started = await request(http)
      .post(summaryUrl(meetingId))
      .set('Authorization', auth(owner.token))
      .expect(202);
    expect((started.body as SummaryResponse).status).toBe(MeetingSummaryStatus.IN_PROGRESS);

    await waitForSummaryStatus(owner.token, meetingId, MeetingSummaryStatus.IN_PROGRESS);
    finishGeneration(VALID_MODEL_RESPONSE);
    const done = await waitForSummaryStatus(owner.token, meetingId, MeetingSummaryStatus.DONE);

    expect(done.summary).toBe('Обсудили релиз');
    expect(done.actionItems).toEqual([{ description: 'Подготовить релиз', assignee: 'Иван' }]);
    expect(done.decisions).toEqual(['Релиз в пятницу']);
    expect(mockOpenRouter.ask).toHaveBeenCalledTimes(1);
  });

  it('повторный POST во время генерации — 409', async () => {
    const owner = await registerUser();
    const meetingId = await createMeetingWithDoneTranscription(owner.token);
    let finishGeneration!: (response: string) => void;
    mockOpenRouter.ask.mockReturnValue(
      new Promise<string>((resolve) => {
        finishGeneration = resolve;
      }),
    );

    await request(http)
      .post(summaryUrl(meetingId))
      .set('Authorization', auth(owner.token))
      .expect(202);
    await request(http)
      .post(summaryUrl(meetingId))
      .set('Authorization', auth(owner.token))
      .expect(409);

    finishGeneration(VALID_MODEL_RESPONSE);
    await waitForSummaryStatus(owner.token, meetingId, MeetingSummaryStatus.DONE);
    expect(mockOpenRouter.ask).toHaveBeenCalledTimes(1);
  });

  it('сбой OpenRouter — статус ERROR без данных, затем повторный запуск разрешён', async () => {
    const owner = await registerUser();
    const meetingId = await createMeetingWithDoneTranscription(owner.token);
    mockOpenRouter.ask.mockRejectedValueOnce(new Error('timeout'));

    await request(http)
      .post(summaryUrl(meetingId))
      .set('Authorization', auth(owner.token))
      .expect(202);
    const failed = await waitForSummaryStatus(owner.token, meetingId, MeetingSummaryStatus.ERROR);
    expect(failed.summary).toBeNull();
    expect(failed.actionItems).toEqual([]);
    expect(failed.decisions).toEqual([]);

    mockOpenRouter.ask.mockResolvedValueOnce(VALID_MODEL_RESPONSE);
    await request(http)
      .post(summaryUrl(meetingId))
      .set('Authorization', auth(owner.token))
      .expect(202);
    await waitForSummaryStatus(owner.token, meetingId, MeetingSummaryStatus.DONE);
  });

  it('встреча без готовых транскрипций — 400, OpenRouter не вызывается', async () => {
    const owner = await registerUser();
    const meetingId = await createMeeting(owner.token);

    await request(http)
      .post(summaryUrl(meetingId))
      .set('Authorization', auth(owner.token))
      .expect(400);
    expect(mockOpenRouter.ask).not.toHaveBeenCalled();
  });

  it('GET без сгенерированной выжимки — 404', async () => {
    const owner = await registerUser();
    const meetingId = await createMeeting(owner.token);

    await request(http)
      .get(summaryUrl(meetingId))
      .set('Authorization', auth(owner.token))
      .expect(404);
  });

  it('пользователь без доступа — 404 на GET и POST', async () => {
    const owner = await registerUser();
    const stranger = await registerUser();
    const meetingId = await createMeetingWithDoneTranscription(owner.token);

    await request(http)
      .get(summaryUrl(meetingId))
      .set('Authorization', auth(stranger.token))
      .expect(404);
    await request(http)
      .post(summaryUrl(meetingId))
      .set('Authorization', auth(stranger.token))
      .expect(404);
    expect(mockOpenRouter.ask).not.toHaveBeenCalled();
  });

  it('требует авторизацию — 401 без токена', async () => {
    await request(http).get(summaryUrl(randomUUID())).expect(401);
    await request(http).post(summaryUrl(randomUUID())).expect(401);
  });
});
