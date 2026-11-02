-- ============================================================
-- Unify taxonomy: single Category -> Subcategory system where rows
-- are either global (vendorId null) or vendor-owned (vendorId set).
-- Removes the separate two-level shop tree
-- (vendor_subcategory_overrides + vendor_shop_subcategories) and the
-- product's extra shopCategoryId/shopSubcategoryId pair.
-- ============================================================

-- 1. Add ownership + image columns
ALTER TABLE "vendor_categories" ADD COLUMN "vendorId" TEXT;
ALTER TABLE "vendor_categories" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "subcategories"   ADD COLUMN "vendorId" TEXT;

-- 2. Slugs: only global categories/subcategories need a slug now.
ALTER TABLE "vendor_categories" ALTER COLUMN "slug" DROP NOT NULL;
ALTER TABLE "subcategories"     ALTER COLUMN "slug" DROP NOT NULL;

-- Drop old global uniqueness on name/slug in favor of per-vendor scopes
-- (partial style: NULL vendor rows group under global, unique scope below).
DROP INDEX IF EXISTS "vendor_categories_name_key";
DROP INDEX IF EXISTS "vendor_categories_slug_key";
ALTER TABLE "subcategories" DROP CONSTRAINT IF EXISTS "subcategories_categoryId_slug_key";

-- 3. Build vendor-owned Category rows from the vendor-created custom shop
--    categories (customName set, no linked global subcategory).
CREATE TABLE "_tmp_vsc_map" (
  old_id TEXT PRIMARY KEY,
  new_id TEXT NOT NULL
);

INSERT INTO "_tmp_vsc_map" (old_id, new_id)
SELECT vsc.id, gen_random_uuid()::text
FROM "vendor_subcategory_overrides" vsc
WHERE vsc."customName" IS NOT NULL
  AND vsc."subcategoryId" IS NULL;

INSERT INTO "vendor_categories"
  (id, name, slug, "imageUrl", "vendorId", "sortOrder", "hasPreparation", "isActive", "createdAt", "updatedAt")
SELECT
  m.new_id,
  vsc."customName",
  NULL,
  vsc."imageUrl",
  vsc."vendorId",
  vsc."sortOrder",
  true,
  true,
  now(),
  now()
FROM "_tmp_vsc_map" m
JOIN "vendor_subcategory_overrides" vsc ON vsc.id = m.old_id;

-- 4. Build vendor-owned Subcategory rows from the shop's leaves, filed under
--    the newly created (or existing) vendor category for that leaf's parent.
CREATE TABLE "_tmp_vss_map" (
  old_id TEXT PRIMARY KEY,
  new_id TEXT NOT NULL
);

INSERT INTO "_tmp_vss_map" (old_id, new_id)
SELECT vss.id, gen_random_uuid()::text
FROM "vendor_shop_subcategories" vss;

INSERT INTO "subcategories"
  (id, "categoryId", name, slug, "imageUrl", "vendorId", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT
  m.new_id,
  vsc_map.new_id,
  vss.name,
  NULL,
  vss."imageUrl",
  vss."vendorId",
  vss."sortOrder",
  true,
  now(),
  now()
FROM "_tmp_vss_map" m
JOIN "vendor_shop_subcategories" vss      ON vss.id = m.old_id
LEFT JOIN "_tmp_vsc_map" vsc_map          ON vsc_map.old_id = vss."shopCategoryId";

-- 5. Remap products filed under the old shop tree onto the unified taxonomy.
--    The shop category's new unified category id + the leaf's new subcategory id
--    become the product's single category/subcategory pair.
UPDATE "products" p
SET "categoryId"    = vsc_map.new_id,
    "subcategoryId" = vss_map.new_id
FROM "_tmp_vsc_map" vsc_map, "_tmp_vss_map" vss_map
WHERE p."shopCategoryId" IS NOT NULL
  AND p."shopCategoryId"    = vsc_map.old_id
  AND p."shopSubcategoryId" = vss_map.old_id;

-- 6. Drop the product's redundant shop columns + their indexes.
DROP INDEX IF EXISTS "products_shopCategoryId_idx";
DROP INDEX IF EXISTS "products_shopSubcategoryId_idx";
ALTER TABLE "products" DROP COLUMN IF EXISTS "shopCategoryId";
ALTER TABLE "products" DROP COLUMN IF EXISTS "shopSubcategoryId";

-- 7. Drop the two-level shop tree tables.
DROP TABLE IF EXISTS "vendor_shop_subcategories";
DROP TABLE IF EXISTS "vendor_subcategory_overrides";

-- 8. Cleanup temp mapping tables.
DROP TABLE IF EXISTS "_tmp_vsc_map";
DROP TABLE IF EXISTS "_tmp_vss_map";

-- 9. New scoped indexes + unique constraints.
CREATE UNIQUE INDEX "vendor_categories_vendorId_name_key"
  ON "vendor_categories"("vendorId", "name");
CREATE UNIQUE INDEX "subcategories_categoryId_vendorId_name_key"
  ON "subcategories"("categoryId", "vendorId", "name");
CREATE INDEX "vendor_categories_vendorId_idx" ON "vendor_categories"("vendorId");
CREATE INDEX "subcategories_vendorId_idx"     ON "subcategories"("vendorId");

-- 10. FK to vendors for the new owner columns.
ALTER TABLE "vendor_categories"
  ADD CONSTRAINT "vendor_categories_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "subcategories"
  ADD CONSTRAINT "subcategories_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON UPDATE CASCADE ON DELETE CASCADE;
