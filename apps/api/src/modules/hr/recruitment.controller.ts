import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApplicantStage, JobPostingStatus } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ConvertApplicantDto, CreateApplicantDto, CreateJobPostingDto, UpdateApplicantDto, UpdateJobPostingDto } from './dto/recruitment.dto';
import { RecruitmentService } from './recruitment.service';

// AL-FR-2 (docs/SRS.md §19) — same pattern as AuthController's loginContext().
function requestContext(req: FastifyRequest) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'HR_MANAGER')
@Controller('hr')
export class RecruitmentController {
  constructor(private readonly recruitment: RecruitmentService) {}

  @Post('job-postings')
  createJobPosting(@CurrentUser() user: { userId: string }, @Body() dto: CreateJobPostingDto) {
    return this.recruitment.createJobPosting(dto, user.userId);
  }

  @Get('job-postings')
  listJobPostings(@Query('status') status?: JobPostingStatus) {
    return this.recruitment.listJobPostings(status);
  }

  @Get('job-postings/:id')
  getJobPosting(@Param('id') id: string) {
    return this.recruitment.getJobPosting(id);
  }

  @Patch('job-postings/:id')
  updateJobPosting(@Param('id') id: string, @Body() dto: UpdateJobPostingDto) {
    return this.recruitment.updateJobPosting(id, dto);
  }

  @Delete('job-postings/:id')
  removeJobPosting(@Param('id') id: string) {
    return this.recruitment.removeJobPosting(id);
  }

  @Post('applicants')
  createApplicant(@Body() dto: CreateApplicantDto) {
    return this.recruitment.createApplicant(dto);
  }

  @Get('applicants')
  listApplicants(@Query('jobPostingId') jobPostingId?: string, @Query('stage') stage?: ApplicantStage) {
    return this.recruitment.listApplicants({ jobPostingId, stage });
  }

  @Patch('applicants/:id')
  updateApplicant(@Param('id') id: string, @Body() dto: UpdateApplicantDto) {
    return this.recruitment.updateApplicant(id, dto);
  }

  @Post('applicants/:id/convert-to-employee')
  convertToEmployee(
    @CurrentUser() user: { userId: string; role: string },
    @Param('id') id: string,
    @Body() dto: ConvertApplicantDto,
    @Req() req: FastifyRequest,
  ) {
    return this.recruitment.convertToEmployee(id, dto, user, requestContext(req));
  }
}
