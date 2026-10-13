-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('NONE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('STRAIGHT', 'PARLAY', 'LADDER');

-- CreateEnum
CREATE TYPE "BetResult" AS ENUM ('PENDING', 'WON', 'LOST', 'PUSH', 'VOID');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'NONE',
    "currentPeriodEnd" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sportsbook" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "supportsDeepLink" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Sportsbook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sport" (
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Sport_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "sportKey" TEXT NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "commenceTime" TIMESTAMP(3) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sportKey" TEXT NOT NULL,
    "team" TEXT,
    "headshotUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "authorId" UUID NOT NULL,
    "type" "PostType" NOT NULL,
    "caption" TEXT,
    "sportsbookId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "units" DECIMAL(6,2) NOT NULL,
    "americanOdds" INTEGER NOT NULL,
    "decimalOdds" DECIMAL(12,4) NOT NULL,
    "result" "BetResult" NOT NULL DEFAULT 'PENDING',
    "settledAt" TIMESTAMP(3),
    "deepLink" TEXT,

    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetLeg" (
    "id" TEXT NOT NULL,
    "betId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "sportKey" TEXT NOT NULL,
    "eventId" TEXT,
    "marketKey" TEXT NOT NULL,
    "selection" TEXT NOT NULL,
    "playerId" TEXT,
    "line" DECIMAL(8,2),
    "americanOdds" INTEGER NOT NULL,
    "result" "BetResult" NOT NULL DEFAULT 'PENDING',
    "bookSelectionId" TEXT,
    "deepLink" TEXT,

    CONSTRAINT "BetLeg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tail" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "betId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reaction" (
    "postId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("postId","userId","emoji")
);

-- CreateTable
CREATE TABLE "StripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeSubscriptionId_key" ON "User"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Sportsbook_key_key" ON "Sportsbook"("key");

-- CreateIndex
CREATE INDEX "Event_sportKey_commenceTime_idx" ON "Event"("sportKey", "commenceTime");

-- CreateIndex
CREATE UNIQUE INDEX "Player_name_sportKey_key" ON "Player"("name", "sportKey");

-- CreateIndex
CREATE INDEX "Post_createdAt_idx" ON "Post"("createdAt");

-- CreateIndex
CREATE INDEX "Post_authorId_createdAt_idx" ON "Post"("authorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Bet_postId_order_key" ON "Bet"("postId", "order");

-- CreateIndex
CREATE INDEX "BetLeg_eventId_idx" ON "BetLeg"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "BetLeg_betId_order_key" ON "BetLeg"("betId", "order");

-- CreateIndex
CREATE INDEX "Tail_betId_idx" ON "Tail"("betId");

-- CreateIndex
CREATE UNIQUE INDEX "Tail_userId_betId_key" ON "Tail"("userId", "betId");

-- CreateIndex
CREATE INDEX "Comment_postId_createdAt_idx" ON "Comment"("postId", "createdAt");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_sportKey_fkey" FOREIGN KEY ("sportKey") REFERENCES "Sport"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_sportKey_fkey" FOREIGN KEY ("sportKey") REFERENCES "Sport"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_sportsbookId_fkey" FOREIGN KEY ("sportsbookId") REFERENCES "Sportsbook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetLeg" ADD CONSTRAINT "BetLeg_betId_fkey" FOREIGN KEY ("betId") REFERENCES "Bet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetLeg" ADD CONSTRAINT "BetLeg_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetLeg" ADD CONSTRAINT "BetLeg_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tail" ADD CONSTRAINT "Tail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tail" ADD CONSTRAINT "Tail_betId_fkey" FOREIGN KEY ("betId") REFERENCES "Bet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Supabase: keep app tables off the public Data API (anon/authenticated keys).
-- All access goes through the Express server, which connects as the table owner.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- Tables created by future migrations won't be granted to the Data API roles either
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
