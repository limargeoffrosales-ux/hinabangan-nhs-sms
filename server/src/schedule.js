const { qa, tx } = require('./db');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DEFAULT_DAY = { start: '07:00', end: '17:00', lunchStart: '12:00', lunchEnd: '13:00', recessStart: '10:00', recessEnd: '10:30' };

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

function loadAssignments(schoolYear) {
  return qa(
    `SELECT ca.*, s.title AS subject_title, s.code AS subject_code, s.units,
            sec.name AS section_name, sec.grade_level, sec.strand, sec.room AS section_room,
            csec.name AS combined_section_name, csec.grade_level AS combined_grade_level,
            t.first_name || ' ' || t.last_name AS teacher_name,
            t.room AS teacher_room
     FROM class_assignments ca
     JOIN sections sec ON sec.id = ca.section_id
     JOIN subjects s ON s.id = ca.subject_id
     LEFT JOIN sections csec ON csec.id = ca.combined_section_id
     LEFT JOIN teachers t ON t.id = ca.teacher_id
     WHERE ca.school_year = ?
     ORDER BY sec.grade_level, sec.name, s.title`,
    [schoolYear]
  );
}

function findConflicts(rows) {
  const conflicts = [];
  const groups = { section: {}, teacher: {}, room: {} };
  const seen = new Set();
  for (const r of rows) {
    const st = toMin(r.start_time);
    const en = toMin(r.end_time);
    const sectionIds = [r.section_id, ...(r.combined_section_id ? [r.combined_section_id] : [])];
    const sectionNames = [r.section_name, ...(r.combined_section_id && r.combined_section_name ? [r.combined_section_name] : [])].join(' + ');
    const keys = {
      section: sectionIds.map((id) => `${r.day}|${id}`),
      teacher: r.teacher_id ? [`${r.day}|${r.teacher_id}`] : null,
      room: r.room ? [`${r.day}|${r.room.toUpperCase()}`] : null,
    };
    for (const type of Object.keys(keys)) {
      const arr = keys[type];
      if (!arr) continue;
      for (const k of arr) {
        const list = (groups[type][k] = groups[type][k] || []);
        for (const other of list) {
          if (overlaps(st, en, other.start, other.end)) {
            // The de-dup key must include the time window. Without it, two
            // genuinely different clashes between the same section/subject pair
            // on the same day (e.g. 07:00-08:00 and 09:00-10:00) produced an
            // identical key, so the second was swallowed as a "duplicate" and
            // the admin only ever saw one of them. Minutes (not the raw string)
            // are used so '7:00' and '07:00' still collapse.
            const pair = [
              type,
              r.day,
              [r.section_id, other.sectionIds[0]].sort((x, y) => Number(x) - Number(y)).join(','),
              [r.subject_id, other.subject_id].sort((x, y) => Number(x) - Number(y)).join(','),
              `${st}-${en}`,
            ].join('|');
            if (seen.has(pair)) continue;
            seen.add(pair);
            conflicts.push({
              type,
              day: r.day,
              day_name: DAYS[r.day - 1],
              time: `${r.start_time}–${r.end_time}`,
              section: sectionNames,
              ids: [...new Set([...sectionIds, ...(other.sectionIds || [])])],
              subject: r.subject_code,
              teacher: r.teacher_name,
              room: r.room,
              other_section: other.section_name,
              other_subject: other.subject_code,
              other_teacher: other.teacher_name,
            });
          }
        }
        list.push({ start: st, end: en, section_name: sectionNames, subject_code: r.subject_code, teacher_name: r.teacher_name, sectionIds });
      }
    }
  }
  return conflicts;
}

