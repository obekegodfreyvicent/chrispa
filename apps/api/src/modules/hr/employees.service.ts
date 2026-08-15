import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentChangeType, EmploymentStatus, Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { ActivityLogService, ActorInfo, deriveActorType, RequestInfo } from '../../common/activity-log/activity-log.service';
import { generateTemporaryPassword } from '../../common/util/temp-password.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AddDocumentDto } from './dto/add-document.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { CreateLoginDto, StaffRole } from './dto/create-login.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';

const DETAIL_INCLUDE = {
  department: true,
  manager: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
  directReports: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
  history: { orderBy: { effectiveDate: 'desc' } },
  documents: { orderBy: { uploadedAt: 'desc' } },
  user: { select: { id: true, email: true, role: true } },
} satisfies Prisma.EmployeeInclude;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  list(params: { search?: string; departmentId?: string; status?: EmploymentStatus }) {
    const { search, departmentId, status } = params;
    return this.prisma.employee.findMany({
      where: {
        ...(departmentId ? { departmentId } : {}),
        ...(status ? { employmentStatus: status } : {}),
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { employeeNumber: { contains: search, mode: 'insensitive' } },
                { jobTitle: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { department: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Accepts an optional transaction client for the same reason as
  // CatalogService.getByIdForAdmin() — see the note there / CLAUDE.md.
  async getById(id: string, client: PrismaService | Prisma.TransactionClient = this.prisma) {
    const employee = await client.employee.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  // Resolves "which Employee is the logged-in caller?" for every Phase 2
  // self-service endpoint (clock in/out, request leave, view/swap shifts).
  // Throws clearly if this staff User has no linked Employee record — e.g.
  // an admin-only account with no HR profile behind it.
  async getByUserId(userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) {
      throw new NotFoundException("Your account isn't linked to an HR employee record — contact HR.");
    }
    return employee;
  }

  // HR-FR (Phase 3 Self-Service Portal): an employee updating their own
  // contact details, not routed through the audit-logged update() above
  // since these fields never trigger an EmploymentHistoryEntry.
  async updateMyProfile(userId: string, dto: UpdateMyProfileDto) {
    const employee = await this.getByUserId(userId);
    return this.prisma.employee.update({
      where: { id: employee.id },
      data: { ...dto, dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined },
    });
  }

  async create(dto: CreateEmployeeDto, actor: ActorInfo, context: RequestInfo = {}) {
    if (dto.userId && dto.loginEmail) {
      throw new BadRequestException('Provide either userId (link an existing account) or loginEmail/loginRole (create a new one), not both.');
    }
    if ((dto.loginEmail && !dto.loginRole) || (!dto.loginEmail && dto.loginRole)) {
      throw new BadRequestException('loginEmail and loginRole must be provided together.');
    }
    if (dto.loginRole === 'OWNER' && actor.role !== 'OWNER') {
      throw new ForbiddenException('Only an Owner can grant the Owner role.');
    }

    const employeeNumber = await this.generateEmployeeNumber();
    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          employeeNumber,
          firstName: dto.firstName,
          lastName: dto.lastName,
          personalEmail: dto.personalEmail,
          personalPhone: dto.personalPhone,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          gender: dto.gender,
          nationalIdNumber: dto.nationalIdNumber,
          address: dto.address,
          photoUrl: dto.photoUrl,
          departmentId: dto.departmentId,
          jobTitle: dto.jobTitle,
          employmentType: dto.employmentType,
          hireDate: new Date(dto.hireDate),
          managerId: dto.managerId,
          baseSalaryUgx: dto.baseSalaryUgx,
          nssfNumber: dto.nssfNumber,
          tinNumber: dto.tinNumber,
          userId: dto.userId,
        },
      });
      await tx.employmentHistoryEntry.create({
        data: {
          employeeId: employee.id,
          changeType: EmploymentChangeType.HIRED,
          newValue: dto.jobTitle,
          effectiveDate: employee.hireDate,
        },
      });

      let temporaryPassword: string | undefined;
      if (dto.loginEmail && dto.loginRole) {
        const login = await this.createLoginInternal(
          tx,
          employee.id,
          dto.firstName,
          dto.lastName,
          dto.loginEmail,
          dto.loginRole,
          actor,
          context,
        );
        temporaryPassword = login.temporaryPassword;
      }

      const full = await this.getById(employee.id, tx);
      return temporaryPassword ? { ...full, temporaryPassword } : full;
    });
  }

  // Grants a system login to an employee who doesn't have one yet — the
  // standalone counterpart to create()'s inline loginEmail/loginRole. Same
  // one-time-temp-password mechanism.
  async createLogin(employeeId: string, actor: ActorInfo, dto: CreateLoginDto, context: RequestInfo = {}) {
    if (dto.role === 'OWNER' && actor.role !== 'OWNER') {
      throw new ForbiddenException('Only an Owner can grant the Owner role.');
    }
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');
    if (employee.userId) throw new BadRequestException('This employee already has a system login.');

    return this.createLoginInternal(
      this.prisma,
      employeeId,
      employee.firstName,
      employee.lastName,
      dto.email,
      dto.role,
      actor,
      context,
    );
  }

  // Issues a one-time temporary password and a new User row (role +
  // mustChangePassword: true), then links it to the employee — "the first
  // thing they do should be a password reset before any operation," per
  // user decision (see MustChangePasswordGuard). Accepts the same optional
  // transaction-client parameter as getById()/getByIdForAdmin() elsewhere,
  // so create() can run this atomically with the employee insert — see the
  // transaction-visibility gotcha noted on CatalogService.getByIdForAdmin().
  private async createLoginInternal(
    client: PrismaService | Prisma.TransactionClient,
    employeeId: string,
    firstName: string,
    lastName: string,
    email: string,
    role: StaffRole,
    actor: ActorInfo,
    context: RequestInfo = {},
  ) {
    const existingUser = await client.user.findUnique({ where: { email } });
    if (existingUser) throw new BadRequestException('A user with this email already exists.');

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const user = await client.user.create({
      data: { name: `${firstName} ${lastName}`, email, passwordHash, role, mustChangePassword: true },
    });
    await client.employee.update({ where: { id: employeeId }, data: { userId: user.id } });

    await this.activityLog.record(
      {
        actorUserId: actor.userId,
        actorRole: actor.role as UserRole,
        actorType: deriveActorType(actor.role),
        action: 'STAFF_LOGIN_GRANTED',
        entityType: 'User',
        entityId: user.id,
        description: `Granted a ${role} login to ${firstName} ${lastName} (${email})`,
        ...context,
      },
      client,
    );

    return { userId: user.id, email: user.email, role: user.role, temporaryPassword };
  }

  // Diffs the incoming DTO against the current row to auto-log an
  // EmploymentHistoryEntry for role/department/salary/status changes —
  // that audit trail is the actual point of Employment History, not
  // something an admin should have to remember to log by hand.
  async update(id: string, dto: UpdateEmployeeDto, actor: ActorInfo, context: RequestInfo = {}) {
    const existing = await this.prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Employee not found');

    const now = new Date();
    const historyEntries: Prisma.EmploymentHistoryEntryCreateManyInput[] = [];

    if (dto.jobTitle !== undefined && dto.jobTitle !== existing.jobTitle) {
      historyEntries.push({
        employeeId: id,
        changeType: EmploymentChangeType.ROLE_CHANGE,
        previousValue: existing.jobTitle,
        newValue: dto.jobTitle,
        effectiveDate: now,
      });
    }
    if (dto.departmentId !== undefined && dto.departmentId !== existing.departmentId) {
      const [oldDept, newDept] = await Promise.all([
        existing.departmentId ? this.prisma.department.findUnique({ where: { id: existing.departmentId } }) : null,
        dto.departmentId ? this.prisma.department.findUnique({ where: { id: dto.departmentId } }) : null,
      ]);
      historyEntries.push({
        employeeId: id,
        changeType: EmploymentChangeType.TRANSFER,
        previousValue: oldDept?.name ?? 'Unassigned',
        newValue: newDept?.name ?? 'Unassigned',
        effectiveDate: now,
      });
    }
    if (dto.baseSalaryUgx !== undefined && dto.baseSalaryUgx !== existing.baseSalaryUgx) {
      historyEntries.push({
        employeeId: id,
        changeType: EmploymentChangeType.SALARY_CHANGE,
        previousValue: existing.baseSalaryUgx?.toLocaleString() ?? 'Not set',
        newValue: dto.baseSalaryUgx.toLocaleString(),
        effectiveDate: now,
      });
    }
    if (dto.employmentStatus !== undefined && dto.employmentStatus !== existing.employmentStatus) {
      const changeType =
        dto.employmentStatus === EmploymentStatus.TERMINATED
          ? EmploymentChangeType.TERMINATION
          : dto.employmentStatus === EmploymentStatus.SUSPENDED
            ? EmploymentChangeType.SUSPENSION
            : existing.employmentStatus === EmploymentStatus.SUSPENDED || existing.employmentStatus === EmploymentStatus.TERMINATED
              ? EmploymentChangeType.REINSTATEMENT
              : null;
      if (changeType) {
        historyEntries.push({
          employeeId: id,
          changeType,
          previousValue: existing.employmentStatus,
          newValue: dto.employmentStatus,
          effectiveDate: now,
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id },
        data: {
          ...dto,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
          terminationDate:
            dto.employmentStatus === EmploymentStatus.TERMINATED && !dto.terminationDate
              ? now
              : dto.terminationDate
                ? new Date(dto.terminationDate)
                : undefined,
        },
      });
      if (historyEntries.length > 0) {
        await tx.employmentHistoryEntry.createMany({ data: historyEntries });
      }
      await this.activityLog.record(
        {
          actorUserId: actor.userId,
          actorRole: actor.role as UserRole,
          actorType: deriveActorType(actor.role),
          action: 'EMPLOYEE_UPDATED',
          entityType: 'Employee',
          entityId: id,
          description: `Updated employee ${existing.firstName} ${existing.lastName} (${existing.employeeNumber})`,
          metadata: historyEntries.length > 0 ? { changeTypes: historyEntries.map((h) => h.changeType) } : undefined,
          ...context,
        },
        tx,
      );
      return this.getById(id, tx);
    });
  }

  // Employee records are never hard-deleted — legal/compliance retention
  // requirements (tax, labor-dispute, payroll-history) apply regardless of
  // whether someone still works here. "Delete" terminates instead.
  async remove(id: string) {
    const existing = await this.prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Employee not found');
    if (existing.employmentStatus === EmploymentStatus.TERMINATED) {
      return { alreadyTerminated: true };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id },
        data: { employmentStatus: EmploymentStatus.TERMINATED, terminationDate: new Date() },
      });
      await tx.employmentHistoryEntry.create({
        data: {
          employeeId: id,
          changeType: EmploymentChangeType.TERMINATION,
          previousValue: existing.employmentStatus,
          newValue: EmploymentStatus.TERMINATED,
          effectiveDate: new Date(),
        },
      });
    });
    return { terminated: true };
  }

  async addDocument(employeeId: string, dto: AddDocumentDto) {
    await this.getById(employeeId); // 404s if the employee doesn't exist
    return this.prisma.employeeDocument.create({
      data: {
        employeeId,
        type: dto.type,
        title: dto.title,
        fileUrl: dto.fileUrl,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
  }

  async removeDocument(documentId: string) {
    try {
      await this.prisma.employeeDocument.delete({ where: { id: documentId } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Document not found');
      }
      throw e;
    }
    return { deleted: true };
  }

  private async generateEmployeeNumber() {
    const last = await this.prisma.employee.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { employeeNumber: true },
    });
    const lastSeq = last ? parseInt(last.employeeNumber.replace('CP-EMP-', ''), 10) || 0 : 0;
    return `CP-EMP-${String(lastSeq + 1).padStart(4, '0')}`;
  }
}
