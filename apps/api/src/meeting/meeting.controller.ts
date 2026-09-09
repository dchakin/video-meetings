import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Meeting } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/auth.types';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { MeetingService } from './meeting.service';

@Controller('meetings')
@UseGuards(JwtAuthGuard)
export class MeetingController {
  constructor(private readonly meetings: MeetingService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateMeetingDto): Promise<Meeting> {
    return this.meetings.create(user.sub, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload): Promise<Meeting[]> {
    return this.meetings.findAllByOwner(user.sub);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string): Promise<Meeting> {
    return this.meetings.findOneByOwner(user.sub, id);
  }
}
