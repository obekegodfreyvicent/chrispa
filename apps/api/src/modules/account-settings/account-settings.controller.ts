import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccountSettingsService } from './account-settings.service';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@UseGuards(JwtAuthGuard)
@Controller('account/settings')
export class AccountSettingsController {
  constructor(private readonly settings: AccountSettingsService) {}

  @Get()
  get(@CurrentUser() user: { userId: string }) {
    return this.settings.getSettings(user.userId);
  }

  @Patch()
  update(@CurrentUser() user: { userId: string }, @Body() dto: UpdateSettingsDto) {
    return this.settings.updateSettings(user.userId, dto);
  }

  @Get('export')
  export(@CurrentUser() user: { userId: string }) {
    return this.settings.exportData(user.userId);
  }

  // FR-17.1 Login Alerts — recent sign-in history, each flagged if it looked
  // like a new device at the time.
  @Get('login-events')
  listLoginEvents(@CurrentUser() user: { userId: string }) {
    return this.settings.listLoginEvents(user.userId);
  }

  @Post('login-events/:id/acknowledge')
  acknowledgeLoginEvent(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.settings.acknowledgeLoginEvent(user.userId, id);
  }

  // FR-17.4 "Delete Account" — password-gated like every other security
  // downgrade in this module (2FA/biometric disable). See
  // AccountSettingsService.deleteAccount() for what this actually does
  // (scrub + retain, never a hard delete).
  @Post('delete-account')
  deleteAccount(@CurrentUser() user: { userId: string }, @Body() dto: DeleteAccountDto) {
    return this.settings.deleteAccount(user.userId, dto.currentPassword);
  }
}
