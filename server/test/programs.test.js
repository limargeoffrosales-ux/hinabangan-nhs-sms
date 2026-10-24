// Unit suite for the AI Teacher Programs CLI's deterministic core
// (scheduler occupancy + validation). No DB, no network — pure logic.
'use strict';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  makeScheduler,
  placeAssignment,
  buildRoomPool,
  toConflictRow,
  DEFAULT_TIMES,
} = require('../src/generate-programs');
const { findConflicts } = require('../src/schedule');

function asg(over) {
  return Object.assign({
    id: 1,
    section_id: 1,
    combined_section_id: null,
    subject_id: 10,
    teacher_id: 7,
    duration_minutes: 60,
    meetings_per_week: 2,
    room: 'Rm 1',
    teacher_room: null,
    section_room: null,
    section_name: 'STEM 12-A',
    subject_code: 'MATH',
    subject_title: 'General Mathematics',
    grade_level: 'Grade 12',
    teacher_name: 'Grace Hopper',
    fixed_day: null,
    fixed_start_time: null,
  }, over);
}

test('placeAssignment: accepts AI meetings that satisfy the meetings-per-week need', () => {
  const s = makeScheduler([]);
  const fails = placeAssignment(asg({ id: 1, meetings_per_week: 2 }), [
    { day: 1, start_time: '07:00', end_time: '08:00', room: 'Rm 1' },
    { day: 3, start_time: '07:00', end_time: '08:00', room: 'Rm 1' },
    { day: 5, start_time: '07:00', end_time: '08:00', room: 'Rm 1' },
  ], DEFAULT_TIMES, ['Rm 1'], s);
  assert.equal(fails.length, 0);
  const rows = s.rows.filter((r) => r.assignment_id === 1);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.day).sort(), [1, 3]);
});

test('placeAssignment: drops a meeting that double-books the same teacher', () => {
  const s = makeScheduler([]);
  const failsA = placeAssignment(asg({ id: 1, teacher_id: 7, section_id: 1, meetings_per_week: 1 }), [
    { day: 1, start_time: '07:00', end_time: '08:00', room: 'Rm 1' },
  ], DEFAULT_TIMES, ['Rm 1'], s);
  assert.equal(failsA.length, 0);
  const failsB = placeAssignment(asg({ id: 2, teacher_id: 7, section_id: 2, meetings_per_week: 1 }), [
    { day: 1, start_time: '07:00', end_time: '08:00', room: 'Rm 2' },
  ], DEFAULT_TIMES, ['Rm 1', 'Rm 2'], s);
  assert.equal(failsB.length, 1);
  assert.equal(failsB[0].reason, 'teacher');
  assert.equal(failsB[0].placed, 0);
});

test('placeAssignment: rejects meetings at wrong duration or outside the school window', () => {
  const s = makeScheduler([]);
  const fails = placeAssignment(asg({ id: 1, meetings_per_week: 3 }), [
    { day: 1, start_time: '07:00', end_time: '08:30', room: 'Rm 1' },
    { day: 2, start_time: '11:30', end_time: '12:30', room: 'Rm 1' },
    { day: 3, start_time: '15:00', end_time: '16:00', room: 'Rm 1' },
  ], DEFAULT_TIMES, ['Rm 1'], s);
  assert.equal(fails.length, 1);
  assert.equal(s.rows.filter((r) => r.assignment_id === 1).length, 1);
  const rows = s.rows.filter((r) => r.assignment_id === 1);
  assert.equal(rows[0].day, 3);
});

test('placeAssignment: honors a pinned day + time', () => {
  const s = makeScheduler([]);
  const fails = placeAssignment(asg({ id: 1, meetings_per_week: 2, fixed_day: 1, fixed_start_time: '08:00' }), [
    { day: 1, start_time: '08:00', end_time: '09:00', room: 'Rm 9' },
    { day: 2, start_time: '08:00', end_time: '09:00', room: 'Rm 9' },
  ], DEFAULT_TIMES, ['Rm 9'], s);
  assert.equal(fails.length, 0);
  const rows = s.rows.filter((r) => r.assignment_id === 1);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].day, 1);
  assert.equal(rows[0].start_time, '08:00');
});

test('placeAssignment: pinned Monday-to-Friday spreads one meeting per weekday', () => {
  const s = makeScheduler([]);
  const fails = placeAssignment(asg({ id: 1, meetings_per_week: 5, fixed_day: 0, fixed_start_time: '13:30' }), [], DEFAULT_TIMES, [], s);
  assert.equal(fails.length, 0);
  const rows = s.rows.filter((r) => r.assignment_id === 1);
  assert.equal(rows.length, 5);
  assert.deepEqual(rows.map((r) => r.day), [1, 2, 3, 4, 5]);
  assert.ok(rows.every((r) => r.start_time === '13:30' && r.end_time === '14:30'));
});

