UPDATE users
SET password_hash = '$2b$10$xvFGA3CUglcTf1xVy/y9d.1z9qk35GjAarR/QgT2lplgtLsUDCwoW',
    status = 'active'
WHERE username IN ('superadmin', 'admin') AND password_changed_at IS NULL;
