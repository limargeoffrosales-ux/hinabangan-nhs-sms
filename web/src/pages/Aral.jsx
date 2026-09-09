import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, ClipboardList, Target, UserPlus } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { SCHOOL_YEARS } from '../lib/constants';
import { PageHead, Spinner, ErrorBanner, Modal, ConfirmModal } from '../components/ui';

const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];

function StatChip({ label, value, color }) {
  return (
    <div className="kpi-mini">
      <div className="kpi-mini-value" style={{ color }}>{value}</div>
      <div className="kpi-mini-label">{label}</div>
    </div>
  );
}

const fmtDate = (d) => (d ? String(d).slice(0, 10) : '—');

export default function Aral() {
  const { user } = useAuth();
  const canWrite = can(user?.role, ...WRITE);
  const canRecord = canWrite || user?.role === 'teacher' || user?.role === 'guidance';

  const [sy, setSy] = useState('2026-2027');
  const [sections, setSections] = useState([]);
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({ grade: '', section: '', area: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ session_date: '', subject_area: 'reading', session_no: '', tutor: '', section_id: '', remarks: '' });
  const [roll, setRoll] = useState([]);
  const [rollLoading, setRollLoading] = useState(false);

  const [allStudents, setAllStudents] = useState([]);
  const [aralLearners, setAralLearners] = useState([]);
  const [aralForm, setAralForm] = useState({ student_id: '', term: '' });
  const [aralBusy, setAralBusy] = useState(false);
  const [aralMsg, setAralMsg] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  useEffect(() => {
    let dead = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = `school_year=${encodeURIComponent(sy)}`
          + (filters.grade ? `&grade_level=${encodeURIComponent(filters.grade)}` : '')
          + (filters.section ? `&section_id=${encodeURIComponent(filters.section)}` : '')
          + (filters.area ? `&subject_area=${encodeURIComponent(filters.area)}` : '');
        const [secs, att, studs, aral] = await Promise.all([
          api(`/sections?school_year=${encodeURIComponent(sy)}`),
          api(`/dashboard/aral-attendance?${qs}`),
          api('/students?limit=500'),
          api(`/dashboard/aral-enrolled?school_year=${encodeURIComponent(sy)}`),
        ]);
        if (dead) return;
        setSections(secs.data || []);
        setData(att);
        setAllStudents((studs.data || []).filter((s) => s.status === 'enrolled'));
        setAralLearners(aral.data || []);
      } catch (e) {
        if (!dead) setError(e.message);
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => { dead = true; };
  }, [sy, filters, reloadTick]);

  const grades = useMemo(() => [...new Set(sections.map((s) => s.grade_level).filter(Boolean))].sort(), [sections]);

  function openModal() {
    const first = sections[0]?.id || '';
    setForm({
      session_date: new Date().toISOString().slice(0, 10),
      subject_area: 'reading',
      session_no: '',
      tutor: user?.name || '',
      section_id: first,
      remarks: '',
    });
    setShowModal(true);
    if (first) loadRoll(first);
  }

  async function loadRoll(sectionId) {
    if (!sectionId) { setRoll([]); return; }
    setRollLoading(true);
    try {
      const r = await api(`/sections/${sectionId}/students`);
      setRoll(r.data.map((s) => ({ student_id: s.id, name: `${s.last_name}, ${s.first_name}`, status: 'present' })));
    } catch (e) {
      setError(e.message);
    } finally {
      setRollLoading(false);
    }
  }

  function setRollStatus(id, status) {
    setRoll((list) => list.map((r) => (r.student_id === id ? { ...r, status } : r)));
  }

  async function saveSession(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api('/dashboard/aral-sessions', {
        method: 'POST',
        body: {
          school_year: sy,
          section_id: form.section_id,
          session_date: form.session_date,
          subject_area: form.subject_area,
          session_no: form.session_no || null,
          tutor: form.tutor || null,
          remarks: form.remarks || null,
          attendance: roll.map((r) => ({ student_id: r.student_id, status: r.status })),
        },
      });
      setShowModal(false);
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function enrollAral(e) {
    e.preventDefault();
    setAralMsg(null);
    setError(null);
    setAralBusy(true);
    try {
      await api('/dashboard/aral-enroll', {
        method: 'POST',
        body: { student_id: Number(aralForm.student_id), school_year: sy, term: aralForm.term },
      });
      setAralMsg('Learner enrolled to the ARAL Program.');
      setAralForm({ student_id: '', term: '' });
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setAralBusy(false);
    }
  }

  async function unenrollAral(enrollmentId) {
    setConfirmAction({ message: 'Remove this learner from the ARAL Program?', action: async () => {
      setError(null);
      try {
        await api('/dashboard/aral-unenroll', { method: 'POST', body: { enrollment_id: enrollmentId } });
        setReloadTick((t) => t + 1);
      } catch (err) {
        setError(err.message);
      }
    } });
  }

  if (loading && !data) return <Spinner />;

  const totals = data?.totals || { sessions: 0, present: 0, absent: 0, excused: 0, rate: 0 };

  return (
    <div>
      <PageHead title="ARAL Program" sub="Remediation sessions and attendance for learners tagged under the Aral Program — record and monitor per session.">
        <select className="input" style={{ width: 140 }} value={sy} onChange={(e) => setSy(e.target.value)}>
          {SCHOOL_YEARS.map((y) => <option key={y}>{y}</option>)}
        </select>
      </PageHead>
      <ErrorBanner error={error} />

      <div className="grid grid-4">
        <StatChip label="Sessions" value={totals.sessions} color="#4D96FF" />
        <StatChip label="Present" value={totals.present} color="#2FD6A0" />
        <StatChip label="Absent" value={totals.absent} color="#F2555A" />
        <StatChip label="Excused" value={totals.excused} color="#F5B942" />
        <StatChip label="Attendance rate" value={totals.rate != null ? totals.rate + '%' : '—'} color="#A78BFA" />
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0 }}><UserPlus size={16} /> Enroll Learner to ARAL Program</h3>
          {canRecord && (
            <form onSubmit={enrollAral} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <select className="input" style={{ minWidth: 260 }} required value={aralForm.student_id}
                onChange={(e) => setAralForm((f) => ({ ...f, student_id: e.target.value }))}>
                <option value="">— select enrolled learner —</option>
                {allStudents.map((s) => (
                  <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} ({s.lrn})</option>
                ))}
              </select>
              <select className="input" style={{ width: 130 }} value={aralForm.term}
                onChange={(e) => setAralForm((f) => ({ ...f, term: e.target.value }))}>
                <option value="">All terms</option>
                <option value="first">First Term</option>
                <option value="second">Second Term</option>
                <option value="third">Third Term</option>
              </select>
              <button className="btn btn-primary" disabled={aralBusy || !aralForm.student_id}>
                {aralBusy ? 'Enrolling…' : 'Enroll to ARAL'}
              </button>
            </form>
          )}
        </div>
        <p className="sub" style={{ margin: '8px 0 0' }}>
          Teachers and advisers can tag any enrolled learner for reading &amp; numeracy remediation.
          The learner keeps their regular section — ARAL attendance and progress are monitored here.
        </p>
        {aralMsg && <div className="notice" style={{ marginTop: 10 }}>{aralMsg}</div>}
        <div className="table-wrap" style={{ marginTop: 12, maxHeight: 280, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr><th>Learner</th><th>LRN</th><th>Grade &amp; Section</th><th style={{ textAlign: 'center' }}>Term</th><th style={{ textAlign: 'right' }}></th></tr>
            </thead>
            <tbody>
              {aralLearners.length === 0 && (
                <tr><td colSpan={5} className="sub">No learners tagged for the ARAL Program in {sy}.</td></tr>
              )}
              {aralLearners.map((r) => (
                <tr key={r.enrollment_id}>
                  <td>{r.last_name}, {r.first_name}</td>
                  <td style={{ fontFamily: 'monospace' }}>{r.lrn}</td>
                  <td>{r.grade_level}{r.section_name ? ' — ' + r.section_name : ''}</td>
                  <td style={{ textAlign: 'center' }}>{r.term ? r.term[0].toUpperCase() + r.term.slice(1) : 'All'}</td>
                  <td style={{ textAlign: 'right' }}>
                    {canWrite && (
                      <button className="btn btn-sm btn-danger" onClick={() => unenrollAral(r.enrollment_id)}>Remove</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0 }}><CalendarCheck size={16} /> Remediation Attendance — {sy}</h3>
          {canRecord && (
            <button className="btn btn-primary" onClick={openModal}>
              <ClipboardList size={15} /> Record Session
            </button>
          )}
        </div>
        <div className="filter-row" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap', display: 'flex', alignItems: 'center' }}>
          <select value={filters.area} onChange={(e) => setFilters((f) => ({ ...f, area: e.target.value }))}>
            <option value="">All subject areas</option>
            <option value="reading">Reading</option>
            <option value="numeracy">Numeracy</option>
          </select>
          <select value={filters.grade} onChange={(e) => setFilters((f) => ({ ...f, grade: e.target.value, section: '' }))}>
            <option value="">All grade levels</option>
            {grades.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={filters.section} onChange={(e) => setFilters((f) => ({ ...f, section: e.target.value }))}>
            <option value="">All sections</option>
            {sections.filter((s) => !filters.grade || s.grade_level === filters.grade).map((s) => (
              <option key={s.id} value={s.id}>{s.grade_level} — {s.name}</option>
            ))}
          </select>
        </div>

        <div className="table-wrap" style={{ marginTop: 12, maxHeight: 320, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr><th>Section</th><th style={{ textAlign: 'center' }}>Learners</th><th style={{ textAlign: 'center' }}>Sessions</th><th style={{ textAlign: 'center' }}>Present</th><th style={{ textAlign: 'center' }}>Absent</th><th style={{ textAlign: 'center' }}>Excused</th><th style={{ textAlign: 'center' }}>Rate</th></tr>
            </thead>
            <tbody>
              {(!data || data.per_section.length === 0) && (
                <tr><td colSpan={7} className="sub">No remediation sessions recorded for the selected filters.</td></tr>
              )}
              {data?.per_section.map((r) => (
                <tr key={r.section_id}>
                  <td>{r.section_name}</td>
                  <td style={{ textAlign: 'center' }}>{r.learners}</td>
                  <td style={{ textAlign: 'center' }}>{r.sessions}</td>
                  <td style={{ textAlign: 'center' }}>{r.present}</td>
                  <td style={{ textAlign: 'center' }}>{r.absent}</td>
                  <td style={{ textAlign: 'center' }}>{r.excused}</td>
                  <td style={{ textAlign: 'center' }}><strong>{r.rate}%</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4 style={{ marginTop: 18, marginBottom: 8 }}>Session Log</h4>
        <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr><th>Date</th><th>Section</th><th>Area</th><th style={{ textAlign: 'center' }}>No.</th><th>Tutor</th><th style={{ textAlign: 'center' }}>Present</th><th style={{ textAlign: 'center' }}>Absent</th><th style={{ textAlign: 'center' }}>Excused</th><th style={{ textAlign: 'center' }}>Rate</th></tr>
            </thead>
            <tbody>
              {(!data || data.sessions.length === 0) && (
                <tr><td colSpan={9} className="sub">No sessions recorded.</td></tr>
              )}
              {data?.sessions.map((s) => {
                const total = Number(s.present) + Number(s.absent) + Number(s.excused);
                return (
                  <tr key={s.id}>
                    <td>{fmtDate(s.session_date)}</td>
                    <td>{s.section_name}</td>
                    <td className="sub" style={{ textTransform: 'capitalize' }}>{s.subject_area}</td>
                    <td style={{ textAlign: 'center' }}>{s.session_no || '—'}</td>
                    <td>{s.tutor || '—'}</td>
                    <td style={{ textAlign: 'center' }}>{s.present}</td>
                    <td style={{ textAlign: 'center' }}>{s.absent}</td>
                    <td style={{ textAlign: 'center' }}>{s.excused}</td>
                    <td style={{ textAlign: 'center' }}><strong>{total ? Math.round((Number(s.present) + Number(s.excused)) / total * 100) + '%' : '—'}</strong></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}><Target size={15} /> Per-Learner Attendance</h3>
        <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr><th>Learner</th><th>Grade &amp; Section</th><th style={{ textAlign: 'center' }}>Sessions</th><th style={{ textAlign: 'center' }}>Present</th><th style={{ textAlign: 'center' }}>Absent</th><th style={{ textAlign: 'center' }}>Excused</th><th style={{ textAlign: 'center' }}>Rate</th></tr>
            </thead>
            <tbody>
              {(!data || data.per_learner.length === 0) && (
                <tr><td colSpan={7} className="sub">No attendance recorded for any learner yet.</td></tr>
              )}
              {data?.per_learner.map((r) => (
                <tr key={r.student_id}>
                  <td>{r.last_name}, {r.first_name}</td>
                  <td>{r.grade_level} — {r.section_name}</td>
                  <td style={{ textAlign: 'center' }}>{r.sessions}</td>
                  <td style={{ textAlign: 'center' }}>{r.present}</td>
                  <td style={{ textAlign: 'center' }}>{r.absent}</td>
                  <td style={{ textAlign: 'center' }}>{r.excused}</td>
                  <td style={{ textAlign: 'center' }}><strong>{r.rate}%</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sub" style={{ marginTop: 8 }}>Attendance is tracked per remediation session (date, subject area, tutor).</div>
      </div>

      {showModal && (
        <Modal
          title="Record ARAL remediation session"
          sub={`Session for ${sy} · ${form.section_id ? sections.find((s) => s.id == form.section_id)?.grade_level + ' — ' + sections.find((s) => s.id == form.section_id)?.name : 'select a section'}`}
          onClose={() => setShowModal(false)}
          wide
        >
          <form onSubmit={saveSession}>
            <div className="grid-2" style={{ marginTop: 10 }}>
              <label>Session date <input type="date" required value={form.session_date} onChange={(e) => setForm((f) => ({ ...f, session_date: e.target.value }))} /></label>
              <label>Subject area <select value={form.subject_area} onChange={(e) => setForm((f) => ({ ...f, subject_area: e.target.value }))}>
                <option value="reading">Reading</option>
                <option value="numeracy">Numeracy</option>
              </select></label>
              <label>Section <select required value={form.section_id} onChange={(e) => { setForm((f) => ({ ...f, section_id: e.target.value })); loadRoll(e.target.value); }}>
                <option value="">Select section…</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.grade_level} — {s.name}</option>
                ))}
              </select></label>
              <label>Session no. <input type="number" min="1" value={form.session_no} onChange={(e) => setForm((f) => ({ ...f, session_no: e.target.value }))} /></label>
              <label>Tutor <input value={form.tutor} onChange={(e) => setForm((f) => ({ ...f, tutor: e.target.value }))} /></label>
              <label>Remarks <input value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} /></label>
            </div>
            <h4 style={{ margin: '14px 0 8px' }}>Attendance <span className="sub">({roll.length} learners)</span></h4>
            <div className="table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr><th>Learner</th><th style={{ textAlign: 'center' }}>Status</th></tr>
                </thead>
                <tbody>
                  {rollLoading && <tr><td colSpan={2} className="sub">Loading learners…</td></tr>}
                  {!rollLoading && roll.length === 0 && (
                    <tr><td colSpan={2} className="sub">No enrolled learners in this section.</td></tr>
                  )}
                  {roll.map((r) => (
                    <tr key={r.student_id}>
                      <td>{r.name}</td>
                      <td style={{ textAlign: 'center' }}>
                        <select value={r.status} onChange={(e) => setRollStatus(r.student_id, e.target.value)}>
                          <option value="present">Present</option>
                          <option value="absent">Absent</option>
                          <option value="excused">Excused</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving || !form.section_id}>{saving ? 'Saving…' : 'Save Session'}</button>
            </div>
          </form>
        </Modal>
      )}
      {confirmAction && <ConfirmModal message={confirmAction.message} danger onConfirm={() => { confirmAction.action(); setConfirmAction(null); }} onCancel={() => setConfirmAction(null)} />}
    </div>
  );
}
