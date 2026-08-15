import { Injectable } from '@nestjs/common';
import { ActivityActorType, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// The literal role string used for automated postings (e.g.
// RevenueRecognitionService, docs/SRS.md §21 FIN-FR-8) — not a real
// UserRole, so it's never written into ActivityLog.actorRole (a UserRole?
// enum column that would reject it at the database level); see
// deriveActorType() and JournalService.postEntryInternal()'s guard.
export const SYSTEM_ROLE = 'SYSTEM';
export const SYSTEM_ACTOR: ActorInfo = { userId: 'system', role: SYSTEM_ROLE };

// AL-FR-1 (docs/SRS.md §19): every UserRole other than CUSTOMER is a staff
// role for logging purposes — matches how the rest of the codebase treats
// "staff" (see e.g. HR's employee-login-grant flow) — except the literal
// SYSTEM_ROLE sentinel, for actions no human actually took.
export function deriveActorType(role: string): ActivityActorType {
  if (role === SYSTEM_ROLE) return ActivityActorType.SYSTEM;
  return role === UserRole.CUSTOMER ? ActivityActorType.CUSTOMER : ActivityActorType.STAFF;
}

// Shared shape for "who did this write, and from where" — every controller
// that logs an action passes these through from @CurrentUser()/@Req().
export interface ActorInfo {
  userId: string;
  role: string;
}
export interface RequestInfo {
  ipAddress?: string;
  userAgent?: string;
}

export interface RecordActivityInput {
  actorUserId?: string;
  actorRole?: UserRole;
  actorType: ActivityActorType;
  action: string;
  entityType?: string;
  entityId?: string;
  description: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

export interface QueryActivityParams {
  actorType?: ActivityActorType;
  action?: string;
  entityType?: string;
  actorUserId?: string;
  // Filters to actions performed by staff linked to this HR department —
  // resolved to a set of actorUserIds before the main query, since
  // ActivityLog has no relation to Employee/Department to filter through
  // directly (see the schema comment on why actorUserId is a plain string).
  departmentId?: string;
  search?: string;
  from?: Date;
  to?: Date;
  skip?: number;
  take?: number;
}

@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  // Best-effort by design: a logging failure must never abort the business
  // operation it's describing (an order placed successfully is still placed
  // even if the audit-trail write fails). Accepts the same optional
  // transaction-client parameter used throughout this codebase (see
  // CatalogService.getByIdForAdmin()) so a caller already inside a
  // $transaction can log atomically with the operation it's recording.
  async record(input: RecordActivityInput, client: PrismaService | Prisma.TransactionClient = this.prisma) {
    try {
      await client.activityLog.create({ data: input });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('ActivityLogService.record failed — continuing without blocking the caller', error);
    }
  }

  async query(params: QueryActivityParams) {
    const { actorType, action, entityType, actorUserId, departmentId, search, from, to, skip = 0, take = 50 } = params;

    let departmentUserIds: string[] | undefined;
    if (departmentId) {
      const employees = await this.prisma.employee.findMany({
        where: { departmentId, userId: { not: null } },
        select: { userId: true },
      });
      departmentUserIds = employees.map((e) => e.userId as string);
      // No staff in this department have a login — return no rows rather
      // than an unfiltered `actorUserId IN ()` (which Prisma/Postgres would
      // otherwise treat as "no constraint," matching everything).
      if (departmentUserIds.length === 0) return { items: [], total: 0 };
    }

    // `actorUserId` (a specific person) and `departmentUserIds` (everyone in
    // a department) both constrain the same column — combine them into one
    // key rather than letting the second spread silently clobber the first
    // if a caller ever sent both.
    const actorUserIdFilter =
      actorUserId && departmentUserIds
        ? departmentUserIds.includes(actorUserId)
          ? actorUserId
          : '__no_match__' // that specific actor isn't in the requested department — match nothing
        : (actorUserId ?? (departmentUserIds ? { in: departmentUserIds } : undefined));

    const where: Prisma.ActivityLogWhereInput = {
      ...(actorType ? { actorType } : {}),
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
      ...(actorUserIdFilter ? { actorUserId: actorUserIdFilter } : {}),
      ...(search ? { description: { contains: search, mode: 'insensitive' } } : {}),
      ...(from || to
        ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.activityLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.activityLog.count({ where }),
    ]);
    return { items: await this.enrichWithActorIdentity(items), total };
  }

  // Resolves actorUserId into the actual person's full name and department
  // — deliberately a read-time join, not a stored/relation field, since
  // ActivityLog.actorUserId is intentionally a plain string, not a `@relation`
  // (see the schema comment on ActivityLog: an audit trail must survive
  // independently of the actor row it describes). Prefers the HR Employee
  // record's name (the authoritative "who is this, organizationally" answer,
  // and the only place a department lives) over the login account's display
  // name, falling back to the latter for actors with no linked Employee
  // (e.g. a customer, or a staff account with no HR profile). A scrubbed
  // ("Delete Account") actor naturally shows as "Deleted User" here, since
  // that's what User.name becomes on anonymization — not a special case.
  private async enrichWithActorIdentity<T extends { actorUserId: string | null }>(
    items: T[],
  ): Promise<(T & { actorName: string | null; actorDepartment: string | null })[]> {
    const actorUserIds = [...new Set(items.map((i) => i.actorUserId).filter((id): id is string => !!id))];
    if (actorUserIds.length === 0) {
      return items.map((item) => ({ ...item, actorName: null, actorDepartment: null }));
    }

    const [users, employees] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: actorUserIds } }, select: { id: true, name: true } }),
      this.prisma.employee.findMany({
        where: { userId: { in: actorUserIds } },
        select: { userId: true, firstName: true, lastName: true, department: { select: { name: true } } },
      }),
    ]);
    const userById = new Map(users.map((u) => [u.id, u]));
    const employeeByUserId = new Map(employees.filter((e) => e.userId).map((e) => [e.userId as string, e]));

    return items.map((item) => {
      const employee = item.actorUserId ? employeeByUserId.get(item.actorUserId) : undefined;
      const user = item.actorUserId ? userById.get(item.actorUserId) : undefined;
      return {
        ...item,
        actorName: employee ? `${employee.firstName} ${employee.lastName}` : (user?.name ?? null),
        actorDepartment: employee?.department?.name ?? null,
      };
    });
  }

  // Populates the admin UI's action-code filter dropdown from what's
  // actually been recorded, rather than a hand-maintained list that would
  // drift from the real set of `action` strings emitted across the codebase.
  async distinctActions(): Promise<string[]> {
    const rows = await this.prisma.activityLog.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    });
    return rows.map((r) => r.action);
  }

  // Populates the admin UI's department filter — every department, not just
  // ones with recorded activity, so the dropdown doesn't change shape as
  // logs accumulate.
  listDepartments() {
    return this.prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
  }
}
