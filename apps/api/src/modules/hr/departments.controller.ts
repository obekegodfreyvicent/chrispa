import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto, UpdateDepartmentDto, UpdateDepartmentPermissionsDto } from './dto/department.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'HR_MANAGER')
@Controller('hr/departments')
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  list() {
    return this.departments.list();
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.departments.getById(id);
  }

  @Post()
  create(@Body() dto: CreateDepartmentDto) {
    return this.departments.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departments.update(id, dto);
  }

  @Patch(':id/permissions')
  updatePermissions(@Param('id') id: string, @Body() dto: UpdateDepartmentPermissionsDto) {
    return this.departments.updatePermissions(id, dto.permissions);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.departments.remove(id);
  }
}
