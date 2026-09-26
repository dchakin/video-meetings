import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TranscriptionStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { WhisperTranscriptionService } from './../src/transcription/whisper-transcription.service';

const REGISTER = '/auth/register';
const MEETINGS = '/meetings';

const PASSWORD = 'correct-horse-battery-staple';
const uniqueEmail = (): string => `user-${randomUUID()}@example.com`;

interface UserSession {
  email: string;
  token: string;
}

interface MeetingResponse {
  id: string;
  title: string;
  date: string;
  participants: string[];
}

interface MeetingFileResponse {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  transcriptionStatus: TranscriptionStatus | null;
  transcriptionText: string | null;
}

function meetingPayload(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    title: 'Weekly sync',
    date: '2026-10-01T10:00:00.000Z',
    participants: [],
    ...overrides,
  };
}

/** Опрашивает список файлов встречи, пока статус транскрибации целевого файла не станет терминальным. */
async function waitForTranscriptionStatus(
  http: App,
  token: string,
  meetingId: string,
  fileId: string,
  terminalStatuses: TranscriptionStatus[],
): Promise<MeetingFileResponse> {
  const POLL_INTERVAL_MS = 20;
  const MAX_ATTEMPTS = 100;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const list = (
      await request(http)
        .get(`/meetings/${meetingId}/files`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
    ).body as MeetingFileResponse[];
    const found = list.find((f) => f.id === fileId);
    if (
      found &&
      found.transcriptionStatus &&
      terminalStatuses.includes(found.transcriptionStatus)
    ) {
      return found;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error('Транскрибация не достигла терминального статуса за отведённое время');
}

describe('Meeting files (e2e)', () => {
  let app: INestApplication<App>;
  let http: App;
  let mockWhisperTranscriptionService: { transcribeFile: jest.Mock };

  async function registerUser(): Promise<UserSession> {
    const email = uniqueEmail();
    const res = await request(http).post(REGISTER).send({ email, password: PASSWORD }).expect(201);
    return { email, token: (res.body as { accessToken: string }).accessToken };
  }

  const auth = (token: string): string => `Bearer ${token}`;

  async function createMeeting(
    token: string,
    overrides: Partial<Record<string, unknown>> = {},
  ): Promise<MeetingResponse> {
    return (
      await request(http)
        .post(MEETINGS)
        .set('Authorization', auth(token))
        .send(meetingPayload(overrides))
        .expect(201)
    ).body as MeetingResponse;
  }

  const filesUrl = (meetingId: string): string => `${MEETINGS}/${meetingId}/files`;

  beforeAll(async () => {
    mockWhisperTranscriptionService = { transcribeFile: jest.fn() };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(WhisperTranscriptionService)
      .useValue(mockWhisperTranscriptionService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockWhisperTranscriptionService.transcribeFile.mockReset();
  });

  describe('POST /meetings/:id/files', () => {
    it('владелец встречи загружает файл', async () => {
      const owner = await registerUser();
      const meeting = await createMeeting(owner.token);

      const res = await request(http)
        .post(filesUrl(meeting.id))
        .set('Authorization', auth(owner.token))
        .attach('file', Buffer.from('hello world'), 'notes.txt');

      expect(res.status).toBe(201);
      const body = res.body as MeetingFileResponse;
      expect(body.fileName).toBe('notes.txt');
      expect(body.mimeType).toBe('text/plain');
      expect(body.size).toBe(Buffer.byteLength('hello world'));
      expect(typeof body.id).toBe('string');
    });

    it('отклоняет файл сверх лимита размера — 413, без сохранения на диск', async () => {
      const owner = await registerUser();
      const meeting = await createMeeting(owner.token);

      const tooBig = Buffer.alloc(11 * 1024 * 1024, 'a'); // лимит по умолчанию — 10MB
      await request(http)
        .post(filesUrl(meeting.id))
        .set('Authorization', auth(owner.token))
        .attach('file', tooBig, 'huge.bin')
        .expect(413);

      const list = (
        await request(http)
          .get(filesUrl(meeting.id))
          .set('Authorization', auth(owner.token))
          .expect(200)
      ).body as MeetingFileResponse[];
      expect(list).toHaveLength(0);
    });

    it('запрещает загрузку не-владельцем — 404', async () => {
      const owner = await registerUser();
      const stranger = await registerUser();
      const meeting = await createMeeting(owner.token);

      await request(http)
        .post(filesUrl(meeting.id))
        .set('Authorization', auth(stranger.token))
        .attach('file', Buffer.from('hello'), 'notes.txt')
        .expect(404);
    });

    it('требует авторизацию — 401 без токена', async () => {
      const owner = await registerUser();
      const meeting = await createMeeting(owner.token);

      await request(http)
        .post(filesUrl(meeting.id))
        .attach('file', Buffer.from('hello'), 'notes.txt')
        .expect(401);
    });

    it('возвращает 400, если файл не передан', async () => {
      const owner = await registerUser();
      const meeting = await createMeeting(owner.token);

      await request(http)
        .post(filesUrl(meeting.id))
        .set('Authorization', auth(owner.token))
        .expect(400);
    });
  });

  const downloadUrl = (meetingId: string, fileId: string): string =>
    `${filesUrl(meetingId)}/${fileId}/download`;
  const fileUrl = (meetingId: string, fileId: string): string => `${filesUrl(meetingId)}/${fileId}`;

  async function uploadFile(
    token: string,
    meetingId: string,
    content: string,
    fileName: string,
  ): Promise<MeetingFileResponse> {
    return (
      await request(http)
        .post(filesUrl(meetingId))
        .set('Authorization', auth(token))
        .attach('file', Buffer.from(content), fileName)
        .expect(201)
    ).body as MeetingFileResponse;
  }

  describe('GET /meetings/:id/files/:fileId/download', () => {
    it('владелец скачивает файл — содержимое совпадает побайтово', async () => {
      const owner = await registerUser();
      const meeting = await createMeeting(owner.token);
      const uploaded = await uploadFile(owner.token, meeting.id, 'hello world', 'notes.txt');

      const res = await request(http)
        .get(downloadUrl(meeting.id, uploaded.id))
        .set('Authorization', auth(owner.token))
        .expect(200);

      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.text).toBe('hello world');
    });

    it('участник встречи скачивает файл', async () => {
      const owner = await registerUser();
      const participant = await registerUser();
      const meeting = await createMeeting(owner.token, { participants: [participant.email] });
      const uploaded = await uploadFile(owner.token, meeting.id, 'hello', 'a.txt');

      const res = await request(http)
        .get(downloadUrl(meeting.id, uploaded.id))
        .set('Authorization', auth(participant.token))
        .expect(200);

      expect(res.text).toBe('hello');
    });

    it('запрещает скачивание постороннему — 404', async () => {
      const owner = await registerUser();
      const stranger = await registerUser();
      const meeting = await createMeeting(owner.token);
      const uploaded = await uploadFile(owner.token, meeting.id, 'hello', 'a.txt');

      await request(http)
        .get(downloadUrl(meeting.id, uploaded.id))
        .set('Authorization', auth(stranger.token))
        .expect(404);
    });

    it('возвращает 404 для несуществующего файла', async () => {
      const owner = await registerUser();
      const meeting = await createMeeting(owner.token);

      await request(http)
        .get(downloadUrl(meeting.id, randomUUID()))
        .set('Authorization', auth(owner.token))
        .expect(404);
    });

    it('требует авторизацию — 401 без токена', async () => {
      const owner = await registerUser();
      const meeting = await createMeeting(owner.token);
      const uploaded = await uploadFile(owner.token, meeting.id, 'hello', 'a.txt');

      await request(http).get(downloadUrl(meeting.id, uploaded.id)).expect(401);
    });
  });

  describe('DELETE /meetings/:id/files/:fileId', () => {
    it('владелец удаляет файл — пропадает из списка и недоступен для скачивания', async () => {
      const owner = await registerUser();
      const meeting = await createMeeting(owner.token);
      const uploaded = await uploadFile(owner.token, meeting.id, 'hello', 'a.txt');

      await request(http)
        .delete(fileUrl(meeting.id, uploaded.id))
        .set('Authorization', auth(owner.token))
        .expect(204);

      const list = (
        await request(http)
          .get(filesUrl(meeting.id))
          .set('Authorization', auth(owner.token))
          .expect(200)
      ).body as MeetingFileResponse[];
      expect(list).toHaveLength(0);

      await request(http)
        .get(downloadUrl(meeting.id, uploaded.id))
        .set('Authorization', auth(owner.token))
        .expect(404);
    });

    it('запрещает удаление участнику без прав владельца — 404', async () => {
      const owner = await registerUser();
      const participant = await registerUser();
      const meeting = await createMeeting(owner.token, { participants: [participant.email] });
      const uploaded = await uploadFile(owner.token, meeting.id, 'hello', 'a.txt');

      await request(http)
        .delete(fileUrl(meeting.id, uploaded.id))
        .set('Authorization', auth(participant.token))
        .expect(404);
    });

    it('запрещает удаление постороннему — 404', async () => {
      const owner = await registerUser();
      const stranger = await registerUser();
      const meeting = await createMeeting(owner.token);
      const uploaded = await uploadFile(owner.token, meeting.id, 'hello', 'a.txt');

      await request(http)
        .delete(fileUrl(meeting.id, uploaded.id))
        .set('Authorization', auth(stranger.token))
        .expect(404);
    });

    it('возвращает 404 для несуществующего файла', async () => {
      const owner = await registerUser();
      const meeting = await createMeeting(owner.token);

      await request(http)
        .delete(fileUrl(meeting.id, randomUUID()))
        .set('Authorization', auth(owner.token))
        .expect(404);
    });

    it('требует авторизацию — 401 без токена', async () => {
      const owner = await registerUser();
      const meeting = await createMeeting(owner.token);
      const uploaded = await uploadFile(owner.token, meeting.id, 'hello', 'a.txt');

      await request(http).delete(fileUrl(meeting.id, uploaded.id)).expect(401);
    });
  });

  describe('GET /meetings/:id/files', () => {
    it('владелец видит список загруженных файлов', async () => {
      const owner = await registerUser();
      const meeting = await createMeeting(owner.token);

      await request(http)
        .post(filesUrl(meeting.id))
        .set('Authorization', auth(owner.token))
        .attach('file', Buffer.from('hello'), 'a.txt')
        .expect(201);
      await request(http)
        .post(filesUrl(meeting.id))
        .set('Authorization', auth(owner.token))
        .attach('file', Buffer.from('world'), 'b.txt')
        .expect(201);

      const list = (
        await request(http)
          .get(filesUrl(meeting.id))
          .set('Authorization', auth(owner.token))
          .expect(200)
      ).body as MeetingFileResponse[];

      expect(list).toHaveLength(2);
      expect(list.map((f) => f.fileName).sort()).toEqual(['a.txt', 'b.txt']);
    });

    it('участник встречи видит список файлов', async () => {
      const owner = await registerUser();
      const participant = await registerUser();
      const meeting = await createMeeting(owner.token, { participants: [participant.email] });

      await request(http)
        .post(filesUrl(meeting.id))
        .set('Authorization', auth(owner.token))
        .attach('file', Buffer.from('hello'), 'a.txt')
        .expect(201);

      const list = (
        await request(http)
          .get(filesUrl(meeting.id))
          .set('Authorization', auth(participant.token))
          .expect(200)
      ).body as MeetingFileResponse[];

      expect(list.map((f) => f.fileName)).toEqual(['a.txt']);
    });

    it('запрещает доступ постороннему — 404', async () => {
      const owner = await registerUser();
      const stranger = await registerUser();
      const meeting = await createMeeting(owner.token);

      await request(http)
        .get(filesUrl(meeting.id))
        .set('Authorization', auth(stranger.token))
        .expect(404);
    });

    it('требует авторизацию — 401 без токена', async () => {
      const owner = await registerUser();
      const meeting = await createMeeting(owner.token);

      await request(http).get(filesUrl(meeting.id)).expect(401);
    });
  });

  describe('транскрибация', () => {
    it('mp3 — статус QUEUED сразу, затем DONE с текстом (whisper-сервис замокан)', async () => {
      mockWhisperTranscriptionService.transcribeFile.mockResolvedValue('Привет, мир!');
      const owner = await registerUser();
      const meeting = await createMeeting(owner.token);

      const uploaded = (
        await request(http)
          .post(filesUrl(meeting.id))
          .set('Authorization', auth(owner.token))
          .attach('file', Buffer.from('fake mp3 content'), 'record.mp3')
          .expect(201)
      ).body as MeetingFileResponse;

      expect(uploaded.transcriptionStatus).toBe(TranscriptionStatus.QUEUED);
      expect(uploaded.transcriptionText).toBeNull();

      const done = await waitForTranscriptionStatus(http, owner.token, meeting.id, uploaded.id, [
        TranscriptionStatus.DONE,
        TranscriptionStatus.ERROR,
      ]);

      expect(done.transcriptionStatus).toBe(TranscriptionStatus.DONE);
      expect(done.transcriptionText).toBe('Привет, мир!');
      expect(mockWhisperTranscriptionService.transcribeFile).toHaveBeenCalledWith(
        expect.stringContaining('.mp3'),
        'audio/mpeg',
      );
    });

    it('mp4 — статус переходит в ERROR при сбое whisper-сервиса, upload не падает', async () => {
      mockWhisperTranscriptionService.transcribeFile.mockRejectedValue(
        new Error('whisper упал в тесте'),
      );
      const owner = await registerUser();
      const meeting = await createMeeting(owner.token);

      const uploaded = (
        await request(http)
          .post(filesUrl(meeting.id))
          .set('Authorization', auth(owner.token))
          .attach('file', Buffer.from('fake mp4 content'), 'record.mp4')
          .expect(201)
      ).body as MeetingFileResponse;

      expect(uploaded.transcriptionStatus).toBe(TranscriptionStatus.QUEUED);

      const failed = await waitForTranscriptionStatus(http, owner.token, meeting.id, uploaded.id, [
        TranscriptionStatus.DONE,
        TranscriptionStatus.ERROR,
      ]);

      expect(failed.transcriptionStatus).toBe(TranscriptionStatus.ERROR);
      expect(failed.transcriptionText).toBeNull();
    });

    it('файл другого формата (pdf) — транскрибация не запускается, статус null', async () => {
      const owner = await registerUser();
      const meeting = await createMeeting(owner.token);

      const uploaded = (
        await request(http)
          .post(filesUrl(meeting.id))
          .set('Authorization', auth(owner.token))
          .attach('file', Buffer.from('%PDF-1.4 fake content'), 'doc.pdf')
          .expect(201)
      ).body as MeetingFileResponse;

      expect(uploaded.transcriptionStatus).toBeNull();
      expect(uploaded.transcriptionText).toBeNull();
      expect(mockWhisperTranscriptionService.transcribeFile).not.toHaveBeenCalled();
    });
  });
});
