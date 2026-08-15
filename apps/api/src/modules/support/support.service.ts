import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TicketStatus, UserRole } from '@prisma/client';
import { ActivityLogService, ActorInfo, deriveActorType, RequestInfo } from '../../common/activity-log/activity-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const TICKET_MESSAGES_INCLUDE = {
  messages: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.SupportTicketInclude;

const ADMIN_DETAIL_INCLUDE = {
  ...TICKET_MESSAGES_INCLUDE,
  user: { select: { id: true, name: true, email: true, phone: true } },
  order: { select: { id: true, orderNumber: true } },
} satisfies Prisma.SupportTicketInclude;

// FR-7: Help & Support ticket submission (FR-7.3), plus staff review/response
// — no original FR-ID (see docs/SRS.md FR-7.4, scoped directly with the user
// after the base submission form was already built). Live chat (FR-7.1) and
// the FAQ/knowledge base (FR-7.2) remain follow-up work.
@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  listForUser(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { userId },
      include: { _count: { select: { messages: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  createForUser(userId: string, body: string, orderId?: string) {
    return this.prisma.supportTicket.create({ data: { userId, body, orderId } });
  }

  async getForUser(userId: string, ticketId: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, userId },
      include: TICKET_MESSAGES_INCLUDE,
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return { ...ticket, messages: await this.attachAuthorNames(ticket.messages) };
  }

  // Resolves each message's authorUserId into the actual person's full
  // name — same read-time-join reasoning as ActivityLogService's identity
  // resolution: prefer the linked Employee record's name (the authoritative
  // "who is this" answer for staff), falling back to the login account's
  // User.name for a customer or a staff account with no HR profile.
  private async attachAuthorNames<M extends { authorUserId: string }>(
    messages: M[],
  ): Promise<(M & { authorName: string | null })[]> {
    const userIds = [...new Set(messages.map((m) => m.authorUserId))];
    if (userIds.length === 0) return [];
    const [users, employees] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
      this.prisma.employee.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, firstName: true, lastName: true },
      }),
    ]);
    const userById = new Map(users.map((u) => [u.id, u]));
    const employeeByUserId = new Map(employees.filter((e) => e.userId).map((e) => [e.userId as string, e]));
    return messages.map((m) => {
      const employee = employeeByUserId.get(m.authorUserId);
      const user = userById.get(m.authorUserId);
      return { ...m, authorName: employee ? `${employee.firstName} ${employee.lastName}` : (user?.name ?? null) };
    });
  }

  async addMessageForUser(userId: string, ticketId: string, body: string) {
    const ticket = await this.prisma.supportTicket.findFirst({ where: { id: ticketId, userId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.status === TicketStatus.CLOSED) {
      throw new BadRequestException('This ticket is closed. Please raise a new ticket for further help.');
    }
    await this.prisma.ticketMessage.create({
      data: { ticketId, authorUserId: userId, authorRole: UserRole.CUSTOMER, body },
    });
    return this.getForUser(userId, ticketId);
  }

  // ---------- Admin (review & response) ----------

  listForAdmin(params: { status?: TicketStatus; search?: string; skip?: number; take?: number }) {
    const { status, search, skip = 0, take = 50 } = params;
    return this.prisma.supportTicket.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { body: { contains: search, mode: 'insensitive' } },
                { user: { name: { contains: search, mode: 'insensitive' } } },
                { user: { email: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: { user: { select: { id: true, name: true, email: true } }, _count: { select: { messages: true } } },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  }

  async countsByStatus() {
    const rows = await this.prisma.supportTicket.groupBy({ by: ['status'], _count: true });
    const counts: Record<string, number> = { ALL: 0 };
    for (const status of Object.values(TicketStatus)) counts[status] = 0;
    for (const row of rows) {
      counts[row.status] = row._count;
      counts.ALL += row._count;
    }
    return counts;
  }

  async getForAdmin(id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id }, include: ADMIN_DETAIL_INCLUDE });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return { ...ticket, messages: await this.attachAuthorNames(ticket.messages) };
  }

  async updateStatus(id: string, nextStatus: TicketStatus, actor: ActorInfo, context: RequestInfo = {}) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.findUnique({ where: { id } });
      if (!ticket) throw new NotFoundException('Ticket not found');

      const previousStatus = ticket.status;
      const updatedTicket = await tx.supportTicket.update({
        where: { id },
        data: { status: nextStatus },
        include: ADMIN_DETAIL_INCLUDE,
      });

      await this.activityLog.record(
        {
          actorUserId: actor.userId,
          actorRole: actor.role as UserRole,
          actorType: deriveActorType(actor.role),
          action: 'TICKET_STATUS_CHANGED',
          entityType: 'SupportTicket',
          entityId: id,
          description: `Ticket moved from ${previousStatus} to ${nextStatus}`,
          metadata: { from: previousStatus, to: nextStatus },
          ...context,
        },
        tx,
      );

      return updatedTicket;
    });
    return { ...updated, messages: await this.attachAuthorNames(updated.messages) };
  }

  async addMessageForAdmin(ticketId: string, actor: ActorInfo, body: string, context: RequestInfo = {}) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.findUnique({ where: { id: ticketId } });
      if (!ticket) throw new NotFoundException('Ticket not found');
      if (ticket.status === TicketStatus.CLOSED) {
        throw new BadRequestException('This ticket is closed. Reopen it before adding a response.');
      }

      await tx.ticketMessage.create({
        data: { ticketId, authorUserId: actor.userId, authorRole: actor.role as UserRole, body },
      });

      // Replying to an untouched ticket is itself the signal that someone
      // has started working it — there's no separate "claim" action in this
      // feature, so the first staff reply doubles as that.
      const nextStatus = ticket.status === TicketStatus.OPEN ? TicketStatus.IN_PROGRESS : ticket.status;
      const updatedTicket = await tx.supportTicket.update({
        where: { id: ticketId },
        data: { status: nextStatus },
        include: ADMIN_DETAIL_INCLUDE,
      });

      await this.activityLog.record(
        {
          actorUserId: actor.userId,
          actorRole: actor.role as UserRole,
          actorType: deriveActorType(actor.role),
          action: 'TICKET_RESPONDED',
          entityType: 'SupportTicket',
          entityId: ticketId,
          description: 'Staff responded to a support ticket',
          ...(nextStatus !== ticket.status ? { metadata: { from: ticket.status, to: nextStatus } } : {}),
          ...context,
        },
        tx,
      );

      return updatedTicket;
    });
    return { ...updated, messages: await this.attachAuthorNames(updated.messages) };
  }
}
