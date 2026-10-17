-- AlterEnum
ALTER TYPE "PostType" ADD VALUE 'GROUP_PARLAY';

-- AlterTable
ALTER TABLE "BetLeg" ADD COLUMN     "addedById" UUID;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "lockAt" TIMESTAMP(3),
ADD COLUMN     "lockedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "BetLeg_betId_addedById_key" ON "BetLeg"("betId", "addedById");

-- AddForeignKey
ALTER TABLE "BetLeg" ADD CONSTRAINT "BetLeg_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

