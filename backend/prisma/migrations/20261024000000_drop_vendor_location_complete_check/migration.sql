-- The blanket approved-vendor location CHECK was enforced on every UPDATE,
-- so unrelated writes (shop open/close, order counters) failed for legacy
-- approved vendors still at 0,0. Location remains enforced in the application
-- at approval, reinstatement and profile-save time. Re-introduce a
-- status-transition-only trigger after the legacy rows are cleaned.

ALTER TABLE "vendors" DROP CONSTRAINT IF EXISTS "vendors_approved_location_complete";
