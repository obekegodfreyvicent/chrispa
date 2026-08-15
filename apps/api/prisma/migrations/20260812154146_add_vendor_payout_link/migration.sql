-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "vendorPayoutId" TEXT;

-- CreateIndex
CREATE INDEX "OrderItem_vendorPayoutId_idx" ON "OrderItem"("vendorPayoutId");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_vendorPayoutId_fkey" FOREIGN KEY ("vendorPayoutId") REFERENCES "VendorPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
