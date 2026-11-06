-- DropIndex
DROP INDEX "User_stripeCustomerId_key";

-- DropIndex
DROP INDEX "User_stripeSubscriptionId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "cancelAtPeriodEnd",
DROP COLUMN "currentPeriodEnd",
DROP COLUMN "stripeCustomerId",
DROP COLUMN "stripeSubscriptionId",
DROP COLUMN "subscriptionStatus";

-- DropTable
DROP TABLE "StripeEvent";

-- DropEnum
DROP TYPE "SubscriptionStatus";

