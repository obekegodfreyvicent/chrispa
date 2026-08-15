import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateVendorDto, UpdateVendorDto } from './dto/vendor.dto';

// MKT-FR-1 (docs/SRS.md §21): vendor directory for the marketplace.
@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.vendor.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async getById(id: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: { products: { select: { id: true, name: true, sku: true, priceUgx: true } } },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  create(dto: CreateVendorDto) {
    return this.prisma.vendor.create({
      data: {
        name: dto.name,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        payoutMobileMoneyNumber: dto.payoutMobileMoneyNumber,
        commissionRatePercent: dto.commissionRatePercent,
      },
    });
  }

  async update(id: string, dto: UpdateVendorDto) {
    await this.getById(id); // 404s if missing
    return this.prisma.vendor.update({
      where: { id },
      data: {
        name: dto.name,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        payoutMobileMoneyNumber: dto.payoutMobileMoneyNumber,
        commissionRatePercent: dto.commissionRatePercent,
        status: dto.status,
      },
    });
  }
}
