-- AlterTable
ALTER TABLE "ResumeVersion" ADD COLUMN     "afterScore" INTEGER,
ADD COLUMN     "beforeScore" INTEGER,
ADD COLUMN     "scoreDelta" JSONB;

-- AlterTable
ALTER TABLE "Scan" ADD COLUMN     "confirmedSkills" JSONB,
ADD COLUMN     "verdict" JSONB;

-- CreateTable
CREATE TABLE "SavedResume" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "role" TEXT,
    "company" TEXT,
    "score" INTEGER,
    "structuredResume" JSONB NOT NULL,
    "sourceScanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedResume_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedResume_userId_idx" ON "SavedResume"("userId");

-- AddForeignKey
ALTER TABLE "SavedResume" ADD CONSTRAINT "SavedResume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
