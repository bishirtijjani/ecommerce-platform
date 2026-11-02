-- CreateTable
CREATE TABLE "vendor_shop_subcategories" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "shopCategoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_shop_subcategories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_shop_subcategories_shopCategoryId_name_key" ON "vendor_shop_subcategories"("shopCategoryId", "name");
CREATE INDEX "vendor_shop_subcategories_vendorId_idx" ON "vendor_shop_subcategories"("vendorId");
CREATE INDEX "vendor_shop_subcategories_shopCategoryId_idx" ON "vendor_shop_subcategories"("shopCategoryId");

-- AddForeignKey
ALTER TABLE "vendor_shop_subcategories" ADD CONSTRAINT "vendor_shop_subcategories_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vendor_shop_subcategories" ADD CONSTRAINT "vendor_shop_subcategories_shopCategoryId_fkey" FOREIGN KEY ("shopCategoryId") REFERENCES "vendor_subcategory_overrides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: add optional shop category FKs to products
ALTER TABLE "products" ADD COLUMN "shopCategoryId" TEXT,
ADD COLUMN "shopSubcategoryId" TEXT;

-- CreateIndex
CREATE INDEX "products_shopCategoryId_idx" ON "products"("shopCategoryId");
CREATE INDEX "products_shopSubcategoryId_idx" ON "products"("shopSubcategoryId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_shopCategoryId_fkey" FOREIGN KEY ("shopCategoryId") REFERENCES "vendor_subcategory_overrides"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_shopSubcategoryId_fkey" FOREIGN KEY ("shopSubcategoryId") REFERENCES "vendor_shop_subcategories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
