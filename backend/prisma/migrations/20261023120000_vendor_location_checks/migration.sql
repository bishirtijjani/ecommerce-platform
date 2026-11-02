-- Vendor location invariants.
--
-- Applied as NOT VALID so existing rows with legacy/incomplete location data
-- do not fail the migration. PostgreSQL still enforces both constraints on
-- every INSERT and UPDATE, so no vendor can be approved (or moved to APPROVED)
-- without a complete location. After the legacy rows are cleaned up, run:
--
--   ALTER TABLE "vendors" VALIDATE CONSTRAINT "vendors_lat_lng_range";
--   ALTER TABLE "vendors" VALIDATE CONSTRAINT "vendors_approved_location_complete";

ALTER TABLE "vendors"
  ADD CONSTRAINT "vendors_lat_lng_range"
  CHECK (
    ("lat" >= -90 AND "lat" <= 90) AND
    ("lng" >= -180 AND "lng" <= 180)
  ) NOT VALID;

ALTER TABLE "vendors"
  ADD CONSTRAINT "vendors_approved_location_complete"
  CHECK (
    "status" <> 'APPROVED'::"VendorStatus" OR (
      NULLIF(btrim("state"), '') IS NOT NULL AND
      NULLIF(btrim("lga"), '') IS NOT NULL AND
      NULLIF(btrim("address"), '') IS NOT NULL AND
      "address" <> 'Pending - set in onboarding' AND
      NOT ("lat" = 0 AND "lng" = 0)
    )
  ) NOT VALID;
