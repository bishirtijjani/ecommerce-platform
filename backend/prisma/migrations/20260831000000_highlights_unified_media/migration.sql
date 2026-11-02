-- AlterTable: Rename imageUrl to mediaUrl, add mediaType for unified image/video support
ALTER TABLE "highlight_stories" RENAME COLUMN "imageUrl" TO "mediaUrl";
ALTER TABLE "highlight_stories" ADD COLUMN "mediaType" TEXT NOT NULL DEFAULT 'image';
