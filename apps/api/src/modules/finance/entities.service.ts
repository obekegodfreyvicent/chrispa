import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateLegalEntityDto, UpdateLegalEntityDto } from './dto/entity.dto';

// FIN-FR-1 (docs/SRS.md §20): the multi-entity tree. A LegalEntity with
// parentEntityId: null is the group's ultimate parent — see the schema
// comment on LegalEntity for why this is a self-referencing tree rather
// than a fixed parent/subsidiary pair.
@Injectable()
export class EntitiesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.legalEntity.findMany({
      include: { subsidiaries: { select: { id: true, name: true, code: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async getById(id: string) {
    const entity = await this.prisma.legalEntity.findUnique({
      where: { id },
      include: { subsidiaries: { select: { id: true, name: true, code: true } }, parentEntity: true },
    });
    if (!entity) throw new NotFoundException('Legal entity not found');
    return entity;
  }

  create(dto: CreateLegalEntityDto) {
    return this.prisma.legalEntity.create({
      data: {
        name: dto.name,
        code: dto.code,
        functionalCurrency: dto.functionalCurrency,
        parentEntityId: dto.parentEntityId,
        currentGroupFxRate: dto.currentGroupFxRate,
      },
    });
  }

  // FIN-FR-5 (multi-currency): when the FX rate actually changes, write an
  // ExchangeRateHistory row first — "tracks exchange rate changes," not
  // just holds whatever the current one is. No-ops the history write if
  // currentGroupFxRate wasn't part of this update (e.g. a name-only edit).
  async update(id: string, dto: UpdateLegalEntityDto, changedByUserId: string) {
    const existing = await this.getById(id); // 404s if missing
    if (dto.currentGroupFxRate !== undefined && dto.currentGroupFxRate !== Number(existing.currentGroupFxRate)) {
      await this.prisma.exchangeRateHistory.create({
        data: {
          legalEntityId: id,
          fromRate: existing.currentGroupFxRate,
          toRate: dto.currentGroupFxRate,
          changedByUserId,
        },
      });
    }
    return this.prisma.legalEntity.update({
      where: { id },
      data: { name: dto.name, currentGroupFxRate: dto.currentGroupFxRate },
    });
  }

  rateHistory(entityId: string) {
    return this.prisma.exchangeRateHistory.findMany({ where: { legalEntityId: entityId }, orderBy: { changedAt: 'desc' } });
  }

  // Every entity in the tree rooted at `rootId` (inclusive) — the scope
  // FinancialReportsService consolidates over. Depth-first, no cycle guard
  // needed since parentEntityId can only point at an already-created row.
  async subtreeIds(rootId: string): Promise<string[]> {
    const children = await this.prisma.legalEntity.findMany({
      where: { parentEntityId: rootId },
      select: { id: true },
    });
    const nested = await Promise.all(children.map((c) => this.subtreeIds(c.id)));
    return [rootId, ...nested.flat()];
  }

  async getGroupSettings() {
    const existing = await this.prisma.groupSettings.findFirst();
    if (existing) return existing;
    return this.prisma.groupSettings.create({ data: {} });
  }
}
