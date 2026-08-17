-- Reset superadmin lockout (safety migration — lockout should not apply to super_admin)
UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE username = 'superadmin';
