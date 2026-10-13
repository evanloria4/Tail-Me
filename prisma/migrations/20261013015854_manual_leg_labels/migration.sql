/*
  Warnings:

  - Added the required column `eventLabel` to the `BetLeg` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "BetLeg" ADD COLUMN     "eventLabel" TEXT NOT NULL,
ADD COLUMN     "marketLabel" TEXT,
ADD COLUMN     "playerName" TEXT;
