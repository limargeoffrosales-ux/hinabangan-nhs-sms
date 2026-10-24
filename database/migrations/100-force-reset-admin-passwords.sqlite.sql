-- Unconditionally reset superadmin and admin passwords to Admin123! and ensure status is active
UPDATE users
SET password_hash = '$2b$10$xvFGA3CUglcTf1xVy/y9d.1z9qk35GjAarR/QgT2lplgtLsUDCwoW',
    status = 'active',
    failed_attempts = 0,
    locked_until = NULL
WHERE username IN ('superadmin', 'admin');
