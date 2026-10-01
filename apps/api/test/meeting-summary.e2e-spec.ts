import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MeetingSummaryStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { MeetingSummaryAgentTool } from './../src/meeting-summary/agent/meeting-summary-agent.tools';
import { OpenRouterService } from './../src/open-router/open-router.service';
import { OpenRouterAssistantMessage } from './../src/open-router/open-router.types';
import { WhisperTranscriptionService } from './../src/transcription/whisper-transcription.service';

const PASSWORD = 'correct-horse-battery-staple';
const POLL_INTERVAL_MS = 20;
const MAX_POLL_ATTEMPTS = 150;

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

interface FileResponse {
  id: string;
  transcriptionStatus: string | null;
}

function toolCall(id: string, name: MeetingSummaryAgentTool, args: object = {}) {
  return { id, type: 'function' as const, function: { name, arguments: JSON.stringify(args) } };
}

/** Один шаг агента, в котором он сразу записывает всё и завершает работу. */
const SUCCESSFUL_AGENT_STEP: OpenRouterAssistantMessage = {
  content: null,
  toolCalls: [
    toolCall('1', MeetingSummaryAgentTool.SET_SUMMARY, { summary: 'Обсудили релиз' }),
    toolCall('2', MeetingSummaryAgentTool.ADD_ACTION_ITEM, {
      description: 'Подготовить релиз',
      assignee: 'Иван',
    }),
    toolCall('3', MeetingSummaryAgentTool.ADD_DECISION, { decision: 'Релиз в пятницу' }),
    toolCall('4', MeetingSummaryAgentTool.FINISH),
  ],
};

