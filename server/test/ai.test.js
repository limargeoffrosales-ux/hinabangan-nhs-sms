// Sanitizer unit tests — pure logic, no DB, no network.
'use strict';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cleanUpMarkdown } = require('../src/ai');

test('cleanUpMarkdown: strips bold/italic/underline emphasis', () => {
  assert.equal(cleanUpMarkdown('**bold**'), 'bold');
  assert.equal(cleanUpMarkdown('the **fastest** way'), 'the fastest way');
  assert.equal(cleanUpMarkdown('***both***'), 'both');
  assert.equal(cleanUpMarkdown('*italic* word'), 'italic word');
  assert.equal(cleanUpMarkdown('__under__'), 'under');
  assert.equal(cleanUpMarkdown('_under_'), 'under');
});

test('cleanUpMarkdown: preserves arithmetic and identifiers', () => {
  assert.equal(cleanUpMarkdown('5 * 3 = 15'), '5 * 3 = 15');
  assert.equal(cleanUpMarkdown('5*3=15'), '5*3=15');
  assert.equal(cleanUpMarkdown('x_1 and a_b stay'), 'x_1 and a_b stay');
});

test('cleanUpMarkdown: removes headings, blockquotes, backticks, bullets', () => {
  assert.equal(cleanUpMarkdown('### Heading here'), 'Heading here');
  assert.equal(cleanUpMarkdown('> quoted line'), 'quoted line');
  assert.equal(cleanUpMarkdown('use `softcopy` now'), 'use softcopy now');
  assert.equal(cleanUpMarkdown('- first\n- second'), '- first\n- second');
});

test('cleanUpMarkdown: cleans JSON string values, not JSON syntax', () => {
  const input = '{\n  "risk_level": "**high**",\n  "reasoning": "ok"\n}';
  const out = cleanUpMarkdown(input);
  assert.ok(!out.includes('**'));
  assert.ok(out.includes('"risk_level": "high"'));
  assert.ok(out.includes('"reasoning": "ok"'));
});

test('cleanUpMarkdown: drops stray leftover asterisk runs', () => {
  assert.ok(!cleanUpMarkdown('**Important ** trailing').includes('*'));
  assert.ok(!cleanUpMarkdown('no ** here ** ok').includes('**'));
});

test('cleanUpMarkdown: null/empty are passthrough', () => {
  assert.equal(cleanUpMarkdown(null), null);
  assert.equal(cleanUpMarkdown(''), '');
  assert.equal(cleanUpMarkdown('plain text, no markers'), 'plain text, no markers');
});