-- AlterTable
ALTER TABLE "divisions" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "divisions_isDeleted_idx" ON "divisions"("isDeleted");