describe('Meeting summary (e2e)', () => {
  let app: INestApplication<App>;
  let http: App;
  let mockWhisper: { transcribeFile: jest.Mock };
  let mockOpenRouter: { chat: jest.Mock };

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

  async function uploadMp3(token: string, meetingId: string): Promise<string> {
    const res = await request(http)
      .post(`/meetings/${meetingId}/files`)
      .set('Authorization', auth(token))
      .attach('file', Buffer.from('fake mp3 content'), 'record.mp3')
      .expect(201);
    return (res.body as { id: string }).id;
  }

  async function waitForFileStatus(
    token: string,
    meetingId: string,
    fileId: string,
    expected: string,
  ): Promise<void> {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
      const files = (
        await request(http)
          .get(`/meetings/${meetingId}/files`)
          .set('Authorization', auth(token))
          .expect(200)
      ).body as FileResponse[];
      if (files.find((file) => file.id === fileId)?.transcriptionStatus === expected) {
        return;
      }
      await sleep();
    }
    throw new Error(`Транскрибация не достигла статуса ${expected} за отведённое время`);
  }

  async function waitForSummaryStatus(
    token: string,
    meetingId: string,
    expected: MeetingSummaryStatus,
  ): Promise<SummaryResponse> {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
      const res = await request(http).get(summaryUrl(meetingId)).set('Authorization', auth(token));
      const body = res.body as SummaryResponse;
      if (res.status === 200 && body.status === expected) {
        return body;
      }
      await sleep();
    }
    throw new Error(`Выжимка не достигла статуса ${expected} за отведённое время`);
  }

  /** Мок, который «зависает» до вызова `release` — позволяет наблюдать промежуточные статусы. */
  function deferred<T>(): { promise: Promise<T>; release: (value: T) => void } {
    let release!: (value: T) => void;
    const promise = new Promise<T>((resolve) => {
      release = resolve;
    });
    return { promise, release };
  }

  beforeAll(async () => {
    mockWhisper = { transcribeFile: jest.fn() };
    mockOpenRouter = { chat: jest.fn() };

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
    mockWhisper.transcribeFile.mockReset().mockResolvedValue('Привет, мир!');
    mockOpenRouter.chat.mockReset().mockResolvedValue(SUCCESSFUL_AGENT_STEP);
  });

  it('после загрузки и транскрибации выжимка создаётся сама, без POST', async () => {
    const owner = await registerUser();
    const meetingId = await createMeeting(owner.token);

    await uploadMp3(owner.token, meetingId);
    const done = await waitForSummaryStatus(owner.token, meetingId, MeetingSummaryStatus.DONE);

    expect(done.summary).toBe('Обсудили релиз');
    expect(done.actionItems).toEqual([{ description: 'Подготовить релиз', assignee: 'Иван' }]);
    expect(done.decisions).toEqual(['Релиз в пятницу']);
    expect(mockOpenRouter.chat).toHaveBeenCalledTimes(1);
  });

  it('во время генерации статус IN_PROGRESS, повторный POST — 409', async () => {
    const owner = await registerUser();
    const meetingId = await createMeeting(owner.token);
    const agentStep = deferred<OpenRouterAssistantMessage>();
    mockOpenRouter.chat.mockReturnValue(agentStep.promise);

    await uploadMp3(owner.token, meetingId);
    await waitForSummaryStatus(owner.token, meetingId, MeetingSummaryStatus.IN_PROGRESS);
    await request(http)
      .post(summaryUrl(meetingId))
      .set('Authorization', auth(owner.token))
      .expect(409);

    agentStep.release(SUCCESSFUL_AGENT_STEP);
    await waitForSummaryStatus(owner.token, meetingId, MeetingSummaryStatus.DONE);
    expect(mockOpenRouter.chat).toHaveBeenCalledTimes(1);
  });

  it('при нескольких файлах генерация стартует только после завершения всех транскрибаций', async () => {
    const owner = await registerUser();
    const meetingId = await createMeeting(owner.token);
    const firstTranscription = deferred<string>();
    const secondTranscription = deferred<string>();
    mockWhisper.transcribeFile
      .mockReturnValueOnce(firstTranscription.promise)
      .mockReturnValueOnce(secondTranscription.promise);

    const firstFileId = await uploadMp3(owner.token, meetingId);
    await waitForFileStatus(owner.token, meetingId, firstFileId, 'IN_PROGRESS');
    const secondFileId = await uploadMp3(owner.token, meetingId);
    await waitForFileStatus(owner.token, meetingId, secondFileId, 'IN_PROGRESS');

    firstTranscription.release('Первая запись');
    await waitForFileStatus(owner.token, meetingId, firstFileId, 'DONE');

    // Второй файл ещё транскрибируется — выжимка не запускалась.
    await request(http)
      .get(summaryUrl(meetingId))
      .set('Authorization', auth(owner.token))
      .expect(404);
    expect(mockOpenRouter.chat).not.toHaveBeenCalled();

    secondTranscription.release('Вторая запись');
    await waitForSummaryStatus(owner.token, meetingId, MeetingSummaryStatus.DONE);

    expect(mockOpenRouter.chat).toHaveBeenCalledTimes(1);
    const [chatRequest] = mockOpenRouter.chat.mock.calls[0] as [
      { messages: { content: string }[] },
    ];
    expect(chatRequest.messages[1].content).toContain('Первая запись');
    expect(chatRequest.messages[1].content).toContain('Вторая запись');
  });

  it('сбой агента — статус ERROR без данных, затем повторный запуск через POST', async () => {
    const owner = await registerUser();
    const meetingId = await createMeeting(owner.token);
    mockOpenRouter.chat.mockRejectedValueOnce(new Error('timeout'));

    await uploadMp3(owner.token, meetingId);
    const failed = await waitForSummaryStatus(owner.token, meetingId, MeetingSummaryStatus.ERROR);
    expect(failed.summary).toBeNull();
    expect(failed.actionItems).toEqual([]);
    expect(failed.decisions).toEqual([]);

    await request(http)
      .post(summaryUrl(meetingId))
      .set('Authorization', auth(owner.token))
      .expect(202);
    await waitForSummaryStatus(owner.token, meetingId, MeetingSummaryStatus.DONE);
  });

  it('новая транскрибация пересобирает выжимку по всем готовым файлам', async () => {
    const owner = await registerUser();
    const meetingId = await createMeeting(owner.token);
    const secondTranscription = deferred<string>();
    mockWhisper.transcribeFile
      .mockResolvedValueOnce('Первая запись')
      .mockReturnValueOnce(secondTranscription.promise);

    const firstFileId = await uploadMp3(owner.token, meetingId);
    await waitForFileStatus(owner.token, meetingId, firstFileId, 'DONE');
    await waitForSummaryStatus(owner.token, meetingId, MeetingSummaryStatus.DONE);
    mockOpenRouter.chat.mockClear();

    const secondFileId = await uploadMp3(owner.token, meetingId);
    await waitForFileStatus(owner.token, meetingId, secondFileId, 'IN_PROGRESS');
    secondTranscription.release('Вторая запись');
    await waitForFileStatus(owner.token, meetingId, secondFileId, 'DONE');

    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
      if (mockOpenRouter.chat.mock.calls.length > 0) break;
      await sleep();
    }
    expect(mockOpenRouter.chat).toHaveBeenCalledTimes(1);
  });

  it('встреча без готовых транскрипций — POST даёт 400, агент не вызывается', async () => {
    const owner = await registerUser();
    const meetingId = await createMeeting(owner.token);

    await request(http)
      .post(summaryUrl(meetingId))
      .set('Authorization', auth(owner.token))
      .expect(400);
    expect(mockOpenRouter.chat).not.toHaveBeenCalled();
  });

  it('GET без выжимки — 404', async () => {
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
    const meetingId = await createMeeting(owner.token);
    await uploadMp3(owner.token, meetingId);
    await waitForSummaryStatus(owner.token, meetingId, MeetingSummaryStatus.DONE);
    mockOpenRouter.chat.mockClear();

    await request(http)
      .get(summaryUrl(meetingId))
      .set('Authorization', auth(stranger.token))
      .expect(404);
    await request(http)
      .post(summaryUrl(meetingId))
      .set('Authorization', auth(stranger.token))
      .expect(404);
    expect(mockOpenRouter.chat).not.toHaveBeenCalled();
  });

  it('требует авторизацию — 401 без токена', async () => {
    await request(http).get(summaryUrl(randomUUID())).expect(401);
    await request(http).post(summaryUrl(randomUUID())).expect(401);
  });
});
