-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shippingZoneName" TEXT;

-- CreateTable
CREATE TABLE "ShippingZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "towns" TEXT[],
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "standardFeeUgx" INTEGER,
    "expressFeeUgx" INTEGER,
    "sameDayFeeUgx" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ShippingZone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShippingZone_name_key" ON "ShippingZone"("name");
