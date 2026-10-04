#!/usr/bin/env node
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-cli-secret-program-generator';

const fs = require('fs');
const path = require('path');
const db = require('./db');
const ai = require('./ai');
const { loadAssignments, findConflicts } = require('./schedule');
const { getCurrentSchoolYear } = require('./schoolYear');

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TIME_RE = /^(([01]\d|2[0-3]):[0-5]\d)$/;
const DEFAULT_TIMES = {
  start: '07:00',
  end: '17:00',
  lunch_start: '12:00',
  lunch_end: '13:00',
  recess_start: '10:00',
  recess_end: '10:30',
};

function toMin(t) {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + m;
}

function toHM(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function overlaps(a1, a2, b1, b2) {
  return a1 < b2 && b1 < a2;
}

function parseArgs(argv) {
  const args = { times: {} };
  const set = (k, v) => {
    switch (k) {
      case 'school-year': args.schoolYear = v; break;
      case 'teacher': args.teacher = Number(v); break;
      case 'start': case 'end': case 'lunch-start': case 'lunch-end':
      case 'recess-start': case 'recess-end': args.times[k] = v; break;
      case 'provider': args.provider = v; break;
      case 'model': args.model = v; break;
      case 'output': args.output = v; break;
      case 'dry-run': args.dryRun = true; break;
      case 'json': args.json = true; break;
      case 'help': args.help = true; break;
      default: console.error(`Unknown option: --${k}`); args.help = true;
    }
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      const k = eq >= 0 ? a.slice(2, eq) : a.slice(2);
      const v = eq >= 0 ? a.slice(eq + 1) : (i + 1 < argv.length && !argv[i + 1].startsWith('--') ? argv[++i] : '');
      set(k, v);
    }
  }
  return args;
}

const USAGE = `Auto AI-powered Teacher Programs generator.

Usage: node src/generate-programs.js [options]

Options:
  --school-year <SY>      School year (default: active school year setting)
  --teacher <id>          Only generate for one teacher id (others are left untouched)
  --start HH:MM           First class of the day (default 07:00)
  --end HH:MM             Last class of the day (default 17:00)
  --lunch-start HH:MM     Lunch start (default 12:00)
  --lunch-end HH:MM       Lunch end (default 13:00)
  --recess-start HH:MM    Recess start (default 10:00)
  --recess-end HH:MM      Recess end (default 10:30)
  --provider <name>       AI provider (openai | groq | ollama | hf)
  --model <name>          AI model to use
  --dry-run               Validate the AI-drafted program but do NOT write it
  --output <file>         Write the full program JSON to a file
  --json                  Print machine-readable JSON summary
  --help                  Show this help

Requires GROQ_API_KEY (default provider) or AI_PROVIDER + its key.`;

function validTimes(times) {
  const keys = ['start', 'end', 'lunch_start', 'lunch_end', 'recess_start', 'recess_end'];
  for (const k of keys) {
    const v = times[k];
    if (v !== undefined && v !== null && v !== '' && !TIME_RE.test(String(v).trim())) {
      return `--${k.replace(/_/g, '-')} must be a valid HH:MM time`;
    }
  }
  if (times.start && times.end && toMin(times.start) >= toMin(times.end)) return '--start must be before --end';
  if (times.lunch_start && times.lunch_end && toMin(times.lunch_start) >= toMin(times.lunch_end)) return '--lunch-start must be before --lunch-end';
  if (times.recess_start && times.recess_end && toMin(times.recess_start) >= toMin(times.recess_end)) return '--recess-start must be before --recess-end';
  return null;
}

function extractJson(text) {
  if (!text) return null;
  if (typeof text !== 'string') return text;
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s === -1 || e === -1 || e <= s) return null;
  try { return JSON.parse(text.slice(s, e + 1)); } catch { return null; }
}

