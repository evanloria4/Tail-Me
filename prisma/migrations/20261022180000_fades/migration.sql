-- CreateTable
CREATE TABLE "Fade" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Fade_postId_idx" ON "Fade"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "Fade_userId_postId_key" ON "Fade"("userId", "postId");

-- AddForeignKey
ALTER TABLE "Fade" ADD CONSTRAINT "Fade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fade" ADD CONSTRAINT "Fade_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep it off Supabase's Data API, like every other table
REVOKE ALL ON public."Fade" FROM anon, authenticated;
