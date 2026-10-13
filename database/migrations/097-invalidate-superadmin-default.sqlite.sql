-- SECURITY: migration 024 shipped a hard-coded bcrypt hash for the `superadmin`
-- account, a login backdoor for any database where a `superadmin` row existed
-- when it ran. This migration invalidates that exact hash so the known password
-- can no longer authenticate.
--
-- The replacement hash below is bcrypt of a random value that was discarded, so
-- nobody can sign in with it. `password_changed_at` is reset to NULL so the next
-- boot applies the SUPERADMIN_PASSWORD env var when set (server/src/index.js:93);
-- otherwise recover through the forgot-password flow or Users > set password.
-- Databases whose superadmin password was already changed are untouched because
-- of the hash comparison in the WHERE clause.
UPDATE users
SET password_hash = '$2b$12$.4fF7qocsFvYxvIyfovbk.jUtV0utH26agFdEaXzjLx2gD.2R6BFe',
    password_changed_at = NULL,
    failed_attempts = 0,
    locked_until = NULL
WHERE username = 'superadmin'
  AND password_hash = '$2b$10$Vtp/MjdmZyuuSrMa1tgS9e2oazoW4MZLI/5JWCK09N3FSmPclENZu';
