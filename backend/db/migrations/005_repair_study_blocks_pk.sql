-- ============================================================
-- Migration 005: Repair study_blocks Primary Key
-- Fixes half-migrated state: id(TEXT) + new_id(UUID) → id(UUID)
--
-- PRODUCTION DATABASE REPAIR — Run in Railway → Postgres → Query tab
-- ============================================================
-- 
-- CURRENT STATE:
--   study_blocks.id     = TEXT   (old, PK is here)
--   study_blocks.new_id = UUID   (new values, not yet promoted)
--   mistakes.block_id   = UUID   (already migrated)
--   revision_items.block_id = UUID (already migrated)
--   block_pyq_links.block_id = UUID (already migrated)
--   plan_block_events.block_id = UUID (FK to study_blocks.id)
--
-- TARGET STATE:
--   study_blocks.id = UUID PRIMARY KEY (only identity column)
--
-- ============================================================

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  PRE-FLIGHT: Run these FIRST, BEFORE the migration       ║
-- ║  If any check fails, DO NOT proceed.                     ║
-- ╚═══════════════════════════════════════════════════════════╝

-- ── CHECK 1: Verify new_id has NO nulls ──────────────────────────────────────
-- Expected result: null_new_id_count = 0
-- If count > 0, STOP. Backfill nulls first.
SELECT COUNT(*) AS null_new_id_count
FROM study_blocks
WHERE new_id IS NULL;

-- ── CHECK 2: Verify new_id has NO duplicates ─────────────────────────────────
-- Expected result: 0 rows
-- If any rows returned, STOP. Resolve duplicates first.
SELECT new_id, COUNT(*) AS cnt
FROM study_blocks
GROUP BY new_id
HAVING COUNT(*) > 1;

-- ── CHECK 3: Inspect existing constraints on study_blocks ────────────────────
-- Look for the PK constraint name (expected: study_blocks_pkey)
-- and any foreign keys FROM other tables pointing to study_blocks.id
SELECT
  tc.constraint_name,
  tc.constraint_type,
  tc.table_name,
  kcu.column_name,
  ccu.table_name  AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
  AND tc.table_schema = ccu.table_schema
WHERE tc.table_schema = 'public'
  AND (tc.table_name = 'study_blocks'
    OR ccu.table_name = 'study_blocks')
ORDER BY tc.constraint_type, tc.table_name;

-- ── CHECK 4: Find any FK constraints referencing study_blocks(id) ────────────
-- These MUST be dropped before we can alter the PK
SELECT
  tc.constraint_name,
  tc.table_name AS referencing_table,
  kcu.column_name AS referencing_column,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'study_blocks'
  AND ccu.column_name = 'id';


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  MIGRATION: Run inside a transaction                     ║
-- ║  Only proceed if ALL pre-flight checks passed.           ║
-- ╚═══════════════════════════════════════════════════════════╝

BEGIN;

-- ── Step 0: Drop any FK constraints referencing study_blocks(id) ─────────────
-- If CHECK 4 returned rows, uncomment and add the appropriate DROP lines.
-- Example (update constraint names from CHECK 4 output):
--
-- ALTER TABLE plan_block_events DROP CONSTRAINT IF EXISTS plan_block_events_block_id_fkey;
-- ALTER TABLE block_pyq_links   DROP CONSTRAINT IF EXISTS block_pyq_links_block_id_fkey;
--
-- NOTE: If these FKs currently point at the old TEXT id column, they are
-- already broken (type mismatch). Dropping them is safe. We will re-create
-- them pointing to the new UUID id after the migration.

-- ── Step 1: Drop indexes that reference the old `id` column ──────────────────
-- Unique/partial indexes on (user_id) with WHERE clauses don't reference `id`
-- directly, but any index on `id` must go. The PK index is dropped with the
-- constraint in Step 2.

-- ── Step 2: Drop the old primary key constraint ──────────────────────────────
ALTER TABLE study_blocks DROP CONSTRAINT IF EXISTS study_blocks_pkey;

-- ── Step 3: Set new_id to NOT NULL ───────────────────────────────────────────
ALTER TABLE study_blocks ALTER COLUMN new_id SET NOT NULL;

-- ── Step 4: Add primary key on new_id ────────────────────────────────────────
ALTER TABLE study_blocks ADD CONSTRAINT study_blocks_pkey PRIMARY KEY (new_id);

-- ── Step 5: Drop old TEXT id column ──────────────────────────────────────────
ALTER TABLE study_blocks DROP COLUMN id;

-- ── Step 6: Rename new_id → id ───────────────────────────────────────────────
ALTER TABLE study_blocks RENAME COLUMN new_id TO id;

-- ── Step 7 (optional): Re-create FK constraints pointing to new UUID id ─────
-- Uncomment these if CHECK 4 showed FK constraints that were dropped in Step 0.
-- These are now type-compatible (UUID → UUID).
--
-- ALTER TABLE plan_block_events
--   ADD CONSTRAINT plan_block_events_block_id_fkey
--   FOREIGN KEY (block_id) REFERENCES study_blocks(id) ON DELETE CASCADE;
--
-- ALTER TABLE block_pyq_links
--   ADD CONSTRAINT block_pyq_links_block_id_fkey
--   FOREIGN KEY (block_id) REFERENCES study_blocks(id) ON DELETE CASCADE;

COMMIT;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  POST-MIGRATION VERIFICATION                             ║
-- ║  Run these AFTER the migration to confirm success.       ║
-- ╚═══════════════════════════════════════════════════════════╝

-- ── VERIFY 1: study_blocks.id exists and is UUID ─────────────────────────────
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'study_blocks'
  AND column_name = 'id';
-- Expected: column_name=id, data_type=uuid, is_nullable=NO

-- ── VERIFY 2: new_id column no longer exists ─────────────────────────────────
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'study_blocks'
  AND column_name = 'new_id';
-- Expected: 0 rows

-- ── VERIFY 3: Primary key is on id ──────────────────────────────────────────
SELECT
  tc.constraint_name,
  kcu.column_name,
  tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'study_blocks'
  AND tc.constraint_type = 'PRIMARY KEY';
-- Expected: constraint_name=study_blocks_pkey, column_name=id, constraint_type=PRIMARY KEY

-- ── VERIFY 4: Full column listing ────────────────────────────────────────────
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'study_blocks'
ORDER BY ordinal_position;

-- ── VERIFY 5: Row count sanity check ─────────────────────────────────────────
SELECT COUNT(*) AS total_rows FROM study_blocks;

-- ── VERIFY 6: Sample rows to confirm data integrity ─────────────────────────
SELECT id, user_id, block_id, day_key, status
FROM study_blocks
LIMIT 5;
