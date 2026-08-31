UPDATE users SET password_hash = '$2b$10$Vtp/MjdmZyuuSrMa1tgS9e2oazoW4MZLI/5JWCK09N3FSmPclENZu', role = 'super_admin', username = 'superadmin', full_name = 'Super Admin'
WHERE username = 'superadmin'
AND password_changed_at IS NULL;
