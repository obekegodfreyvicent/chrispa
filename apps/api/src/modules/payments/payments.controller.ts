import { Body, Controller, Get, Headers, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaymentsService } from './payments.service';

@Controller('payments/flutterwave')
export class PaymentsWebhookController {
  constructor(private readonly payments: PaymentsService) {}

  // PAY-FR-1 (docs/SRS.md §21): no auth guard — Flutterwave calls this
  // directly and can't present one of our JWTs. `verify-hash` (Fastify
  // lower-cases headers) is what authenticates the caller instead; see
  // FlutterwaveService.verifyWebhookSignature().
  @Post('webhook')
  async webhook(@Headers('verif-hash') verifHash: string | undefined, @Body() body: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.payments.handleWebhook(verifHash, body as any);
    return { received: true };
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'STORE_MANAGER')
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('transactions')
  list(@Query('orderId') orderId?: string) {
    return this.prisma.paymentTransaction.findMany({
      where: orderId ? { orderId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
