import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryMethod, ShippingZone, UserRole } from '@prisma/client';
import { ActivityLogService, ActorInfo, deriveActorType, RequestInfo } from '../../common/activity-log/activity-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateShippingZoneDto } from './dto/create-shipping-zone.dto';
import { UpdateShippingZoneDto } from './dto/update-shipping-zone.dto';

export interface ShippingQuote {
  zoneId: string;
  zoneName: string;
  rates: Record<DeliveryMethod, { available: boolean; feeUgx: number | null }>;
}

function feeField(method: DeliveryMethod): 'standardFeeUgx' | 'expressFeeUgx' | 'sameDayFeeUgx' {
  if (method === DeliveryMethod.STANDARD) return 'standardFeeUgx';
  if (method === DeliveryMethod.EXPRESS) return 'expressFeeUgx';
  return 'sameDayFeeUgx';
}

// Per user decision (not in the original SRS): shipping is priced by BOTH
// destination and delivery method, admin-managed rather than hardcoded —
// replaces CheckoutService's old flat DELIVERY_FEES_UGX table.
@Injectable()
export class ShippingZonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  list() {
    return this.prisma.shippingZone.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  private async getOrThrow(id: string) {
    const zone = await this.prisma.shippingZone.findUnique({ where: { id } });
    if (!zone) throw new NotFoundException('Shipping zone not found');
    return zone;
  }

  async create(dto: CreateShippingZoneDto, actor: ActorInfo, context: RequestInfo = {}) {
    const zone = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.shippingZone.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      }
      return tx.shippingZone.create({
        data: {
          name: dto.name,
          towns: dto.towns,
          isDefault: dto.isDefault ?? false,
          standardFeeUgx: dto.standardFeeUgx ?? null,
          expressFeeUgx: dto.expressFeeUgx ?? null,
          sameDayFeeUgx: dto.sameDayFeeUgx ?? null,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
    });
    await this.assertExactlyOneDefault();

    await this.activityLog.record({
      actorUserId: actor.userId,
      actorRole: actor.role as UserRole,
      actorType: deriveActorType(actor.role),
      action: 'SHIPPING_ZONE_CREATED',
      entityType: 'ShippingZone',
      entityId: zone.id,
      description: `Added shipping zone "${zone.name}"`,
      ...context,
    });
    return zone;
  }

  async update(id: string, dto: UpdateShippingZoneDto, actor: ActorInfo, context: RequestInfo = {}) {
    await this.getOrThrow(id);

    const zone = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.shippingZone.updateMany({ where: { isDefault: true, id: { not: id } }, data: { isDefault: false } });
      }
      return tx.shippingZone.update({ where: { id }, data: dto });
    });

    // Re-validate unconditionally — cheap (one count query) and correct
    // regardless of which combination of fields this update touched, unlike
    // trying to special-case exactly which dto shapes could break the
    // invariant.
    await this.assertExactlyOneDefault();

    await this.activityLog.record({
      actorUserId: actor.userId,
      actorRole: actor.role as UserRole,
      actorType: deriveActorType(actor.role),
      action: 'SHIPPING_ZONE_UPDATED',
      entityType: 'ShippingZone',
      entityId: id,
      description: `Updated shipping zone "${zone.name}"`,
      ...context,
    });
    return zone;
  }

  async remove(id: string, actor: ActorInfo, context: RequestInfo = {}) {
    const zone = await this.getOrThrow(id);
    if (zone.isDefault) {
      throw new BadRequestException(
        'This is the default shipping zone (the fallback for unmatched cities) — make another zone the default before deleting it.',
      );
    }
    await this.prisma.shippingZone.delete({ where: { id } });

    await this.activityLog.record({
      actorUserId: actor.userId,
      actorRole: actor.role as UserRole,
      actorType: deriveActorType(actor.role),
      action: 'SHIPPING_ZONE_DELETED',
      entityType: 'ShippingZone',
      entityId: id,
      description: `Removed shipping zone "${zone.name}"`,
      ...context,
    });
    return { deleted: true };
  }

  // Guards the "exactly one isDefault zone" invariant that isn't expressible
  // as a DB constraint (see the schema comment) — called after any write
  // that could have broken it. Doesn't auto-fix; a broken invariant means a
  // logic bug here, not a recoverable admin input, so it throws rather than
  // silently picking a zone to be "the" default.
  private async assertExactlyOneDefault() {
    const count = await this.prisma.shippingZone.count({ where: { isDefault: true } });
    if (count !== 1) {
      throw new BadRequestException(
        'There must be exactly one default shipping zone at all times — set another zone as default first.',
      );
    }
  }

  // Case-insensitive, substring-tolerant match against each zone's `towns`
  // list — not an exact-equality lookup, since the storefront's City field
  // is free text (no canonical Uganda-locations table exists in this
  // schema) and real input varies ("Kampala", "Kampala Uganda", "Kla").
  // Falls back to the isDefault zone if nothing matches. Zones are checked
  // in sortOrder so an admin can resolve ambiguous overlaps by ordering.
  private async matchZone(city: string): Promise<ShippingZone> {
    const zones = await this.list();
    const normalizedCity = city.trim().toLowerCase();
    for (const zone of zones) {
      const matches = zone.towns.some((town) => {
        const t = town.trim().toLowerCase();
        return t.length > 0 && (normalizedCity.includes(t) || t.includes(normalizedCity));
      });
      if (matches) return zone;
    }
    const fallback = zones.find((z) => z.isDefault);
    if (!fallback) {
      throw new BadRequestException('No shipping zones are configured — an admin needs to set one up before checkout can price delivery.');
    }
    return fallback;
  }

  // The one method both CheckoutService and the public quote endpoint call
  // — city determines the zone, deliveryMethod determines which of that
  // zone's three fees applies. `available: false` (feeUgx null) means this
  // zone doesn't offer that method at all, not "free."
  async quote(city: string): Promise<ShippingQuote> {
    const zone = await this.matchZone(city);
    const rates = {} as ShippingQuote['rates'];
    for (const method of Object.values(DeliveryMethod)) {
      const fee = zone[feeField(method)];
      rates[method] = { available: fee != null, feeUgx: fee };
    }
    return { zoneId: zone.id, zoneName: zone.name, rates };
  }

  // Server-side source of truth for CheckoutService — never trusts a
  // client-supplied fee (the checkout DTO never accepted one in the first
  // place). Throws if the matched zone doesn't offer `deliveryMethod` at
  // all, rather than silently charging 0 or falling back to another method.
  async priceFor(city: string, deliveryMethod: DeliveryMethod): Promise<{ zoneName: string; feeUgx: number }> {
    const quote = await this.quote(city);
    const rate = quote.rates[deliveryMethod];
    if (!rate.available || rate.feeUgx == null) {
      throw new BadRequestException(
        `${deliveryMethod.replace(/_/g, ' ')} delivery isn't available for ${quote.zoneName} — please choose a different delivery method.`,
      );
    }
    return { zoneName: quote.zoneName, feeUgx: rate.feeUgx };
  }
}
