import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MeetingSummaryStatus, Prisma, TranscriptionStatus } from '@prisma/client';
import { JwtPayload } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { MeetingSummaryAgentService } from './agent/meeting-summary-agent.service';
import { MeetingSummaryService } from './meeting-summary.service';

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('MeetingSummaryService', () => {
  const owner: JwtPayload = { sub: 'owner-id', email: 'owner@example.com', tokenVersion: 0 };
  const stranger: JwtPayload = { sub: 'stranger-id', email: 'x@example.com', tokenVersion: 0 };
  const meeting = { id: 'meeting-1', ownerId: owner.sub, participants: [] };

  const agentResult = {
    summary: 'Обсудили релиз',
    actionItems: [
      { description: 'Подготовить релиз', assignee: 'Иван' },
      { description: 'Обновить доку', assignee: null },
    ],
    decisions: ['Релиз в пятницу'],
  };

  let prisma: {
    meeting: { findUnique: jest.Mock };
    meetingFile: { findMany: jest.Mock; count: jest.Mock };
    meetingSummary: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let summaryAgent: { run: jest.Mock };
  let service: MeetingSummaryService;

  beforeEach(() => {
    prisma = {
      meeting: { findUnique: jest.fn().mockResolvedValue(meeting) },
      meetingFile: {
        findMany: jest.fn().mockResolvedValue([{ transcriptionText: 'Первая запись' }]),
        count: jest.fn().mockResolvedValue(0),
      },
      meetingSummary: {
        findUnique: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ status: MeetingSummaryStatus.IN_PROGRESS }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({ status: MeetingSummaryStatus.IN_PROGRESS }),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
    summaryAgent = { run: jest.fn().mockResolvedValue(agentResult) };
    service = new MeetingSummaryService(
      prisma as unknown as PrismaService,
      summaryAgent as unknown as MeetingSummaryAgentService,
    );
  });

  it('requests only DONE transcriptions and passes their text to the agent', async () => {
    prisma.meetingFile.findMany.mockResolvedValue([
      { transcriptionText: 'Первая запись' },
      { transcriptionText: 'Вторая запись' },
    ]);

    await service.generate(meeting.id);

    expect(prisma.meetingFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { meetingId: meeting.id, transcriptionStatus: TranscriptionStatus.DONE },
      }),
    );
    expect(summaryAgent.run).toHaveBeenCalledWith(['Первая запись', 'Вторая запись']);
  });

  it('saves a valid response with DONE status', async () => {
    await service.generate(meeting.id);

    expect(prisma.meetingSummary.update).toHaveBeenCalledWith({
      where: { meetingId: meeting.id },
      data: {
        status: MeetingSummaryStatus.DONE,
        summary: 'Обсудили релиз',
        actionItems: [
          { description: 'Подготовить релиз', assignee: 'Иван' },
          { description: 'Обновить доку', assignee: null },
        ],
        decisions: ['Релиз в пятницу'],
      },
    });
  });

  it('replaces previous action items and decisions on regeneration', async () => {
    await service.generate(meeting.id);
    summaryAgent.run.mockResolvedValue({ summary: 'Новое', actionItems: [], decisions: [] });
    await service.generate(meeting.id);

    expect(prisma.meetingSummary.update).toHaveBeenLastCalledWith({
      where: { meetingId: meeting.id },
      data: {
        status: MeetingSummaryStatus.DONE,
        summary: 'Новое',
        actionItems: [],
        decisions: [],
      },
    });
  });

  it('marks the summary as ERROR without saving data when the agent fails validation', async () => {
    summaryAgent.run.mockRejectedValue(new Error('Агент не записал summary'));

    await expect(service.generate(meeting.id)).rejects.toThrow();

    expect(prisma.meetingSummary.update).toHaveBeenCalledTimes(1);
    expect(prisma.meetingSummary.update).toHaveBeenCalledWith({
      where: { meetingId: meeting.id },
      data: { status: MeetingSummaryStatus.ERROR },
    });
  });

  it('marks the summary as ERROR without saving data when OpenRouter fails', async () => {
    summaryAgent.run.mockRejectedValue(new Error('timeout'));

    await expect(service.generate(meeting.id)).rejects.toThrow('timeout');

    expect(prisma.meetingSummary.update).toHaveBeenCalledTimes(1);
    expect(prisma.meetingSummary.update).toHaveBeenCalledWith({
      where: { meetingId: meeting.id },
      data: { status: MeetingSummaryStatus.ERROR },
    });
  });

  describe('getSummary', () => {
    it('returns the stored summary without triggering generation', async () => {
      const stored = { status: MeetingSummaryStatus.DONE, summary: 'Готово' };
      prisma.meetingSummary.findUnique.mockResolvedValue(stored);

      await expect(service.getSummary(owner, meeting.id)).resolves.toBe(stored);
      expect(summaryAgent.run).not.toHaveBeenCalled();
    });

    it('throws NotFound when there is no summary yet', async () => {
      await expect(service.getSummary(owner, meeting.id)).rejects.toThrow(NotFoundException);
    });

    it('hides a meeting from a non-member', async () => {
      await expect(service.getSummary(stranger, meeting.id)).rejects.toThrow(NotFoundException);
      expect(prisma.meetingSummary.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('startGeneration', () => {
    it('sets IN_PROGRESS and returns without waiting for generation', async () => {
      summaryAgent.run.mockReturnValue(new Promise(() => undefined));

      const result = await service.startGeneration(owner, meeting.id);

      expect(prisma.meetingSummary.updateMany).toHaveBeenCalledWith({
        where: { meetingId: meeting.id, status: { not: MeetingSummaryStatus.IN_PROGRESS } },
        data: { status: MeetingSummaryStatus.IN_PROGRESS },
      });
      expect(result.status).toBe(MeetingSummaryStatus.IN_PROGRESS);
    });

    it('creates the summary when it does not exist yet', async () => {
      prisma.meetingSummary.updateMany.mockResolvedValue({ count: 0 });

      await service.startGeneration(owner, meeting.id);

      expect(prisma.meetingSummary.create).toHaveBeenCalledWith({
        data: { meetingId: meeting.id, status: MeetingSummaryStatus.IN_PROGRESS },
      });
    });

    it('rejects with 409 when generation is already in progress', async () => {
      prisma.meetingSummary.updateMany.mockResolvedValue({ count: 0 });
      prisma.meetingSummary.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(service.startGeneration(owner, meeting.id)).rejects.toThrow(ConflictException);
      expect(summaryAgent.run).not.toHaveBeenCalled();
    });

    it('rejects when there are no DONE transcriptions', async () => {
      prisma.meetingFile.findMany.mockResolvedValue([]);

      await expect(service.startGeneration(owner, meeting.id)).rejects.toThrow(BadRequestException);
      expect(prisma.meetingSummary.updateMany).not.toHaveBeenCalled();
      expect(summaryAgent.run).not.toHaveBeenCalled();
    });

    it('allows a restart after ERROR', async () => {
      await expect(service.startGeneration(owner, meeting.id)).resolves.toBeDefined();
      expect(prisma.meetingSummary.updateMany).toHaveBeenCalledTimes(1);
    });

    it('hides a meeting from a non-member', async () => {
      await expect(service.startGeneration(stranger, meeting.id)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.meetingSummary.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('startAutoGeneration', () => {
    it('starts generation when all files are transcribed', async () => {
      await service.startAutoGeneration(meeting.id);

      expect(prisma.meetingSummary.updateMany).toHaveBeenCalledTimes(1);
      await flushPromises();
      expect(summaryAgent.run).toHaveBeenCalledWith(['Первая запись']);
    });

    it('does nothing while some files are still QUEUED or IN_PROGRESS', async () => {
      prisma.meetingFile.count.mockResolvedValue(1);

      await service.startAutoGeneration(meeting.id);

      expect(prisma.meetingFile.count).toHaveBeenCalledWith({
        where: {
          meetingId: meeting.id,
          transcriptionStatus: {
            in: [TranscriptionStatus.QUEUED, TranscriptionStatus.IN_PROGRESS],
          },
        },
      });
      expect(prisma.meetingSummary.updateMany).not.toHaveBeenCalled();
      expect(summaryAgent.run).not.toHaveBeenCalled();
    });

    it('does nothing when there are no DONE transcriptions', async () => {
      prisma.meetingFile.findMany.mockResolvedValue([]);

      await service.startAutoGeneration(meeting.id);

      expect(prisma.meetingSummary.updateMany).not.toHaveBeenCalled();
    });

    it('reruns generation after the current one when a new transcription arrives meanwhile', async () => {
      let finishFirstRun!: (value: typeof agentResult) => void;
      summaryAgent.run.mockReturnValueOnce(
        new Promise((resolve) => {
          finishFirstRun = resolve;
        }),
      );

      await service.startAutoGeneration(meeting.id);
      // Генерация уже идёт: второй захват отклоняется с 409 и ставит повторный прогон.
      prisma.meetingSummary.updateMany.mockResolvedValueOnce({ count: 0 });
      prisma.meetingSummary.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      await service.startAutoGeneration(meeting.id);
      expect(summaryAgent.run).toHaveBeenCalledTimes(1);

      finishFirstRun(agentResult);
      await flushPromises();

      expect(summaryAgent.run).toHaveBeenCalledTimes(2);
    });
  });
});
