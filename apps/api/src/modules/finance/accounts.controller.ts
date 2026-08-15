import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/account.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER')
@Controller('admin/finance/accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  list(@Query('entityId') entityId: string) {
    return this.accounts.list(entityId);
  }

  @Post()
  create(@Body() dto: CreateAccountDto) {
    return this.accounts.create(dto);
  }
}
