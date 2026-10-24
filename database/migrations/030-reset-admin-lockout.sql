-- Reset all lockouts (safety — admin was locked during testing)
UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE username = 'admin';
