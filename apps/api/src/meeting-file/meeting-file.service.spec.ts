import { NotFoundException } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { JwtPayload } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { MeetingFileService } from './meeting-file.service';

jest.mock('node:fs', () => ({
  ...jest.requireActual('node:fs'),
  promises: {
    ...jest.requireActual('node:fs').promises,
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
  },
}));

describe('MeetingFileService', () => {
  const owner: JwtPayload = { sub: 'owner-id', email: 'owner@example.com' };
  const participant: JwtPayload = { sub: 'participant-id', email: 'participant@example.com' };
  const stranger: JwtPayload = { sub: 'stranger-id', email: 'stranger@example.com' };

  const meeting = {
    id: 'meeting-1',
    ownerId: owner.sub,
    participants: [participant.email],
  };

  const file = {
    id: 'file-1',
    meetingId: meeting.id,
    fileName: 'notes.txt',
    mimeType: 'text/plain',
    size: 11,
    storagePath: '/tmp/storage/notes.txt',
    uploadedById: owner.sub,
    createdAt: new Date(),
  };

  let prisma: {
    meeting: { findUnique: jest.Mock };
    meetingFile: { findFirst: jest.Mock; delete: jest.Mock };
  };
  let service: MeetingFileService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      meeting: { findUnique: jest.fn() },
      meetingFile: { findFirst: jest.fn(), delete: jest.fn() },
    };
    service = new MeetingFileService(prisma as unknown as PrismaService);
  });

  describe('getForMember', () => {
    it('владелец получает файл', async () => {
      prisma.meeting.findUnique.mockResolvedValue(meeting);
      prisma.meetingFile.findFirst.mockResolvedValue(file);

      await expect(service.getForMember(owner, meeting.id, file.id)).resolves.toEqual(file);
    });

    it('участник получает файл', async () => {
      prisma.meeting.findUnique.mockResolvedValue(meeting);
      prisma.meetingFile.findFirst.mockResolvedValue(file);

      await expect(service.getForMember(participant, meeting.id, file.id)).resolves.toEqual(file);
    });

    it('постороннему — 404', async () => {
      prisma.meeting.findUnique.mockResolvedValue(meeting);

      await expect(service.getForMember(stranger, meeting.id, file.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.meetingFile.findFirst).not.toHaveBeenCalled();
    });

    it('несуществующий файл — 404', async () => {
      prisma.meeting.findUnique.mockResolvedValue(meeting);
      prisma.meetingFile.findFirst.mockResolvedValue(null);

      await expect(service.getForMember(owner, meeting.id, 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('deleteAsOwner', () => {
    it('владелец удаляет файл из БД и с диска', async () => {
      prisma.meeting.findUnique.mockResolvedValue(meeting);
      prisma.meetingFile.findFirst.mockResolvedValue(file);
      prisma.meetingFile.delete.mockResolvedValue(file);
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      await service.deleteAsOwner(owner, meeting.id, file.id);

      expect(prisma.meetingFile.delete).toHaveBeenCalledWith({ where: { id: file.id } });
      expect(fs.unlink).toHaveBeenCalledWith(file.storagePath);
    });

    it('не-владельцу — 404, ничего не удаляется', async () => {
      prisma.meeting.findUnique.mockResolvedValue(meeting);

      await expect(service.deleteAsOwner(participant, meeting.id, file.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.meetingFile.delete).not.toHaveBeenCalled();
    });

    it('постороннему — 404', async () => {
      prisma.meeting.findUnique.mockResolvedValue(meeting);

      await expect(service.deleteAsOwner(stranger, meeting.id, file.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.meetingFile.delete).not.toHaveBeenCalled();
    });

    it('несуществующий файл — 404', async () => {
      prisma.meeting.findUnique.mockResolvedValue(meeting);
      prisma.meetingFile.findFirst.mockResolvedValue(null);

      await expect(service.deleteAsOwner(owner, meeting.id, 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.meetingFile.delete).not.toHaveBeenCalled();
    });

    it('встреча не найдена — 404', async () => {
      prisma.meeting.findUnique.mockResolvedValue(null);

      await expect(service.deleteAsOwner(owner, 'missing', file.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
