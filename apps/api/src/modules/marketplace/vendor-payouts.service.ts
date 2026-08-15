import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ComputeVendorPayoutDto } from './dto/vendor.dto';

// MKT-FR-2 (docs/SRS.md §21): aggregates a vendor's already-recognized
// commission/payout figures (platformCommissionUgx/vendorPayoutUgx,
// computed per OrderItem by RevenueRecognitionService at order delivery —
// see that service) into a single periodic payout run.
@Injectable()
export class VendorPayoutsService {
  constructor(private readonly prisma: PrismaService) {}

  list(vendorId?: string) {
    return this.prisma.vendorPayout.findMany({
      where: vendorId ? { vendorId } : undefined,
      include: { vendor: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Only pulls items whose revenue has already been recognized
  // (platformCommissionUgx set, by RevenueRecognitionService at delivery)
  // and that haven't been claimed by an earlier payout run
  // (vendorPayoutId still null) — the second condition is what prevents
  // double-paying a vendor if payout periods are ever run with overlapping
  // date ranges. Filtered by Order.updatedAt as a stand-in for "delivered
  // within this period" — there's no dedicated deliveredAt timestamp on
  // Order yet, a documented limitation, not an oversight.
  async computePayout(vendorId: string, dto: ComputeVendorPayoutDto) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);
    if (periodEnd <= periodStart) throw new BadRequestException('periodEnd must be after periodStart.');

    const eligibleItems = await this.prisma.orderItem.findMany({
      where: {
        vendorId,
        vendorPayoutId: null,
        platformCommissionUgx: { not: null },
        order: { status: 'DELIVERED', updatedAt: { gte: periodStart, lte: periodEnd } },
      },
    });

    if (eligibleItems.length === 0) {
      throw new BadRequestException('No eligible (recognized, unpaid) sales for this vendor in that period.');
    }

    const grossSalesUgx = eligibleItems.reduce((sum, i) => sum + i.unitPriceUgx * i.qty, 0);
    const commissionUgx = eligibleItems.reduce((sum, i) => sum + (i.platformCommissionUgx ?? 0), 0);
    const payoutUgx = eligibleItems.reduce((sum, i) => sum + (i.vendorPayoutUgx ?? 0), 0);

    return this.prisma.$transaction(async (tx) => {
      const payout = await tx.vendorPayout.create({
        data: { vendorId, periodStart, periodEnd, grossSalesUgx, commissionUgx, payoutUgx },
      });
      await tx.orderItem.updateMany({
        where: { id: { in: eligibleItems.map((i) => i.id) } },
        data: { vendorPayoutId: payout.id },
      });
      return payout;
    });
  }

  async markPaid(payoutId: string) {
    const payout = await this.prisma.vendorPayout.findUnique({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException('Payout not found');
    if (payout.status === 'PAID') throw new BadRequestException('This payout is already marked paid.');
    return this.prisma.vendorPayout.update({ where: { id: payoutId }, data: { status: 'PAID', paidAt: new Date() } });
  }
}
