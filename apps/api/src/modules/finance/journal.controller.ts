import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PostJournalEntryDto } from './dto/journal-entry.dto';
import { JournalService } from './journal.service';

function requestContext(req: FastifyRequest) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER')
@Controller('admin/finance')
export class JournalController {
  constructor(private readonly journal: JournalService) {}

  @Get('journal-entries')
  list(@Query('entityId') entityId: string, @Query('skip') skip?: string, @Query('take') take?: string) {
    return this.journal.listEntries(entityId, {
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
  }

  @Get('journal-entries/:id')
  get(@Param('id') id: string) {
    return this.journal.getEntry(id);
  }

  @Post('journal-entries')
  post(@CurrentUser() user: { userId: string; role: string }, @Body() dto: PostJournalEntryDto, @Req() req: FastifyRequest) {
    return this.journal.postEntry(dto, user, requestContext(req));
  }

  @Get('periods')
  listPeriods(@Query('entityId') entityId: string) {
    return this.journal.listPeriods(entityId);
  }

  @Post('periods/close')
  closePeriod(@Body('entityId') entityId: string, @Body('month') month: string) {
    return this.journal.closePeriod(entityId, month);
  }

  @Post('periods/reopen')
  reopenPeriod(@Body('entityId') entityId: string, @Body('month') month: string) {
    return this.journal.reopenPeriod(entityId, month);
  }
}
