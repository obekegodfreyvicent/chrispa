-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('OFFLINE', 'AVAILABLE', 'ON_DELIVERY');

-- CreateEnum
CREATE TYPE "DeliveryPriority" AS ENUM ('NORMAL', 'URGENT');

-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "priority" "DeliveryPriority" NOT NULL DEFAULT 'NORMAL';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "driverStatus" "DriverStatus" NOT NULL DEFAULT 'OFFLINE';
