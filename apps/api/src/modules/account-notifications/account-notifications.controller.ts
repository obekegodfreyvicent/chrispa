import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccountNotificationsService } from './account-notifications.service';

// Self-service, JWT-scoped to the caller — same shape as wishlist/addresses,
// no RBAC needed since a customer only ever sees their own notifications.
@UseGuards(JwtAuthGuard)
@Controller('account/notifications')
export class AccountNotificationsController {
  constructor(private readonly notifications: AccountNotificationsService) {}

  @Get()
  list(@CurrentUser() user: { userId: string }) {
    return this.notifications.list(user.userId);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: { userId: string }) {
    return this.notifications.unreadCount(user.userId);
  }

  @Post(':id/read')
  markRead(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.notifications.markRead(user.userId, id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: { userId: string }) {
    return this.notifications.markAllRead(user.userId);
  }
}
