import { NotFoundException } from '@nestjs/common';
import { JwtPayload } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { MeetingService } from './meeting.service';

describe('MeetingService', () => {
  const owner: JwtPayload = { sub: 'owner-id', email: 'owner@example.com', tokenVersion: 0 };
  const participant: JwtPayload = {
    sub: 'participant-id',
    email: 'participant@example.com',
    tokenVersion: 0,
  };
  const stranger: JwtPayload = {
    sub: 'stranger-id',
    email: 'stranger@example.com',
    tokenVersion: 0,
  };

  const meeting = {
    id: 'meeting-1',
    ownerId: owner.sub,
    title: 'Sync',
    date: new Date('2026-01-01'),
    participants: [participant.email],
    createdAt: new Date(),
  };

  let prisma: {
    meeting: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock };
  };
  let service: MeetingService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      meeting: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    };
    service = new MeetingService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('создаёт встречу с переданным владельцем и данными', async () => {
      const dto: CreateMeetingDto = {
        title: meeting.title,
        date: meeting.date.toISOString(),
        participants: meeting.participants,
      };
      prisma.meeting.create.mockResolvedValue(meeting);

      await expect(service.create(owner.sub, dto)).resolves.toEqual(meeting);
      expect(prisma.meeting.create).toHaveBeenCalledWith({
        data: {
          ownerId: owner.sub,
          title: dto.title,
          date: new Date(dto.date),
          participants: dto.participants,
        },
      });
    });
  });

  describe('findAllByOwner', () => {
    it('скоупит выборку по ownerId и применяет offset/limit', async () => {
      prisma.meeting.findMany.mockResolvedValue([meeting]);

      await expect(service.findAllByOwner(owner.sub, { offset: 20, limit: 10 })).resolves.toEqual([
        meeting,
      ]);
      expect(prisma.meeting.findMany).toHaveBeenCalledWith({
        where: { ownerId: owner.sub },
        orderBy: { createdAt: 'desc' },
        skip: 20,
        take: 10,
      });
    });
  });

  describe('findOneForMember', () => {
    it('владелец получает встречу', async () => {
      prisma.meeting.findUnique.mockResolvedValue(meeting);

      await expect(service.findOneForMember(owner, meeting.id)).resolves.toEqual(meeting);
    });

    it('участник получает встречу', async () => {
      prisma.meeting.findUnique.mockResolvedValue(meeting);

      await expect(service.findOneForMember(participant, meeting.id)).resolves.toEqual(meeting);
    });

    it('постороннему — 404', async () => {
      prisma.meeting.findUnique.mockResolvedValue(meeting);

      await expect(service.findOneForMember(stranger, meeting.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('несуществующая встреча — 404', async () => {
      prisma.meeting.findUnique.mockResolvedValue(null);

      await expect(service.findOneForMember(owner, 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
