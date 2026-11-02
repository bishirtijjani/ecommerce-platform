-- ============================================================
-- Product media gallery.
-- Adds an `images` array (gallery, cover-first) and an optional
-- `videoUrl` to both products and product_variants. `imageUrl` is
-- kept as a cover/back-compat alias equal to images[0]; existing
-- single-image products are backfilled so their current thumbnail
-- becomes the gallery's first (cover) image.
-- ============================================================

ALTER TABLE "products" ADD COLUMN "images" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "products" ADD COLUMN "videoUrl" TEXT;

UPDATE "products" SET "images" = ARRAY["imageUrl"] WHERE "imageUrl" IS NOT NULL AND "images" = '{}';

ALTER TABLE "product_variants" ADD COLUMN "images" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "product_variants" ADD COLUMN "videoUrl" TEXT;

UPDATE "product_variants" SET "images" = ARRAY["imageUrl"] WHERE "imageUrl" IS NOT NULL AND "images" = '{}';