function groupByTeacher(assignments) {
  const map = new Map();
  for (const a of assignments) {
    const key = a.teacher_id == null ? 'unassigned' : String(a.teacher_id);
    if (!map.has(key)) {
      map.set(key, {
        id: a.teacher_id == null ? null : Number(a.teacher_id),
        name: a.teacher_name || 'Unassigned (auto)',
        room: a.teacher_room || null,
        assignments: [],
      });
    }
    map.get(key).assignments.push(a);
  }
  const groups = [...map.values()].sort((a, b) => {
    if (a.id == null && b.id == null) return a.name.localeCompare(b.name);
    if (a.id == null) return 1;
    if (b.id == null) return -1;
    return a.name.localeCompare(b.name);
  });
  for (const g of groups) {
    g.assignments.sort((x, y) =>
      (parseInt(x.grade_level, 10) || 0) - (parseInt(y.grade_level, 10) || 0) ||
      String(x.section_name).localeCompare(String(y.section_name)) ||
      String(x.subject_code).localeCompare(String(y.subject_code)));
  }
  return groups;
}

function buildRoomPool(assignments) {
  return [...new Set(assignments.flatMap((a) => [a.room, a.teacher_room, a.section_room].filter(Boolean)))];
}

function makeScheduler(existingRows) {
  const occ = { section: {}, teacher: {}, room: {} };
  const occupy = (kind, dayIdx, key, st, en) => {
    const k = `${dayIdx}|${key}`;
    (occ[kind][k] = occ[kind][k] || []).push([st, en]);
  };
  for (const r of existingRows) {
    const st = toMin(r.start_time);
    const en = toMin(r.end_time);
    for (const id of [r.section_id, r.combined_section_id].filter(Boolean)) occupy('section', r.day, Number(id), st, en);
    if (r.teacher_id != null) occupy('teacher', r.day, Number(r.teacher_id), st, en);
    if (r.room) occupy('room', r.day, String(r.room).toUpperCase(), st, en);
  }
  return {
    rows: existingRows.slice(),
    occ,
    occupy,
    busy(kind, dayIdx, key, st, en) {
      return (occ[kind][`${dayIdx}|${key}`] || []).some(([x0, x1]) => overlaps(st, en, x0, x1));
    },
  };
}

function toConflictRow(e) {
  return {
    section_id: e.section_id,
    combined_section_id: e.combined_section_id || null,
    subject_id: e.subject_id,
    teacher_id: e.teacher_id || null,
    day: e.day,
    start_time: e.start_time,
    end_time: e.end_time,
    room: e.room || null,
    section_name: e.section_name || '',
    combined_section_name: e.combined_section_name || null,
    subject_code: e.subject_code || '',
    teacher_name: e.teacher_name || '',
  };
}

