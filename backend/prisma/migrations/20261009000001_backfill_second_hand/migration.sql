-- Backfill the retired single-vendor Second Hand catalogue into the new model.
--
-- The seeded "Second Hand Items" vendor (…b000-000000000004) encoded location as
-- taxonomy: each VendorCategory.name was a Nigerian State and each
-- Subcategory.name an LGA. Those rows become ordinary SECOND_HAND products with
-- a real state/lga snapshot, so the new cross-vendor Second Hand marketplace
-- (filtered by condition + state/lga) surfaces them. The vendor itself is kept
-- as a normal approved seller.
--
-- The LGA is read via a correlated subquery (not a LEFT JOIN in the FROM list,
-- which Postgres won't let reference the UPDATE target).
UPDATE "products" p
SET "condition" = 'SECOND_HAND',
    "state"     = vc."name",
    "lga"       = (SELECT sc."name" FROM "subcategories" sc WHERE sc."id" = p."subcategoryId")
FROM "vendor_categories" vc
WHERE p."categoryId" = vc."id"
  AND p."vendorId" = '00000000-0000-4000-b000-000000000004'
  AND p."condition" <> 'SECOND_HAND';
