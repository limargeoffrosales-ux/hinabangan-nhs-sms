import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Plus, RefreshCw, Trash2, Pencil, TriangleAlert, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { PageHead, Badge, Empty, Spinner, ErrorBanner, Modal } from '../components/ui';

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
  const [genOpts, setGenOpts] = useState({ start: '07:00', end: '17:00', lunch_start: '12:00', lunch_end: '13:00' });
  const [view, setView] = useState('section');
  const [viewId, setViewId] = useState('');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null);

  async function loadAll() {
    setError(null);
    try {
      const [sec, sub, tea, asg, sched, conf] = await Promise.all([
        api('/sections?school_year=' + encodeURIComponent(schoolYear)),
        api('/subjects?school_year=' + encodeURIComponent(schoolYear)),
        api('/teachers?limit=100'),
        api('/schedule/assignments?school_year=' + encodeURIComponent(schoolYear)),
        api('/schedule?school_year=' + encodeURIComponent(schoolYear)),
        api('/schedule/conflicts?school_year=' + encodeURIComponent(schoolYear)),
      ]);
      setSections(sec.data || []);
      setSubjects(sub.data || []);
      setTeachers(tea.data || []);
      setAssignments(asg.data || []);
      setEntries(sched.data || []);
      setConflicts(conf.data || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { loadAll(); }, [schoolYear]);

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
    await api(`/schedule/assignments/${id}`, { method: 'DELETE' });
    const asg = await api('/schedule/assignments?school_year=' + encodeURIComponent(schoolYear));
    setAssignments(asg.data || []);
  }

  const viewedEntries = useMemo(() => {
    if (!viewId) return [];
    return entries
      .filter((e) => view === 'section' ? String(e.section_id) === viewId : String(e.teacher_id) === viewId)
      .sort((a, b) => a.day - b.day || a.start_time.localeCompare(b.start_time));
  }, [entries, view, viewId]);

  const conflictSubjects = useMemo(() => {
    const set = new Set();
    for (const c of conflicts) { set.add(`${c.section}|${c.subject}|${c.day}|${c.time}`); }
    return set;
  }, [conflicts]);

  const secName = (id) => sections.find((s) => String(s.id) === id)?.name || '—';
  const teaName = (id) => teachers.find((t) => String(t.id) === id)?.first_name + ' ' + teachers.find((t) => String(t.id) === id)?.last_name || '—';

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
                  <td>{a.section_name} <span className="muted">({a.grade_level})</span></td>
                  <td>{a.subject_code}<br /><span className="muted">{a.subject_title}</span></td>
                  <td>{a.teacher_name || '—'}</td>
                  <td>{a.room || a.section_room || '—'}</td>
                  <td>{a.duration_minutes} min</td>
                  <td>{a.meetings_per_week}×/wk</td>
                  {canWrite && (
                    <td className="row-actions">
                      <button className="icon-btn" title="Edit" onClick={() => setModal({ mode: 'edit', a })}><Pencil size={14} /></button>
                      <button className="icon-btn" title="Delete" onClick={() => deleteAssignment(a.id)}><Trash2 size={14} /></button>
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
          </div>
        </div>
        {viewedEntries.length ? (
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
                      <td>{e.subject_code}</td>
                      {view === 'section' && <td>{e.teacher_name || '—'}</td>}
                      <td>{e.room || '—'}</td>
                      <td>{hit ? <Badge status="absent" /> : <Badge status="present" />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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

function AssignmentModal({ mode, assignment, sections, subjects, teachers, onClose, onSubmit }) {
  const [form, setForm] = useState({
    section_id: assignment?.section_id ? String(assignment.section_id) : '',
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
    <Modal title={mode === 'add' ? 'Add subject assignment' : 'Edit assignment'} sub="50 min classes are rounded to the standard 60/90/120-min periods." onClose={onClose}>
      <ErrorBanner error={err} />
      <form onSubmit={submit}>
        <label>Section</label>
        <select className="input" value={form.section_id} onChange={set('section_id')}>
          <option value="">Select section…</option>
          {sections.map((s) => (
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
        <label>Teacher</label>
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