import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { DisableTwoFactorDto } from './dto/two-factor.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { WebauthnService } from './webauthn.service';

const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

// These request bodies (RegistrationResponseJSON/AuthenticationResponseJSON)
// are plain TypeScript types, not classes — Nest's global ValidationPipe
// only validates class-typed params (see main.ts), so these deliberately
// pass through unvalidated by class-validator. That's correct here:
// @simplewebauthn/server's verify functions do real structural + cryptographic
// validation internally and throw on anything malformed.
interface VerifyRegistrationBody {
  challengeToken: string;
  response: RegistrationResponseJSON;
  deviceLabel?: string;
}
interface AuthOptionsBody {
  identifier: string;
}
interface VerifyAuthenticationBody {
  challengeToken: string;
  response: AuthenticationResponseJSON;
}

@Controller('auth/webauthn')
export class WebauthnController {
  constructor(
    private readonly webauthn: WebauthnService,
    private readonly authService: AuthService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('register/options')
  registerOptions(@CurrentUser() user: { userId: string }) {
    return this.webauthn.generateRegistrationOptionsFor(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('register/verify')
  verifyRegistration(@CurrentUser() user: { userId: string }, @Body() body: VerifyRegistrationBody) {
    return this.webauthn.verifyRegistration(user.userId, body.challengeToken, body.response, body.deviceLabel);
  }

  @Throttle(AUTH_THROTTLE)
  @Post('login/options')
  loginOptions(@Body() body: AuthOptionsBody) {
    return this.webauthn.generateAuthenticationOptionsFor(body.identifier);
  }

  @Throttle(AUTH_THROTTLE)
  @Post('login/verify')
  async verifyLogin(@Body() body: VerifyAuthenticationBody, @Req() req: FastifyRequest) {
    const user = await this.webauthn.verifyAuthentication(body.challengeToken, body.response);
    return this.authService.completeLogin(user, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('disable')
  disable(@CurrentUser() user: { userId: string }, @Body() dto: DisableTwoFactorDto) {
    return this.webauthn.disable(user.userId, dto.currentPassword);
  }
}
