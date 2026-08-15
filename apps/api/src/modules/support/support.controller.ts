import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { SupportService } from './support.service';

@UseGuards(JwtAuthGuard)
@Controller('support/tickets')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get()
  list(@CurrentUser() user: { userId: string }) {
    return this.support.listForUser(user.userId);
  }

  @Post()
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreateTicketDto) {
    return this.support.createForUser(user.userId, dto.body, dto.orderId);
  }

  @Get(':id')
  get(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.support.getForUser(user.userId, id);
  }

  @Post(':id/messages')
  addMessage(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: CreateTicketMessageDto) {
    return this.support.addMessageForUser(user.userId, id, dto.body);
  }
}
