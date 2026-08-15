import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

// FR-28.1: Admin user management (read side). Invite/role-change/store-config and
// integration-toggle endpoints (FR-28.1/28.3/28.4) are follow-up work.
@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({
      where: { role: { not: UserRole.CUSTOMER } },
      select: { id: true, name: true, email: true, role: true, twoFactorEnabled: true },
      orderBy: { name: 'asc' },
    });
  }
}
