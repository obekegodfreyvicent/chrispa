import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

// FR-18: Loyalty & Rewards read side. Redemption and earn-rate rule evaluation are
// follow-up work — see docs/SRS.md FR-18.2/18.3.
@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  getForUser(userId: string) {
    return this.prisma.loyaltyAccount.findUnique({
      where: { userId },
      include: { ledgerEntries: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
  }
}
