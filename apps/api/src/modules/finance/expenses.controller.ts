import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RecordExpenseDto } from './dto/expense.dto';
import { ExpensesService } from './expenses.service';

function requestContext(req: FastifyRequest) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER')
@Controller('admin/finance/expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get('categories')
  categories() {
    return this.expenses.categories();
  }

  @Post()
  record(@CurrentUser() user: { userId: string; role: string }, @Body() dto: RecordExpenseDto, @Req() req: FastifyRequest) {
    return this.expenses.recordExpense(dto, user, requestContext(req));
  }
}
