import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { SupportService } from './support.service';

// AL-FR-2 (docs/SRS.md §19) — same pattern as AdminOrdersController's requestContext().
function requestContext(req: FastifyRequest) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

// FR-7.4: Support ticket review & response (staff side). SUPPORT_AGENT is
// this feature's first real consumer of that role.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'STORE_MANAGER', 'SUPPORT_AGENT')
@Controller('admin/support/tickets')
export class AdminSupportController {
  constructor(private readonly support: SupportService) {}

  @Get()
  list(
    @Query('status') status?: TicketStatus,
    @Query('search') search?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.support.listForAdmin({
      status,
      search,
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
  }

  @Get('counts')
  counts() {
    return this.support.countsByStatus();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.support.getForAdmin(id);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: { userId: string; role: string },
    @Param('id') id: string,
    @Body() dto: UpdateTicketStatusDto,
    @Req() req: FastifyRequest,
  ) {
    return this.support.updateStatus(id, dto.status, user, requestContext(req));
  }

  @Post(':id/messages')
  addMessage(
    @CurrentUser() user: { userId: string; role: string },
    @Param('id') id: string,
    @Body() dto: CreateTicketMessageDto,
    @Req() req: FastifyRequest,
  ) {
    return this.support.addMessageForAdmin(id, user, dto.body, requestContext(req));
  }
}
