import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ApplicantStage, JobPostingStatus } from '@prisma/client';
import { ActorInfo, RequestInfo } from '../../common/activity-log/activity-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConvertApplicantDto, CreateApplicantDto, CreateJobPostingDto, UpdateApplicantDto, UpdateJobPostingDto } from './dto/recruitment.dto';
import { EmployeesService } from './employees.service';

// HR Phase 3 — Onboarding & Recruitment. "Simplifies digital paperwork for
// new hires" is implemented as convertToEmployee() below: a one-click
// conversion from applicant data into a real Employee record, reusing
// EmployeesService.create() (so it gets the same employee-number generation
// and auto-logged HIRED history entry as any other new hire) — not
// e-signature/document-workflow automation, which is a much bigger separate
// integration and out of scope here.
@Injectable()
export class RecruitmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: EmployeesService,
  ) {}

  // ---------- Job Postings ----------

  createJobPosting(dto: CreateJobPostingDto, createdByUserId: string) {
    return this.prisma.jobPosting.create({ data: { ...dto, createdByUserId } });
  }

  listJobPostings(status?: JobPostingStatus) {
    return this.prisma.jobPosting.findMany({
      where: status ? { status } : {},
      include: { department: true, _count: { select: { applicants: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getJobPosting(id: string) {
    const posting = await this.prisma.jobPosting.findUnique({
      where: { id },
      include: { department: true, applicants: { orderBy: { appliedAt: 'desc' } } },
    });
    if (!posting) throw new NotFoundException('Job posting not found');
    return posting;
  }

  async updateJobPosting(id: string, dto: UpdateJobPostingDto) {
    const existing = await this.prisma.jobPosting.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Job posting not found');
    const now = new Date();
    return this.prisma.jobPosting.update({
      where: { id },
      data: {
        ...dto,
        postedAt: dto.status === JobPostingStatus.OPEN && !existing.postedAt ? now : undefined,
        closedAt:
          (dto.status === JobPostingStatus.CLOSED || dto.status === JobPostingStatus.FILLED) && !existing.closedAt
            ? now
            : undefined,
      },
    });
  }

  async removeJobPosting(id: string) {
    const existing = await this.prisma.jobPosting.findUnique({ where: { id }, include: { _count: { select: { applicants: true } } } });
    if (!existing) throw new NotFoundException('Job posting not found');
    if (existing._count.applicants > 0) {
      throw new BadRequestException('This posting has applicants attached — close it instead of deleting it.');
    }
    await this.prisma.jobPosting.delete({ where: { id } });
    return { deleted: true };
  }

  // ---------- Applicants ----------

  createApplicant(dto: CreateApplicantDto) {
    return this.prisma.applicant.create({ data: dto });
  }

  listApplicants(params: { jobPostingId?: string; stage?: ApplicantStage }) {
    return this.prisma.applicant.findMany({
      where: { ...(params.jobPostingId ? { jobPostingId: params.jobPostingId } : {}), ...(params.stage ? { stage: params.stage } : {}) },
      include: { jobPosting: { select: { title: true } } },
      orderBy: { appliedAt: 'desc' },
    });
  }

  async updateApplicant(id: string, dto: UpdateApplicantDto) {
    const existing = await this.prisma.applicant.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Applicant not found');
    if (existing.stage === ApplicantStage.HIRED) {
      throw new BadRequestException('This applicant has already been hired — see their employee record instead.');
    }
    return this.prisma.applicant.update({ where: { id }, data: dto });
  }

  async convertToEmployee(applicantId: string, dto: ConvertApplicantDto, actor: ActorInfo, context: RequestInfo = {}) {
    const applicant = await this.prisma.applicant.findUnique({ where: { id: applicantId }, include: { jobPosting: true } });
    if (!applicant) throw new NotFoundException('Applicant not found');
    if (applicant.convertedEmployeeId) {
      throw new BadRequestException('This applicant has already been converted to an employee.');
    }

    const employee = await this.employees.create(
      {
        firstName: applicant.firstName,
        lastName: applicant.lastName,
        personalEmail: applicant.email,
        personalPhone: applicant.phone ?? undefined,
        jobTitle: dto.jobTitle ?? applicant.jobPosting.title,
        departmentId: dto.departmentId ?? applicant.jobPosting.departmentId ?? undefined,
        employmentType: applicant.jobPosting.employmentType,
        hireDate: new Date().toISOString(),
        baseSalaryUgx: dto.baseSalaryUgx,
      },
      actor,
      context,
    );

    await this.prisma.applicant.update({
      where: { id: applicantId },
      data: { stage: ApplicantStage.HIRED, convertedEmployeeId: employee.id },
    });
    await this.prisma.jobPosting.updateMany({
      where: { id: applicant.jobPostingId, status: { not: JobPostingStatus.FILLED } },
      data: { status: JobPostingStatus.FILLED, closedAt: new Date() },
    });

    return employee;
  }
}
