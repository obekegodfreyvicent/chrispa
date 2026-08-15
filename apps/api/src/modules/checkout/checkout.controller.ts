import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CheckoutDto } from './dto/checkout.dto';
import { CheckoutService } from './checkout.service';

// AL-FR-2 (docs/SRS.md §19) — same pattern as AuthController's loginContext().
function requestContext(req: FastifyRequest) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

// Guest checkout (FR-5.2) isn't built — the cart module itself is
// user-account-only right now (see CartService), so checkout requires the
// same authentication.
@UseGuards(JwtAuthGuard)
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post()
  place(@CurrentUser() user: { userId: string; role: string }, @Body() dto: CheckoutDto, @Req() req: FastifyRequest) {
    return this.checkout.checkout(user, dto, requestContext(req));
  }
}
