-- CreateEnum
CREATE TYPE "PackUnit" AS ENUM ('STRIP', 'BOTTLE', 'TUBE', 'VIAL', 'SACHET', 'BOX');

-- CreateEnum
CREATE TYPE "ContentUnit" AS ENUM ('TABLET', 'CAPSULE', 'ML', 'GM');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('OPENING', 'PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT', 'DAMAGE', 'EXPIRY');

-- AlterTable
ALTER TABLE "products"
ADD COLUMN "packUnit" "PackUnit" NOT NULL DEFAULT 'BOX',
ADD COLUMN "contentQuantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
ADD COLUMN "contentUnit" "ContentUnit" NOT NULL DEFAULT 'TABLET',
ADD COLUMN "reorderLevel" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "inventory_batches" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "batchNumber" VARCHAR(50) NOT NULL,
    "manufacturingDate" DATE NOT NULL,
    "expiryDate" DATE NOT NULL,
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "purchaseRate" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "inventoryBatchId" UUID NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_batches_productId_batchNumber_key" ON "inventory_batches"("productId", "batchNumber");

-- CreateIndex
CREATE INDEX "inventory_batches_productId_idx" ON "inventory_batches"("productId");

-- CreateIndex
CREATE INDEX "inventory_batches_expiryDate_idx" ON "inventory_batches"("expiryDate");

-- CreateIndex
CREATE INDEX "stock_movements_inventoryBatchId_idx" ON "stock_movements"("inventoryBatchId");

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_inventoryBatchId_fkey" FOREIGN KEY ("inventoryBatchId") REFERENCES "inventory_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
