import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

// FR-25: Customers (CRM) read side. RFM segmentation, tags/notes, and campaign-list
// export are follow-up work.
@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({
      // Deleted accounts (FR-17.4) are scrubbed, not removed — their order
      // history stays for the business's own records, but they shouldn't
      // show up in the admin customer list as if still active.
      where: { role: UserRole.CUSTOMER, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        tier: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
