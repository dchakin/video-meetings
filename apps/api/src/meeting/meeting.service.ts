import { Injectable, NotFoundException } from '@nestjs/common';
import { Meeting } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';

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

  async findOneByOwner(ownerId: string, id: string): Promise<Meeting> {
    const meeting = await this.prisma.meeting.findFirst({ where: { id, ownerId } });
    if (!meeting) {
      throw new NotFoundException('Встреча не найдена');
    }
    return meeting;
  }
}
