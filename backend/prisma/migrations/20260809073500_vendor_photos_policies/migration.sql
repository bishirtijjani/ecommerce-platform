-- AlterTable
ALTER TABLE "vendors" ADD COLUMN     "photos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "policies" JSONB;
