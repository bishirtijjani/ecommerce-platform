-- Add SECOND_HAND to ProductCondition. Kept in its own migration file (its own
-- transaction) because a freshly ADDed enum value cannot be used in the same
-- transaction - the data backfill lives in the next migration.
ALTER TYPE "ProductCondition" ADD VALUE 'SECOND_HAND';

-- Nigerian State + LGA on accounts (captured at registration), shops (copied
-- at enroll, editable on the profile), and second-hand products (snapshot).
ALTER TABLE "users"    ADD COLUMN "state" TEXT;
ALTER TABLE "users"    ADD COLUMN "lga"   TEXT;
ALTER TABLE "vendors"  ADD COLUMN "state" TEXT;
ALTER TABLE "vendors"  ADD COLUMN "lga"   TEXT;
ALTER TABLE "products" ADD COLUMN "state" TEXT;
ALTER TABLE "products" ADD COLUMN "lga"   TEXT;

CREATE INDEX "vendors_state_lga_idx" ON "vendors" ("state", "lga");
CREATE INDEX "products_condition_state_lga_idx" ON "products" ("condition", "state", "lga");
