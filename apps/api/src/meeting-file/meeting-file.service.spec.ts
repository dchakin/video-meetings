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
    meetingFile: { findFirst: jest.Mock; delete: jest.Mock; create: jest.Mock };
  };
  let service: MeetingFileService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      meeting: { findUnique: jest.fn() },
      meetingFile: { findFirst: jest.fn(), delete: jest.fn(), create: jest.fn() },
    };
    service = new MeetingFileService(prisma as unknown as PrismaService);
  });

  describe('upload', () => {
    it('перекодирует имя файла из latin1 в UTF-8 (busboy декодирует multipart как latin1)', async () => {
      prisma.meeting.findUnique.mockResolvedValue(meeting);
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      prisma.meetingFile.create.mockImplementation(({ data }) =>
        Promise.resolve({ ...file, ...data }),
      );

      // Байты UTF-8 строки «файл.txt», прочитанные как latin1 — так их отдаёт busboy.
      const mangledName = Buffer.from('файл.txt', 'utf8').toString('latin1');
      const multerFile = {
        originalname: mangledName,
        mimetype: 'text/plain',
        size: 4,
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      const result = await service.upload(owner, meeting.id, multerFile);

      expect(result.fileName).toBe('файл.txt');
      expect(prisma.meetingFile.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ fileName: 'файл.txt' }) }),
      );
    });
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

    it('игнорирует отсутствие файла на диске (ENOENT)', async () => {
      prisma.meeting.findUnique.mockResolvedValue(meeting);
      prisma.meetingFile.findFirst.mockResolvedValue(file);
      prisma.meetingFile.delete.mockResolvedValue(file);
      const enoent = Object.assign(new Error('missing'), { code: 'ENOENT' });
      (fs.unlink as jest.Mock).mockRejectedValue(enoent);

      await expect(service.deleteAsOwner(owner, meeting.id, file.id)).resolves.toBeUndefined();
    });

    it('пробрасывает ошибку удаления файла с диска, если это не ENOENT', async () => {
      prisma.meeting.findUnique.mockResolvedValue(meeting);
      prisma.meetingFile.findFirst.mockResolvedValue(file);
      prisma.meetingFile.delete.mockResolvedValue(file);
      const eacces = Object.assign(new Error('permission denied'), { code: 'EACCES' });
      (fs.unlink as jest.Mock).mockRejectedValue(eacces);

      await expect(service.deleteAsOwner(owner, meeting.id, file.id)).rejects.toThrow(eacces);
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
