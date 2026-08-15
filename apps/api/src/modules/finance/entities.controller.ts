import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AccountsService } from './accounts.service';
import { CreateLegalEntityDto, UpdateLegalEntityDto } from './dto/entity.dto';
import { EntitiesService } from './entities.service';

// FIN-FR-1 (docs/SRS.md §20): financial data is sensitive group-wide
// information, not scoped to any one operational department — OWNER-only
// across all of /admin/finance/*, matching the precedent already set by
// /admin/users and /admin/activity-log.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER')
@Controller('admin/finance/entities')
export class EntitiesController {
  constructor(
    private readonly entities: EntitiesService,
    private readonly accounts: AccountsService,
  ) {}

  @Get()
  list() {
    return this.entities.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.entities.getById(id);
  }

  // Applies the standard chart-of-accounts template to the new entity
  // immediately — every entity in the group needs one before it can post
  // any journal entries, and sharing the same template across entities is
  // what makes consolidation-by-account-code work (see AccountsService).
  @Post()
  async create(@Body() dto: CreateLegalEntityDto) {
    const entity = await this.entities.create(dto);
    await this.accounts.applyStandardTemplate(entity.id);
    return entity;
  }

  @Patch(':id')
  update(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: UpdateLegalEntityDto) {
    return this.entities.update(id, dto, user.userId);
  }

  @Get(':id/fx-rate-history')
  rateHistory(@Param('id') id: string) {
    return this.entities.rateHistory(id);
  }
}
