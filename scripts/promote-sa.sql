-- ═══════════════════════════════════════════════════════════════════════════════
-- Promote a user to Special Admin (SA)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- PREREQUISITE: Full schema from scripts/supabase-sql-editor.sql OR npm run setup:db
--
-- WHERE: Supabase Dashboard → SQL → New query
--
-- STEPS:
--   1. Deploy / migrate database (see supabase-sql-editor.sql)
--   2. Sign up at /login with your email
--   3. Replace YOUR_EMAIL@example.com below and run
--
-- Only ONE SA allowed (users_single_sa_idx partial unique index).
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE users
SET
  role = 'SA',
  updated_at = NOW()
WHERE email = 'YOUR_EMAIL@example.com'
  AND NOT EXISTS (
    SELECT 1
    FROM users
    WHERE role = 'SA'
      AND email <> 'YOUR_EMAIL@example.com'
  );

-- Verify:
SELECT id, email, role, created_at FROM users WHERE role = 'SA';
