-- CreateTable
CREATE TABLE "NaukriOptimizationSet" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "headlineFix" JSONB NOT NULL,
    "literalTermSwaps" JSONB NOT NULL,
    "recencyFixes" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NaukriOptimizationSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NaukriOptimizationSet_scanId_idx" ON "NaukriOptimizationSet"("scanId");

-- AddForeignKey
ALTER TABLE "NaukriOptimizationSet" ADD CONSTRAINT "NaukriOptimizationSet_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
