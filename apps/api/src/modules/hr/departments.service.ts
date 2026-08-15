import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PermissionResource } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateDepartmentDto, DepartmentPermissionDto, UpdateDepartmentDto } from './dto/department.dto';

const DENY_ALL = { canView: false, canCreate: false, canUpdate: false, canDelete: false, canExecute: false };

// A department's policy is a *record*, not the enforcement mechanism — see
// the comment on the DepartmentPermission model in schema.prisma. Every
// department always has a complete matrix (one row per PermissionResource),
// so the UI never has to handle a missing row; new departments start
// deny-all unless the caller supplies initial permissions.
@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.department.findMany({
      include: { _count: { select: { employees: true } }, permissions: true },
      orderBy: { name: 'asc' },
    });
  }

  async getById(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: { permissions: true },
    });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  async create(dto: CreateDepartmentDto) {
    const byResource = new Map(dto.permissions?.map((p) => [p.resource, p]) ?? []);
    try {
      return await this.prisma.department.create({
        data: {
          name: dto.name,
          description: dto.description,
          permissions: {
            create: Object.values(PermissionResource).map((resource) => {
              const override = byResource.get(resource);
              return override ? { ...override } : { resource, ...DENY_ALL };
            }),
          },
        },
        include: { permissions: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('A department with this name already exists.');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    try {
      return await this.prisma.department.update({ where: { id }, data: dto });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Department not found');
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('A department with this name already exists.');
      }
      throw e;
    }
  }

  async updatePermissions(id: string, permissions: DepartmentPermissionDto[]) {
    const department = await this.prisma.department.findUnique({ where: { id } });
    if (!department) throw new NotFoundException('Department not found');

    await this.prisma.$transaction(
      permissions.map((p) =>
        this.prisma.departmentPermission.upsert({
          where: { departmentId_resource: { departmentId: id, resource: p.resource } },
          create: { departmentId: id, ...p },
          update: { ...p },
        }),
      ),
    );
    return this.getById(id);
  }

  async remove(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: { _count: { select: { employees: true } } },
    });
    if (!department) throw new NotFoundException('Department not found');
    if (department._count.employees > 0) {
      throw new BadRequestException(
        `Can't delete "${department.name}" — ${department._count.employees} employee(s) are still assigned to it. Reassign them first.`,
      );
    }
    await this.prisma.department.delete({ where: { id } });
    return { deleted: true };
  }
}
