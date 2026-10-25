-- CreateTable
CREATE TABLE "OddsUsage" (
    "userId" UUID NOT NULL,
    "day" TEXT NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "calls" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OddsUsage_pkey" PRIMARY KEY ("userId","day")
);

-- AddForeignKey
ALTER TABLE "OddsUsage" ADD CONSTRAINT "OddsUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep it off Supabase's Data API, like every other table
REVOKE ALL ON public."OddsUsage" FROM anon, authenticated;
