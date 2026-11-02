-- Add an explicit curated image to subcategories (used on shop category grids).
ALTER TABLE "subcategories" ADD COLUMN "imageUrl" TEXT;

-- Per-vendor override of how a subcategory is displayed inside one shop.
CREATE TABLE "vendor_subcategory_overrides" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "subcategoryId" TEXT NOT NULL,
    "displayName" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_subcategory_overrides_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on the relation so each (vendor, subcategory) has one override.
CREATE UNIQUE INDEX "vendor_subcategory_overrides_vendorId_subcategoryId_key"
    ON "vendor_subcategory_overrides"("vendorId", "subcategoryId");
CREATE INDEX "vendor_subcategory_overrides_vendorId_idx"
    ON "vendor_subcategory_overrides"("vendorId");
CREATE INDEX "vendor_subcategory_overrides_subcategoryId_idx"
    ON "vendor_subcategory_overrides"("subcategoryId");

-- Foreign keys
ALTER TABLE "vendor_subcategory_overrides"
    ADD CONSTRAINT "vendor_subcategory_overrides_vendorId_fkey"
    FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vendor_subcategory_overrides"
    ADD CONSTRAINT "vendor_subcategory_overrides_subcategoryId_fkey"
    FOREIGN KEY ("subcategoryId") REFERENCES "subcategories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