async function generateSchedule(schoolYear, options = {}) {
  const day = Object.assign({}, DEFAULT_DAY, Object.fromEntries(
    Object.entries(options).filter(([, v]) => v !== undefined && v !== null && v !== '')));
  const dayStart = toMin(day.start);
  const dayEnd = toMin(day.end);
  const lunchStart = toMin(day.lunchStart);
  const lunchEnd = toMin(day.lunchEnd);
  const recessStart = toMin(day.recessStart);
  const recessEnd = toMin(day.recessEnd);

  const assignments = await loadAssignments(schoolYear);
  if (!assignments.length) throw new Error('No class assignments found for this school year');

  const starts = [];
  for (let t = dayStart; t <= dayEnd; t += 30) starts.push(t);

  const sorted = assignments.slice().sort((a, b) =>
    (((b.duration_minutes || 60) * (b.meetings_per_week || 1)) - ((a.duration_minutes || 60) * (a.meetings_per_week || 1))) ||
    (b.meetings_per_week - a.meetings_per_week) ||
    (b.duration_minutes - a.duration_minutes) ||
    a.section_id - b.section_id);

  const occupied = { section: {}, teacher: {}, room: {} };
  const failures = [];
  const keyFor = (kind, id) => `${kind}|${String(id).toUpperCase()}`;
  const busy = (kind, dayIdx, id, st, en) =>
    (occupied[kind][`${dayIdx}|${keyFor(kind, id)}`] || []).some((x) => overlaps(st, en, x[0], x[1]));
  const occupy = (dayIdx, id, st, en, kind) => {
    const k = `${dayIdx}|${keyFor(kind, id)}`;
    (occupied[kind][k] = occupied[kind][k] || []).push([st, en]);
  };

  const roomPool = [...new Set(
    assignments.flatMap((a) => [a.room, a.teacher_room, a.section_room]).filter(Boolean)
  )];
  const roomsFor = (a) => {
    const prefs = [];
    for (const r of [a.room, a.teacher_room, a.section_room]) {
      if (r && !prefs.some((p) => p.toUpperCase() === r.toUpperCase())) prefs.push(r);
    }
    return prefs.length ? prefs : (roomPool.length ? roomPool : [`${a.section_name || 'Section'} Rm`]);
  };

  const entries = [];
  let seedDay = 0;

  await tx(async (conn) => {
    await conn.run('DELETE FROM schedule_entries WHERE school_year = ?', [schoolYear]);

    for (const a of sorted) {
      const dur = a.duration_minutes || 60;
      const need = a.meetings_per_week || 1;
      const comboName = a.combined_section_id
        ? `${a.section_name} + ${a.combined_section_name || 'companion'}`
        : a.section_name;
      const secKeys = [`s${a.section_id}`];
      if (a.combined_section_id) secKeys.push(`s${a.combined_section_id}`);
      const teaKey = a.teacher_id ? `t${a.teacher_id}` : null;
      let placed = 0;
      const reasons = { teacher: 0, section: 0, room: 0, time: 0 };

      let pin = (a.fixed_day != null && a.fixed_start_time)
        ? { day: Number(a.fixed_day), start: String(a.fixed_start_time) } : null;
      if (pin && pin.day === 0) {
        const st = toMin(pin.start);
        const en = st + dur;
        const dayOrder = [1, 2, 3, 4, 5];
        for (let i = 0; i < 5 && placed < need; i++) {
          const d = dayOrder[(seedDay + i) % 5];
          const di = d - 1;
          let why = null;
          if (en > dayEnd) why = 'time';
          else if (st < lunchEnd && en > lunchStart) why = 'time';
          else if (st < recessEnd && en > recessStart) why = 'time';
          else if (secKeys.some((k) => busy('section', di, k, st, en))) why = 'section';
          else if (teaKey && busy('teacher', di, teaKey, st, en)) why = 'teacher';
          else if (!roomsFor(a).some((r) => !busy('room', di, r, st, en))) why = 'room';
          if (why) { reasons[why] += 1; continue; }
          const room = roomsFor(a).find((r) => !busy('room', di, r, st, en)) || roomsFor(a)[0];
          const id = await conn.runId(
            `INSERT INTO schedule_entries (school_year, section_id, combined_section_id, subject_id, teacher_id, day, start_time, end_time, room)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [schoolYear, a.section_id, a.combined_section_id || null, a.subject_id, a.teacher_id, d, toHM(st), toHM(en), room]);
          entries.push({
            id, section_id: a.section_id, combined_section_id: a.combined_section_id || null,
            subject_id: a.subject_id, teacher_id: a.teacher_id,
            day: d, start_time: toHM(st), end_time: toHM(en), room,
            section_name: comboName, subject_code: a.subject_code, subject_title: a.subject_title,
            teacher_name: a.teacher_name, pinned: true,
          });
          for (const k of secKeys) occupy(di, k, st, en, 'section');
          if (teaKey) occupy(di, teaKey, st, en, 'teacher');
          occupy(di, room, st, en, 'room');
          placed++;
        }
        seedDay = (seedDay + placed) % 5;
        pin = placed === 0 ? { day: dayOrder[seedDay], start: String(a.fixed_start_time) } : null;
      }
      if (pin) {
        const st = toMin(pin.start);
        const en = st + dur;
        const room = roomsFor(a)[0];
        const id = await conn.runId(
          `INSERT INTO schedule_entries (school_year, section_id, combined_section_id, subject_id, teacher_id, day, start_time, end_time, room)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [schoolYear, a.section_id, a.combined_section_id || null, a.subject_id, a.teacher_id, pin.day, toHM(st), toHM(en), room]);
        entries.push({
          id, section_id: a.section_id, combined_section_id: a.combined_section_id || null,
          subject_id: a.subject_id, teacher_id: a.teacher_id,
          day: pin.day, start_time: toHM(st), end_time: toHM(en), room,
          section_name: comboName, subject_code: a.subject_code, subject_title: a.subject_title,
          teacher_name: a.teacher_name, pinned: true,
        });
        for (const k of secKeys) occupy(pin.day - 1, k, st, en, 'section');
        if (teaKey) occupy(pin.day - 1, teaKey, st, en, 'teacher');
        occupy(pin.day - 1, room, st, en, 'room');
        placed = 1;
      }

      const rotated = Array.from({ length: 5 }, (_, i) => (seedDay + i) % 5);
      seedDay = (seedDay + 1) % 5;
      for (const dayIdx of rotated) {
        if (placed >= need) break;
        for (const st of starts) {
          const en = st + dur;
          let why = null;
          let room = null;
          if (en > dayEnd) why = 'time';
          else if (st < lunchEnd && en > lunchStart) why = 'time';
          else if (st < recessEnd && en > recessStart) why = 'time';
          else if (secKeys.some((k) => busy('section', dayIdx, k, st, en))) why = 'section';
          else if (teaKey && busy('teacher', dayIdx, teaKey, st, en)) why = 'teacher';
          else {
            room = roomsFor(a).find((r) => !busy('room', dayIdx, r, st, en));
            if (!room) why = 'room';
          }
          if (why) { reasons[why] += 1; continue; }
          const id = await conn.runId(
            `INSERT INTO schedule_entries (school_year, section_id, combined_section_id, subject_id, teacher_id, day, start_time, end_time, room)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [schoolYear, a.section_id, a.combined_section_id || null, a.subject_id, a.teacher_id, dayIdx + 1, toHM(st), toHM(en), room]);
          entries.push({
            id, section_id: a.section_id, combined_section_id: a.combined_section_id || null,
            subject_id: a.subject_id, teacher_id: a.teacher_id,
            day: dayIdx + 1, start_time: toHM(st), end_time: toHM(en), room,
            section_name: comboName, subject_code: a.subject_code, subject_title: a.subject_title,
            teacher_name: a.teacher_name,
          });
          for (const k of secKeys) occupy(dayIdx, k, st, en, 'section');
          if (teaKey) occupy(dayIdx, teaKey, st, en, 'teacher');
          occupy(dayIdx, room, st, en, 'room');
          placed++;
          break;
        }
      }
      if (placed < need) {
        const resource = Object.entries(reasons)
          .filter(([k, n]) => k !== 'time' && n > 0)
          .sort((x, y) => y[1] - x[1])[0];
        const reason = resource ? resource[0] : (reasons.time > 0 ? 'time' : null);
        failures.push({
          section: comboName, subject: a.subject_code, teacher: a.teacher_name,
          duration_minutes: dur, meetings_per_week: need, placed,
          ...(reason ? { reason } : {}),
        });
      }
    }
  });

  const stored = await qa(
    `SELECT e.*, sec.name AS section_name, s.code AS subject_code,
            csec.name AS combined_section_name,
            t.first_name || ' ' || t.last_name AS teacher_name
     FROM schedule_entries e
     JOIN sections sec ON sec.id = e.section_id
     JOIN subjects s ON s.id = e.subject_id
     LEFT JOIN sections csec ON csec.id = e.combined_section_id
     LEFT JOIN teachers t ON t.id = e.teacher_id
     WHERE e.school_year = ? ORDER BY e.section_id, e.day, e.start_time`,
    [schoolYear]
  );
  const conflicts = findConflicts(stored);

  return { generated: entries.length, assignments: assignments.length, pinned: entries.filter((e) => e.pinned).length, failures, conflicts, days: DAYS };
}

module.exports = { generateSchedule, findConflicts, loadAssignments, DAYS };