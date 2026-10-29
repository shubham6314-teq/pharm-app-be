-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CopilotMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- AlterTable
ALTER TABLE "inventory_analyses"
ADD COLUMN "recommendationStatus" "RecommendationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "decidedQuantity" INTEGER,
ADD COLUMN "decidedAt" TIMESTAMP(3),
ADD COLUMN "decidedById" UUID;

-- CreateTable
CREATE TABLE "copilot_threads" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copilot_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copilot_messages" (
    "id" UUID NOT NULL,
    "threadId" UUID NOT NULL,
    "role" "CopilotMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "citations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copilot_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_analyses_decidedById_idx" ON "inventory_analyses"("decidedById");

-- CreateIndex
CREATE INDEX "copilot_threads_userId_idx" ON "copilot_threads"("userId");

-- CreateIndex
CREATE INDEX "copilot_messages_threadId_idx" ON "copilot_messages"("threadId");

-- AddForeignKey
ALTER TABLE "inventory_analyses" ADD CONSTRAINT "inventory_analyses_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_threads" ADD CONSTRAINT "copilot_threads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_messages" ADD CONSTRAINT "copilot_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "copilot_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
