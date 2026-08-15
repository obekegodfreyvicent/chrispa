import { Injectable, NotFoundException, NotImplementedException } from '@nestjs/common';
import { PaymentMethodType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';

// FR-16: Saved Payment Methods. Only Mobile Money can actually be saved —
// Card and PayPal are rejected (see create() below) for two different
// reasons: Card needs a PCI-DSS gateway (Stripe/Flutterwave/etc.) so raw PANs
// never touch this server; PayPal needs a real PayPal Developer app
// (Client ID/Secret) to run the OAuth linking flow — neither is connected
// yet. "Default" is a single flag across all of a user's payment methods,
// matching the wireframe (only one card ever shows a "Default" badge,
// regardless of type).
const UNIMPLEMENTED_REASONS: Partial<Record<PaymentMethodType, string>> = {
  [PaymentMethodType.CARD]:
    'Saved cards need a PCI-DSS payment gateway integration, which is not connected yet.',
  [PaymentMethodType.PAYPAL]:
    'Connecting a PayPal account needs a registered PayPal Developer app (Client ID/Secret) to run the OAuth linking flow, which is not connected yet.',
};

function maskIdentifier(raw: string) {
  if (raw.length <= 6) return raw;
  return `${raw.slice(0, 6)}••••${raw.slice(-3)}`;
}

@Injectable()
export class PaymentMethodsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.paymentMethod.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  }

  async create(userId: string, dto: CreatePaymentMethodDto) {
    const reason = UNIMPLEMENTED_REASONS[dto.type];
    if (reason) {
      throw new NotImplementedException(`${reason} Mobile Money numbers can be saved today.`);
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.paymentMethod.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.paymentMethod.create({
        data: {
          userId,
          type: dto.type,
          maskedIdentifier: maskIdentifier(dto.identifier),
          // No real gateway to tokenize through yet — an opaque placeholder,
          // never a value derived from anything sensitive the client sent.
          gatewayToken: `mock_${randomUUID()}`,
          isDefault: dto.isDefault ?? false,
        },
      });
    });
  }

  async update(userId: string, id: string, dto: UpdatePaymentMethodDto) {
    const existing = await this.prisma.paymentMethod.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Payment method not found');

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.paymentMethod.updateMany({ where: { userId, isDefault: true, NOT: { id } }, data: { isDefault: false } });
      }
      return tx.paymentMethod.update({ where: { id }, data: dto });
    });
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.paymentMethod.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Payment method not found');
    await this.prisma.paymentMethod.delete({ where: { id } });
    return { deleted: true };
  }
}
