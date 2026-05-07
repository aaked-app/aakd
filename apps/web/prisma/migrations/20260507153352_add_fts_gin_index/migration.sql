-- Add GIN index for full-text search on contracts.
--
-- NOTE: `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block, and
-- `prisma migrate` wraps each migration file in an implicit transaction. To
-- avoid the migration runner aborting, this file uses a plain `CREATE INDEX`
-- (which briefly takes an ACCESS EXCLUSIVE lock on the table). For dev and
-- small-to-medium production tables this is fine. On a large production
-- `Contract` table consider applying the CONCURRENTLY variant manually:
--
--   psql "$DATABASE_URL" -c '\
--     CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_contracts_fts" \
--     ON "Contract" USING GIN ( \
--       to_tsvector(''english'', \
--         coalesce("title", '''') || '' '' || \
--         coalesce("counterpartyName", '''') || '' '' || \
--         coalesce("notes", '''') || '' '' || \
--         coalesce("extractedText", '''') \
--       ) \
--     );'
--
-- Then mark this migration as applied without re-running its body:
--
--   pnpm prisma migrate resolve --applied 20260507153352_add_fts_gin_index
--
-- The non-concurrent variant below is the default that runs through
-- `prisma migrate deploy` / `prisma migrate dev`.

CREATE INDEX IF NOT EXISTS "idx_contracts_fts"
ON "Contract" USING GIN (
  to_tsvector('english',
    coalesce("title", '') || ' ' ||
    coalesce("counterpartyName", '') || ' ' ||
    coalesce("notes", '') || ' ' ||
    coalesce("extractedText", '')
  )
);
