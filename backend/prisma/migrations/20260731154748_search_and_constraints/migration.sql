-- Full-text search + fuzzy search + a financial-safety CHECK constraint.
--
-- Not expressible in schema.prisma alone (generated columns and CHECK
-- constraints aren't part of Prisma's DSL), so this is raw SQL applied on
-- top of the Prisma-generated init migration. The two `search_vector`
-- columns are already declared `Unsupported("tsvector")?` in the schema so
-- Prisma leaves them alone on future `migrate dev` diffs.

-- ── pg_trgm: fuzzy/typo-tolerant search on name/description ──────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── Vendors: tsvector (name=A, description=B) + GIN + trigram ────────────
ALTER TABLE "vendors"
  ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS "vendors_search_vector_idx" ON "vendors" USING GIN ("search_vector");
CREATE INDEX IF NOT EXISTS "vendors_name_trgm_idx" ON "vendors" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "vendors_description_trgm_idx" ON "vendors" USING GIN ("description" gin_trgm_ops);

-- ── Products: tsvector (name=A, description=B, category=C) + GIN + trigram ─
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("category", '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS "products_search_vector_idx" ON "products" USING GIN ("search_vector");
CREATE INDEX IF NOT EXISTS "products_name_trgm_idx" ON "products" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "products_description_trgm_idx" ON "products" USING GIN ("description" gin_trgm_ops);

-- ── Wallet balance floor ──────────────────────────────────────────────────
-- Ecommerce has no cash/rider debit path (unlike logistics, which needed a
-- bypass flag for cash-commission edge cases), so this is a plain
-- unconditional floor: a wallet's balance can never go negative.
ALTER TABLE "wallets"
  ADD CONSTRAINT "wallet_balance_nonneg" CHECK ("balance" >= 0);