test('placeAssignment: a combined section blocks its sections from overlap', () => {
  const s = makeScheduler([]);
  const a1 = asg({ id: 1, section_id: 1, combined_section_id: 2, teacher_id: 7, meetings_per_week: 1 });
  const a2 = asg({ id: 2, section_id: 2, combined_section_id: null, teacher_id: 8, meetings_per_week: 1 });
  assert.equal(placeAssignment(a1, [{ day: 1, start_time: '07:00', end_time: '08:00', room: 'Rm 1' }], DEFAULT_TIMES, ['Rm 1'], s).length, 0);
  const fails = placeAssignment(a2, [{ day: 1, start_time: '07:00', end_time: '08:00', room: 'Rm 2' }], DEFAULT_TIMES, ['Rm 2'], s);
  assert.equal(fails.length, 1);
  assert.equal(fails[0].reason, 'section');
});

test('placeAssignment: falls back through the room pool when the primary room is taken', () => {
  const s = makeScheduler([]);
  const a1 = asg({ id: 1, teacher_id: 7, section_id: 1, meetings_per_week: 1 });
  const a2 = asg({ id: 2, teacher_id: 8, section_id: 2, meetings_per_week: 1 });
  assert.equal(placeAssignment(a1, [{ day: 1, start_time: '07:00', end_time: '08:00', room: 'Rm 1' }], DEFAULT_TIMES, ['Rm 1', 'Rm 2'], s).length, 0);
  assert.equal(placeAssignment(a2, [{ day: 1, start_time: '07:00', end_time: '08:00', room: 'Rm 1' }], DEFAULT_TIMES, ['Rm 1', 'Rm 2'], s).length, 0);
  const rows = s.rows.filter((r) => r.assignment_id === 2);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].room, 'Rm 2');
});

test('makeScheduler: seeded existing rows keep new placements conflict-free (partial regenerate)', () => {
  const existing = [{
    section_id: 3,
    combined_section_id: null,
    teacher_id: 9,
    day: 2,
    start_time: '09:00',
    end_time: '10:00',
    room: 'Lab 1',
  }];
  const s = makeScheduler(existing);
  const fails = placeAssignment(asg({ id: 5, teacher_id: 7, section_id: 1, meetings_per_week: 1, room: 'Lab 1' }), [
    { day: 2, start_time: '09:00', end_time: '10:00', room: 'Lab 1' },
  ], DEFAULT_TIMES, [], s);
  assert.equal(fails.length, 1);
  assert.equal(fails[0].reason, 'room');
});

test('placeAssignment: duration mismatch is an AI-level rejection', () => {
  const s = makeScheduler([]);
  const fails = placeAssignment(asg({ id: 1, meetings_per_week: 1, duration_minutes: 90 }), [
    { day: 1, start_time: '07:00', end_time: '08:00', room: 'Rm 1' },
  ], DEFAULT_TIMES, ['Rm 1'], s);
  assert.equal(fails.length, 1);
  assert.equal(fails[0].reason, 'ai');
});

test('without conflicts: a fully placed program passes findConflicts', () => {
  const s = makeScheduler([]);
  const defs = [
    asg({ id: 1, teacher_id: 7, section_id: 1, meetings_per_week: 2 }),
    asg({ id: 2, teacher_id: 8, section_id: 2, meetings_per_week: 2 }),
  ];
  const ai = {
    1: [
      { day: 1, start_time: '07:00', end_time: '08:00', room: 'Rm 1' },
      { day: 3, start_time: '07:00', end_time: '08:00', room: 'Rm 1' },
    ],
    2: [
      { day: 2, start_time: '07:00', end_time: '08:00', room: 'Rm 1' },
      { day: 4, start_time: '07:00', end_time: '08:00', room: 'Rm 1' },
    ],
  };
  for (const d of defs) placeAssignment(d, ai[d.id], DEFAULT_TIMES, ['Rm 1'], s);
  const rows = s.rows.filter((r) => r.assignment_id !== undefined);
  assert.equal(rows.length, 4);
  assert.equal(findConflicts(rows.map(toConflictRow)).length, 0);
});

test('buildRoomPool: union of preferred rooms across assignments', () => {
  const pool = buildRoomPool([
    asg({ room: 'Rm 1', teacher_room: 'T-OFFICE', section_room: null }),
    asg({ room: 'Rm 1', teacher_room: null, section_room: 'Lab 2' }),
    asg({ room: '', teacher_room: '', section_room: 'Rm 1' }),
  ]);
  assert.deepEqual(pool.sort(), ['Lab 2', 'Rm 1', 'T-OFFICE']);
});