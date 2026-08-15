import { Controller, Body, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

@UseGuards(JwtAuthGuard)
@Controller('account/profile')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  get(@CurrentUser() user: { userId: string }) {
    return this.profile.getProfile(user.userId);
  }

  @Patch()
  update(@CurrentUser() user: { userId: string; role: string }, @Body() dto: UpdateProfileDto, @Req() req: FastifyRequest) {
    return this.profile.updateProfile(user, dto, { ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  }

  // multipart/form-data — @fastify/multipart (registered in main.ts) decorates
  // the request with .file(); Nest has no Fastify-native file interceptor
  // equivalent to @nestjs/platform-express's, so this reads it directly.
  @Post('avatar')
  async uploadAvatar(@CurrentUser() user: { userId: string }, @Req() req: FastifyRequest) {
    const file = await req.file();
    return this.profile.setAvatarFromUpload(user.userId, file);
  }
}
