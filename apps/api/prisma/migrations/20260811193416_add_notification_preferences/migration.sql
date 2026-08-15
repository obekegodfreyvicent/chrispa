-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyOrderUpdatesEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyOrderUpdatesSms" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyPromotions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyPush" BOOLEAN NOT NULL DEFAULT true;
