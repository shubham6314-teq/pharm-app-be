-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "InventoryAlertKind" AS ENUM ('LOW_STOCK');

-- CreateEnum
CREATE TYPE "InventoryAlertStatus" AS ENUM ('OPEN', 'ANALYZING', 'READY', 'FAILED', 'DISMISSED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "KnowledgeDocumentKind" AS ENUM ('POLICY', 'SUPPLIER');

-- CreateTable
CREATE TABLE "inventory_alerts" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "kind" "InventoryAlertKind" NOT NULL DEFAULT 'LOW_STOCK',
    "availableQuantity" INTEGER NOT NULL,
    "reorderLevel" INTEGER NOT NULL,
    "status" "InventoryAlertStatus" NOT NULL DEFAULT 'OPEN',
    "activeProductKey" UUID,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_analyses" (
    "id" UUID NOT NULL,
    "alertId" UUID NOT NULL,
    "explanation" TEXT NOT NULL,
    "recommendedQuantity" INTEGER,
    "calculationExplanation" TEXT NOT NULL,
    "missingInformation" TEXT[],
    "citedChunkIds" TEXT[],
    "model" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "kind" "KnowledgeDocumentKind" NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "uploadedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(768) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_alerts_activeProductKey_key" ON "inventory_alerts"("activeProductKey");

-- CreateIndex
CREATE INDEX "inventory_alerts_productId_idx" ON "inventory_alerts"("productId");

-- CreateIndex
CREATE INDEX "inventory_alerts_status_idx" ON "inventory_alerts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_analyses_alertId_key" ON "inventory_analyses"("alertId");

-- CreateIndex
CREATE INDEX "knowledge_documents_uploadedById_idx" ON "knowledge_documents"("uploadedById");

-- CreateIndex
CREATE INDEX "knowledge_documents_kind_idx" ON "knowledge_documents"("kind");

-- CreateIndex
CREATE INDEX "knowledge_chunks_documentId_idx" ON "knowledge_chunks"("documentId");

-- CreateIndex
CREATE INDEX "knowledge_chunks_embedding_hnsw_idx" ON "knowledge_chunks" USING hnsw ("embedding" vector_cosine_ops);

-- AddForeignKey
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_analyses" ADD CONSTRAINT "inventory_analyses_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "inventory_alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
