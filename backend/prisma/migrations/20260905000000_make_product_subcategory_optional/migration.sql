-- ============================================================
-- Make Product.subcategoryId optional.
-- A vendor catalogues a product under a category (required) + a
-- subcategory (optional). Categories that have no subcategories
-- (the majority of the global taxonomy) no longer block product
-- creation. A product can be filed under just a category, then get
-- a subcategory later.
-- ============================================================

ALTER TABLE "products" ALTER COLUMN "subcategoryId" DROP NOT NULL;