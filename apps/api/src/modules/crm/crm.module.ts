import { Module } from '@nestjs/common';
import { AccountSettingsModule } from '../account-settings/account-settings.module';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';

@Module({
  imports: [AccountSettingsModule],
  controllers: [CrmController],
  providers: [CrmService],
})
export class CrmModule {}
