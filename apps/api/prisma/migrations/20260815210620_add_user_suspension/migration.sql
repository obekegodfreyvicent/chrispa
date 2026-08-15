-- AlterTable
ALTER TABLE "User" ADD COLUMN     "suspendedAt" TIMESTAMPTZ(3),
ADD COLUMN     "suspensionReason" TEXT;
