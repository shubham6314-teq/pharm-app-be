-- CreateEnum
CREATE TYPE "PackTypeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ContentUnitStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "pack_types" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "singularLabel" VARCHAR(40) NOT NULL,
    "pluralLabel" VARCHAR(40) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "PackTypeStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pack_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_units" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "singularLabel" VARCHAR(40) NOT NULL,
    "pluralLabel" VARCHAR(40) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentUnitStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_units_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pack_types_name_key" ON "pack_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "pack_types_code_key" ON "pack_types"("code");

-- CreateIndex
CREATE INDEX "pack_types_isDeleted_idx" ON "pack_types"("isDeleted");

-- CreateIndex
CREATE INDEX "pack_types_sortOrder_idx" ON "pack_types"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "content_units_name_key" ON "content_units"("name");

-- CreateIndex
CREATE UNIQUE INDEX "content_units_code_key" ON "content_units"("code");

-- CreateIndex
CREATE INDEX "content_units_isDeleted_idx" ON "content_units"("isDeleted");

-- CreateIndex
CREATE INDEX "content_units_sortOrder_idx" ON "content_units"("sortOrder");

INSERT INTO "pack_types" ("id", "name", "code", "singularLabel", "pluralLabel", "sortOrder", "status", "isDeleted", "createdAt", "updatedAt") VALUES
('aaaaaaaa-0001-4000-8000-000000000001', 'Strip', 'STRIP', 'strip', 'strips', 10, 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('aaaaaaaa-0001-4000-8000-000000000002', 'Bottle', 'BOTTLE', 'bottle', 'bottles', 20, 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('aaaaaaaa-0001-4000-8000-000000000003', 'Tube', 'TUBE', 'tube', 'tubes', 30, 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('aaaaaaaa-0001-4000-8000-000000000004', 'Vial', 'VIAL', 'vial', 'vials', 40, 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('aaaaaaaa-0001-4000-8000-000000000005', 'Sachet', 'SACHET', 'sachet', 'sachets', 50, 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('aaaaaaaa-0001-4000-8000-000000000006', 'Box', 'BOX', 'box', 'boxes', 60, 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('aaaaaaaa-0001-4000-8000-000000000007', 'Ampoule', 'AMPOULE', 'ampoule', 'ampoules', 70, 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('aaaaaaaa-0001-4000-8000-000000000008', 'Jar', 'JAR', 'jar', 'jars', 80, 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('aaaaaaaa-0001-4000-8000-000000000009', 'Pouch', 'POUCH', 'pouch', 'pouches', 90, 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('aaaaaaaa-0001-4000-8000-00000000000a', 'Inhaler', 'INHALER', 'inhaler', 'inhalers', 100, 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('aaaaaaaa-0001-4000-8000-00000000000b', 'Dropper', 'DROPPER', 'dropper', 'droppers', 110, 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('aaaaaaaa-0001-4000-8000-00000000000c', 'Cartridge', 'CARTRIDGE', 'cartridge', 'cartridges', 120, 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('aaaaaaaa-0001-4000-8000-00000000000d', 'Kit', 'KIT', 'kit', 'kits', 130, 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('aaaaaaaa-0001-4000-8000-00000000000e', 'Piece', 'PIECE', 'piece', 'pieces', 140, 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "content_units" ("id", "name", "code", "singularLabel", "pluralLabel", "sortOrder", "status", "isDeleted", "createdAt", "updatedAt") VALUES
('bbbbbbbb-0001-4000-8000-000000000001', 'Tablet', 'TABLET', 'tablet', 'tablets', 10, 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('bbbbbbbb-0001-4000-8000-000000000002', 'Capsule', 'CAPSULE', 'capsule', 'capsules', 20, 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('bbbbbbbb-0001-4000-8000-000000000003', 'Millilitre', 'ML', 'ml', 'ml', 30, 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('bbbbbbbb-0001-4000-8000-000000000004', 'Gram', 'GM', 'g', 'g', 40, 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('bbbbbbbb-0001-4000-8000-000000000005', 'Microgram', 'MCG', 'mcg', 'mcg', 50, 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('bbbbbbbb-0001-4000-8000-000000000006', 'International unit', 'IU', 'IU', 'IU', 60, 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('bbbbbbbb-0001-4000-8000-000000000007', 'Dose', 'DOSE', 'dose', 'doses', 70, 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('bbbbbbbb-0001-4000-8000-000000000008', 'Drop', 'DROP', 'drop', 'drops', 80, 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('bbbbbbbb-0001-4000-8000-000000000009', 'Puff', 'PUFF', 'puff', 'puffs', 90, 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('bbbbbbbb-0001-4000-8000-00000000000a', 'Piece', 'PIECE', 'piece', 'pieces', 100, 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- AlterTable
ALTER TABLE "products" ADD COLUMN "packTypeId" UUID,
ADD COLUMN "contentUnitId" UUID;

UPDATE "products" AS product
SET "packTypeId" = pack_type.id
FROM "pack_types" AS pack_type
WHERE pack_type.code = product."packUnit"::text;

UPDATE "products" AS product
SET "contentUnitId" = content_unit.id
FROM "content_units" AS content_unit
WHERE content_unit.code = product."contentUnit"::text;

UPDATE "products"
SET "packTypeId" = 'aaaaaaaa-0001-4000-8000-000000000006'
WHERE "packTypeId" IS NULL;

UPDATE "products"
SET "contentUnitId" = 'bbbbbbbb-0001-4000-8000-000000000001'
WHERE "contentUnitId" IS NULL;

ALTER TABLE "products" ALTER COLUMN "packTypeId" SET NOT NULL,
ALTER COLUMN "contentUnitId" SET NOT NULL;

ALTER TABLE "products" DROP COLUMN "packUnit",
DROP COLUMN "contentUnit";

DROP TYPE "PackUnit";
DROP TYPE "ContentUnit";

-- CreateIndex
CREATE INDEX "products_packTypeId_idx" ON "products"("packTypeId");

-- CreateIndex
CREATE INDEX "products_contentUnitId_idx" ON "products"("contentUnitId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_packTypeId_fkey" FOREIGN KEY ("packTypeId") REFERENCES "pack_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_contentUnitId_fkey" FOREIGN KEY ("contentUnitId") REFERENCES "content_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
