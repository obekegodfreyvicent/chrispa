import { Module } from '@nestjs/common';
import { AdvanceActionsController, AdvancesController, MyAdvancesController } from './payroll/advances.controller';
import { AdvancesService } from './payroll/advances.service';
import { AllowancesController, MyAllowancesController } from './payroll/allowances.controller';
import { AllowancesService } from './payroll/allowances.service';
import { AttendanceController, MyAttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { LeaveController, MyLeaveController } from './leave.controller';
import { LeaveService } from './leave.service';
import { MyPerformanceController, PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';
import { MyPayslipsController, PayrollController } from './payroll/payroll.controller';
import { PayrollService } from './payroll/payroll.service';
import { MyProfileController } from './my-profile.controller';
import { RecruitmentController } from './recruitment.controller';
import { RecruitmentService } from './recruitment.service';
import { MyShiftsController, ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';

@Module({
  controllers: [
    DepartmentsController,
    EmployeesController,
    MyProfileController,
    MyAttendanceController,
    AttendanceController,
    MyLeaveController,
    LeaveController,
    MyShiftsController,
    ShiftsController,
    PerformanceController,
    MyPerformanceController,
    RecruitmentController,
    PayrollController,
    MyPayslipsController,
    DashboardController,
    AllowancesController,
    MyAllowancesController,
    AdvancesController,
    AdvanceActionsController,
    MyAdvancesController,
  ],
  providers: [
    DepartmentsService,
    EmployeesService,
    AttendanceService,
    LeaveService,
    ShiftsService,
    PerformanceService,
    RecruitmentService,
    PayrollService,
    DashboardService,
    AllowancesService,
    AdvancesService,
  ],
})
export class HrModule {}
