-- ============================================================
-- Categories move to products (admin-managed taxonomy) + highlight product links
--
-- 1. New Subcategory table (one level under VendorCategory, admin-managed).
-- 2. Products gain categoryId + subcategoryId, backfilled from the old
--    free-text `category` path ("Clothing & Fashion > Women > Dresses" ->
--    category "Clothing & Fashion" + subcategory "Women"; empty second
--    segments fall back to a per-category "General" subcategory).
-- 3. Vendor.categoryId (single shop category) is dropped - shop categories
--    now derive from the categories of their available products.
-- 4. New highlight_story_products join table (up to 2 products per story).
-- 5. Product.search_vector rebuilt without the dropped category weight.
-- ============================================================

-- ── Subcategory table ──────────────────────────────────────────────────────
CREATE TABLE "subcategories" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subcategories_pkey" PRIMARY KEY ("id")
);

-- ── Highlight story ↔ product join table ───────────────────────────────────
CREATE TABLE "highlight_story_products" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "highlight_story_products_pkey" PRIMARY KEY ("id")
);

-- ── Product: add category/subcategory columns (backfill before NOT NULL) ───
ALTER TABLE "products" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "products" ADD COLUMN "subcategoryId" TEXT;

-- Backfill categoryId from the leading segment of the old free-text path.
UPDATE "products" p
SET "categoryId" = c.id
FROM "vendor_categories" c
WHERE c.name = btrim(split_part(p."category", '>', 1));

-- Every category gets a "General" subcategory so legacy products with an
-- empty second segment (e.g. "Clothing & Fashion >") still resolve.
INSERT INTO "subcategories" ("id", "categoryId", "name", "slug", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), c.id, 'General', 'general', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "vendor_categories" c
WHERE NOT EXISTS (SELECT 1 FROM "subcategories" s WHERE s."categoryId" = c.id AND s.slug = 'general');

-- Seed subcategories from the distinct second path segments.
INSERT INTO "subcategories" ("id", "categoryId", "name", "slug", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), p.cid, p.sub, lower(regexp_replace(p.sub, '\s+', '-', 'g')), 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT c.id AS cid, btrim(split_part(pr."category", '>', 2)) AS sub
  FROM "products" pr
  JOIN "vendor_categories" c ON c.name = btrim(split_part(pr."category", '>', 1))
  WHERE pr."category" IS NOT NULL AND btrim(split_part(pr."category", '>', 2)) <> ''
) p
WHERE NOT EXISTS (
  SELECT 1 FROM "subcategories" s WHERE s."categoryId" = p.cid AND s.slug = lower(regexp_replace(p.sub, '\s+', '-', 'g'))
);

-- Backfill subcategoryId: match the second segment, else the General fallback.
UPDATE "products" p
SET "subcategoryId" = sc.id
FROM "subcategories" sc
JOIN "vendor_categories" c ON c.id = sc."categoryId"
WHERE c.name = btrim(split_part(p."category", '>', 1))
  AND (
    sc.name = btrim(split_part(p."category", '>', 2))
    OR (btrim(split_part(p."category", '>', 2)) = '' AND sc.slug = 'general')
  );

ALTER TABLE "products" ALTER COLUMN "categoryId" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "subcategoryId" SET NOT NULL;

-- ── Constraints & indexes ──────────────────────────────────────────────────
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "vendor_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_categoryId_slug_key" UNIQUE ("categoryId", "slug");

ALTER TABLE "highlight_story_products" ADD CONSTRAINT "highlight_story_products_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "highlight_stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "highlight_story_products" ADD CONSTRAINT "highlight_story_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "highlight_story_products" ADD CONSTRAINT "highlight_story_products_storyId_productId_key" UNIQUE ("storyId", "productId");

ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "vendor_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "subcategories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "subcategories_categoryId_idx" ON "subcategories"("categoryId");
CREATE INDEX "subcategories_categoryId_isActive_sortOrder_idx" ON "subcategories"("categoryId", "isActive", "sortOrder");
CREATE INDEX "highlight_story_products_storyId_idx" ON "highlight_story_products"("storyId");
CREATE INDEX "highlight_story_products_storyId_sortOrder_idx" ON "highlight_story_products"("storyId", "sortOrder");
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");
CREATE INDEX "products_subcategoryId_idx" ON "products"("subcategoryId");

-- ── Drop the old free-text path + the shop's single category ───────────────
DROP INDEX IF EXISTS "products_category_idx";
ALTER TABLE "products" DROP COLUMN "category";

DROP INDEX IF EXISTS "vendors_categoryId_idx";
ALTER TABLE "vendors" DROP CONSTRAINT IF EXISTS "vendors_categoryId_fkey";
ALTER TABLE "vendors" DROP COLUMN "categoryId";

-- ── Product search_vector: drop the category weight (column is gone) ───────
ALTER TABLE "products" DROP COLUMN IF EXISTS "search_vector";
ALTER TABLE "products" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'B')
) STORED;
CREATE INDEX IF NOT EXISTS "products_search_vector_idx" ON "products" USING GIN ("search_vector");
