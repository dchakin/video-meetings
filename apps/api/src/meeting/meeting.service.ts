import { Injectable, NotFoundException } from '@nestjs/common';
import { Meeting } from '@prisma/client';
import { JwtPayload } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { isMeetingMember } from './meeting-membership';

@Injectable()
export class MeetingService {
  constructor(private readonly prisma: PrismaService) {}

  create(ownerId: string, dto: CreateMeetingDto): Promise<Meeting> {
    return this.prisma.meeting.create({
      data: {
        ownerId,
        title: dto.title,
        date: new Date(dto.date),
        participants: dto.participants,
      },
    });
  }

  findAllByOwner(ownerId: string): Promise<Meeting[]> {
    return this.prisma.meeting.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Владелец и участники (сверка по email) видят встречу; для остальных — 404, как в meeting-file. */
  async findOneForMember(user: JwtPayload, id: string): Promise<Meeting> {
    const meeting = await this.prisma.meeting.findUnique({ where: { id } });
    if (!meeting || !isMeetingMember(meeting, user)) {
      throw new NotFoundException('Встреча не найдена');
    }
    return meeting;
  }
}