function placeAssignment(a, aiMeetings, dayTimes, roomPool, scheduler) {
  const s0 = toMin(dayTimes.start);
  const s1 = toMin(dayTimes.end);
  const l0 = dayTimes.lunch_start ? toMin(dayTimes.lunch_start) : -1;
  const l1 = dayTimes.lunch_end ? toMin(dayTimes.lunch_end) : -1;
  const r0 = dayTimes.recess_start ? toMin(dayTimes.recess_start) : -1;
  const r1 = dayTimes.recess_end ? toMin(dayTimes.recess_end) : -1;
  const dur = Number(a.duration_minutes) || 60;
  const need = Number(a.meetings_per_week) || 1;
  const sectionIds = [Number(a.section_id)];
  if (a.combined_section_id) sectionIds.push(Number(a.combined_section_id));
  const teacherKey = a.teacher_id != null ? Number(a.teacher_id) : null;
  const prefs = [...new Set([a.room, a.teacher_room, a.section_room].filter(Boolean))];

  const reasons = { ai: 0, time: 0, section: 0, teacher: 0, room: 0, pinned: 0 };
  const slotOk = (st, en) =>
    st >= s0 && en <= s1 &&
    !(st < l1 && en > l0) &&
    !(st < r1 && en > r0);

  const firstFreeRoom = (st, en, dayIdx, hints) => {
    const candidates = [];
    for (const p of hints) {
      if (p && !candidates.some((x) => x.toUpperCase() === p.toUpperCase())) candidates.push(String(p).trim());
    }
    for (const r of roomPool) {
      if (!candidates.some((x) => x.toUpperCase() === r.toUpperCase())) candidates.push(r);
    }
    if (!candidates.length) candidates.push(`${a.section_name || 'Section'} Rm`);
    for (const room of candidates) {
      if (!scheduler.busy('room', dayIdx, room.toUpperCase(), st, en)) return room;
    }
    return candidates[0];
  };

  const tryAccept = (day, startTime, endTime, roomHint, isPinned) => {
    if (!Number.isInteger(day) || day < 1 || day > 5) { reasons.ai += 1; return false; }
    if (!TIME_RE.test(String(startTime)) || !TIME_RE.test(String(endTime))) { reasons.ai += 1; return false; }
    const st = toMin(startTime);
    const en = toMin(endTime);
    if (en - st !== dur) { reasons.ai += 1; return false; }
    if (!slotOk(st, en)) { if (isPinned) reasons.pinned += 1; else reasons.time += 1; return false; }
    if (sectionIds.some((id) => scheduler.busy('section', day, id, st, en))) { if (isPinned) reasons.pinned += 1; else reasons.section += 1; return false; }
    if (teacherKey != null && scheduler.busy('teacher', day, teacherKey, st, en)) { if (isPinned) reasons.pinned += 1; else reasons.teacher += 1; return false; }
    const room = firstFreeRoom(st, en, day, [roomHint ? String(roomHint).trim() : null, ...prefs]);
    if (scheduler.busy('room', day, room.toUpperCase(), st, en)) { if (isPinned) reasons.pinned += 1; else reasons.room += 1; return false; }
    for (const id of sectionIds) scheduler.occupy('section', day, id, st, en);
    if (teacherKey != null) scheduler.occupy('teacher', day, teacherKey, st, en);
    scheduler.occupy('room', day, room.toUpperCase(), st, en);
    scheduler.rows.push({
      assignment_id: a.id,
      section_id: a.section_id,
      combined_section_id: a.combined_section_id || null,
      subject_id: a.subject_id,
      teacher_id: a.teacher_id || null,
      assignment: a,
      day,
      start_time: toHM(st),
      end_time: toHM(en),
      room,
      section_name: a.section_name,
      combined_section_name: a.combined_section_name || null,
      subject_code: a.subject_code,
      teacher_name: a.teacher_name || '',
    });
    return true;
  };

  const candidates = [];
  if (a.fixed_day != null && a.fixed_start_time != null) {
    if (Number(a.fixed_day) === 0) {
      for (let d = 1; d <= 5 && candidates.length < need; d++) {
        const st = toMin(a.fixed_start_time);
        candidates.push({ day: d, start_time: a.fixed_start_time, end_time: toHM(st + dur), room: a.room || null, pinned: true });
      }
    } else {
      const st = toMin(a.fixed_start_time);
      candidates.push({ day: Number(a.fixed_day), start_time: a.fixed_start_time, end_time: toHM(st + dur), room: a.room || null, pinned: true });
    }
  }
  for (const m of aiMeetings) {
    if (candidates.length >= need) break;
    const clashingPin = candidates.some((c) => c.pinned && c.day === Number(m.day) && toMin(c.start_time) === toMin(m.start_time));
    if (clashingPin) continue;
    candidates.push({ day: Number(m.day), start_time: String(m.start_time), end_time: String(m.end_time), room: m.room ? String(m.room).trim() : null, pinned: false });
  }

  const accepted = [];
  for (const c of candidates) {
    if (accepted.length >= need) break;
    if (tryAccept(c.day, c.start_time, c.end_time, c.room, c.pinned)) accepted.push(c);
  }

  const failures = [];
  if (accepted.length < need) {
    const top = Object.entries(reasons).filter(([, n]) => n > 0).sort((x, y) => y[1] - x[1])[0];
    failures.push({
      assignment_id: a.id,
      section: a.section_name,
      subject: a.subject_code,
      teacher: a.teacher_name || 'Unassigned',
      required: need,
      placed: accepted.length,
      reasons,
      reason: top ? top[0] : 'none',
    });
  }
  return failures;
}

