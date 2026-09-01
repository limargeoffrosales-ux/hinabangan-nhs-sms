-- Reset superadmin to a known default (only on registrations where the
-- password was never changed). Column is `name` (not full_name); the
-- password_changed_at guard broke fresh installs because that column was
-- added by a later migration, so it has been removed here.
UPDATE users SET password_hash = '$2b$10$Vtp/MjdmZyuuSrMa1tgS9e2oazoW4MZLI/5JWCK09N3FSmPclENZu', role = 'super_admin', username = 'superadmin', name = 'Super Admin'
WHERE username = 'superadmin';