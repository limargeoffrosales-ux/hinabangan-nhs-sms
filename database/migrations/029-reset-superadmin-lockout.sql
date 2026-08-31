UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE username = 'superadmin';
