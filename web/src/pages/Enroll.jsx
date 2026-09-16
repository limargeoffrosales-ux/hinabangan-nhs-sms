import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Search } from 'lucide-react';
import { api } from '../lib/api';
import { SHS_TRACKS, ENROLLMENT_STATUSES } from '../lib/constants';
import { PageHead, Modal, Empty, ErrorBanner, Spinner, Badge } from '../components/ui';
import { useToast } from '../components/Toast';

const CATEGORIES = [
  { cat: 'core', label: 'Core Subjects' },
  { cat: 'arts-humanities', label: 'Academic — Arts, Social Sciences & Humanities' },
  { cat: 'business-entrepreneurship', label: 'Academic — Business & Entrepreneurship' },
  { cat: 'stem', label: 'Academic — Science, Technology, Engineering & Math' },
  { cat: 'sports-health-wellness', label: 'Academic — Sports, Health & Wellness' },
  { cat: 'field-experience', label: 'Academic — Field Experience' },
  { cat: 'tvl-aesthetic', label: 'TechPro — Aesthetic, Wellness & Human Care' },
  { cat: 'tvl-agri-fishery', label: 'TechPro — Agri-Fishery & Food Innovation' },
  { cat: 'tvl-artisanry', label: 'TechPro — Artisanry & Creative Enterprise' },
  { cat: 'tvl-automotive', label: 'TechPro — Automotive & Small Engine' },
  { cat: 'tvl-construction', label: 'TechPro — Construction & Building' },
  { cat: 'tvl-creative-design', label: 'TechPro — Creative Arts & Design' },
  { cat: 'tvl-hospitality', label: 'TechPro — Hospitality & Tourism' },
  { cat: 'tvl-industrial', label: 'TechPro — Industrial Technologies' },
  { cat: 'tvl-ict', label: 'TechPro — ICT & Computer Programming' },
  { cat: 'tvl-maritime', label: 'TechPro — Maritime' },
  { cat: 'tvl-work-immersion', label: 'TechPro — Work Immersion' },
];

const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

// Render's free tier sleeps the DB/instance between requests; the first call
// after an idle window can surface a transient 500 (pool connection error has
// no status -> generic "Internal server error"). Retry so a cold-start hiccup
// never bricks the page.
async function retryFetch(fn, attempts = 3) {
  let lastErr;
  for (let a = 0; a < attempts; a++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (e.status === 400 || e.status === 401 || e.status === 403 || e.status === 404 || e.status === 409) throw e;
      if (a < attempts - 1) await sleepMs(1000 + a * 1000);
    }
  }
  throw lastErr;
}

function gradeOrder(a, b) {
  const n = (s) => { const m = /(\d+)/.exec(s || ''); return m ? Number(m[1]) : 0; };
  return n(a) - n(b);
}

function catOf(s) {
  if (s.category) return s.category;
  if (s.track === 'tvl') return 'tvl-ict';
  if (s.term === 'all' || s.track === 'general' || String(s.code).startsWith('SSHS-') || String(s.code).startsWith('CORE-')) return 'core';
  return 'arts-humanities';
}

// Defined at module scope (stable identity) so the checklist does not remount
// on every checkbox click — the scroll position of the list is preserved.
function CheckGroup({ label, items, selectedSubjects, toggleSubject, toggleGroup }) {
  return (
    <fieldset style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
      <legend style={{ fontWeight: 600, fontSize: 13, padding: '0 6px' }}>{label} ({items.length})</legend>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 6,
          maxHeight: 260,
          overflowY: 'auto',
          padding: 2,
        }}
      >
        {items.map((s) => (
          <label
            key={s.id}
            className="check-item"
            title={s.title}
            style={{
              display: 'grid',
              gridTemplateColumns: '16px 120px minmax(0, 1fr)',
              alignItems: 'center',
              columnGap: 10,
              minHeight: 46,
              padding: '8px 10px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--surface, #fff)',
              fontSize: 12.5,
              lineHeight: 1.35,
              cursor: 'pointer',
              boxSizing: 'border-box',
            }}
          >
            <input type="checkbox" checked={selectedSubjects.includes(s.id)} onChange={() => toggleSubject(s.id)} style={{ width: 16, height: 16, margin: 0 }} />
            <span
              title={s.code}
              style={{ fontWeight: 600, fontSize: 11, opacity: 0.72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}
            >
              {s.code}
            </span>
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{s.title}</span>
          </label>
        ))}
      </div>
      <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => toggleGroup(items)}>
        {items.every((s) => selectedSubjects.includes(s.id)) ? 'Clear all' : 'Select all'}
      </button>
    </fieldset>
  );
}

