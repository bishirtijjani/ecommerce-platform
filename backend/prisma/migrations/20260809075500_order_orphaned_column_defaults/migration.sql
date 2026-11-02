-- `platformFee` and `customerPaid` are NOT NULL columns with no default,
-- left over from before the platform dropped payments/checkout (see
-- PRODUCT.md history) - schema.prisma's Order model no longer declares
-- them, but the DB still enforces NOT NULL with nothing to fall back to,
-- so ANY order insert (not just seed data) currently fails. Give them the
-- same zero-default already used by their sibling columns
-- (vendorEarning/platformEarning) rather than resurrecting the fields.
ALTER TABLE "orders" ALTER COLUMN "platformFee" SET DEFAULT 0;
ALTER TABLE "orders" ALTER COLUMN "customerPaid" SET DEFAULT 0;
