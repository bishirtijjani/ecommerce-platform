-- CreateEnum
CREATE TYPE "ProductCondition" AS ENUM ('NEW', 'USED');

-- AlterTable: existing rows default to NEW (new items), preserving prior meaning.
ALTER TABLE "products" ADD COLUMN     "condition" "ProductCondition" NOT NULL DEFAULT 'NEW';

-- CreateIndex
CREATE INDEX "products_condition_idx" ON "products"("condition");
