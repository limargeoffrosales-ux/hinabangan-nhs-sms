// Minimal unit suite — pure logic only, no DB, no network. Every spec runs in
// milliseconds so they can ride the deployment build without slowing it down.
'use strict';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  defaultPolicy,
  checkPasswordPolicy,
} = require('../src/password-policy');
const {
  RESET_CODE_TTL_MS,
  RESET_MAX_ATTEMPTS,
  RESET_CODE_LENGTH,
  genResetCode,
} = require('../src/reset-codes');
const { render, isEmail } = require('../src/notify');
const { hashToken } = require('../src/auth');

test('password policy: accepts a fully-compliant password', () => {
  assert.equal(checkPasswordPolicy(defaultPolicy(), 'Str0ng!Passw0rd'), null);
});

test('password policy: rejects each missing requirement', () => {
  const p = defaultPolicy();
  assert.match(checkPasswordPolicy(p, 'short1!A'), /at least 12/);
  assert.match(checkPasswordPolicy(p, 'alllowercase1!'), /uppercase/);
  assert.match(checkPasswordPolicy(p, 'ALLUPPERCASE1!'), /lowercase/);
  assert.match(checkPasswordPolicy(p, 'NoDigitsHere!!'), /one digit/);
  assert.match(checkPasswordPolicy(p, 'NoSpecialChar9'), /special character/);
});

test('password policy: minLength is inclusive at the boundary', () => {
  const p = defaultPolicy();
  const at = 'Aa1!'.repeat(3); // exactly 12 chars
  const below = 'Aa1!'.repeat(3).slice(0, 11);
  assert.equal(checkPasswordPolicy(p, at), null);
  assert.match(checkPasswordPolicy(p, below), /at least 12/);
});

test('password policy: relaxed policy skips disabled rules', () => {
  const p = { minLength: 6, requireUppercase: false, requireLowercase: false, requireDigit: false, requireSpecial: false };
  assert.equal(checkPasswordPolicy(p, 'abc123'), null);
});

test('reset codes: always RESET_CODE_LENGTH numeric digits', () => {
  for (let i = 0; i < 5000; i++) {
    const code = genResetCode();
    assert.equal(code.length, RESET_CODE_LENGTH);
    assert.match(code, /^[0-9]+$/);
  }
});

test('reset codes: supported lifespan and attempt cap stay put', () => {
  assert.equal(RESET_CODE_TTL_MS, 15 * 60 * 1000);
  assert.equal(RESET_MAX_ATTEMPTS, 5);
});

test('notify.render: substitutes {{vars}}, blanks unknown ones', () => {
  const out = render('Hello {{name}}, code {{code}}', { name: 'Grace' });
  assert.equal(out, 'Hello Grace, code ');
  const both = render('{{name}}/{{code}}', { name: 'Grace', code: '123456' });
  assert.equal(both, 'Grace/123456');
});

test('notify.render: handles empty data and no placeholders', () => {
  assert.equal(render('plain text', null), 'plain text');
  assert.equal(render(null, { x: 1 }), '');
});

test('notify.isEmail: accepts well-formed addresses, rejects junk', () => {
  assert.equal(isEmail('a@b.com'), true);
  assert.equal(isEmail('first.last+tag@sub.example.org'), true);
  assert.equal(isEmail('not-an-email'), false);
  assert.equal(isEmail('a@b'), false);
  assert.equal(isEmail(''), false);
  assert.equal(isEmail('   '), false);
});

test('auth.hashToken: sha256 hex, deterministic, distinct per input', () => {
  const a = hashToken('secret-code-a');
  const b = hashToken('secret-code-a');
  const c = hashToken('secret-code-b');
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.notEqual(a.length, 'secret-code-a'.length); // must never be the raw code
});