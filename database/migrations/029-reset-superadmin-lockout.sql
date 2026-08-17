-- Reset lockout for all users (safety migration)
UPDATE users SET failed_attempts = 0, locked_until = NULL;
