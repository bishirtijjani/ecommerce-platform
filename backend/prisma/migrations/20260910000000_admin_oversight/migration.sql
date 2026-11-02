-- ============================================================
-- Admin oversight gaps (audit 2026-09):
--   1. Order.source  - provenance of an order (customer checkout vs vendor-logged)
--   2. PlatformCampaign.vendorId + createdBy - who owns a campaign
--   3. CallbackRequest - persisted "request a callback" leads so admins can
--      audit leads that previously lived only in a vendor inbox
-- ============================================================

-- 1. Order provenance -----------------------------------------------------
CREATE TYPE "OrderSource" AS ENUM ('CUSTOMER', 'VENDOR');

ALTER TABLE "orders" ADD COLUMN "source" "OrderSource" NOT NULL DEFAULT 'CUSTOMER';

-- 2. Campaign ownership ---------------------------------------------------
ALTER TABLE "platform_campaigns" ADD COLUMN "vendorId" TEXT;
ALTER TABLE "platform_campaigns" ADD COLUMN "createdBy" TEXT;

CREATE INDEX "platform_campaigns_vendorId_idx" ON "platform_campaigns"("vendorId");

ALTER TABLE "platform_campaigns" ADD CONSTRAINT "platform_campaigns_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "vendors"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Callback requests ----------------------------------------------------
CREATE TABLE "callback_requests" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "customerName" TEXT,
  "customerPhone" TEXT NOT NULL,
  "customerEmail" TEXT,
  "productId" TEXT,
  "note" TEXT,
  "ipAddress" VARCHAR(64),
  "userAgent" VARCHAR(255),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "callback_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "callback_requests_vendorId_createdAt_idx"
  ON "callback_requests"("vendorId", "createdAt");
CREATE INDEX "callback_requests_customerPhone_idx"
  ON "callback_requests"("customerPhone");

ALTER TABLE "callback_requests" ADD CONSTRAINT "callback_requests_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "vendors"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "callback_requests" ADD CONSTRAINT "callback_requests_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;