-- Explicit top-level industry on each vendor. A shop always belongs to one
-- VendorCategory (Clothing & Fashion, Vehicles & Automobiles, Furniture,
-- Real Estate, ...); the marketplace/home group shops by this field rather
-- than only inferring categories from products (which leaves product-less
-- shops falling into a spurious "Other" group).
ALTER TABLE "vendors" ADD COLUMN "categoryId" TEXT;

-- Backfill for existing shops already carrying products: their categories are
-- derived from those products' categories at seed time, so leave NULL for
-- rows the seed does not explicitly assign.
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "vendor_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "vendors_categoryId_idx" ON "vendors"("categoryId");