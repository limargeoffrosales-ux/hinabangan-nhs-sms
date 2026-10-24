// Shared password policy. `checkPasswordPolicy` is pure so it can be unit
// tested and reused everywhere a password is set or changed. The per-school
// knobs live in app_settings and are read by auth.routes via getPasswordPolicy();
// this module only knows how to judge a password against a policy object.

const POLICY_KEYS = [
  'password_min_length',
  'password_require_uppercase',
  'password_require_lowercase',
  'password_require_digit',
  'password_require_special',
];

const SPECIAL_RE = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/;

function defaultPolicy() {
  return {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireDigit: true,
    requireSpecial: true,
  };
}

function checkPasswordPolicy(policy, password) {
  const s = String(password);
  if (s.length < (policy.minLength || 12)) return `Password must be at least ${policy.minLength || 12} characters`;
  if (policy.requireUppercase !== false && !/[A-Z]/.test(s)) return 'Password must contain at least one uppercase letter';
  if (policy.requireLowercase !== false && !/[a-z]/.test(s)) return 'Password must contain at least one lowercase letter';
  if (policy.requireDigit !== false && !/[0-9]/.test(s)) return 'Password must contain at least one digit';
  if (policy.requireSpecial !== false && !SPECIAL_RE.test(s)) return 'Password must contain at least one special character';
  return null;
}

module.exports = { POLICY_KEYS, defaultPolicy, checkPasswordPolicy };