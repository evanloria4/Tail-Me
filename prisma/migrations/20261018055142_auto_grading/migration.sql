-- CreateEnum
CREATE TYPE "GradeSource" AS ENUM ('AUTO', 'MANUAL');

-- AlterTable
ALTER TABLE "Bet" ADD COLUMN     "gradedBy" "GradeSource";

-- AlterTable
ALTER TABLE "BetLeg" ADD COLUMN     "actual" DECIMAL(8,2),
ADD COLUMN     "gradedBy" "GradeSource";

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "espnId" TEXT;

-- Everything settled before auto-grading existed was settled by hand
UPDATE "Bet" SET "gradedBy" = 'MANUAL' WHERE "result" <> 'PENDING';
UPDATE "BetLeg" SET "gradedBy" = 'MANUAL' WHERE "result" <> 'PENDING';
