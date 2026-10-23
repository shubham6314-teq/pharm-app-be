-- AlterTable
ALTER TABLE "products" ADD COLUMN "packSize" VARCHAR(100);

UPDATE "products"
SET "packSize" = TRIM(
  BOTH FROM
  TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM "packQuantity"::text))
  || ' '
  || "packUnit"::text
)
WHERE "packSize" IS NULL;

ALTER TABLE "products" ALTER COLUMN "packSize" SET NOT NULL;

DROP INDEX "products_categoryId_name_packQuantity_packUnit_key";

ALTER TABLE "products" DROP COLUMN "packQuantity",
DROP COLUMN "packUnit";

DROP TYPE "PackUnit";

CREATE UNIQUE INDEX "products_categoryId_name_packSize_key" ON "products"("categoryId", "name", "packSize");
