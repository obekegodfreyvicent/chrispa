import { Injectable, NotFoundException } from '@nestjs/common';
import { AddressType, UserRole } from '@prisma/client';
import { ActivityLogService, ActorInfo, deriveActorType, RequestInfo } from '../../common/activity-log/activity-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

// FR-13: Address Book. "Default" is scoped per AddressType (one default
// shipping address, one default billing address), matching the wireframe's
// "Default Shipping" label on one card and a plain "Billing" chip on another.
@Injectable()
export class AddressesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  list(userId: string) {
    return this.prisma.address.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  }

  async create(actor: ActorInfo, dto: CreateAddressDto, context: RequestInfo = {}) {
    const userId = actor.userId;
    const type = dto.type ?? AddressType.SHIPPING;
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.address.updateMany({ where: { userId, type, isDefault: true }, data: { isDefault: false } });
      }
      const address = await tx.address.create({
        data: {
          userId,
          label: dto.label,
          recipient: dto.recipient,
          line1: dto.line1,
          city: dto.city,
          phone: dto.phone,
          type,
          isDefault: dto.isDefault ?? false,
        },
      });
      await this.activityLog.record(
        {
          actorUserId: actor.userId,
          actorRole: actor.role as UserRole,
          actorType: deriveActorType(actor.role),
          action: 'ADDRESS_CREATED',
          entityType: 'Address',
          entityId: address.id,
          description: `Added a ${type.toLowerCase()} address ("${dto.label}")`,
          ...context,
        },
        tx,
      );
      return address;
    });
  }

  async update(userId: string, id: string, dto: UpdateAddressDto) {
    const existing = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Address not found');
    const type = dto.type ?? existing.type;

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.address.updateMany({
          where: { userId, type, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
      }
      return tx.address.update({ where: { id }, data: dto });
    });
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Address not found');
    await this.prisma.address.delete({ where: { id } });
    return { deleted: true };
  }
}
