-- Add videos to reverse-marketplace requests so a customer can support a need
-- with a short clip as well as images.
ALTER TABLE "requests" ADD COLUMN "videos" TEXT[] DEFAULT ARRAY[]::TEXT[];
