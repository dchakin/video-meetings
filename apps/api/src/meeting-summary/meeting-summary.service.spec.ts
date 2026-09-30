import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MeetingSummaryStatus, Prisma, TranscriptionStatus } from '@prisma/client';
import { JwtPayload } from '../auth/auth.types';
import { OpenRouterService } from '../open-router/open-router.service';
import { PrismaService } from '../prisma/prisma.service';
import { MeetingSummaryService } from './meeting-summary.service';

describe('MeetingSummaryService', () => {
  const owner: JwtPayload = { sub: 'owner-id', email: 'owner@example.com', tokenVersion: 0 };
  const stranger: JwtPayload = { sub: 'stranger-id', email: 'x@example.com', tokenVersion: 0 };
  const meeting = { id: 'meeting-1', ownerId: owner.sub, participants: [] };

  const validResponse = JSON.stringify({
    summary: 'Обсудили релиз',
    actionItems: [
      { description: 'Подготовить релиз', assignee: 'Иван' },
      { description: 'Обновить доку', assignee: null },
    ],
    decisions: ['Релиз в пятницу'],
  });

  let prisma: {
    meeting: { findUnique: jest.Mock };
    meetingFile: { findMany: jest.Mock };
    meetingSummary: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let openRouter: { ask: jest.Mock };
  let service: MeetingSummaryService;

  beforeEach(() => {
    prisma = {
      meeting: { findUnique: jest.fn().mockResolvedValue(meeting) },
      meetingFile: {
        findMany: jest.fn().mockResolvedValue([{ transcriptionText: 'Первая запись' }]),
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
    openRouter = { ask: jest.fn().mockResolvedValue(validResponse) };
    service = new MeetingSummaryService(
      prisma as unknown as PrismaService,
      openRouter as unknown as OpenRouterService,
    );
  });

  it('requests only DONE transcriptions and puts their text into the prompt', async () => {
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
    const [prompt] = openRouter.ask.mock.calls[0] as [string];
    expect(prompt).toContain('Первая запись');
    expect(prompt).toContain('Вторая запись');
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
    openRouter.ask.mockResolvedValue(
      JSON.stringify({ summary: 'Новое', actionItems: [], decisions: [] }),
    );
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

  it('marks the summary as ERROR without saving data when the response is invalid', async () => {
    openRouter.ask.mockResolvedValue('not a json');

    await expect(service.generate(meeting.id)).rejects.toThrow();

    expect(prisma.meetingSummary.update).toHaveBeenCalledTimes(1);
    expect(prisma.meetingSummary.update).toHaveBeenCalledWith({
      where: { meetingId: meeting.id },
      data: { status: MeetingSummaryStatus.ERROR },
    });
  });

  it('marks the summary as ERROR without saving data when OpenRouter fails', async () => {
    openRouter.ask.mockRejectedValue(new Error('timeout'));

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
      expect(openRouter.ask).not.toHaveBeenCalled();
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
      openRouter.ask.mockReturnValue(new Promise(() => undefined));

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
      expect(openRouter.ask).not.toHaveBeenCalled();
    });

    it('rejects when there are no DONE transcriptions', async () => {
      prisma.meetingFile.findMany.mockResolvedValue([]);

      await expect(service.startGeneration(owner, meeting.id)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.meetingSummary.updateMany).not.toHaveBeenCalled();
      expect(openRouter.ask).not.toHaveBeenCalled();
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
});
