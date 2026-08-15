import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

// FR-24: Inventory & Warehouse (read side). Purchase orders, transfers, cycle counts,
// FIFO/LIFO costing, and damaged/expired-goods logging are follow-up work.
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.inventoryRecord.findMany({
      include: { product: true, warehouse: true },
      orderBy: { qtyOnHand: 'asc' },
    });
  }

  listWarehouses() {
    return this.prisma.warehouse.findMany({ orderBy: { name: 'asc' } });
  }
}
