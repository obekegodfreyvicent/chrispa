import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@UseGuards(JwtAuthGuard)
@Controller('account/addresses')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  list(@CurrentUser() user: { userId: string }) {
    return this.addresses.list(user.userId);
  }

  @Post()
  create(@CurrentUser() user: { userId: string; role: string }, @Body() dto: CreateAddressDto, @Req() req: FastifyRequest) {
    return this.addresses.create(user, dto, { ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  }

  @Patch(':id')
  update(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: UpdateAddressDto) {
    return this.addresses.update(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.addresses.remove(user.userId, id);
  }
}
