import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AllocateManagementFeeDto, RecordIntercompanyTransferDto } from './dto/intercompany.dto';
import { IntercompanyService } from './intercompany.service';

function requestContext(req: FastifyRequest) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER')
@Controller('admin/finance/intercompany')
export class IntercompanyController {
  constructor(private readonly intercompany: IntercompanyService) {}

  @Get('due-to-due-from')
  dueToDueFrom(@Query('entityId') entityId: string) {
    return this.intercompany.dueToDueFrom(entityId);
  }

  @Post('management-fee')
  allocateManagementFee(
    @CurrentUser() user: { userId: string; role: string },
    @Body() dto: AllocateManagementFeeDto,
    @Req() req: FastifyRequest,
  ) {
    return this.intercompany.allocateManagementFee(dto, user, requestContext(req));
  }

  @Post('transfer')
  recordTransfer(
    @CurrentUser() user: { userId: string; role: string },
    @Body() dto: RecordIntercompanyTransferDto,
    @Req() req: FastifyRequest,
  ) {
    return this.intercompany.recordTransfer(dto, user, requestContext(req));
  }
}
