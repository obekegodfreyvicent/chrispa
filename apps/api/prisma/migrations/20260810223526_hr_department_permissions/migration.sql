-- CreateEnum
CREATE TYPE "PermissionResource" AS ENUM ('PRODUCTS', 'ORDERS', 'INVENTORY', 'CUSTOMERS', 'MARKETING', 'CMS', 'SETTINGS', 'HR_DASHBOARD', 'HR_EMPLOYEES', 'HR_ATTENDANCE', 'HR_LEAVE', 'HR_SHIFTS', 'HR_RECRUITMENT', 'HR_PAYROLL', 'HR_PERFORMANCE');

-- CreateTable
CREATE TABLE "DepartmentPermission" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "resource" "PermissionResource" NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT false,
    "canCreate" BOOLEAN NOT NULL DEFAULT false,
    "canUpdate" BOOLEAN NOT NULL DEFAULT false,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    "canExecute" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DepartmentPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DepartmentPermission_departmentId_idx" ON "DepartmentPermission"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentPermission_departmentId_resource_key" ON "DepartmentPermission"("departmentId", "resource");

-- AddForeignKey
ALTER TABLE "DepartmentPermission" ADD CONSTRAINT "DepartmentPermission_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
