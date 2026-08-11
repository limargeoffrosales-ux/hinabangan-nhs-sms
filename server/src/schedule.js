const { qa, qi, qr } = require('./db');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DEFAULT_DAY = { start: '07:00', end: '17:00', lunchStart: '12:00', lunchEnd: '13:00' };

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

function effectiveRoom(a) {
  return a.room || a.section_room || (a.section_name ? `${a.section_name} Rm` : `Rm ${a.section_id}`);
}

function loadAssignments(schoolYear) {
  return qa(
    `SELECT ca.*, s.title AS subject_title, s.code AS subject_code, s.units,
            sec.name AS section_name, sec.grade_level, sec.strand, sec.room AS section_room,
            t.first_name || ' ' || t.last_name AS teacher_name
     FROM class_assignments ca
     JOIN sections sec ON sec.id = ca.section_id
     JOIN subjects s ON s.id = ca.subject_id
     LEFT JOIN teachers t ON t.id = ca.teacher_id
     WHERE ca.school_year = ?
     ORDER BY sec.grade_level, sec.name, s.title`,
    [schoolYear]
  );
}

function findConflicts(rows) {
  const conflicts = [];
  const groups = { section: {}, teacher: {}, room: {} };
  for (const r of rows) {
    const st = toMin(r.start_time);
    const en = toMin(r.end_time);
    const keys = {
      section: `${r.day}|${r.section_id}`,
      teacher: r.teacher_id ? `${r.day}|${r.teacher_id}` : null,
      room: r.room ? `${r.day}|${r.room.toUpperCase()}` : null,
    };
    for (const type of Object.keys(keys)) {
      const k = keys[type];
      if (!k) continue;
      const list = (groups[type][k] = groups[type][k] || []);
      for (const other of list) {
        if (overlaps(st, en, other.start, other.end)) {
          conflicts.push({
            type,
            day: r.day,
            day_name: DAYS[r.day - 1],
            time: `${r.start_time}–${r.end_time}`,
            section: r.section_name,
            subject: r.subject_code,
            teacher: r.teacher_name,
            room: r.room,
            other_section: other.section_name,
            other_subject: other.subject_code,
            other_teacher: other.teacher_name,
          });
        }
      }
      list.push({ start: st, end: en, section_name: r.section_name, subject_code: r.subject_code, teacher_name: r.teacher_name });
    }
  }
  return conflicts;
}

async function generateSchedule(schoolYear, options = {}) {
  const day = Object.assign({}, DEFAULT_DAY, options);
  const dayStart = toMin(day.start);
  const dayEnd = toMin(day.end);
  const lunchStart = toMin(day.lunchStart);
  const lunchEnd = toMin(day.lunchEnd);

  const assignments = await loadAssignments(schoolYear);
  if (!assignments.length) throw new Error('No class assignments found for this school year');

  const starts = [];
  for (let t = dayStart; t <= dayEnd; t += 30) starts.push(t);

  const sorted = assignments.slice().sort((a, b) =>
    (b.meetings_per_week - a.meetings_per_week) ||
    (b.duration_minutes - a.duration_minutes) ||
    a.section_id - b.section_id);

  await qr('DELETE FROM schedule_entries WHERE school_year = ?', [schoolYear]);

  const entries = [];
  const occupied = { section: {}, teacher: {}, room: {} };
  const failures = [];
  const keyFor = (kind, id) => `${kind}|${id}`;
  const isFree = (dayIdx, st, en, a) => {
    const room = effectiveRoom(a).toUpperCase();
    const sec = keyFor('section', a.section_id);
    const tea = a.teacher_id ? keyFor('teacher', a.teacher_id) : null;
    const rm = keyFor('room', room);
    const busy = (kind, k) => (occupied[kind][`${dayIdx}|${k}`] || []).some((x) => overlaps(st, en, x[0], x[1]));
    if (busy('section', sec)) return false;
    if (tea && busy('teacher', tea)) return false;
    if (busy('room', rm)) return false;
    return true;
  };
  const occupy = (dayIdx, st, en, a) => {
    const room = effectiveRoom(a).toUpperCase();
    for (const kind of ['section', 'teacher', 'room']) {
      let k = kind === 'section' ? keyFor('section', a.section_id) : kind === 'teacher' ? keyFor('teacher', a.teacher_id) : keyFor('room', room);
      if (!k) continue;
      (occupied[kind][`${dayIdx}|${k}`] = occupied[kind][`${dayIdx}|${k}`] || []).push([st, en]);
    }
  };

  let seedDay = 0;
  for (const a of sorted) {
    const dur = a.duration_minutes || 60;
    const need = a.meetings_per_week || 1;
    let placed = 0;
    const rotated = Array.from({ length: 5 }, (_, i) => (seedDay + i) % 5);
    seedDay = (seedDay + 1) % 5;
    for (const dayIdx of rotated) {
      if (placed >= need) break;
      for (const st of starts) {
        const en = st + dur;
        if (en > dayEnd) continue;
        if (st < lunchEnd && en > lunchStart) continue;
        if (!isFree(dayIdx, st, en, a)) continue;
        const room = effectiveRoom(a);
        const id = await qi(
          `INSERT INTO schedule_entries (school_year, section_id, subject_id, teacher_id, day, start_time, end_time, room)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [schoolYear, a.section_id, a.subject_id, a.teacher_id, dayIdx + 1, toHM(st), toHM(en), room]);
        entries.push({
          id, section_id: a.section_id, subject_id: a.subject_id, teacher_id: a.teacher_id,
          day: dayIdx + 1, start_time: toHM(st), end_time: toHM(en), room,
          section_name: a.section_name, subject_code: a.subject_code, subject_title: a.subject_title,
          teacher_name: a.teacher_name,
        });
        occupy(dayIdx, st, en, a);
        placed++;
        break;
      }
    }
    if (placed < need) {
      failures.push({
        section: a.section_name, subject: a.subject_code, teacher: a.teacher_name,
        duration_minutes: dur, meetings_per_week: need, placed,
      });
    }
  }

  const stored = await qa(
    `SELECT e.*, sec.name AS section_name, s.code AS subject_code,
            t.first_name || ' ' || t.last_name AS teacher_name
     FROM schedule_entries e
     JOIN sections sec ON sec.id = e.section_id
     JOIN subjects s ON s.id = e.subject_id
     LEFT JOIN teachers t ON t.id = e.teacher_id
     WHERE e.school_year = ? ORDER BY e.section_id, e.day, e.start_time`,
    [schoolYear]
  );
  const conflicts = findConflicts(stored);

  return { generated: entries.length, assignments: assignments.length, failures, conflicts, days: DAYS };
}

module.exports = { generateSchedule, findConflicts, loadAssignments, DAYS };