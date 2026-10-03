// Operating-hours gate — pure logic, no DB, no network (rides the deploy
// build in milliseconds like the other unit specs).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { config, isOpen, manilaHour, formatHour, gate, DEFAULT_OPEN_HOUR, DEFAULT_CLOSE_HOUR } = require('../src/operating-hours');

const OPEN = { enabled: true, openHour: DEFAULT_OPEN_HOUR, closeHour: DEFAULT_CLOSE_HOUR };

// Manila = UTC+8, no DST.
test('manilaHour: UTC midnight is 08:00 in Manila (open)', () => {
  assert.equal(manilaHour(new Date('2026-10-03T00:00:00Z')), 8);
});

test('manilaHour: UTC 16:00 wraps to 00:00 (closed)', () => {
  assert.equal(manilaHour(new Date('2026-10-03T16:00:00Z')), 0);
});

test('isOpen: open at 06:00 Manila exactly', () => {
  assert.equal(isOpen(new Date('2026-10-03T22:00:00Z'), OPEN), true); // 06:00 Manila
});

test('isOpen: closed at 23:59 Manila (one minute before the 00:00 exclusive bound)', () => {
  assert.equal(isOpen(new Date('2026-10-03T15:59:00Z'), OPEN), true); // 23:59 Manila -> still open
});

test('isOpen: closed at 00:00 and 05:00 Manila', () => {
  assert.equal(isOpen(new Date('2026-10-03T16:00:00Z'), OPEN), false); // 00:00
  assert.equal(isOpen(new Date('2026-10-03T21:00:00Z'), OPEN), false); // 05:00
});

test('isOpen: disabled config always answers', () => {
  const off = { enabled: false, openHour: 6, closeHour: 24 };
  assert.equal(isOpen(new Date('2026-10-03T16:00:00Z'), off), true);
});

test('config: defaults enable 06:00-24:00', () => {
  const c = config({}); // empty env
  assert.equal(c.enabled, true);
  assert.equal(c.openHour, 6);
  assert.equal(c.closeHour, 24);
});

test('config: env overrides are parsed, garbage falls back', () => {
  const c = config({ SYSTEM_OPEN_HOUR: '7', SYSTEM_CLOSE_HOUR: '23' });
  assert.deepEqual(c, { enabled: true, openHour: 7, closeHour: 23 });
  const bad = config({ SYSTEM_OPEN_HOUR: 'noon', SYSTEM_CLOSE_HOUR: '25' });
  assert.deepEqual(bad, { enabled: true, openHour: 6, closeHour: 24 });
});

test('config: open >= close disables the gate (escape hatch)', () => {
  assert.equal(config({ SYSTEM_OPEN_HOUR: '24', SYSTEM_CLOSE_HOUR: '6' }).enabled, false);
  assert.equal(config({ SYSTEM_OPEN_HOUR: '6', SYSTEM_CLOSE_HOUR: '6' }).enabled, false);
});

test('formatHour: friendly labels', () => {
  assert.equal(formatHour(6), '6:00 AM');
  assert.equal(formatHour(12), '12:00 PM');
  assert.equal(formatHour(18), '6:00 PM');
  assert.equal(formatHour(24), '12:00 AM (midnight)');
});

test('gate: health is always exempt while closed', () => {
  let sent;
  const mw = gate(OPEN, () => new Date('2026-10-03T16:00:00Z')); // closed in Manila
  mw({ originalUrl: '/api/v1/health' }, { status: () => ({ json: () => {} }) }, () => { sent = 'next'; });
  assert.equal(sent, 'next');
});

test('gate: 423 + friendly message when closed', () => {
  let statusCode, body, calledNext = false;
  const mw = gate(OPEN, () => new Date('2026-10-03T16:00:00Z'));
  const res = {
    status: (code) => { statusCode = code; return { json: (b) => { body = b; } }; },
  };
  mw({ originalUrl: '/api/v1/students?q=1' }, res, () => { calledNext = true; });
  assert.equal(statusCode, 423);
  assert.match(body.error, /currently closed/);
  assert.equal(body.code, 'SYSTEM_CLOSED');
  assert.equal(calledNext, false);
});

test('gate: passes through while open', () => {
  let calledNext = false;
  const mw = gate(OPEN, () => new Date('2026-10-03T22:00:00Z')); // 06:00 Manila
  mw({ originalUrl: '/api/v1/students' }, { status: () => ({ json: () => {} }) }, () => { calledNext = true; });
  assert.equal(calledNext, true);
});