import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ActivityLogModule } from './common/activity-log/activity-log.module';
import configuration from './common/config/configuration';
import { PrismaModule } from './common/prisma/prisma.module';
import { AccountNotificationsModule } from './modules/account-notifications/account-notifications.module';
import { AccountSettingsModule } from './modules/account-settings/account-settings.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { AdminUsersModule } from './modules/admin-users/admin-users.module';
import { AuthModule } from './modules/auth/auth.module';
import { CartModule } from './modules/cart/cart.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ChatModule } from './modules/chat/chat.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { CmsModule } from './modules/cms/cms.module';
import { CrmModule } from './modules/crm/crm.module';
import { FinanceModule } from './modules/finance/finance.module';
import { HealthModule } from './modules/health/health.module';
import { HrModule } from './modules/hr/hr.module';
import { MustChangePasswordGuard } from './modules/auth/guards/must-change-password.guard';
import { InventoryModule } from './modules/inventory/inventory.module';
import { LoyaltyModule } from './modules/loyalty/loyalty.module';
import { MarketingModule } from './modules/marketing/marketing.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentMethodsModule } from './modules/payment-methods/payment-methods.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProfileModule } from './modules/profile/profile.module';
import { SupportModule } from './modules/support/support.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    ActivityLogModule,
    HealthModule,
    AuthModule,
    CatalogModule,
    CartModule,
    CheckoutModule,
    OrdersModule,
    InventoryModule,
    CrmModule,
    MarketingModule,
    CmsModule,
    LoyaltyModule,
    SupportModule,
    AdminUsersModule,
    WishlistModule,
    AddressesModule,
    PaymentMethodsModule,
    PaymentsModule,
    ProfileModule,
    AccountSettingsModule,
    AccountNotificationsModule,
    HrModule,
    MarketplaceModule,
    FinanceModule,
    ChatModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: MustChangePasswordGuard },
  ],
})
export class AppModule {}