export default function Enroll() {
  const { toast } = useToast();
  const [students, setStudents] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [form, setForm] = useState({ student_id: '', section_id: '', school_year: '2026-2027', grade_level: 'Grade 11', strand: '', term: 'first', is_aral: false, status: 'enrolled', enrolled_at: '' });
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSubjects, setEditSubjects] = useState([]);
  const [editSelected, setEditSelected] = useState([]);
  const [editSearch, setEditSearch] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async (q, quiet) => {
    if (!quiet) setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: '300', sort: 'recent_enrolled' });
      if (q) qs.set('q', q);
      const [st, se, rec] = await Promise.all([
        retryFetch(() => api('/students?' + qs)),
        retryFetch(() => api('/sections?limit=200')),
        retryFetch(() => api('/enrollments/recent?limit=8')).catch(() => ({ data: [] })),
      ]);
      setStudents(st.data);
      setSections(se.data);
      setRecent(rec.data || []);
      setError(null);
    } catch (e) {
      setError(e.status === 500
        ? 'The server hit an error loading enrollment data — retrying usually fixes this. Please try again.'
        : e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const firstLoad = useRef(true);
  useEffect(() => {
    const t = setTimeout(() => {
      load(studentSearch.trim(), firstLoad.current);
      firstLoad.current = false;
    }, 300);
    return () => clearTimeout(t);
  }, [studentSearch, load]);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function loadSubjectsFor(gradeLevel) {
    try {
      const q = new URLSearchParams({ grade_level: gradeLevel, limit: '500' });
      const res = await retryFetch(() => api(`/subjects?${q}`), 2);
      setSubjects(res.data);
    } catch (e) {
      setError(e.status === 500
        ? 'The subject catalog could not be loaded — refresh to try again.'
        : e.message);
    }
  }

  function onStudentChange(v) {
    const s = students.find((x) => x.id === Number(v));
    setForm((f) => ({ ...f, student_id: v, grade_level: s?.grade_level || f.grade_level, strand: s?.track_strand || f.strand }));
    setSelectedSubjects([]);
  }

  function onSectionChange(v) {
    const sec = sections.find((x) => x.id === Number(v));
    setForm((f) => ({ ...f, section_id: v, grade_level: sec?.grade_level || f.grade_level, strand: sec?.strand || f.strand }));
    setSelectedSubjects([]);
  }

  function onTermChange(v) {
    setForm((f) => ({ ...f, term: v }));
  }

  useEffect(() => {
    const g = form.grade_level;
    if (g && /^Grade 1[12]$/.test(g)) loadSubjectsFor(g);
    else setSubjects([]);
  }, [form.grade_level]);

  const isShsGrade = /^Grade 1[12]$/.test(form.grade_level || '');

  const group = useMemo(() => {
    if (!isShsGrade) return [];
    const q = search.trim().toLowerCase();
    const list = subjects.filter((s) => !q || `${s.code} ${s.title}`.toLowerCase().includes(q));
    return CATEGORIES.map(({ cat, label }) => ({ cat, label, items: list.filter((s) => catOf(s) === cat) }))
      .filter((g) => g.items.length > 0);
  }, [subjects, search, isShsGrade]);

  const totalAvailable = useMemo(() => (isShsGrade ? subjects.length : 0), [subjects, isShsGrade]);

  function toggleSubject(id) {
    setSelectedSubjects((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));
  }

  function toggleGroup(list) {
    const ids = list.map((s) => s.id);
    const allSelected = ids.every((id) => selectedSubjects.includes(id));
    setSelectedSubjects((sel) => (allSelected ? sel.filter((x) => !ids.includes(x)) : [...new Set([...sel, ...ids])]));
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!form.student_id || !form.section_id) return setError('Select a student and a section.');
    try {
      const selected = students.find((s) => s.id === Number(form.student_id));
      const isShs = /^Grade 1[12]$/.test(form.grade_level || selected?.grade_level || '');
      const body = {
        ...form,
        student_id: Number(form.student_id),
        section_id: Number(form.section_id),
        grade_level: form.grade_level,
        is_aral: form.is_aral,
        subject_ids: isShs ? selectedSubjects : [],
      };
      if (!isShs) delete body.term;
      await api('/enrollments', { method: 'POST', body });
      toast.success('Student enrolled successfully.');
      setForm((f) => ({ ...f, student_id: '', section_id: '', is_aral: false }));
      setSelectedSubjects([]);
      load(studentSearch.trim(), true);
    } catch (e2) {
      setError(e2.message);
    }
  }

  async function viewHistory(s) {
    try {
      const res = await api(`/enrollments/student/${s.id}`);
      setHistory({ student: s, rows: res.data });
      setShowHistory(true);
    } catch (e) {
      setError(e.message);
    }
  }

  async function startEdit(r) {
    setError(null);
    try {
      const full = await retryFetch(() => api(`/enrollments/student/${r.student_id}`));
      const enr = (full.data || []).find((x) => x.id === r.id) || full.data?.[0];
      if (!enr) throw new Error('Enrollment record not found');
      const isShsGrade = /^Grade 1[12]$/.test(enr.grade_level || '');
      setEditing(enr);
      setEditForm({
        section_id: enr.section_id,
        term: enr.term || 'first',
        strand: enr.strand || '',
        status: enr.status || 'enrolled',
        is_aral: !!enr.is_aral,
        grade_level: enr.grade_level,
      });
      setEditSearch('');
      if (isShsGrade) {
        const q = new URLSearchParams({ grade_level: enr.grade_level, limit: '500' });
        const subRes = await retryFetch(() => api(`/subjects?${q}`), 2);
        setEditSubjects(subRes.data);
        setEditSelected((enr.subjects || []).map((s) => s.subject_id));
      } else {
        setEditSubjects([]);
        setEditSelected([]);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setEditSaving(true);
    setError(null);
    try {
      const body = {
        section_id: Number(editForm.section_id),
        term: editForm.term,
        strand: editForm.strand,
        status: editForm.status,
        is_aral: editForm.is_aral,
        subject_ids: editSelected,
      };
      await api(`/enrollments/${editing.id}`, { method: 'PATCH', body });
      toast.success('Enrollment updated.');
      setEditing(null);
      load(studentSearch.trim(), true);
    } catch (e) {
      setError(e.message);
    } finally {
      setEditSaving(false);
    }
  }

  function onEditSectionChange(v) {
    const sec = sections.find((x) => x.id === Number(v));
    setEditForm((f) => {
      const next = { ...f, section_id: v, strand: sec?.strand || f.strand };
      const prevGl = f.grade_level;
      const newGl = sec?.grade_level || prevGl;
      if (newGl !== prevGl && /^Grade 1[12]$/.test(newGl)) {
        retryFetch(() => api(`/subjects?${new URLSearchParams({ grade_level: newGl, limit: '500' })}`), 2)
          .then((res) => { setEditSubjects(res.data); setEditSelected([]); })
          .catch(() => {});
      }
      next.grade_level = newGl;
      return next;
    });
  }

  const editGroups = useMemo(() => {
    const isShs = /^Grade 1[12]$/.test(editForm.grade_level || '');
    if (!isShs || !editSubjects.length) return [];
    const q = editSearch.trim().toLowerCase();
    const list = editSubjects.filter((s) => !q || `${s.code} ${s.title}`.toLowerCase().includes(q));
    return CATEGORIES.map(({ cat, label }) => ({ cat, label, items: list.filter((s) => catOf(s) === cat) }))
      .filter((g) => g.items.length > 0);
  }, [editSubjects, editSearch, editForm.grade_level]);

  function toggleEditSubject(id) {
    setEditSelected((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));
  }

  function toggleEditGroup(list) {
    const ids = list.map((s) => s.id);
    const allSelected = ids.every((id) => editSelected.includes(id));
    setEditSelected((sel) => (allSelected ? sel.filter((x) => !ids.includes(x)) : [...new Set([...sel, ...ids])]));
  }

  const eligible = students.filter((s) => s.status === 'enrolled' && !s.has_enrollment);
  const searchActive = studentSearch.trim().length > 0;
  const visibleStudents = searchActive ? students.filter((s) => s.status === 'enrolled') : eligible;
  const eligibleHint = searchActive
    ? `${visibleStudents.length} ${visibleStudents.length === 1 ? 'matching learner' : 'matching learners'} (including already-enrolled — type to pin down a specific learner)`
    : `${eligible.length} ${eligible.length === 1 ? 'learner' : 'learners'} available to enroll`;
  const selectedCount = selectedSubjects.length;

  const gradeOptions = useMemo(() => {
    const set = new Set();
    sections.forEach((s) => { if (s.grade_level) set.add(s.grade_level); });
    students.forEach((s) => { if (s.grade_level) set.add(s.grade_level); });
    return [...set].sort(gradeOrder);
  }, [sections, students]);

  return (
    <>
      <PageHead title="Enrollment" sub="Assign learners to sections with the full SSHS subject checklist (DepEd LRN-based)" />
      <ErrorBanner error={error} />
      {loading ? <Spinner /> : (
        <div className="two-col">
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Enroll a Student</h3>
            <form onSubmit={submit}>
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                <input
                  className="input"
                  placeholder="Search learners by name or LRN — updates the list below…"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  style={{ paddingLeft: 30 }}
                />
              </div>
              <label>Student</label>
              <div className="hint" style={{ marginTop: -6, marginBottom: 6 }}>{eligibleHint}</div>
              <select required value={form.student_id} onChange={(e) => onStudentChange(e.target.value)}>
                <option value="">— select learner —</option>
                {visibleStudents.map((s) => (
                  <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} ({s.lrn}){s.has_enrollment ? ' — already enrolled' : ''}</option>
                ))}
              </select>
              <label>Section</label>
              <select required value={form.section_id} onChange={(e) => onSectionChange(e.target.value)}>
                <option value="">— select section —</option>
                {sections.filter((s) => s.status === 'active' && s.school_year === form.school_year && s.grade_level === form.grade_level).map((s) => (
                  <option key={s.id} value={s.id}>{s.name} — {s.grade_level} ({s.school_year})</option>
                ))}
              </select>
              <div className="form-row">
                <div>
                  <label>School year</label>
                  <input required value={form.school_year} onChange={(e) => { set('school_year', e.target.value); set('section_id', ''); setSelectedSubjects([]); }} />
                </div>
                <div>
                  <label>Grade level</label>
                  <select value={form.grade_level} onChange={(e) => { set('grade_level', e.target.value); set('section_id', ''); setSelectedSubjects([]); }}>
                    <option value="">— select —</option>
                    {gradeOptions.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label>Term (SHS)</label>
                  <select value={form.term} onChange={(e) => onTermChange(e.target.value)} disabled={!isShsGrade}>
                    <option value="first">First Term</option>
                    <option value="second">Second Term</option>
                    <option value="third">Third Term</option>
                  </select>
                </div>
                <div>
                  <label>Strand (SHS)</label>
                  <select value={form.strand} onChange={(e) => set('strand', e.target.value)} disabled={!isShsGrade}>
                    <option value="">— select —</option>
                    {SHS_TRACKS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label>Status</label>
                  <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                    {ENROLLMENT_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div
                onClick={() => set('is_aral', !form.is_aral)}
                role="checkbox"
                aria-checked={form.is_aral}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); set('is_aral', !form.is_aral); } }}
                style={{
                  marginTop: 12, display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px',
                  border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer',
                  background: form.is_aral ? 'var(--bg-soft, #f0f7f2)' : 'transparent',
                }}
              >
                <input type="checkbox" checked={form.is_aral} onChange={(e) => set('is_aral', e.target.checked)} style={{ marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Enroll to Aral Program</div>
                  <div className="hint">Reading &amp; numeracy remediation tracking — PHIL-IRI baseline, intervention sessions and progress monitoring.</div>
                </div>
              </div>

              {isShsGrade ? (
                <>
                  <div style={{ margin: '12px 0 4px' }}>
                    <label style={{ fontWeight: 600 }}>Enrolled subjects — tick the cores and electives for this term</label>
                    <div className="hint">
                      Full SSHS catalog for Grade 11 and 12 · available in all three terms · {selectedCount} of {totalAvailable} selected
                    </div>
                  </div>
                  <div style={{ position: 'relative', marginBottom: 8 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                    <input
                      className="input"
                      placeholder="Search subjects by code or title…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ paddingLeft: 30 }}
                    />
                  </div>
                  {group.length === 0 ? (
                    <div className="hint">No subjects found for this grade level{search ? ' matching your search' : ' in the catalog'}.</div>
                  ) : (
                    <>
                      {group.map((g) => (
                        <CheckGroup key={g.cat} label={g.label} items={g.items} selectedSubjects={selectedSubjects} toggleSubject={toggleSubject} toggleGroup={toggleGroup} />
                      ))}
                      {selectedCount > 0 && (
                        <button type="button" className="btn btn-sm" onClick={() => setSelectedSubjects([])}>Clear selection ({selectedCount})</button>
                      )}
                    </>
                  )}
                </>
              ) : (
                <div className="hint" style={{ marginTop: 10 }}>Subject checklist is available for Senior High School learners.</div>
              )}

              <div className="modal-actions" style={{ marginTop: 16 }}>
                <button className="btn btn-primary">Enroll student</button>
              </div>
            </form>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Recently Enrolled</h3>
            {recent.length === 0 ? <Empty text="No enrollments recorded yet." /> : (
              <table>
                <thead>
                  <tr><th>Student</th><th>Section</th><th>Grade</th><th></th></tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id}>
                      <td>{r.last_name}, {r.first_name}</td>
                      <td>{r.section_name || '—'}</td>
                      <td>{r.grade_level}{r.term ? ` · ${r.term[0].toUpperCase() + r.term.slice(1)}` : ''}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-sm" onClick={() => startEdit({ id: r.id, student_id: r.student_id })}>Edit</button>
                        <button className="btn btn-sm" style={{ marginLeft: 4 }} onClick={() => viewHistory({ id: r.student_id, last_name: r.last_name, first_name: r.first_name, lrn: r.lrn })}>History</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

{showHistory && history && (
        <Modal
          title={`Enrollment History — ${history.student.last_name}, ${history.student.first_name}`}
          sub={`LRN ${history.student.lrn}`}
          onClose={() => setShowHistory(false)}
          wide
        >
          {history.rows.length === 0 ? <Empty text="No enrollment records." /> : (
            <table>
              <thead>
                <tr><th>School Year</th><th>Term</th><th>Section</th><th>Grade</th><th>Aral</th><th>Subjects</th><th>Status</th><th>Date</th><th></th></tr>
              </thead>
              <tbody>
                {history.rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.school_year}</td>
                    <td>{r.term ? r.term[0].toUpperCase() + r.term.slice(1) : '—'}</td>
                    <td>{r.section_name || '—'}</td>
                    <td>{r.grade_level}</td>
                    <td>{r.is_aral ? <Badge status="aral" /> : '—'}</td>
                    <td style={{ maxWidth: 320 }}>
                      {r.subjects && r.subjects.length ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {r.subjects.map((su) => (
                            <span key={su.subject_id} className="badge badge-blue">{su.code}</span>
                          ))}
                        </div>
                      ) : '—'}
                    </td>
                    <td>{r.status}</td>
                    <td>{r.enrolled_at || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-sm" onClick={() => { setShowHistory(false); startEdit({ id: r.id, student_id: r.student_id }); }}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}

      {editing && (
        <Modal
          title="Edit Enrollment"
          sub="Correct any wrong data for this enrollment record."
          onClose={() => { if (!editSaving) setEditing(null); }}
          wide
        >
          {(() => {
            const editIsShs = /^Grade 1[12]$/.test(editForm.grade_level || '');
            return (
              <div>
                <div className="form-row">
                  <div>
                    <label>Section</label>
                    <select value={editForm.section_id || ''} onChange={(e) => onEditSectionChange(e.target.value)}>
                      <option value="">— select —</option>
                      {sections.filter((s) => s.status === 'active' && s.school_year === editing.school_year && s.grade_level === editForm.grade_level).map((s) => (
                        <option key={s.id} value={s.id}>{s.name} — {s.grade_level} ({s.school_year})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Term (SHS)</label>
                    <select value={editForm.term || 'first'} onChange={(e) => setEditForm((f) => ({ ...f, term: e.target.value }))} disabled={!editIsShs}>
                      <option value="first">First Term</option>
                      <option value="second">Second Term</option>
                      <option value="third">Third Term</option>
                    </select>
                  </div>
                  <div>
                    <label>Strand (SHS)</label>
                    <select value={editForm.strand || ''} onChange={(e) => setEditForm((f) => ({ ...f, strand: e.target.value }))} disabled={!editIsShs}>
                      <option value="">— select —</option>
                      {SHS_TRACKS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>Status</label>
                    <select value={editForm.status || 'enrolled'} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                      {ENROLLMENT_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>

                <div
                  onClick={() => setEditForm((f) => ({ ...f, is_aral: !f.is_aral }))}
                  role="checkbox"
                  aria-checked={!!editForm.is_aral}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditForm((f) => ({ ...f, is_aral: !f.is_aral })); } }}
                  style={{
                    marginTop: 12, display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px',
                    border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer',
                    background: editForm.is_aral ? 'var(--bg-soft, #f0f7f2)' : 'transparent',
                  }}
                >
                  <input type="checkbox" checked={!!editForm.is_aral} onChange={(e) => setEditForm((f) => ({ ...f, is_aral: e.target.checked }))} style={{ marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Enroll to Aral Program</div>
                    <div className="hint">Reading &amp; numeracy remediation tracking — PHIL-IRI baseline, intervention sessions and progress monitoring.</div>
                  </div>
                </div>

                {editIsShs ? (
                  <>
                    <div style={{ margin: '12px 0 4px' }}>
                      <label style={{ fontWeight: 600 }}>Enrolled subjects — tick the cores and electives for this term</label>
                      <div className="hint">{editSelected.length} of {editSubjects.length} selected</div>
                    </div>
                    <div style={{ position: 'relative', marginBottom: 8 }}>
                      <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                      <input
                        className="input"
                        placeholder="Search subjects by code or title…"
                        value={editSearch}
                        onChange={(e) => setEditSearch(e.target.value)}
                        style={{ paddingLeft: 30 }}
                      />
                    </div>
                    {editGroups.length === 0 ? (
                      <div className="hint">No subjects found for this grade level.</div>
                    ) : (
                      <>
                        {editGroups.map((g) => (
                          <CheckGroup key={g.cat} label={g.label} items={g.items} selectedSubjects={editSelected} toggleSubject={toggleEditSubject} toggleGroup={toggleEditGroup} />
                        ))}
                      </>
                    )}
                  </>
                ) : (
                  <div className="hint" style={{ marginTop: 10 }}>Subject checklist is available for Senior High School learners.</div>
                )}

                <div className="modal-actions" style={{ marginTop: 16 }}>
                  <button className="btn" onClick={() => { if (!editSaving) setEditing(null); }}>Cancel</button>
                  <button className="btn btn-primary" onClick={saveEdit} disabled={editSaving}>
                    {editSaving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
</div>
            );
          })()}
        </Modal>
      )}
    </>
  );
}