async function generateGroup(group, scheduler, dayTimes, roomPool, log) {
  // Local failure list for this teacher. When the AI returns unusable output we
  // mark every one of the teacher's assignments failed and bail out.
  const failures = [];
  const placed = scheduler.rows.filter((r) => r.assignment_id !== undefined).map((r) => ({
    day: r.day,
    start_time: r.start_time,
    end_time: r.end_time,
    room: r.room,
    section_name: r.section_name,
    combined_section_name: r.combined_section_name,
    subject_code: r.subject_code,
    teacher_name: r.teacher_name,
  }));

  const data = await ai.generateTeacherProgram({
    teacher: { name: group.name, room: group.room },
    assignments: group.assignments,
    placed,
    day: dayTimes,
  });

  let meetings = Array.isArray(data?.meetings) ? data.meetings : null;
  if (!meetings) meetings = extractJson(data?.raw || data);
  if (!Array.isArray(meetings)) {
    for (const a of group.assignments) {
      failures.push({
        assignment_id: a.id,
        section: a.section_name,
        subject: a.subject_code,
        teacher: group.name,
        required: a.meetings_per_week,
        placed: 0,
        reasons: { ai: 'AI did not return a valid program JSON' },
        reason: 'ai',
      });
    }
    log('  ! AI returned unparseable output for this teacher - all assignments marked failed.');
    return failures;
  }

  const byId = new Map(group.assignments.map((a) => [Number(a.id), a]));
  for (const m of meetings) {
    const id = Number(m && m.id);
    if (!byId.has(id)) continue;
    byId.get(id)._ai = byId.get(id)._ai || [];
    byId.get(id)._ai.push({ day: m.day, start_time: m.start_time, end_time: m.end_time, room: m.room });
  }

  let placedCount = 0;
  const groupFailures = [];
  for (const a of group.assignments) {
    const before = scheduler.rows.length;
    groupFailures.push(...placeAssignment(a, byId.get(Number(a.id))._ai || [], dayTimes, roomPool, scheduler));
    if (scheduler.rows.length > before) placedCount += scheduler.rows.length - before;
  }
  log(`  placed ${placedCount} meeting(s), ${groupFailures.length}/${group.assignments.length} assignment(s) failed`);
  return groupFailures;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(USAGE);
    process.exit(0);
  }
  const bad = validTimes(args.times);
  if (bad) {
    console.error(`Error: ${bad}`);
    process.exit(1);
  }
  const dayTimes = Object.assign({}, DEFAULT_TIMES, args.times);

  await db.init();
  const schoolYear = args.schoolYear || (await getCurrentSchoolYear());
  if (args.provider) process.env.AI_PROVIDER = args.provider;
  if (args.model) process.env.AI_MODEL = args.model;

  if (!ai.isEnabled()) {
    console.error('AI is not configured. Set GROQ_API_KEY (free) or AI_PROVIDER + its provider key (see server/src/ai.js).');
    process.exit(1);
  }

  const info = ai.getProviderInfo();
  const log = (msg) => { if (!args.json) console.log(msg); };

  log('Auto AI Teacher Programs generator');
  log(`  school year : ${schoolYear}`);
  log(`  dialect     : ${db.dialect}`);
  log(`  AI provider : ${info.provider} (${info.model})`);
  if (args.dryRun) log('  mode        : DRY-RUN - nothing will be written');
  if (args.teacher) log(`  scope       : teacher ${args.teacher} only`);

  const assignments = await loadAssignments(schoolYear);
  if (!assignments.length) {
    console.error('No class assignments found for this school year. Add subject assignments first (Teacher Programs page).');
    process.exit(1);
  }
  const onlyTeacher = args.teacher ? Number(args.teacher) : null;
  const scopeAssignments = onlyTeacher ? assignments.filter((a) => Number(a.teacher_id) === onlyTeacher) : assignments;
  if (!scopeAssignments.length) {
    console.error(`No class assignments found for teacher id ${onlyTeacher} in ${schoolYear}.`);
    process.exit(1);
  }

  const roomPool = buildRoomPool(assignments);
  const groups = groupByTeacher(scopeAssignments);

  let existingRows = [];
  if (onlyTeacher) {
    existingRows = await db.qa(
      `SELECT e.*, sec.name AS section_name, s.code AS subject_code,
              csec.name AS combined_section_name,
              t.first_name || ' ' || t.last_name AS teacher_name
       FROM schedule_entries e
       JOIN sections sec ON sec.id = e.section_id
       JOIN subjects s ON s.id = e.subject_id
       LEFT JOIN sections csec ON csec.id = e.combined_section_id
       LEFT JOIN teachers t ON t.id = e.teacher_id
       WHERE e.school_year = ?`, [schoolYear]);
    existingRows = existingRows.filter((r) => Number(r.teacher_id) !== onlyTeacher);
  }

  const scheduler = makeScheduler(existingRows);
  const failures = [];
  log(`Generating programs for ${groups.length} teacher group(s)...`);
  for (const group of groups) {
    log(`> ${group.name}${group.room ? ` (${group.room})` : ''} - ${group.assignments.length} assignment(s)`);
    failures.push(...await generateGroup(group, scheduler, dayTimes, roomPool, log));
    log('');
  }

  const generatedRows = scheduler.rows.filter((r) => r.assignment_id !== undefined);
  const conflicts = findConflicts(generatedRows.map(toConflictRow));
  if (conflicts.length && !args.dryRun) {
    console.error(`\n${conflicts.length} conflict(s) detected after AI generation - nothing was written. Rerun with --dry-run for the report.`);
    if (args.json) console.log(JSON.stringify({ ok: false, schoolYear, conflicts, failures, generated: generatedRows.length }, null, 2));
    process.exit(2);
  }

  let written = 0;
  if (!args.dryRun) {
    await db.tx(async (conn) => {
      if (onlyTeacher) {
        await conn.qr('DELETE FROM schedule_entries WHERE school_year = ? AND teacher_id = ?', [schoolYear, onlyTeacher]);
      } else {
        await conn.qr('DELETE FROM schedule_entries WHERE school_year = ?', [schoolYear]);
      }
      for (const e of generatedRows) {
        await conn.run(
          `INSERT INTO schedule_entries (school_year, section_id, combined_section_id, subject_id, teacher_id, day, start_time, end_time, room)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [schoolYear, e.section_id, e.combined_section_id, e.subject_id, e.teacher_id, e.day, e.start_time, e.end_time, e.room]);
        written += 1;
      }
    });
  }

  const summary = {
    ok: failures.length === 0 && conflicts.length === 0,
    school_year: schoolYear,
    provider: info.provider,
    model: info.model,
    dry_run: !!args.dryRun,
    teachers: groups.length,
    assignments: scopeAssignments.length,
    generated: generatedRows.length,
    failed: failures.length,
    conflicts: conflicts.length,
  };

  if (args.output) {
    const out = { ...summary, day: dayTimes, entries: generatedRows, failures, conflicts };
    fs.writeFileSync(path.resolve(args.output), JSON.stringify(out, null, 2));
    log(`Full program JSON written to ${args.output}`);
  }

  if (args.json) {
    console.log(JSON.stringify({ ...summary, entries: generatedRows, failures, conflicts }, null, 2));
    return;
  }

  log('------------------------------------------------');
  log(`Generated  : ${generatedRows.length} meeting(s) across ${groups.length} teacher group(s)`);
  log(`Failed     : ${failures.length} assignment(s)`);
  log(`Conflicts  : ${conflicts.length}`);
  log(`Provider   : ${info.provider} / ${info.model}`);
  if (args.dryRun) log('DRY-RUN: the database was NOT modified. Rerun without --dry-run to save the program.');
  else log(`Saved ${written} meeting(s) to schedule_entries for ${schoolYear}.${onlyTeacher ? ` (teacher ${onlyTeacher} only; other teacher programs left untouched)` : ''}`);

  if (failures.length) {
    log('\nFailed assignments (placed < required meetings/wk):');
    for (const f of failures) {
      log(`  - ${f.section} - ${f.subject} (${f.teacher}): placed ${f.placed} of ${f.required}; blocker: ${f.reason || 'none'} (${JSON.stringify(f.reasons)})`);
    }
  }
  if (conflicts.length) {
    log('\nConflicts (would block saving):');
    for (const c of conflicts) log(`  - ${c.day_name} ${c.time} - ${c.section} (${c.subject}) vs ${c.other_section} (${c.other_subject}) [${c.type}]`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal:', err && err.message ? err.message : err);
    process.exit(1);
  });
}

module.exports = {
  toMin, toHM, overlaps, parseArgs, validTimes, extractJson, groupByTeacher,
  buildRoomPool, makeScheduler, placeAssignment, toConflictRow, DEFAULT_TIMES,
};