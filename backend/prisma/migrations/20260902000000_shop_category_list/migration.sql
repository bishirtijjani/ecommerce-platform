-- Repurpose the override table into the shop's own category list.
-- Add ordering + the shop's own label, and allow a row to be a shop-added
-- category (subcategoryId null instead of a global pick).
ALTER TABLE "vendor_subcategory_overrides" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "vendor_subcategory_overrides" ADD COLUMN "customName" TEXT;

-- A shop-added category has no global subcategory behind it.
ALTER TABLE "vendor_subcategory_overrides" ALTER COLUMN "subcategoryId" DROP NOT NULL;

-- If a global subcategory is deleted, keep the shop row (it becomes a shop
-- custom category) rather than cascading the whole shop category away.
ALTER TABLE "vendor_subcategory_overrides" DROP CONSTRAINT "vendor_subcategory_overrides_subcategoryId_fkey";
ALTER TABLE "vendor_subcategory_overrides"
    ADD CONSTRAINT "vendor_subcategory_overrides_subcategoryId_fkey"
    FOREIGN KEY ("subcategoryId") REFERENCES "subcategories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
