import { CouponType, PermissionResource, PrismaClient, ProductStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { ActivityLogService } from '../src/common/activity-log/activity-log.service';
import type { PrismaService } from '../src/common/prisma/prisma.service';
import { AccountsService } from '../src/modules/finance/accounts.service';
import { EntitiesService } from '../src/modules/finance/entities.service';
import { ExpensesService } from '../src/modules/finance/expenses.service';
import { IntercompanyService } from '../src/modules/finance/intercompany.service';
import { JournalService } from '../src/modules/finance/journal.service';
import { RevenueRecognitionService } from '../src/modules/finance/revenue-recognition.service';
import { computePayslip } from '../src/modules/hr/payroll/paye-nssf.util';

const prisma = new PrismaClient();

// Raw ingredient palette across all 5 lines matches ChrisPa's stated sourcing:
// goat's milk (soap), honey (soap/honey/ghee), herbs (all lines), ghee, soywax
// & beeswax (candles), sea salt (salts), essential oils (scent/flavor notes
// throughout — see each product's `notes` below).
const PRODUCT_LINES = [
  { name: 'Scented Soywax Candles', slug: 'candles', unitSize: '200g' },
  { name: 'Flavored Sea Salts', slug: 'sea-salts', unitSize: '250g' },
  { name: 'Herb-Flavored Ghee', slug: 'ghee', unitSize: '300ml' },
  { name: 'Herb-Infused Honey', slug: 'honey', unitSize: '350g' },
  { name: 'Goat Milk + Honey Soap Bars', slug: 'soap-bars', unitSize: '100g' },
] as const;

const WELLNESS_TAGS = [
  'Sleep & Calm',
  'Focus & Energy',
  'Skin & Glow',
  'Immune Support',
  'Bug Repel / Outdoor',
  'Massage & Muscle',
] as const;

interface SeedProduct {
  sku: string;
  name: string;
  slug: string;
  line: (typeof PRODUCT_LINES)[number]['slug'];
  priceUgx: number;
  notes: string;
  directions: string;
  healthBenefits: string;
  tags: (typeof WELLNESS_TAGS)[number][];
  status?: ProductStatus;
}

// Names/prices/notes for these SKUs are taken directly from mockUps/*.html;
// the rest are invented to fill out 5 SKUs per line, consistent with the brand.
const PRODUCTS: SeedProduct[] = [
  // Candles — CDL-001..005. Scent/flavor notes end with the wax base
  // ("Soywax & Beeswax Blend"), matching the convention already used for
  // Ghee (ends "Grass-fed Ghee") and Honey (ends "Raw Honey") — the base
  // ingredient wasn't previously listed here even though the product line
  // is literally named "Scented Soywax Candles".
  {
    sku: 'CDL-001', name: 'Bug Repel Garden Candle', slug: 'bug-repel-garden-candle', line: 'candles',
    priceUgx: 35000, notes: 'Citronella · Lemongrass · Eucalyptus · Soywax & Beeswax Blend',
    directions: 'Burn outdoors on the patio or garden table during evening hours.',
    healthBenefits: 'Citronella and lemongrass are natural insect deterrents.',
    tags: ['Bug Repel / Outdoor'],
  },
  {
    sku: 'CDL-002', name: 'Citrus Focus Candle', slug: 'citrus-focus-candle', line: 'candles',
    priceUgx: 35000, notes: 'Peppermint · Rosemary · Lemon · Soywax & Beeswax Blend',
    directions: 'Burn at your desk during work or study sessions.',
    healthBenefits: 'Peppermint and rosemary are associated with alertness and mental clarity.',
    tags: ['Focus & Energy'],
  },
  {
    sku: 'CDL-003', name: 'Sleep Aid Candle', slug: 'sleep-aid-candle', line: 'candles',
    priceUgx: 35000, notes: 'Lavender · Chamomile · Vetiver · Soywax & Beeswax Blend',
    directions: 'Burn 2 hrs before sleep, in bedroom. Inhale deeply.',
    healthBenefits: "Lavender + Chamomile lower cortisol. Vetiver = 'oil of tranquility'.",
    tags: ['Sleep & Calm'],
  },
  {
    sku: 'CDL-004', name: 'Skin Glow Massage Candle', slug: 'skin-glow-massage-candle', line: 'candles',
    priceUgx: 38000, notes: 'Shea Butter · Cocoa Butter · Vanilla · Soywax & Beeswax Blend',
    directions: 'Burn, then pour the warm melted wax directly onto skin for a massage oil.',
    healthBenefits: 'Shea and cocoa butter moisturize and soften skin.',
    tags: ['Skin & Glow', 'Massage & Muscle'],
  },
  {
    sku: 'CDL-005', name: 'Immune Boost Candle', slug: 'immune-boost-candle', line: 'candles',
    priceUgx: 35000, notes: 'Eucalyptus · Tea Tree · Ginger · Soywax & Beeswax Blend',
    directions: 'Burn in shared/living spaces during cold and flu season.',
    healthBenefits: 'Eucalyptus and tea tree have traditional antimicrobial associations.',
    tags: ['Immune Support'],
  },
  // Sea Salts — SLT-001..005
  {
    sku: 'SLT-001', name: 'Lemon-Ginger Immune Salt', slug: 'lemon-ginger-immune-salt', line: 'sea-salts',
    priceUgx: 22000, notes: 'Lemon · Ginger · Coarse Sea Salt',
    directions: 'Add to warm bath water, or use as a culinary finishing salt.',
    healthBenefits: 'Ginger and citrus are traditionally used to support circulation and immunity.',
    tags: ['Immune Support'],
  },
  {
    sku: 'SLT-002', name: 'Moringa-Neem Detox Salt', slug: 'moringa-neem-detox-salt', line: 'sea-salts',
    priceUgx: 24000, notes: 'Moringa · Neem · Coarse Sea Salt',
    directions: 'Dissolve in a warm bath soak, twice weekly.',
    healthBenefits: 'Moringa and neem are used traditionally for skin detoxification.',
    tags: ['Skin & Glow'],
  },
  {
    sku: 'SLT-003', name: 'Garlic-Herb Culinary Salt', slug: 'garlic-herb-culinary-salt', line: 'sea-salts',
    priceUgx: 20000, notes: 'Garlic · Rosemary · Thyme',
    directions: 'Use as an everyday cooking and finishing salt.',
    healthBenefits: 'A natural, unprocessed alternative to seasoned table salt blends.',
    tags: [],
  },
  {
    sku: 'SLT-004', name: 'Hibiscus-Lemongrass Glow Salt', slug: 'hibiscus-lemongrass-glow-salt', line: 'sea-salts',
    priceUgx: 26000, notes: 'Hibiscus · Lemongrass · Coarse Sea Salt',
    directions: 'Use as a gentle body scrub in the shower, 2-3 times weekly.',
    healthBenefits: 'Hibiscus is rich in antioxidants that support skin radiance.',
    tags: ['Skin & Glow'],
  },
  {
    sku: 'SLT-005', name: 'Eucalyptus-Mint Breathe Salt', slug: 'eucalyptus-mint-breathe-salt', line: 'sea-salts',
    priceUgx: 23000, notes: 'Eucalyptus · Peppermint · Coarse Sea Salt',
    directions: 'Add to a warm bath or footbath in the morning.',
    healthBenefits: 'Eucalyptus and mint are associated with clearer breathing and alertness.',
    tags: ['Focus & Energy'],
  },
  // Ghee — GHE-001..005
  {
    sku: 'GHE-001', name: 'Turmeric-Ginger Healing Ghee', slug: 'turmeric-ginger-healing-ghee', line: 'ghee',
    priceUgx: 42000, notes: 'Turmeric · Ginger · Grass-fed Ghee',
    directions: 'Use 1 tsp daily in warm water, tea, or cooking.',
    healthBenefits: 'Turmeric and ginger are traditionally used to support immunity and digestion.',
    tags: ['Immune Support'],
  },
  {
    sku: 'GHE-002', name: 'Garlic-Rosemary Ghee', slug: 'garlic-rosemary-ghee', line: 'ghee',
    priceUgx: 40000, notes: 'Garlic · Rosemary · Grass-fed Ghee',
    directions: 'Use for sautéing or as a finishing fat on cooked vegetables.',
    healthBenefits: 'Rosemary is traditionally associated with mental alertness.',
    tags: ['Focus & Energy'],
  },
  {
    sku: 'GHE-003', name: 'Cardamom-Cinnamon Calm Ghee', slug: 'cardamom-cinnamon-calm-ghee', line: 'ghee',
    priceUgx: 40000, notes: 'Cardamom · Cinnamon · Grass-fed Ghee',
    directions: 'Stir 1 tsp into warm milk or tea before bed.',
    healthBenefits: 'Warm spiced ghee is used traditionally as an evening wind-down ritual.',
    tags: ['Sleep & Calm'],
  },
  {
    sku: 'GHE-004', name: 'Basil-Pepper Digest Ghee', slug: 'basil-pepper-digest-ghee', line: 'ghee',
    priceUgx: 38000, notes: 'Holy Basil · Black Pepper · Grass-fed Ghee',
    directions: 'Use 1 tsp after meals to support digestion.',
    healthBenefits: 'Holy basil and black pepper are traditionally used as digestive aids.',
    tags: ['Immune Support'],
  },
  {
    sku: 'GHE-005', name: 'Vanilla-Honey Golden Ghee', slug: 'vanilla-honey-golden-ghee', line: 'ghee',
    priceUgx: 40000, notes: 'Vanilla · Local Honey · Grass-fed Ghee',
    directions: 'Spread on warm bread or stir into porridge.',
    healthBenefits: 'A gentler, everyday ghee for skin and hair nourishment from within.',
    tags: ['Skin & Glow'],
  },
  // Honey — HNY-001..005
  {
    sku: 'HNY-001', name: 'Ginger-Lemon Power Shot Honey', slug: 'ginger-lemon-power-shot-honey', line: 'honey',
    priceUgx: 28000, notes: 'Ginger · Lemon · Raw Honey',
    directions: 'Take 1 tbsp daily, or stir into warm water as a morning shot.',
    healthBenefits: 'Ginger and lemon are traditionally used to support immunity and energy.',
    tags: ['Immune Support'],
  },
  {
    sku: 'HNY-002', name: 'Turmeric-Black Pepper Honey', slug: 'turmeric-black-pepper-honey', line: 'honey',
    priceUgx: 30000, notes: 'Turmeric · Black Pepper · Raw Honey',
    directions: 'Take 1 tbsp daily, or stir into warm turmeric milk.',
    healthBenefits: 'Black pepper is traditionally used to enhance turmeric absorption.',
    tags: ['Immune Support'],
  },
  {
    sku: 'HNY-003', name: 'Lavender Sleep Honey', slug: 'lavender-sleep-honey', line: 'honey',
    priceUgx: 28000, notes: 'Lavender · Chamomile · Raw Honey',
    directions: 'Stir 1 tbsp into warm milk or herbal tea before bed.',
    healthBenefits: 'Lavender and chamomile are traditionally used to support relaxation.',
    tags: ['Sleep & Calm'],
  },
  {
    sku: 'HNY-004', name: 'Hibiscus-Rose Glow Honey', slug: 'hibiscus-rose-glow-honey', line: 'honey',
    priceUgx: 30000, notes: 'Hibiscus · Rose · Raw Honey',
    directions: 'Take daily, or use as a natural face-mask base mixed with oats.',
    healthBenefits: 'Hibiscus and rose are rich in antioxidants that support skin radiance.',
    tags: ['Skin & Glow'],
  },
  {
    sku: 'HNY-005', name: 'Mint-Eucalyptus Focus Honey', slug: 'mint-eucalyptus-focus-honey', line: 'honey',
    priceUgx: 28000, notes: 'Peppermint · Eucalyptus · Raw Honey',
    directions: 'Stir 1 tbsp into warm water or tea during the workday.',
    healthBenefits: 'Peppermint and eucalyptus are associated with alertness and clear breathing.',
    tags: ['Focus & Energy'],
  },
  // Soap Bars — SOP-001..005
  {
    sku: 'SOP-001', name: 'Moisture Bomb Bar', slug: 'moisture-bomb-bar', line: 'soap-bars',
    priceUgx: 18000, notes: 'Goat Milk · Honey · Oatmeal',
    directions: 'Lather and use daily in the shower or bath.',
    healthBenefits: 'Goat milk and honey deeply moisturize dry skin.',
    tags: ['Skin & Glow'],
    status: ProductStatus.DRAFT,
  },
  {
    sku: 'SOP-002', name: 'Brightening Bar', slug: 'brightening-bar', line: 'soap-bars',
    priceUgx: 19000, notes: 'Goat Milk · Honey · Turmeric',
    directions: 'Lather and use daily, avoiding direct eye contact.',
    healthBenefits: 'Turmeric is traditionally used to even and brighten skin tone.',
    tags: ['Skin & Glow'],
  },
  {
    sku: 'SOP-003', name: 'Calm Lavender Bar', slug: 'calm-lavender-bar', line: 'soap-bars',
    priceUgx: 18000, notes: 'Goat Milk · Honey · Lavender',
    directions: 'Use during an evening shower as part of a wind-down routine.',
    healthBenefits: 'Lavender is traditionally associated with relaxation.',
    tags: ['Sleep & Calm'],
  },
  {
    sku: 'SOP-004', name: 'Muscle Ease Bar', slug: 'muscle-ease-bar', line: 'soap-bars',
    priceUgx: 19000, notes: 'Goat Milk · Honey · Eucalyptus · Menthol',
    directions: 'Lather onto tired muscles after exercise.',
    healthBenefits: 'Eucalyptus and menthol create a cooling, soothing sensation.',
    tags: ['Massage & Muscle'],
  },
  {
    sku: 'SOP-005', name: 'Citrus Wake-Up Bar', slug: 'citrus-wake-up-bar', line: 'soap-bars',
    priceUgx: 18000, notes: 'Goat Milk · Honey · Orange · Ginger',
    directions: 'Use in the morning shower for an energizing start.',
    healthBenefits: 'Citrus and ginger are associated with an energizing, uplifting scent.',
    tags: ['Focus & Energy'],
  },
];

// Kampala Central / Entebbe Hub stock levels for these three SKUs are taken
// directly from mockUps/ChrisPa_Admin_Wireframes__1_.html's Inventory screen.
const INVENTORY_OVERRIDES: Record<string, { central: number; entebbe: number; reorderPoint: number; batchLot: string }> = {
  'CDL-003': { central: 4, entebbe: 0, reorderPoint: 15, batchLot: 'LOT-0625A' },
  'SLT-002': { central: 9, entebbe: 12, reorderPoint: 20, batchLot: 'LOT-0619C' },
  'GHE-001': { central: 22, entebbe: 16, reorderPoint: 15, batchLot: 'LOT-0601B' },
};

async function main() {
  const lineBySlug = new Map<string, string>();
  for (const line of PRODUCT_LINES) {
    const created = await prisma.productLine.upsert({
      where: { slug: line.slug },
      update: { name: line.name, unitSize: line.unitSize },
      create: line,
    });
    lineBySlug.set(line.slug, created.id);
  }

  const tagByLabel = new Map<string, string>();
  for (const label of WELLNESS_TAGS) {
    const created = await prisma.wellnessTag.upsert({
      where: { label },
      update: {},
      create: { label },
    });
    tagByLabel.set(label, created.id);
  }

  const [central, entebbe] = await Promise.all([
    prisma.warehouse.upsert({
      where: { name: 'Kampala Central' },
      update: {},
      create: { name: 'Kampala Central', location: 'Kampala, Uganda' },
    }),
    prisma.warehouse.upsert({
      where: { name: 'Entebbe Hub' },
      update: {},
      create: { name: 'Entebbe Hub', location: 'Entebbe, Uganda' },
    }),
  ]);

  for (const p of PRODUCTS) {
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        name: p.name,
        priceUgx: p.priceUgx,
        scentOrFlavorNotes: p.notes,
        directions: p.directions,
        healthBenefits: p.healthBenefits,
        status: p.status ?? ProductStatus.ACTIVE,
      },
      create: {
        sku: p.sku,
        name: p.name,
        slug: p.slug,
        productLineId: lineBySlug.get(p.line)!,
        priceUgx: p.priceUgx,
        status: p.status ?? ProductStatus.ACTIVE,
        scentOrFlavorNotes: p.notes,
        directions: p.directions,
        healthBenefits: p.healthBenefits,
        seoTitle: p.name,
        seoMeta: `${p.name} — ${p.notes} — ChrisPa Scents and Soaps`,
      },
    });

    for (const tag of p.tags) {
      await prisma.productWellnessTag.upsert({
        where: { productId_wellnessTagId: { productId: product.id, wellnessTagId: tagByLabel.get(tag)! } },
        update: {},
        create: { productId: product.id, wellnessTagId: tagByLabel.get(tag)! },
      });
    }

    const override = INVENTORY_OVERRIDES[p.sku];
    const centralQty = override?.central ?? (p.status === ProductStatus.DRAFT ? 0 : 40 + Math.floor(Math.random() * 30));
    const entebbeQty = override?.entebbe ?? (p.status === ProductStatus.DRAFT ? 0 : 15 + Math.floor(Math.random() * 25));
    const reorderPoint = override?.reorderPoint ?? 15;
    const batchLot = override?.batchLot ?? `LOT-${p.sku}`;

    await prisma.inventoryRecord.upsert({
      where: { productId_warehouseId_batchLot: { productId: product.id, warehouseId: central.id, batchLot } },
      update: { qtyOnHand: centralQty, reorderPoint },
      create: { productId: product.id, warehouseId: central.id, batchLot, qtyOnHand: centralQty, reorderPoint },
    });
    await prisma.inventoryRecord.upsert({
      where: { productId_warehouseId_batchLot: { productId: product.id, warehouseId: entebbe.id, batchLot } },
      update: { qtyOnHand: entebbeQty, reorderPoint },
      create: { productId: product.id, warehouseId: entebbe.id, batchLot, qtyOnHand: entebbeQty, reorderPoint },
    });

    await prisma.product.update({
      where: { id: product.id },
      data: { stockQty: centralQty + entebbeQty },
    });
  }

  // Coupons — codes/types/usage counts from mockUps/ChrisPa_Admin_Wireframes__1_.html
  await Promise.all([
    prisma.coupon.upsert({
      where: { code: 'CHRISPA10' },
      update: {},
      create: { code: 'CHRISPA10', type: CouponType.PERCENT_OFF, value: 10, usageCount: 412, isActive: true },
    }),
    prisma.coupon.upsert({
      where: { code: 'SLEEPWELL' },
      update: {},
      create: { code: 'SLEEPWELL', type: CouponType.FREE_SHIPPING, value: 0, usageCount: 88, isActive: true },
    }),
    prisma.coupon.upsert({
      where: { code: 'WELCOME5' },
      update: {},
      create: { code: 'WELCOME5', type: CouponType.PERCENT_OFF, value: 5, usageCount: 1204, isActive: true },
    }),
  ]);

  // Shipping zones (per user decision, not in the original SRS) — replaces
  // the old flat per-delivery-method fee table; CheckoutService now prices
  // by destination + delivery method via ShippingZonesService. Two starter
  // zones so checkout works out of the box; an admin can add/edit more via
  // Admin → Shipping Zones. "Rest of Uganda" is the isDefault fallback for
  // any city that doesn't match Kampala Metro's town list — deliberately
  // not "Kampala Metro" itself, so an unrecognized/misspelled town gets
  // priced as upcountry (safer to overcharge shipping than undercharge it)
  // rather than silently defaulting to Kampala's cheaper rates.
  const kampalaZone = await prisma.shippingZone.findFirst({ where: { name: 'Kampala Metro' } });
  if (!kampalaZone) {
    await prisma.shippingZone.create({
      data: {
        name: 'Kampala Metro',
        towns: [
          'Kampala', 'Nakawa', 'Kawempe', 'Makindye', 'Rubaga', 'Central Division',
          'Ntinda', 'Bugolobi', 'Muyenga', 'Kololo', 'Nakasero', 'Naalya', 'Kyanja',
          'Kisaasi', 'Bukoto', 'Kabalagala', 'Namuwongo',
        ],
        isDefault: false,
        standardFeeUgx: 0,
        expressFeeUgx: 8000,
        sameDayFeeUgx: 12000,
        sortOrder: 0,
      },
    });
  }
  const upcountryZone = await prisma.shippingZone.findFirst({ where: { name: 'Rest of Uganda' } });
  if (!upcountryZone) {
    await prisma.shippingZone.create({
      data: {
        name: 'Rest of Uganda',
        towns: [],
        isDefault: true,
        standardFeeUgx: 15000,
        expressFeeUgx: 25000,
        sameDayFeeUgx: 35000,
        sortOrder: 1,
      },
    });
  }

  // Wellness Kit bundle — from the Marketing wireframe's Bundle Builder panel
  const sleepAid = await prisma.product.findUniqueOrThrow({ where: { sku: 'CDL-003' } });
  const sleepHoney = await prisma.product.findUniqueOrThrow({ where: { sku: 'HNY-003' } });
  const calmGhee = await prisma.product.findUniqueOrThrow({ where: { sku: 'GHE-003' } });
  const existingBundle = await prisma.bundle.findFirst({ where: { name: 'Sleep Ritual Kit' } });
  if (!existingBundle) {
    await prisma.bundle.create({
      data: {
        name: 'Sleep Ritual Kit',
        productIds: [sleepAid.id, sleepHoney.id, calmGhee.id],
        bundlePriceUgx: 95000,
      },
    });
  }

  // Admin/staff users — names/roles/2FA status from the Users & Settings wireframe
  const devPasswordHash = await bcrypt.hash('ChrisPa2026!', 10);
  // emailVerifiedAt is set on every staff seed user — the registration-OTP
  // hard gate (AuthService.login()) only applies to CUSTOMER accounts, but
  // seeding it here too means the flag is never a false signal if that scope
  // ever widens.
  const chris = await prisma.user.upsert({
    where: { email: 'chris@chrispa.ug' },
    update: {},
    create: { name: 'Chris P.', email: 'chris@chrispa.ug', role: UserRole.OWNER, passwordHash: devPasswordHash, twoFactorEnabled: true, emailVerifiedAt: new Date() },
  });
  const patricia = await prisma.user.upsert({
    where: { email: 'patricia@chrispa.ug' },
    update: {},
    create: { name: 'Patricia A.', email: 'patricia@chrispa.ug', role: UserRole.STORE_MANAGER, passwordHash: devPasswordHash, twoFactorEnabled: true, emailVerifiedAt: new Date() },
  });
  const dennis = await prisma.user.upsert({
    where: { email: 'dennis@chrispa.ug' },
    update: {},
    create: { name: 'Dennis M.', email: 'dennis@chrispa.ug', role: UserRole.FULFILLMENT, passwordHash: devPasswordHash, twoFactorEnabled: false, emailVerifiedAt: new Date() },
  });
  const grace = await prisma.user.upsert({
    where: { email: 'grace@chrispa.ug' },
    update: {},
    create: { name: 'Grace N.', email: 'grace@chrispa.ug', role: UserRole.HR_MANAGER, passwordHash: devPasswordHash, twoFactorEnabled: true, emailVerifiedAt: new Date() },
  });
  // First real login for the SUPPORT_AGENT role (FR-7.4) — existed in
  // UserRole from the start but had no gated endpoint, and so no seed user,
  // until Support Tickets admin review/response was built.
  const brenda = await prisma.user.upsert({
    where: { email: 'brenda@chrispa.ug' },
    update: {},
    create: { name: 'Brenda K.', email: 'brenda@chrispa.ug', role: UserRole.SUPPORT_AGENT, passwordHash: devPasswordHash, twoFactorEnabled: false, emailVerifiedAt: new Date() },
  });

  // ---------- HR Phase 1: Departments & Employee Profiles ----------
  const [execDept, retailDept, fulfillmentDept, hrDept] = await Promise.all([
    prisma.department.upsert({ where: { name: 'Executive' }, update: {}, create: { name: 'Executive', description: 'Ownership & overall direction' } }),
    prisma.department.upsert({ where: { name: 'Retail Operations' }, update: {}, create: { name: 'Retail Operations', description: 'Storefront, merchandising, customer experience' } }),
    prisma.department.upsert({ where: { name: 'Fulfillment & Logistics' }, update: {}, create: { name: 'Fulfillment & Logistics', description: 'Warehousing, packing, delivery' } }),
    prisma.department.upsert({ where: { name: 'Human Resources' }, update: {}, create: { name: 'Human Resources', description: 'Staffing, payroll, compliance' } }),
  ]);

  // Department policy/permissions — a stored record documenting what each
  // department is "meant to operate" (see the comment on DepartmentPermission
  // in schema.prisma: it's policy data surfaced in the UI, not the actual
  // enforcement mechanism, which stays the @Roles()/RolesGuard checks on
  // UserRole). Matrix mirrors those role checks exactly so the record is
  // accurate from day one. Only seeds if the department has no permission
  // rows yet, so it never clobbers edits made later via the Departments UI.
  const ALL_TRUE = { canView: true, canCreate: true, canUpdate: true, canDelete: true, canExecute: true };
  const VIEW_ONLY = { canView: true, canCreate: false, canUpdate: false, canDelete: false, canExecute: false };
  const VIEW_AND_EXECUTE = { canView: true, canCreate: false, canUpdate: false, canDelete: false, canExecute: true };
  const DENY_ALL = { canView: false, canCreate: false, canUpdate: false, canDelete: false, canExecute: false };

  async function seedDepartmentPermissions(departmentId: string, overrides: Partial<Record<PermissionResource, typeof ALL_TRUE>>) {
    const existing = await prisma.departmentPermission.count({ where: { departmentId } });
    if (existing > 0) return;
    await prisma.departmentPermission.createMany({
      data: Object.values(PermissionResource).map((resource) => ({ departmentId, resource, ...(overrides[resource] ?? DENY_ALL) })),
    });
  }

  await seedDepartmentPermissions(
    execDept.id,
    Object.fromEntries(Object.values(PermissionResource).map((r) => [r, ALL_TRUE])) as Partial<Record<PermissionResource, typeof ALL_TRUE>>,
  );
  await seedDepartmentPermissions(hrDept.id, {
    HR_DASHBOARD: ALL_TRUE, HR_EMPLOYEES: ALL_TRUE, HR_ATTENDANCE: ALL_TRUE, HR_LEAVE: ALL_TRUE,
    HR_SHIFTS: ALL_TRUE, HR_RECRUITMENT: ALL_TRUE, HR_PAYROLL: ALL_TRUE, HR_PERFORMANCE: ALL_TRUE,
  });
  await seedDepartmentPermissions(retailDept.id, {
    PRODUCTS: ALL_TRUE, ORDERS: ALL_TRUE, INVENTORY: ALL_TRUE, CUSTOMERS: ALL_TRUE, MARKETING: ALL_TRUE, CMS: ALL_TRUE,
  });
  await seedDepartmentPermissions(fulfillmentDept.id, {
    PRODUCTS: VIEW_ONLY, ORDERS: VIEW_AND_EXECUTE, INVENTORY: VIEW_ONLY, CUSTOMERS: VIEW_ONLY, MARKETING: VIEW_ONLY, CMS: VIEW_ONLY,
  });

  async function upsertEmployee(params: {
    employeeNumber: string;
    userId?: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
    departmentId: string;
    hireDate: Date;
    managerId?: string;
    baseSalaryUgx: number;
    personalPhone?: string;
  }) {
    const employee = await prisma.employee.upsert({
      where: { employeeNumber: params.employeeNumber },
      update: {},
      create: {
        employeeNumber: params.employeeNumber,
        userId: params.userId,
        firstName: params.firstName,
        lastName: params.lastName,
        jobTitle: params.jobTitle,
        departmentId: params.departmentId,
        hireDate: params.hireDate,
        managerId: params.managerId,
        baseSalaryUgx: params.baseSalaryUgx,
        personalPhone: params.personalPhone,
        employmentType: 'FULL_TIME',
        employmentStatus: 'ACTIVE',
      },
    });
    const hasHiredEntry = await prisma.employmentHistoryEntry.findFirst({ where: { employeeId: employee.id, changeType: 'HIRED' } });
    if (!hasHiredEntry) {
      await prisma.employmentHistoryEntry.create({
        data: { employeeId: employee.id, changeType: 'HIRED', newValue: params.jobTitle, effectiveDate: params.hireDate },
      });
    }
    return employee;
  }

  const chrisEmployee = await upsertEmployee({
    employeeNumber: 'CP-EMP-0001', userId: chris.id, firstName: 'Chris', lastName: 'P.',
    jobTitle: 'Owner / CEO', departmentId: execDept.id, hireDate: new Date('2023-01-16'), baseSalaryUgx: 4500000,
  });
  const patriciaEmployee = await upsertEmployee({
    employeeNumber: 'CP-EMP-0002', userId: patricia.id, firstName: 'Patricia', lastName: 'A.',
    jobTitle: 'Store Manager', departmentId: retailDept.id, hireDate: new Date('2023-03-01'),
    managerId: chrisEmployee.id, baseSalaryUgx: 2200000,
  });
  const dennisEmployee = await upsertEmployee({
    employeeNumber: 'CP-EMP-0003', userId: dennis.id, firstName: 'Dennis', lastName: 'M.',
    jobTitle: 'Fulfillment Coordinator', departmentId: fulfillmentDept.id, hireDate: new Date('2023-06-10'),
    managerId: chrisEmployee.id, baseSalaryUgx: 1800000,
  });
  await upsertEmployee({
    employeeNumber: 'CP-EMP-0009', userId: brenda.id, firstName: 'Brenda', lastName: 'K.',
    jobTitle: 'Customer Support Agent', departmentId: retailDept.id, hireDate: new Date('2025-01-15'),
    managerId: patriciaEmployee.id, baseSalaryUgx: 1400000,
  });
  await upsertEmployee({
    employeeNumber: 'CP-EMP-0004', userId: grace.id, firstName: 'Grace', lastName: 'N.',
    jobTitle: 'HR Manager', departmentId: hrDept.id, hireDate: new Date('2024-02-01'),
    managerId: chrisEmployee.id, baseSalaryUgx: 2100000,
  });
  // No `userId` — demonstrates an employee record that exists (e.g. mid-onboarding)
  // without a system login yet.
  const peterEmployee = await upsertEmployee({
    employeeNumber: 'CP-EMP-0005', firstName: 'Peter', lastName: 'K.',
    jobTitle: 'Warehouse Assistant', departmentId: fulfillmentDept.id, hireDate: new Date('2025-11-03'),
    managerId: dennisEmployee.id, baseSalaryUgx: 900000, personalPhone: '+256701112233',
  });

  const chrisContract = await prisma.employeeDocument.findFirst({ where: { employeeId: chrisEmployee.id, type: 'CONTRACT' } });
  if (!chrisContract) {
    await prisma.employeeDocument.create({
      data: {
        employeeId: chrisEmployee.id,
        type: 'CONTRACT',
        title: 'Founding Owner Agreement',
        fileUrl: 'https://example.com/documents/chris-owner-agreement.pdf',
      },
    });
  }

  // ---------- HR Phase 2: Time & Attendance, Leave, Shift Scheduling ----------
  const dennisLeave = await prisma.leaveRequest.findFirst({ where: { employeeId: dennisEmployee.id, type: 'ANNUAL' } });
  if (!dennisLeave) {
    await prisma.leaveRequest.create({
      data: {
        employeeId: dennisEmployee.id,
        type: 'ANNUAL',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-09-05'),
        reason: 'Family trip',
        status: 'APPROVED',
        reviewedByUserId: grace.id,
        reviewNotes: 'Enjoy!',
      },
    });
  }

  const dennisPastEntry = await prisma.timeEntry.findFirst({ where: { employeeId: dennisEmployee.id } });
  if (!dennisPastEntry) {
    const yesterday8am = new Date();
    yesterday8am.setDate(yesterday8am.getDate() - 1);
    yesterday8am.setHours(8, 2, 0, 0);
    const yesterday5pm = new Date(yesterday8am);
    yesterday5pm.setHours(17, 6, 0, 0);
    await prisma.timeEntry.create({ data: { employeeId: dennisEmployee.id, clockIn: yesterday8am, clockOut: yesterday5pm } });
  }

  const swapDemoShift = await prisma.shift.findFirst({ where: { employeeId: peterEmployee.id, role: 'Warehouse Lead' } });
  if (!swapDemoShift) {
    await prisma.shift.create({
      data: {
        employeeId: peterEmployee.id,
        startAt: new Date('2026-09-10T08:00:00Z'),
        endAt: new Date('2026-09-10T16:00:00Z'),
        role: 'Warehouse Lead',
        notes: 'Originally Dennis — swapped to Peter (demo data)',
      },
    });
  }

  // ---------- HR Phase 3: Performance, Recruitment ----------
  const peterGoal = await prisma.performanceGoal.findFirst({ where: { employeeId: peterEmployee.id } });
  if (!peterGoal) {
    await prisma.performanceGoal.create({
      data: {
        employeeId: peterEmployee.id,
        title: 'Complete forklift certification',
        targetDate: new Date('2026-12-01'),
        createdByUserId: dennis.id, // Peter's manager, not Owner/HR — demonstrates manager-level access
      },
    });
  }

  const patriciaReview = await prisma.performanceReview.findFirst({ where: { employeeId: patriciaEmployee.id } });
  if (!patriciaReview) {
    await prisma.performanceReview.create({
      data: {
        employeeId: patriciaEmployee.id,
        reviewerUserId: chris.id,
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-06-30'),
        rating: 4,
        strengths: 'Strong team leadership',
        areasForImprovement: 'Delegate more',
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
      },
    });
  }

  const deliveryPosting = await prisma.jobPosting.findFirst({ where: { title: 'Delivery Rider' } });
  if (!deliveryPosting) {
    const posting = await prisma.jobPosting.create({
      data: {
        title: 'Delivery Rider',
        departmentId: fulfillmentDept.id,
        description: 'Kampala same-day delivery',
        status: 'FILLED',
        postedAt: new Date('2026-07-01'),
        closedAt: new Date('2026-07-20'),
        createdByUserId: grace.id,
      },
    });
    const ronald = await upsertEmployee({
      employeeNumber: 'CP-EMP-0006', firstName: 'Ronald', lastName: 'Okello',
      jobTitle: 'Delivery Rider', departmentId: fulfillmentDept.id, hireDate: new Date('2026-07-20'),
      managerId: dennisEmployee.id, baseSalaryUgx: 850000, personalPhone: '+256709998877',
    });
    await prisma.applicant.create({
      data: {
        jobPostingId: posting.id,
        firstName: 'Ronald',
        lastName: 'Okello',
        email: 'ronald.okello@example.com',
        phone: '+256709998877',
        stage: 'HIRED',
        convertedEmployeeId: ronald.id,
      },
    });
  }

  // ---------- HR Phase 4: Payroll ----------
  // A finalized period demonstrates the full DRAFT -> COMPUTED -> FINALIZED
  // lifecycle, including a recurring allowance, a confirmed overtime
  // amount, a bonus, a penalty, and salary-advance recovery — computed
  // directly via computePayslip() (the same function PayrollService.run()
  // uses) so this seed script doesn't need a Nest DI context.
  const payrollMonth = new Date('2026-07-01');
  let julyPayroll = await prisma.payrollPeriod.findUnique({
    where: { month_type: { month: payrollMonth, type: 'REGULAR' } },
  });
  if (!julyPayroll) {
    julyPayroll = await prisma.payrollPeriod.create({
      data: { month: payrollMonth, createdByUserId: chris.id, status: 'FINALIZED', finalizedAt: new Date('2026-07-28') },
    });

    await prisma.employeeAllowance.create({
      data: { employeeId: patriciaEmployee.id, type: 'TRANSPORT', label: 'Transport allowance', amountUgx: 150_000, taxable: true },
    });

    const peterAdvance = await prisma.salaryAdvance.create({
      data: {
        employeeId: peterEmployee.id,
        principalUgx: 300_000,
        balanceRemainingUgx: 300_000,
        monthlyInstallmentUgx: 100_000,
        approvedByUserId: chris.id,
        note: 'School fees advance',
      },
    });

    await prisma.payrollAdjustment.create({
      data: {
        periodId: julyPayroll.id, employeeId: dennisEmployee.id, type: 'BONUS',
        label: 'Fulfillment KPI bonus', amountUgx: 100_000, taxable: true, createdByUserId: chris.id,
      },
    });
    await prisma.payrollAdjustment.create({
      data: {
        periodId: julyPayroll.id, employeeId: dennisEmployee.id, type: 'OVERTIME',
        label: 'Confirmed overtime — July', amountUgx: 45_000, taxable: true, createdByUserId: chris.id,
      },
    });
    await prisma.payrollAdjustment.create({
      data: {
        periodId: julyPayroll.id, employeeId: peterEmployee.id, type: 'PENALTY',
        label: 'Late timesheet submission', amountUgx: 20_000, createdByUserId: chris.id,
      },
    });

    const payrollEmployees: {
      employee: typeof chrisEmployee;
      taxableAllowancesUgx?: number;
      bonusUgx?: number;
      overtimeUgx?: number;
      penaltyUgx?: number;
      advance?: { id: string; amountUgx: number };
    }[] = [
      { employee: chrisEmployee },
      { employee: patriciaEmployee, taxableAllowancesUgx: 150_000 },
      { employee: dennisEmployee, bonusUgx: 100_000, overtimeUgx: 45_000 },
      { employee: peterEmployee, penaltyUgx: 20_000, advance: { id: peterAdvance.id, amountUgx: 100_000 } },
    ];
    for (const p of payrollEmployees) {
      if (!p.employee.baseSalaryUgx) continue;
      const calc = computePayslip({
        basicSalaryUgx: p.employee.baseSalaryUgx,
        taxableAllowancesUgx: p.taxableAllowancesUgx,
        bonusUgx: p.bonusUgx,
        overtimeUgx: p.overtimeUgx,
        penaltyUgx: p.penaltyUgx,
        advanceRepaymentUgx: p.advance?.amountUgx,
      });
      const payslip = await prisma.payslip.create({
        data: { periodId: julyPayroll.id, employeeId: p.employee.id, ...calc },
      });
      if (p.advance) {
        await prisma.payslipAdvanceRepayment.create({
          data: { payslipId: payslip.id, advanceId: p.advance.id, amountUgx: p.advance.amountUgx },
        });
        await prisma.salaryAdvance.update({
          where: { id: p.advance.id },
          data: { balanceRemainingUgx: { decrement: p.advance.amountUgx } },
        });
      }
    }
  }

  // Sample customer + order history — from the My Account / Order History wireframes
  const sarah = await prisma.user.upsert({
    where: { email: 'sarah@example.com' },
    update: {},
    create: {
      name: 'Sarah Nakato',
      email: 'sarah@example.com',
      phone: '+256700000214',
      role: UserRole.CUSTOMER,
      tier: 'GOLD',
      passwordHash: devPasswordHash,
      // Pre-verified — the registration-OTP hard gate (AuthService.login())
      // has nothing to check against for a seeded demo account with no real
      // OTP ever sent.
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      cart: { create: {} },
      loyaltyAccount: { create: { pointsBalance: 1240, tier: 'GOLD' } },
    },
  });

  const moistureBombBar = await prisma.product.findUniqueOrThrow({ where: { sku: 'SOP-001' } });
  const gingerLemonHoney = await prisma.product.findUniqueOrThrow({ where: { sku: 'HNY-001' } });

  const order1042 = await prisma.order.upsert({
    where: { orderNumber: 'CP-1042' },
    update: {},
    create: {
      orderNumber: 'CP-1042',
      userId: sarah.id,
      status: 'DELIVERED',
      warehouseId: central.id,
      subtotalUgx: 99000,
      shippingFeeUgx: 6000,
      discountUgx: 9900,
      totalUgx: 95100,
      deliveryMethod: 'STANDARD',
      shippingAddress: { recipient: 'Sarah Nakato', line1: 'Plot 14, Ntinda Road', city: 'Kampala', phone: '+256700000214' },
      items: {
        create: [
          { productId: sleepAid.id, qty: 1, unitPriceUgx: 35000 },
          { productId: moistureBombBar.id, qty: 2, unitPriceUgx: 18000 },
          { productId: gingerLemonHoney.id, qty: 1, unitPriceUgx: 28000 },
        ],
      },
    },
  });

  await prisma.order.upsert({
    where: { orderNumber: 'CP-1031' },
    update: {},
    create: {
      orderNumber: 'CP-1031',
      userId: sarah.id,
      status: 'SHIPPED',
      warehouseId: central.id,
      subtotalUgx: 35000,
      totalUgx: 35000,
      deliveryMethod: 'STANDARD',
      shippingAddress: { recipient: 'Sarah Nakato', line1: 'Plot 14, Ntinda Road', city: 'Kampala', phone: '+256700000214' },
      items: { create: [{ productId: sleepAid.id, qty: 1, unitPriceUgx: 35000 }] },
    },
  });

  const loyaltyAccount = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: sarah.id } });
  const existingLedger = await prisma.loyaltyLedgerEntry.findFirst({ where: { loyaltyAccountId: loyaltyAccount.id } });
  if (!existingLedger) {
    await prisma.loyaltyLedgerEntry.createMany({
      data: [
        { loyaltyAccountId: loyaltyAccount.id, delta: 95, reason: `Order #${order1042.orderNumber}`, orderId: order1042.id },
        { loyaltyAccountId: loyaltyAccount.id, delta: 30, reason: 'Referral: Brian K.' },
      ],
    });
  }

  const existingAddress = await prisma.address.findFirst({ where: { userId: sarah.id, label: 'Home' } });
  if (!existingAddress) {
    await prisma.address.create({
      data: { userId: sarah.id, label: 'Home', recipient: 'Sarah Nakato', line1: 'Plot 14, Ntinda Road', phone: '+256700000214', isDefault: true },
    });
  }

  // AL-FR-1 (docs/SRS.md §19): a handful of representative rows so the admin
  // Activity Log page isn't empty on first run — same "demo data illustrates
  // the feature" convention as the rest of this file (e.g. the one seeded
  // clock-in/out cycle). Not literally replayed through the real write paths
  // that emit these in production; just realistic examples of both actor types.
  const existingActivity = await prisma.activityLog.findFirst({ where: { action: 'ORDER_PLACED', entityId: order1042.id } });
  if (!existingActivity) {
    const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
    await prisma.activityLog.createMany({
      data: [
        {
          actorUserId: sarah.id,
          actorRole: UserRole.CUSTOMER,
          actorType: 'CUSTOMER',
          action: 'LOGIN',
          entityType: 'User',
          entityId: sarah.id,
          description: 'Logged in',
          ipAddress: '102.89.44.10',
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)',
          createdAt: daysAgo(6),
        },
        {
          actorUserId: sarah.id,
          actorRole: UserRole.CUSTOMER,
          actorType: 'CUSTOMER',
          action: 'ORDER_PLACED',
          entityType: 'Order',
          entityId: order1042.id,
          description: `Placed order #${order1042.orderNumber} — CASH_ON_DELIVERY, total UGX 95,100`,
          ipAddress: '102.89.44.10',
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)',
          createdAt: daysAgo(6),
        },
        {
          actorUserId: chris.id,
          actorRole: UserRole.OWNER,
          actorType: 'STAFF',
          action: 'ORDER_STATUS_CHANGED',
          entityType: 'Order',
          entityId: order1042.id,
          description: `Order #${order1042.orderNumber} moved from PROCESSING to DELIVERED`,
          metadata: { from: 'PROCESSING', to: 'DELIVERED' },
          ipAddress: '41.210.140.2',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          createdAt: daysAgo(4),
        },
        {
          actorUserId: patricia.id,
          actorRole: UserRole.STORE_MANAGER,
          actorType: 'STAFF',
          action: 'PRODUCT_UPDATED',
          entityType: 'Product',
          entityId: moistureBombBar.id,
          description: `Updated product "${moistureBombBar.name}" (${moistureBombBar.sku})`,
          ipAddress: '41.210.140.5',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          createdAt: daysAgo(3),
        },
        {
          actorUserId: grace.id,
          actorRole: UserRole.HR_MANAGER,
          actorType: 'STAFF',
          action: 'EMPLOYEE_UPDATED',
          entityType: 'Employee',
          entityId: dennisEmployee.id,
          description: `Updated employee ${dennisEmployee.firstName} ${dennisEmployee.lastName} (${dennisEmployee.employeeNumber})`,
          metadata: { changeTypes: ['SALARY_CHANGE'] },
          ipAddress: '41.210.140.7',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          createdAt: daysAgo(2),
        },
        {
          actorUserId: sarah.id,
          actorRole: UserRole.CUSTOMER,
          actorType: 'CUSTOMER',
          action: 'PROFILE_UPDATED',
          entityType: 'User',
          entityId: sarah.id,
          description: 'Updated profile details',
          ipAddress: '102.89.44.10',
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)',
          createdAt: daysAgo(1),
        },
      ],
    });
  }

  // FIN-FR-1..5 (docs/SRS.md §20): a demo multi-entity group so the Finance
  // section has real, balanced books to show on first run. Reuses the real
  // service classes (not a hand-rolled reimplementation) so the seeded data
  // goes through the exact same balance validation, period handling, and
  // intercompany pairing as a real API call would — the `prisma` client here
  // is a plain PrismaClient rather than the NestJS-wrapped PrismaService,
  // but they're structurally identical for every method these services call.
  const activityLogForSeed = new ActivityLogService(prisma as unknown as PrismaService);
  const entitiesService = new EntitiesService(prisma as unknown as PrismaService);
  const accountsService = new AccountsService(prisma as unknown as PrismaService);
  const journalService = new JournalService(prisma as unknown as PrismaService, activityLogForSeed);
  const intercompanyService = new IntercompanyService(prisma as unknown as PrismaService, journalService);

  const existingGroupSettings = await prisma.groupSettings.findFirst();
  if (!existingGroupSettings) {
    await prisma.groupSettings.create({ data: { reportingCurrency: 'UGX' } });
  }

  let parentEntity = await prisma.legalEntity.findUnique({ where: { code: 'CHRISPA-UG' } });
  if (!parentEntity) {
    parentEntity = await entitiesService.create({ name: 'ChrisPa Scents and Soaps LTD', code: 'CHRISPA-UG', functionalCurrency: 'UGX' });
    await accountsService.applyStandardTemplate(parentEntity.id);
  }

  // Clearly labeled as a demo/placeholder — the user confirmed ChrisPa is a
  // genuine multi-entity group but gave no real subsidiary names, so this
  // exercises the multi-entity/consolidation/intercompany mechanics without
  // asserting anything factual about ChrisPa's actual corporate structure.
  // 29 UGX per KES is an illustrative manual rate, not a live FX feed — see
  // the schema comment on LegalEntity.currentGroupFxRate.
  let subsidiaryEntity = await prisma.legalEntity.findUnique({ where: { code: 'CHRISPA-DEMO-SUB' } });
  if (!subsidiaryEntity) {
    subsidiaryEntity = await entitiesService.create({
      name: 'ChrisPa Regional Distribution Ltd (Demo Subsidiary)',
      code: 'CHRISPA-DEMO-SUB',
      functionalCurrency: 'KES',
      parentEntityId: parentEntity.id,
      currentGroupFxRate: 29,
    });
    await accountsService.applyStandardTemplate(subsidiaryEntity.id);
  }

  const existingJournalEntry = await prisma.journalEntry.findFirst({ where: { entityId: parentEntity.id } });
  if (!existingJournalEntry) {
    const parentAccounts = await prisma.account.findMany({ where: { entityId: parentEntity.id } });
    const subAccounts = await prisma.account.findMany({ where: { entityId: subsidiaryEntity.id } });
    const pAcct = (code: string) => parentAccounts.find((a) => a.code === code)!.id;
    const sAcct = (code: string) => subAccounts.find((a) => a.code === code)!.id;

    // Parent: opening capital, a quarter of trading activity, and an
    // inventory purchase — enough for the balance sheet/income statement to
    // show non-trivial, correctly-balancing figures.
    await journalService.postEntry(
      { entityId: parentEntity.id, date: '2026-01-05', description: 'Opening share capital', lines: [{ accountId: pAcct('1000'), debitAmount: 80_000_000 }, { accountId: pAcct('3000'), creditAmount: 80_000_000 }] },
      { userId: chris.id, role: 'OWNER' },
    );
    await journalService.postEntry(
      { entityId: parentEntity.id, date: '2026-02-10', description: 'Inventory purchase — Q1 stock', lines: [{ accountId: pAcct('1200'), debitAmount: 18_000_000 }, { accountId: pAcct('1000'), creditAmount: 18_000_000 }] },
      { userId: chris.id, role: 'OWNER' },
    );
    await journalService.postEntry(
      { entityId: parentEntity.id, date: '2026-03-20', description: 'Q1 retail sales', lines: [{ accountId: pAcct('1000'), debitAmount: 42_000_000 }, { accountId: pAcct('4000'), creditAmount: 42_000_000 }] },
      { userId: chris.id, role: 'OWNER' },
    );
    await journalService.postEntry(
      { entityId: parentEntity.id, date: '2026-03-20', description: 'Q1 cost of goods sold', lines: [{ accountId: pAcct('5000'), debitAmount: 14_000_000 }, { accountId: pAcct('1200'), creditAmount: 14_000_000 }] },
      { userId: chris.id, role: 'OWNER' },
    );
    await journalService.postEntry(
      { entityId: parentEntity.id, date: '2026-03-25', description: 'Q1 operating expenses (rent, salaries)', lines: [{ accountId: pAcct('5100'), debitAmount: 9_500_000 }, { accountId: pAcct('1000'), creditAmount: 9_500_000 }] },
      { userId: chris.id, role: 'OWNER' },
    );

    // Subsidiary: its own opening capital and trading activity, in KES.
    await journalService.postEntry(
      { entityId: subsidiaryEntity.id, date: '2026-01-15', description: 'Opening share capital', lines: [{ accountId: sAcct('1000'), debitAmount: 2_800_000 }, { accountId: sAcct('3000'), creditAmount: 2_800_000 }] },
      { userId: chris.id, role: 'OWNER' },
    );
    await journalService.postEntry(
      { entityId: subsidiaryEntity.id, date: '2026-03-18', description: 'Q1 distribution revenue', lines: [{ accountId: sAcct('1000'), debitAmount: 1_450_000 }, { accountId: sAcct('4000'), creditAmount: 1_450_000 }] },
      { userId: chris.id, role: 'OWNER' },
    );
    await journalService.postEntry(
      { entityId: subsidiaryEntity.id, date: '2026-03-25', description: 'Q1 operating expenses', lines: [{ accountId: sAcct('5100'), debitAmount: 620_000 }, { accountId: sAcct('1000'), creditAmount: 620_000 }] },
      { userId: chris.id, role: 'OWNER' },
    );

    // Intercompany: parent bills the subsidiary a quarterly management fee
    // — demonstrates the paired due-to/due-from posting and (via the
    // consolidated balance sheet/income statement) the elimination.
    await intercompanyService.allocateManagementFee(
      { parentEntityId: parentEntity.id, subsidiaryEntityId: subsidiaryEntity.id, amount: 3_000_000, date: '2026-03-31', description: 'Q1 corporate management fee' },
      { userId: chris.id, role: 'OWNER' },
    );
  }

  // Backfills any chart-of-accounts codes added since these entities were
  // first created (e.g. VAT Payable, Deferred Revenue, Vendor Payables,
  // Commission Income, expense sub-accounts) — skipDuplicates means this is
  // safe to run every seed, not just on first creation.
  await accountsService.applyStandardTemplate(parentEntity.id);
  await accountsService.applyStandardTemplate(subsidiaryEntity.id);

  // MKT-FR-1/2/FIN-FR-6..9 (docs/SRS.md §21): a demo vendor + a real,
  // fully-worked order exercising VAT, the deferred-revenue → recognition
  // handoff for a prepaid order, vendor commission splitting, and COGS —
  // every new accounting mechanic added in this pass, in one place. Clearly
  // labeled as a demo vendor for the same reason the subsidiary above is —
  // no real marketplace sellers were specified.
  let demoVendor = await prisma.vendor.findFirst({ where: { name: { contains: '(Demo Vendor)' } } });
  if (!demoVendor) {
    demoVendor = await prisma.vendor.create({
      data: {
        name: 'Kampala Artisan Soaps (Demo Vendor)',
        contactEmail: 'hello@kampala-artisan-demo.example',
        payoutMobileMoneyNumber: '+256700000900',
        commissionRatePercent: 25,
      },
    });
  }

  const brighteningBar = await prisma.product.findUniqueOrThrow({ where: { sku: 'SOP-002' } });
  if (!brighteningBar.vendorId) {
    await prisma.product.update({ where: { id: brighteningBar.id }, data: { vendorId: demoVendor.id } });
  }
  // Cost basis for COGS — a plausible ~45% cost-of-goods ratio, only set on
  // the platform-owned items used in the demo order below (see the schema
  // comment on Product.costUgx for why this is optional elsewhere).
  if (moistureBombBar.costUgx == null) {
    await prisma.product.update({ where: { id: moistureBombBar.id }, data: { costUgx: 8_000 } });
  }

  const existingVendorOrder = await prisma.order.findUnique({ where: { orderNumber: 'CP-1050' } });
  if (!existingVendorOrder) {
    const revenueRecognitionService = new RevenueRecognitionService(prisma as unknown as PrismaService, journalService);

    const vendorItemLineUgx = 19_000; // Brightening Bar price, per seed PRODUCTS list
    const platformItemLineUgx = 18_000 * 2; // 2x Moisture Bomb Bar
    const subtotalUgx = vendorItemLineUgx + platformItemLineUgx;
    const shippingFeeUgx = 0;
    const discountUgx = 0;
    const vatUgx = Math.round(subtotalUgx * 0.18);
    const totalUgx = subtotalUgx + shippingFeeUgx - discountUgx + vatUgx;

    const vendorOrder = await prisma.order.create({
      data: {
        orderNumber: 'CP-1050',
        userId: sarah.id,
        status: 'DELIVERED',
        warehouseId: central.id,
        subtotalUgx,
        shippingFeeUgx,
        discountUgx,
        vatUgx,
        totalUgx,
        deliveryMethod: 'STANDARD',
        paymentMethod: 'MOBILE_MONEY',
        shippingAddress: { recipient: 'Sarah Nakato', line1: 'Plot 14, Ntinda Road', city: 'Kampala', phone: '+256700000214' },
        items: {
          create: [
            { productId: moistureBombBar.id, qty: 2, unitPriceUgx: 18_000, costUgxSnapshot: 8_000 },
            { productId: brighteningBar.id, qty: 1, unitPriceUgx: 19_000, vendorId: demoVendor.id },
          ],
        },
      },
    });

    // A completed Mobile Money charge — mirrors what PaymentsService would
    // have created via a real Flutterwave webhook, without actually calling
    // Flutterwave (no live credentials in this environment — see PAY-FR-1).
    await prisma.paymentTransaction.create({
      data: {
        orderId: vendorOrder.id,
        provider: 'FLUTTERWAVE',
        providerReference: `CP-PAY-SEED-${vendorOrder.id.slice(0, 8)}`,
        providerTransactionId: `seed-${vendorOrder.id.slice(0, 8)}`,
        amountUgx: totalUgx,
        status: 'SUCCESSFUL',
      },
    });

    // The real two-step accrual flow: cash collected up front is deferred,
    // then recognized (with the vendor split + COGS + VAT) at delivery —
    // exactly what PaymentsService.handleWebhook() + OrdersService.updateStatus()
    // call in production; invoked directly here since this is seed data,
    // not a live checkout.
    await revenueRecognitionService.recordDeferredRevenue(vendorOrder.id);
    await revenueRecognitionService.recognizeRevenue(vendorOrder.id);
  }

  // FIN-FR-9 (Expense Tracking): one recorded expense per category so the
  // Finance → Expenses view isn't empty on first run.
  const expensesService = new ExpensesService(prisma as unknown as PrismaService, journalService);
  const hasExpenses = await prisma.journalEntry.findFirst({ where: { entityId: parentEntity.id, description: { startsWith: 'Server & Hosting' } } });
  if (!hasExpenses) {
    const parentAccountsForExpenses = await prisma.account.findMany({ where: { entityId: parentEntity.id } });
    const cashAccountId = parentAccountsForExpenses.find((a) => a.code === '1000')!.id;
    await expensesService.recordExpense(
      { entityId: parentEntity.id, expenseAccountCode: '5101', paidFromAccountId: cashAccountId, amountUgx: 450_000, date: '2026-03-05', description: 'Monthly hosting — production API + storefront' },
      { userId: chris.id, role: 'OWNER' },
    );
    await expensesService.recordExpense(
      { entityId: parentEntity.id, expenseAccountCode: '5102', paidFromAccountId: cashAccountId, amountUgx: 180_000, date: '2026-03-08', description: 'Annual design-tool license, prorated' },
      { userId: chris.id, role: 'OWNER' },
    );
    await expensesService.recordExpense(
      { entityId: parentEntity.id, expenseAccountCode: '5103', paidFromAccountId: cashAccountId, amountUgx: 1_200_000, date: '2026-03-12', description: 'Instagram + Google Ads — Q1 campaign' },
      { userId: chris.id, role: 'OWNER' },
    );
  }

  // FR-19.2/FR-1.6 (Social Media Accounts): a few real-looking placeholder
  // handles so the storefront footer and Account → Connected & Social
  // aren't empty on first run — clearly ChrisPa-branded but invented, same
  // "presentable placeholder, not a claim about the real business" caveat
  // as the receipt's company contact block. Replace via Admin → CMS once
  // ChrisPa's real handles are known.
  const socialLinkSeed = [
    { platform: 'Instagram', url: 'https://instagram.com/chrispascents', sortOrder: 1 },
    { platform: 'Facebook', url: 'https://facebook.com/chrispascents', sortOrder: 2 },
    { platform: 'TikTok', url: 'https://tiktok.com/@chrispascents', sortOrder: 3 },
    { platform: 'WhatsApp', url: 'https://wa.me/256700123456', sortOrder: 4 },
  ];
  for (const link of socialLinkSeed) {
    const existing = await prisma.socialMediaAccount.findFirst({ where: { platform: link.platform } });
    if (!existing) await prisma.socialMediaAccount.create({ data: link });
  }

  // eslint-disable-next-line no-console
  console.log('Seed complete.');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
