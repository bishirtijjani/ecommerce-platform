-- Nigerian State + LGA on a Request (picked on the compose screen), mirroring
-- the same columns on users/vendors/products. Scopes NEARBY matching to the
-- seller's own LGA/state before the radius applies.
ALTER TABLE "requests" ADD COLUMN "state" TEXT;
ALTER TABLE "requests" ADD COLUMN "lga"   TEXT;

CREATE INDEX "requests_state_lga_idx" ON "requests" ("state", "lga");
