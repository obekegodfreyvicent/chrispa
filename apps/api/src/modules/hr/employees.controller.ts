import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { EmploymentStatus } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AddDocumentDto } from './dto/add-document.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { CreateLoginDto } from './dto/create-login.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';

// AL-FR-2 (docs/SRS.md §19) — same pattern as AuthController's loginContext().
function requestContext(req: FastifyRequest) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

// FR (HR Phase 1): Centralized Employee Profiles + Document Management.
// Restricted to OWNER/HR_MANAGER — this data includes national ID numbers,
// salaries, and personal contact info.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'HR_MANAGER')
@Controller('hr/employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  list(
    @Query('search') search?: string,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: EmploymentStatus,
  ) {
    return this.employees.list({ search, departmentId, status });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.employees.getById(id);
  }

  @Post()
  create(@CurrentUser() user: { userId: string; role: string }, @Body() dto: CreateEmployeeDto, @Req() req: FastifyRequest) {
    return this.employees.create(dto, user, requestContext(req));
  }

  // Grants a system login (one-time temp password) to an employee who
  // doesn't have one yet — see EmployeesService.createLogin().
  @Post(':id/create-login')
  createLogin(
    @CurrentUser() user: { userId: string; role: string },
    @Param('id') id: string,
    @Body() dto: CreateLoginDto,
    @Req() req: FastifyRequest,
  ) {
    return this.employees.createLogin(id, user, dto, requestContext(req));
  }

  @Patch(':id')
  update(
    @CurrentUser() user: { userId: string; role: string },
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @Req() req: FastifyRequest,
  ) {
    return this.employees.update(id, dto, user, requestContext(req));
  }

  // Soft-terminate, not a hard delete — see EmployeesService.remove().
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.employees.remove(id);
  }

  @Post(':id/documents')
  addDocument(@Param('id') id: string, @Body() dto: AddDocumentDto) {
    return this.employees.addDocument(id, dto);
  }

  @Delete('documents/:documentId')
  removeDocument(@Param('documentId') documentId: string) {
    return this.employees.removeDocument(documentId);
  }
}
