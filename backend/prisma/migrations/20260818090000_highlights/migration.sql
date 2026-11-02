-- CreateTable
CREATE TABLE "highlights" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "highlights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "highlight_stories" (
    "id" TEXT NOT NULL,
    "highlightId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "highlight_stories_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "highlight_stories" ADD CONSTRAINT "highlight_stories_highlightId_fkey" FOREIGN KEY ("highlightId") REFERENCES "highlights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "highlights_vendorId_sortOrder_idx" ON "highlights"("vendorId", "isActive", "sortOrder");
CREATE INDEX "highlight_stories_highlightId_idx" ON "highlight_stories"("highlightId");
CREATE INDEX "highlight_stories_highlightId_sortOrder_idx" ON "highlight_stories"("highlightId", "sortOrder");
