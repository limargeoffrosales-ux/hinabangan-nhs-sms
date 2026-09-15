import { useEffect, useMemo, useState, useCallback } from 'react';
import { CalendarRange, Plus, RefreshCw, Trash2, Pencil, TriangleAlert, CheckCircle2, Printer } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { PageHead, Badge, Empty, ErrorBanner, Modal } from '../components/ui';
import { printElementHtml } from '../lib/export';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DURATIONS = [60, 90, 120];
const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];

export default function Programs() {
  const { user } = useAuth();
  const canWrite = WRITE.includes(user?.role);
  const [schoolYear, setSchoolYear] = useState('2026-2027');
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [entries, setEntries] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [schoolInfo, setSchoolInfo] = useState({});
  const [genOpts, setGenOpts] = useState({ start: '07:00', end: '17:00', lunch_start: '12:00', lunch_end: '13:00' });
  const [view, setView] = useState('section');
  const [viewId, setViewId] = useState('');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [sec, sub, tea, asg, sched, conf, sch] = await Promise.all([
        api('/sections?school_year=' + encodeURIComponent(schoolYear)),
        api('/subjects?school_year=' + encodeURIComponent(schoolYear)),
        api('/teachers?limit=100'),
        api('/schedule/assignments?school_year=' + encodeURIComponent(schoolYear)),
        api('/schedule?school_year=' + encodeURIComponent(schoolYear)),
        api('/schedule/conflicts?school_year=' + encodeURIComponent(schoolYear)),
        api('/deped-forms/school-info').catch(() => ({})),
      ]);
      setSections(sec.data || []);
      setSubjects(sub.data || []);
      setTeachers(tea.data || []);
      setAssignments(asg.data || []);
      setEntries(sched.data || []);
      setConflicts(conf.data || []);
      setSchoolInfo(sch || {});
    } catch (err) {
      setError(err.message);
    }
  }, [schoolYear]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function generate() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api('/schedule/generate', {
        method: 'POST',
        body: { school_year: schoolYear, ...genOpts },
      });
      setNotice({
        ok: res.failures.length === 0,
        text: `Generated ${res.generated} class meetings across ${res.days.length} days.` +
          (res.failures.length ? ` ${res.failures.length} offering(s) could not be fully placed.` : ' No failures.') +
          (res.conflicts.length ? ` ${res.conflicts.length} conflict(s) detected.` : ' No conflicts detected.'),
      });
      const [sched, conf] = await Promise.all([
        api('/schedule?school_year=' + encodeURIComponent(schoolYear)),
        api('/schedule/conflicts?school_year=' + encodeURIComponent(schoolYear)),
      ]);
      setEntries(sched.data || []);
      setConflicts(conf.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function addAssignment(body) {
    await api('/schedule/assignments', { method: 'POST', body: { school_year: schoolYear, ...body } });
    const asg = await api('/schedule/assignments?school_year=' + encodeURIComponent(schoolYear));
    setAssignments(asg.data || []);
  }

  async function updateAssignment(id, body) {
    await api(`/schedule/assignments/${id}`, { method: 'PATCH', body });
    const asg = await api('/schedule/assignments?school_year=' + encodeURIComponent(schoolYear));
    setAssignments(asg.data || []);
  }

  async function deleteAssignment(id) {
    if (!window.confirm('Delete this assignment? This cannot be undone.')) return;
    await api(`/schedule/assignments/${id}`, { method: 'DELETE' });
    const asg = await api('/schedule/assignments?school_year=' + encodeURIComponent(schoolYear));
    setAssignments(asg.data || []);
  }

  function printProgram() {
    const item = (view === 'section' ? sections : teachers).find((x) => String(x.id) === viewId);
    if (!item || !viewedEntries.length) return;
    const html = programSheetHtml({
      kind: view,
      item,
      entries: viewedEntries,
      schoolInfo,
      lunchStart: genOpts.lunch_start,
      lunchEnd: genOpts.lunch_end,
    });
    const header = view === 'section'
      ? `Class Program — ${item.name} (${item.grade_level})`
      : `Teacher's Program — ${item.first_name} ${item.last_name}`;
    printElementHtml(`${header} | ${(schoolInfo.school_name || 'School')}`, html, { orientation: 'landscape', paper: 'legal' });
  }

  const viewedEntries = useMemo(() => {
    if (!viewId) return [];
    return entries
      .filter((e) => view === 'section'
        ? (String(e.section_id) === viewId || String(e.combined_section_id) === viewId)
        : String(e.teacher_id) === viewId)
      .sort((a, b) => a.day - b.day || a.start_time.localeCompare(b.start_time));
  }, [entries, view, viewId]);

  const conflictSubjects = useMemo(() => {
    const set = new Set();
    for (const c of conflicts) { set.add(`${c.section}|${c.subject}|${c.day}|${c.time}`); }
    return set;
  }, [conflicts]);

  const gradeSummary = useMemo(() => {
    const sectionById = new Map();
    const base = {};
    sections.forEach((s) => {
      sectionById.set(Number(s.id), s);
      const g = s.grade_level || '—';
      base[g] = base[g] || { grade: g, sectionSet: new Set(), subjectSet: new Set(), assignments: 0, meetings: 0, minutes: 0, teacherSet: new Set(), conflicts: 0 };
      base[g].sectionSet.add(s.name);
    });
    assignments.forEach((a) => {
      const g = a.grade_level || sectionById.get(Number(a.section_id))?.grade_level || '—';
      base[g] = base[g] || { grade: g, sectionSet: new Set(), subjectSet: new Set(), assignments: 0, meetings: 0, minutes: 0, teacherSet: new Set(), conflicts: 0 };
      base[g].assignments++;
      if (a.subject_code) base[g].subjectSet.add(a.subject_code);
      if (a.teacher_id) base[g].teacherSet.add(Number(a.teacher_id));
    });
    entries.forEach((e) => {
      const sec = sectionById.get(Number(e.section_id));
      const g = sec ? sec.grade_level : '—';
      base[g] = base[g] || { grade: g, sectionSet: new Set(), subjectSet: new Set(), assignments: 0, meetings: 0, minutes: 0, teacherSet: new Set(), conflicts: 0 };
      base[g].meetings++;
      base[g].minutes += Math.max(0, toMin(e.end_time) - toMin(e.start_time));
    });
    const sectionNameToGrade = new Map(sections.map((s) => [s.name, s.grade_level]));
    conflicts.forEach((c) => {
      const g = (c.section && sectionNameToGrade.get(c.section))
        || (c.other_section && sectionNameToGrade.get(c.other_section)) || null;
      if (g && base[g]) base[g].conflicts++;
    });
    return Object.values(base)
      .map((g) => ({ grade: g.grade, sectionsArr: [...g.sectionSet], subjects: g.subjectSet.size, assignments: g.assignments, meetings: g.meetings, minutes: g.minutes, teachers: g.teacherSet.size, conflicts: g.conflicts }))
      .sort((a, b) => (parseInt(a.grade, 10) || 0) - (parseInt(b.grade, 10) || 0) || String(a.grade).localeCompare(String(b.grade)));
  }, [sections, assignments, entries, conflicts]);

  return (
    <div>
      <PageHead title="Teacher Programs" sub="Auto-generate weekly teaching loads for Grade 11 and Grade 12 — no class, teacher, or room conflicts.">
        <select
          className="input"
          style={{ maxWidth: 180 }}
          value={schoolYear}
          onChange={(e) => setSchoolYear(e.target.value)}
        >
          {['2026-2027', '2025-2026', '2024-2025'].filter((v, i, a) => a.indexOf(v) === i).map((y) => <option key={y}>{y}</option>)}
        </select>
      </PageHead>

      <ErrorBanner error={error} />
      {notice && (
        <div className={`notice ${notice.ok ? 'ok' : 'warn'}`}>
          {notice.ok ? <CheckCircle2 size={15} /> : <TriangleAlert size={15} />} {notice.text}
        </div>
      )}

      <div className="card">
        <h3>
          <CalendarRange size={16} style={{ verticalAlign: -3 }} /> Automatic Program Generator
        </h3>
        <p className="sub">
          Places every subject assignment into conflict-free slots (Mon–Fri). Supports 1-hour, 1.5-hour and 2-hour classes;
          rooms follow the priority assignment room → teacher room → section room → free room pool, so vacant rooms are
          delegated to teachers without rooms. Skips the lunch break.
        </p>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', maxWidth: 660 }}>
          <label>First class
            <input type="time" className="input" value={genOpts.start}
              onChange={(e) => setGenOpts({ ...genOpts, start: e.target.value })} disabled={!canWrite} />
          </label>
          <label>Last class
            <input type="time" className="input" value={genOpts.end}
              onChange={(e) => setGenOpts({ ...genOpts, end: e.target.value })} disabled={!canWrite} />
          </label>
          <label>Lunch break
            <input type="time" className="input" value={genOpts.lunch_start}
              onChange={(e) => setGenOpts({ ...genOpts, lunch_start: e.target.value })} disabled={!canWrite} />
          </label>
          <label>Lunch ends
            <input type="time" className="input" value={genOpts.lunch_end}
              onChange={(e) => setGenOpts({ ...genOpts, lunch_end: e.target.value })} disabled={!canWrite} />
          </label>
        </div>
        <div style={{ marginTop: 14 }}>
          <button className="btn btn-primary" onClick={generate} disabled={busy || !canWrite}>
            <RefreshCw size={15} /> {busy ? 'Generating…' : 'Auto-generate programs'}
          </button>
          {!canWrite && <span className="hint" style={{ marginLeft: 10 }}>Only admins can generate programs.</span>}
        </div>
      </div>

      <div className="card">
        <h3>Summary by Grade Level <span className="count-pill">{schoolYear}</span></h3>
        {gradeSummary.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Grade level</th><th>Sections</th><th>Subjects</th><th>Assignments</th><th>Meetings / wk</th><th>Teaching load</th><th>Teachers</th><th>Conflicts</th></tr>
              </thead>
              <tbody>
                {gradeSummary.map((g) => (
                  <tr key={g.grade}>
                    <td>
                      <strong>{g.grade}</strong>
                      <div className="muted" style={{ maxWidth: 220 }}>{g.sectionsArr.join(', ') || '—'}</div>
                    </td>
                    <td>{g.sectionsArr.length}</td>
                    <td>{g.subjects}</td>
                    <td>{g.assignments}</td>
                    <td>{g.meetings}</td>
                    <td>{fmtHours(g.minutes)}</td>
                    <td>{g.teachers}</td>
                    <td>{g.conflicts ? <><Badge status="absent" /> {g.conflicts}</> : '—'}</td>
                  </tr>
                ))}
              </tbody>
              {gradeSummary.length > 1 && (
                <tfoot>
                  <tr>
                    <td><strong>All grades</strong></td>
                    <td>{gradeSummary.reduce((a, g) => a + g.sectionsArr.length, 0)}</td>
                    <td>{gradeSummary.reduce((a, g) => a + g.subjects, 0)}</td>
                    <td>{gradeSummary.reduce((a, g) => a + g.assignments, 0)}</td>
                    <td>{gradeSummary.reduce((a, g) => a + g.meetings, 0)}</td>
                    <td>{fmtHours(gradeSummary.reduce((a, g) => a + g.minutes, 0))}</td>
                    <td>{gradeSummary.reduce((a, g) => a + g.teachers, 0)}</td>
                    <td>{gradeSummary.reduce((a, g) => a + g.conflicts, 0) || '—'}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        ) : (
          <Empty text="No scheduling data for this school year yet — add assignments or run the generator first." />
        )}
        <div className="hint" style={{ marginTop: 8 }}>
          Teaching load is the total scheduled class time per week; Subjects counts unique subject codes assigned in that grade.
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0 }}>Subject Assignments <span className="count-pill">{assignments.length}</span></h3>
          {canWrite && (
            <button className="btn" onClick={() => setModal({ mode: 'add' })}>
              <Plus size={15} /> Add assignment
            </button>
          )}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Section</th><th>Subject</th><th>Teacher</th><th>Room</th><th>Length</th><th>Load</th>{canWrite && <th></th>}</tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id}>
                  <td>{a.section_name}{a.combined_section_id && a.combined_section_name ? ` + ${a.combined_section_name}` : ''} <span className="muted">({a.combined_section_id ? `${a.grade_level} + ${a.combined_grade_level || '—'}` : a.grade_level})</span></td>
                  <td>{a.subject_code}<br /><span className="muted">{a.subject_title}</span></td>
                  <td>{a.teacher_name || '—'}</td>
                  <td>{a.room || a.section_room || '—'}</td>
                  <td>{a.duration_minutes} min</td>
                  <td>{a.meetings_per_week}×/wk</td>
                  {canWrite && (
                    <td className="row-actions">
                      <button className="icon-btn" title="Edit" aria-label="Edit" onClick={() => setModal({ mode: 'edit', a })}><Pencil size={14} aria-hidden="true" /></button>
                      <button className="icon-btn" title="Delete" aria-label="Delete" onClick={() => deleteAssignment(a.id)}><Trash2 size={14} aria-hidden="true" /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!assignments.length && <Empty text="No assignments yet — add subjects to sections, then auto-generate." />}
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0 }}>
            {view === 'section' ? 'Section Timetable' : 'Teacher Weekly Program'}
            <span className="count-pill">{viewedEntries.length} meetings</span>
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="input" style={{ maxWidth: 140 }} value={view}
              onChange={(e) => { setView(e.target.value); setViewId(''); }}>
              <option value="section">Per section</option>
              <option value="teacher">Per teacher</option>
            </select>
            <select className="input" style={{ minWidth: 210 }} value={viewId} onChange={(e) => setViewId(e.target.value)}>
              <option value="">Choose {view === 'section' ? 'section' : 'teacher'}…</option>
              {(view === 'section' ? sections : teachers).map((x) => (
                <option key={x.id} value={String(x.id)}>
                  {view === 'section' ? `${x.name} (${x.grade_level})` : `${x.first_name} ${x.last_name}`}
                </option>
              ))}
            </select>
            {viewId && viewedEntries.length > 0 && (
              <button className="btn" onClick={printProgram} title="Open the DepEd Class Program sheet for printing">
                <Printer size={15} /> Print {view === 'section' ? 'Class Program' : "Teacher's Program"}
              </button>
            )}
          </div>
        </div>
        {viewedEntries.length ? (
          <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Day</th><th>Time</th><th>Length</th><th>{view === 'section' ? 'Subject' : 'Subject'}</th>
                  {view === 'section' && <th>Teacher</th>}<th>Room</th><th>Status</th></tr>
              </thead>
              <tbody>
                {viewedEntries.map((e) => {
                  const hit = conflictSubjects.has(`${e.section_name}|${e.subject_code}|${e.day}|${e.start_time}–${e.end_time}`);
                  return (
                    <tr key={e.id}>
                      <td>{DAYS[e.day - 1]}</td>
                      <td>{e.start_time}–{e.end_time}</td>
                      <td>{Math.round(toMin(e.end_time) - toMin(e.start_time))} min</td>
                      <td>{e.subject_code}{e.combined_section_id && <><br /><span className="muted">+ {e.combined_section_name}</span></>}</td>
                      {view === 'section' && <td>{e.teacher_name || '—'}</td>}
                      <td>{e.room || '—'}</td>
                      <td>{hit ? <Badge status="absent" /> : <Badge status="present" />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {viewId && view === 'section' && (
            <div className="program-preview" dangerouslySetInnerHTML={{
              __html: programSheetHtml({
                kind: 'section',
                item: sections.find((x) => String(x.id) === viewId),
                entries: viewedEntries,
                schoolInfo,
                lunchStart: genOpts.lunch_start,
                lunchEnd: genOpts.lunch_end,
              }),
            }} />
          )}
          </>
        ) : (
          <Empty text={viewId ? 'No classes scheduled for this selection yet.' : 'Pick a section or teacher to view their program.'} />
        )}
        <div className="hint" style={{ marginTop: 10 }}>
          <Badge status="absent" /> conflict detected &nbsp;·&nbsp; <Badge status="present" /> no conflict
        </div>
      </div>

      <div className="card">
        <h3>Conflict Report <span className="count-pill">{conflicts.length}</span></h3>
        {conflicts.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Type</th><th>Day</th><th>Time</th><th>Classes</th><th>Section</th></tr>
              </thead>
              <tbody>
                {conflicts.map((c, i) => (
                  <tr key={i}>
                    <td><Badge status={c.type === 'room' ? 'urgent' : 'late'} /> {c.type}</td>
                    <td>{c.day_name}</td>
                    <td>{c.time}</td>
                    <td>{c.subject} &amp; {c.other_subject}</td>
                    <td>{c.section} &amp; {c.other_section}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="No scheduling conflicts. The program is clear." />
        )}
      </div>

      {modal && (
        <AssignmentModal
          mode={modal.mode}
          assignment={modal.a}
          sections={sections}
          subjects={subjects}
          teachers={teachers}
          onClose={() => setModal(null)}
          onSubmit={async (body) => {
            if (modal.mode === 'add') await addAssignment(body);
            else await updateAssignment(modal.a.id, body);
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

function toMin(t) {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + m;
}

function fmtHours(min) {
  const m = Math.round(min || 0);
  if (!m) return '0 min';
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} min`;
  if (!r) return `${h} h`;
  return `${h} h ${r} min`;
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const DAY_LABELS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

function fmtHM(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function buildProgramGrid(entries) {
  if (!entries.length) return null;
  const times = [];
  for (const e of entries) { times.push(toMin(e.start_time), toMin(e.end_time)); }
  const min = Math.min(...times);
  const max = Math.max(...times);
  const slots = [];
  for (let t = min; t < max; t += 30) slots.push(t);
  const grid = [[], [], [], [], []];
  for (const e of entries) {
    const d = Math.max(0, Math.min(4, (e.day || 1) - 1));
    const s0 = slots.indexOf(toMin(e.start_time));
    const s1 = slots.indexOf(toMin(e.end_time));
    if (s0 < 0 || s1 < 0 || s1 <= s0) continue;
    grid[d][s0] = e;
    for (let i = s0 + 1; i < s1; i++) grid[d][i] = '__span__';
  }
  return { slots, grid };
}

function programSheetHtml({ kind = 'section', item = {}, entries = [], schoolInfo = {}, lunchStart, lunchEnd }) {
  const school = schoolInfo || {};
  const model = buildProgramGrid(entries);
  const l0 = lunchStart ? toMin(lunchStart) : -1;
  const l1 = lunchEnd ? toMin(lunchEnd) : -1;

  const head = `
  <div style="text-align:center;">
    <div style="font-size:10pt;font-weight:bold;">REPUBLIC OF THE PHILIPPINES</div>
    <div style="font-size:9pt;">Department of Education</div>
    <div style="font-size:8.5pt;">${esc(school.region || 'Region ____')}</div>
    <div style="font-size:8.5pt;">${esc(school.division || 'Schools Division of ____')}</div>
    <div style="font-size:10pt;font-weight:bold;margin-top:4pt;">${esc(school.school_name || 'Hinabangan National High School')}</div>
    <div style="font-size:8pt;">School ID: ${esc(school.school_id || '______')}</div>
    <div style="font-size:12pt;font-weight:bold;margin-top:6pt;">${kind === 'section' ? 'CLASS PROGRAM' : "TEACHER'S PROGRAM"}</div>
  </div>`;

  const info = kind === 'section' ? `
  <table class="no-border">
    <tr>
      <td style="border:none;">School Year: <strong>${esc(item.school_year || school.school_year || '____-____')}</strong></td>
      <td style="border:none;">Grade &amp; Section: <strong>${esc(item.grade_level || '____')} — ${esc(item.name || '____')}</strong></td>
      <td style="border:none;">Strand: <strong>${esc(item.strand ? String(item.strand).replace(/_/g, ' ') : '—')}</strong></td>
    </tr>
    <tr>
      <td style="border:none;">Room: <strong>${esc(item.room || '—')}</strong></td>
      <td style="border:none;">Adviser: <strong>${esc(item.adviser_name || '____________________')}</strong></td>
      <td style="border:none;">No. of Meetings: <strong>${entries.length} / week</strong></td>
    </tr>
  </table>` : `
  <table class="no-border">
    <tr>
      <td style="border:none;">Teacher: <strong>${esc(item.first_name ? `${item.first_name} ${item.last_name}` : '____________________')}</strong></td>
      <td style="border:none;">Position: <strong>${esc(item.position || 'Teacher')}</strong></td>
      <td style="border:none;">School Year: <strong>${esc(school.school_year || '____-____')}</strong></td>
    </tr>
  </table>`;

  let gridMarkup = '';
  if (model) {
    let body = '';
    for (let i = 0; i < model.slots.length; i++) {
      const t = model.slots[i];
      const inLunch = (l0 >= 0 && t >= l0 && t < l1);
      body += `<tr><td style="width:64pt;${inLunch ? 'background:#ececec;' : ''}">${fmtHM(t)}</td>`;
      for (let d = 0; d < 5; d++) {
        const cell = model.grid[d][i];
        if (cell === '__span__') continue;
        if (!cell) { body += '<td></td>'; continue; }
        const s0 = model.slots.indexOf(toMin(cell.start_time));
        const s1 = model.slots.indexOf(toMin(cell.end_time));
        const span = Math.max(1, s1 - s0);
        const subLine = kind === 'section'
          ? `Room ${esc(cell.room || '—')}${cell.teacher_name ? ` · ${esc(cell.teacher_name)}` : ''}${cell.combined_section_id ? ` · w/ ${esc(cell.combined_section_name || 'companion section')}` : ''}`
          : `Room ${esc(cell.room || '—')} · ${esc(cell.section_name || '')}${cell.combined_section_id ? ` + ${esc(cell.combined_section_name || '')}` : ''}`;
        body += `<td rowspan="${span}"><div class="b">${esc(cell.subject_code || '')}</div>` +
          `<div class="small">${esc(cell.subject_title || '')}<br/>${subLine}</div></td>`;
      }
      body += '</tr>';
    }
    gridMarkup = `<table>
      <thead><tr><th>TIME</th>${DAY_LABELS.map((d) => `<th>${d}</th>`).join('')}</tr></thead>
      <tbody>${body}</tbody>
    </table>`;
  } else {
    gridMarkup = '<p class="small">No classes are scheduled for this period.</p>';
  }

  const lunchNote = (l1 > l0) ? `<div class="small" style="margin-top:3pt;">Lunch / recess break: ${fmtHM(l0)} – ${fmtHM(l1)} (shaded).</div>` : '';

  const legend = model ? (() => {
    const totals = {};
    for (const e of entries) {
      const pair = e.combined_section_id && e.combined_section_name ? ` + ${e.combined_section_name}` : '';
      const key = kind === 'section'
        ? `${e.subject_code} — ${e.subject_title || ''}`
        : `${e.subject_code} (${e.section_name || ''}${pair}) — ${e.subject_title || ''}`;
      totals[key] = (totals[key] || 0) + (toMin(e.end_time) - toMin(e.start_time));
    }
    const items = Object.entries(totals)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, mins]) => `<li>${esc(label)} — ${mins} min/week</li>`)
      .join('');
    const total = Object.values(totals).reduce((a, b) => a + b, 0);
    return `<div class="small" style="margin-top:6pt;">Weekly load per subject:</div>
      <ul class="small" style="margin:2pt 0 0 0;padding-left:14pt;">${items}</ul>
      <div class="small b" style="margin-top:2pt;">Total teaching load: ${total} minutes per week</div>`;
  })() : '';

  const sig = kind === 'section' ? `
  <div style="display:flex;justify-content:space-between;margin-top:28pt;">
    <div style="text-align:center;width:48%;">
      <div>_______________________________</div>
      <div class="b">${esc(item.adviser_name || '____________________')}</div>
      <div class="small">Adviser / Class Adviser</div>
    </div>
    <div style="text-align:center;width:48%;">
      <div>_______________________________</div>
      <div class="b">${esc(school.school_head_name || '____________________')}</div>
      <div class="small">School Head</div>
    </div>
  </div>` : `
  <div style="display:flex;justify-content:space-between;margin-top:28pt;">
    <div style="text-align:center;width:48%;">
      <div>_______________________________</div>
      <div class="small">Teacher / Faculty</div>
    </div>
    <div style="text-align:center;width:48%;">
      <div>_______________________________</div>
      <div class="b">${esc(school.school_head_name || '____________________')}</div>
      <div class="small">School Head</div>
    </div>
  </div>`;

  return `${head}<br/>${info}<br/>${gridMarkup}${lunchNote}${legend}${sig}`;
}

function AssignmentModal({ mode, assignment, sections, subjects, teachers, onClose, onSubmit }) {
  const [form, setForm] = useState({
    section_id: assignment?.section_id ? String(assignment.section_id) : '',
    combined_section_id: assignment?.combined_section_id ? String(assignment.combined_section_id) : '',
    subject_id: assignment?.subject_id ? String(assignment.subject_id) : '',
    teacher_id: assignment?.teacher_id ? String(assignment.teacher_id) : '',
    duration_minutes: String(assignment?.duration_minutes || 60),
    meetings_per_week: String(assignment?.meetings_per_week || 2),
    room: assignment?.room || '',
  });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (!form.section_id || !form.subject_id) { setErr('Section and subject are required.'); return; }
    setBusy(true);
    setErr(null);
    try {
      await onSubmit({
        ...form,
        section_id: Number(form.section_id),
        combined_section_id: form.combined_section_id ? Number(form.combined_section_id) : null,
        subject_id: Number(form.subject_id),
        teacher_id: form.teacher_id ? Number(form.teacher_id) : null,
        duration_minutes: Number(form.duration_minutes),
        meetings_per_week: Number(form.meetings_per_week),
      });
    } catch (ex) {
      setErr(ex.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={mode === 'add' ? 'Add subject assignment' : 'Edit assignment'} sub="50 min classes are rounded to the standard 60/90/120-min periods. Combined classes place ONE meeting that covers both sections." onClose={onClose}>
      <ErrorBanner error={err} />
      <form onSubmit={submit}>
        <label>Section</label>
        <select className="input" value={form.section_id} onChange={set('section_id')}>
          <option value="">Select section…</option>
          {sections.map((s) => (
            <option key={s.id} value={String(s.id)}>{s.name} ({s.grade_level})</option>
          ))}
        </select>
        <label>Combine with section <span className="muted">(optional — one meeting serves both sections)</span></label>
        <select className="input" value={form.combined_section_id}
          onChange={(e) => setForm({ ...form, combined_section_id: e.target.value })}>
          <option value="">No — assign to this section alone</option>
          {sections
            .filter((s) => String(s.id) !== form.section_id)
            .map((s) => (
              <option key={s.id} value={String(s.id)}>{s.name} ({s.grade_level})</option>
            ))}
        </select>
        <label>Subject</label>
        <select className="input" value={form.subject_id} onChange={set('subject_id')}>
          <option value="">Select subject…</option>
          {subjects.map((s) => (
            <option key={s.id} value={String(s.id)}>{s.code} — {s.title}</option>
          ))}
        </select>
        <label>Teacher{form.combined_section_id ? ' (required — combined class)' : ''}</label>
        <select className="input" value={form.teacher_id} onChange={set('teacher_id')}>
          <option value="">Unassigned (auto)</option>
          {teachers.map((t) => (
            <option key={t.id} value={String(t.id)}>{t.first_name} {t.last_name} — {t.position}</option>
          ))}
        </select>
        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <label>Period length
            <select className="input" value={form.duration_minutes} onChange={set('duration_minutes')}>
              {DURATIONS.map((d) => <option key={d} value={String(d)}>{d} minutes ({d / 60} hr)</option>)}
            </select>
          </label>
          <label>Meetings / week
            <select className="input" value={form.meetings_per_week} onChange={set('meetings_per_week')}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={String(n)}>{n}× per week</option>)}
            </select>
          </label>
        </div>
        <label>Room <span className="muted">(defaults to teacher room, then section room)</span></label>
        <input className="input" value={form.room} onChange={set('room')} placeholder="e.g. ICT Lab 1" />
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : mode === 'add' ? 'Add' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}