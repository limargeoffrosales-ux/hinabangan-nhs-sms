import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { RotateCcw, FileText, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { SHS_TRACKS, ENROLLMENT_STATUSES, ENROLLMENT_DOC_TYPES, CURRENT_SCHOOL_YEAR } from '../lib/constants';
import { PageHead, Modal, Empty, ErrorBanner, Badge, SearchInput, ConfirmModal, SkeletonTable } from '../components/ui';
import { useToast } from '../components/Toast';
import { useTranslation } from 'react-i18next';

const STATUS_MAP = Object.fromEntries(ENROLLMENT_STATUSES.map((s) => [s.value, s.label]));
const statusLabel = (v) => STATUS_MAP[v] || v || '—';
const DOC_LABELS = Object.fromEntries(ENROLLMENT_DOC_TYPES.map((d) => [d.value, d.label]));

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
  const { t } = useTranslation();
  const [students, setStudents] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [recent, setRecent] = useState([]);
  const [recentSort, setRecentSort] = useState({ key: 'recent', dir: 'desc' });
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
  const [docs, setDocs] = useState([]);
  const [newDocType, setNewDocType] = useState('psa_birth');
  const [docUploading, setDocUploading] = useState(false);
  const [autoFillInfo, setAutoFillInfo] = useState('');
  const [confirmDocDelete, setConfirmDocDelete] = useState(null);
  const skipNextAutoFill = useRef(false);

  const load = useCallback(async (q, quiet) => {
    if (!quiet) setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: '300', sort: 'recent_enrolled' });
      if (q) qs.set('q', q);
      const [st, se, rec] = await Promise.all([
        retryFetch(() => api('/students?' + qs)),
        retryFetch(() => api('/sections?limit=200')),
        retryFetch(() => api('/enrollments/recent?limit=50')).catch(() => ({ data: [] })),
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
    const prevGl = form.grade_level;
    const glChanged = !!sec?.grade_level && sec.grade_level !== prevGl;
    setForm((f) => ({ ...f, section_id: v, grade_level: sec?.grade_level || f.grade_level, strand: sec?.strand || f.strand }));
    if (glChanged) {
      // Promoting (or demoting) through a re-enrollment: last year's subjects
      // no longer fit this grade level, so drop the baseline and let the
      // defaults effect refill the checklist for the new grade. Same-grade
      // section changes keep the copied set — the checklist is unchanged.
      skipNextAutoFill.current = false;
      setSelectedSubjects([]);
    }
  }

  function onTermChange(v) {
    skipNextAutoFill.current = false;
    setForm((f) => ({ ...f, term: v }));
  }

  function onStrandChange(v) {
    skipNextAutoFill.current = false;
    setForm((f) => ({ ...f, strand: v }));
  }

  useEffect(() => {
    const g = form.grade_level;
    if (g && /^Grade 1[12]$/.test(g)) loadSubjectsFor(g);
    else setSubjects([]);
  }, [form.grade_level]);

  const isShsGrade = /^Grade 1[12]$/.test(form.grade_level || '');

  // Pre-tick the standard subject set (cores + the strand's sector electives)
  // from the curriculum whenever the grade/strand/term change. The registrar
  // adjusts from a sane baseline instead of re-ticking every subject.
  const applyDefaults = useCallback(async () => {
    const g = form.grade_level;
    if (!g || !/^Grade 1[12]$/.test(g)) return false;
    try {
      const qs = new URLSearchParams({ grade_level: g });
      if (form.term) qs.set('term', form.term);
      if (form.strand) qs.set('strand', form.strand);
      const res = await retryFetch(() => api(`/enrollments/default-subjects?${qs}`), 2);
      const ids = (res.data || []).map(Number);
      setSelectedSubjects(ids);
      setAutoFillInfo(form.strand && ids.length
        ? `Auto-filled ${ids.length} ${ids.length === 1 ? 'subject' : 'subjects'} from the ${form.strand} curriculum — adjust below if needed.`
        : ids.length
          ? `Auto-filled ${ids.length} core ${ids.length === 1 ? 'subject' : 'subjects'} for ${g}.`
          : 'No default subjects found for this grade, strand and term.');
      return ids.length > 0;
    } catch (e) {
      setError(e.status === 500 ? 'Default subjects could not be loaded — refresh to try again.' : e.message);
      return false;
    }
  }, [form.grade_level, form.term, form.strand]);

  useEffect(() => {
    if (skipNextAutoFill.current) { skipNextAutoFill.current = false; return; }
    if (isShsGrade && form.term) applyDefaults();
  }, [applyDefaults, isShsGrade]);

  const group = useMemo(() => {
    if (!isShsGrade) return [];
    const q = search.trim().toLowerCase();
    const list = subjects.filter((s) => !q || `${s.code} ${s.title}`.toLowerCase().includes(q));
    return CATEGORIES.map(({ cat, label }) => ({ cat, label, items: list.filter((s) => catOf(s) === cat) }))
      .filter((g) => g.items.length > 0);
  }, [subjects, search, isShsGrade]);

  const totalAvailable = useMemo(() => (isShsGrade ? subjects.length : 0), [subjects, isShsGrade]);

  function toggleSubject(id) {
    setAutoFillInfo('');
    setSelectedSubjects((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));
  }

  function toggleGroup(list) {
    setAutoFillInfo('');
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
      setAutoFillInfo('');
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

  // One-click re-enrollment: copy the learner's most recent enrollment into
  // the main form for the current school year. Section is left blank so the
  // registrar picks the right one; strand/term/subjects/Aral carry over.
  async function prefillReEnroll(r) {
    setError(null);
    try {
      const res = await retryFetch(() => api(`/enrollments/student/${r.student_id}`), 2);
      const rows = (res.data || []).filter((x) => x.school_year !== CURRENT_SCHOOL_YEAR);
      const latest = rows[0];
      if (!latest) {
        const current = (res.data || [])[0];
        if (current && current.school_year === CURRENT_SCHOOL_YEAR) {
          return setError(`This learner is already enrolled for ${CURRENT_SCHOOL_YEAR}.`);
        }
        return setError('No previous enrollment to copy.');
      }
      const student = students.find((s) => s.id === Number(r.student_id)) || history?.student
        || { last_name: '', first_name: '' };
      const isShs1 = /^Grade 1[12]$/.test(latest.grade_level || '');
      skipNextAutoFill.current = true;
      setForm((f) => ({
        ...f,
        student_id: String(r.student_id),
        grade_level: latest.grade_level,
        strand: latest.strand || f.strand,
        term: latest.term || 'first',
        school_year: CURRENT_SCHOOL_YEAR,
        section_id: '',
        is_aral: !!latest.is_aral,
        status: 'enrolled',
      }));
      setSelectedSubjects(isShs1 ? (latest.subjects || []).map((s) => s.subject_id) : []);
      setAutoFillInfo(isShs1 && latest.subjects?.length
        ? `Re-enrolling ${student.last_name}, ${student.first_name} — copied ${latest.subjects.length} subjects from ${latest.school_year}. Pick a section and press Enroll.`
        : `Re-enrolling ${student.last_name}, ${student.first_name} — copied from ${latest.school_year}. Pick a section and press Enroll.`);
      setShowHistory(false);
      setStudentSearch(student.last_name ? `${student.last_name}, ${student.first_name}`.trim() : '');
      toast.success(`Re-enrollment drafted from ${latest.school_year} — confirm and enroll.`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
      loadDocs(enr.id);
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
      setDocs([]);
      load(studentSearch.trim(), true);
    } catch (e) {
      setError(e.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function approveEnrollment(enId) {
    try {
      await api(`/enrollments/${enId}`, { method: 'PATCH', body: { status: 'enrolled' } });
      toast.success('Student enrollment approved and confirmed.');
      load(studentSearch.trim(), true);
    } catch (e) {
      setError(e.message);
    }
  }

  const pendingEnrollments = recent.filter((r) => r.status === 'pending');

  async function loadDocs(id) {
    try {
      const res = await retryFetch(() => api(`/enrollments/${id}/documents`), 2);
      setDocs(res.data || []);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDocUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file || !editing) return;
    setDocUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const up = await api('/uploads/file?folder=enrollment_docs', { method: 'POST', body: fd });
      await api(`/enrollments/${editing.id}/documents`, {
        method: 'POST',
        body: { doc_type: newDocType, url: up.url, key: up.key, name: up.name || file.name },
      });
      toast.success('Requirement uploaded.');
      loadDocs(editing.id);
    } catch (e2) {
      setError(e2.message);
    } finally {
      setDocUploading(false);
      e.target.value = '';
    }
  }

  async function deleteDoc(doc) {
    setConfirmDocDelete(doc);
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

  const eligible = students.filter((s) => s.status === 'enrolled' && !s.has_subjects);
  const searchActive = studentSearch.trim().length > 0;
  const visibleStudents = searchActive ? students.filter((s) => s.status === 'enrolled') : eligible;
  const eligibleHint = searchActive
    ? `${visibleStudents.length} ${visibleStudents.length === 1 ? 'matching learner' : 'matching learners'} (including already-enrolled — type to pin down a specific learner)`
    : `${eligible.length} ${eligible.length === 1 ? 'learner' : 'learners'} available to enroll`;
  const selectedCount = selectedSubjects.length;

  // Sortable columns head the "Recently Enrolled" list so teachers can group
  // records by section or grade level and spot (then edit) wrongly-recorded
  // enrollments. Default stays newest-first.
  const sortedRecent = useMemo(() => {
    const { key, dir } = recentSort;
    const list = [...recent];
    const gradeNum = (g) => { const m = /(\d+)/.exec(String(g || '')); return m ? Number(m[1]) : 0; };
    const secOf = (r) => String(r.section_name || '').toLowerCase();
    const nameOf = (r) => `${String(r.last_name || '')}, ${String(r.first_name || '')}`.toLowerCase();
    const cmp = (a, b) => {
      if (key === 'section') {
        return secOf(a).localeCompare(secOf(b)) || gradeNum(a.grade_level) - gradeNum(b.grade_level) || nameOf(a).localeCompare(nameOf(b));
      }
      if (key === 'grade') {
        return gradeNum(a.grade_level) - gradeNum(b.grade_level) || secOf(a).localeCompare(secOf(b)) || nameOf(a).localeCompare(nameOf(b)) || (Number(a.id) || 0) - (Number(b.id) || 0);
      }
      if (key === 'name') {
        return nameOf(a).localeCompare(nameOf(b));
      }
      return (Number(a.id) || 0) - (Number(b.id) || 0);
    };
    return dir === 'asc' ? list.sort(cmp) : list.sort((a, b) => -cmp(a, b));
  }, [recent, recentSort]);

  const recentSortMark = (key) => (recentSort.key === key
    ? <span style={{ fontSize: 10, marginLeft: 3 }}>{recentSort.dir === 'asc' ? '▲' : '▼'}</span>
    : null);

  const recentAriaSort = (key) => (recentSort.key === key
    ? (recentSort.dir === 'asc' ? 'ascending' : 'descending')
    : 'none');

  function toggleRecentSort(key) {
    setRecentSort((s) => (s.key === key
      ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'recent' ? 'desc' : 'asc' }));
  }

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
      {loading ? <SkeletonTable rows={8} cols={5} /> : (
        <>
          <div className="kpi-strip" style={{ marginBottom: 20, gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="card kpi" style={{ padding: '14px 16px' }}>
              <div className="sub">Total Enrolled</div>
              <div className="value" style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>{recent.filter(r => r.status === 'enrolled').length}</div>
            </div>
            <div className="card kpi" style={{ padding: '14px 16px' }}>
              <div className="sub">Pending Applications</div>
              <div className="value" style={{ fontSize: 24, fontWeight: 700, color: 'var(--warn)' }}>{pendingEnrollments.length}</div>
            </div>
            <div className="card kpi" style={{ padding: '14px 16px' }}>
              <div className="sub">Available Learners</div>
              <div className="value" style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>{eligible.length}</div>
            </div>
            <div className="card kpi" style={{ padding: '14px 16px' }}>
              <div className="sub">Active Sections</div>
              <div className="value" style={{ fontSize: 24, fontWeight: 700, color: 'var(--purple)' }}>{sections.length}</div>
            </div>
          </div>

          <div className="two-col">
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Enroll a Student</h3>
            <form onSubmit={submit}>
              <SearchInput
                placeholder="Search learners by name or LRN — updates the list below…"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
              <label>Student</label>
              <div className="hint" style={{ marginTop: -6, marginBottom: 6 }}>{eligibleHint}</div>
              <select required value={form.student_id} onChange={(e) => onStudentChange(e.target.value)}>
                <option value="">— select learner —</option>
                {visibleStudents.map((s) => (
                  <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} ({s.lrn}){s.has_subjects ? ' — already enrolled' : ''}</option>
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
                  <select value={form.strand} onChange={(e) => onStrandChange(e.target.value)} disabled={!isShsGrade}>
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
                  <div style={{ margin: '12px 0 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <label style={{ fontWeight: 600 }}>Enrolled subjects — tick the cores and electives for this term</label>
                    <button type="button" className="btn btn-sm" onClick={() => applyDefaults()} title="Restore the standard subject set from the curriculum">
                      <RotateCcw size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Refill curriculum defaults
                    </button>
                  </div>
                  {autoFillInfo && (
                    <div className="hint" style={{ padding: '6px 10px', background: 'var(--bg-soft, #f0f7f2)', borderRadius: 6, marginBottom: 8 }}>
                      {autoFillInfo}
                    </div>
                  )}
                  <div className="hint">
                    Full SSHS catalog for Grade 11 and 12 · available in all three terms · {selectedCount} of {totalAvailable} selected
                  </div>
                  <SearchInput
                    placeholder="Search subjects by code or title…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
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
            {pendingEnrollments.length > 0 && (
              <div style={{ marginBottom: 20, padding: 14, background: 'rgba(var(--rgb-warn), 0.12)', border: '1px solid rgba(var(--rgb-warn), 0.35)', borderRadius: 12 }}>
                <h4 style={{ margin: '0 0 8px 0', color: 'var(--warn)' }}>Pending Student Enrollment Applications ({pendingEnrollments.length})</h4>
                <p className="sub" style={{ margin: '0 0 10px 0', fontSize: 12 }}>Students have applied for enrollment online. Review and confirm their section placement.</p>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Section</th>
                        <th>Grade / Term</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingEnrollments.map((p) => (
                        <tr key={p.id}>
                          <td><strong>{p.last_name}, {p.first_name}</strong><br /><span className="sub">LRN {p.lrn || '—'}</span></td>
                          <td>{p.section_name || '—'}</td>
                          <td>{p.grade_level}{p.term ? ` · ${p.term[0].toUpperCase() + p.term.slice(1)}` : ''}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="btn btn-sm btn-primary" onClick={() => approveEnrollment(p.id)} style={{ background: 'var(--success)' }}>Approve</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <h3 style={{ marginTop: 0 }}>Recently Enrolled</h3>
            <div className="hint" style={{ marginTop: -6, marginBottom: 8 }}>
              Tap a column heading to sort by student, section or grade — find and fix wrongly-recorded enrollments.
            </div>
            {recent.length === 0 ? <Empty text="No enrollments recorded yet." /> : (
              <table>
                <thead>
                  <tr>
                    <th style={{ cursor: 'pointer', userSelect: 'none' }} aria-sort={recentAriaSort('name')} onClick={() => toggleRecentSort('name')}>Student{recentSortMark('name')}</th>
                    <th style={{ cursor: 'pointer', userSelect: 'none' }} aria-sort={recentAriaSort('section')} onClick={() => toggleRecentSort('section')}>Section{recentSortMark('section')}</th>
                    <th style={{ cursor: 'pointer', userSelect: 'none' }} aria-sort={recentAriaSort('grade')} onClick={() => toggleRecentSort('grade')}>Grade{recentSortMark('grade')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRecent.map((r) => (
                    <tr key={r.id}>
                      <td>{r.last_name}, {r.first_name}</td>
                      <td>{r.section_name || '—'}</td>
                      <td>{r.grade_level}{r.term ? ` · ${r.term[0].toUpperCase() + r.term.slice(1)}` : ''}</td>
<td style={{ textAlign: 'right' }}>
  <button className="btn btn-sm" onClick={() => startEdit({ id: r.id, student_id: r.student_id })}>Edit</button>
  <button className="btn btn-sm" style={{ marginLeft: 4 }} onClick={() => viewHistory({ id: r.student_id, last_name: r.last_name, first_name: r.first_name, lrn: r.lrn })}>History</button>
  {r.school_year !== CURRENT_SCHOOL_YEAR && (
    <button className="btn btn-sm" style={{ marginLeft: 4 }} onClick={() => prefillReEnroll(r)}>Re-enroll</button>
  )}
</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          </div>
        </>
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
                    <td>{statusLabel(r.status)}</td>
                    <td>{r.enrolled_at || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-sm" onClick={() => { setShowHistory(false); startEdit({ id: r.id, student_id: r.student_id }); }}>Edit</button>
                      {r.school_year !== CURRENT_SCHOOL_YEAR && (
                        <button className="btn btn-sm" style={{ marginLeft: 4 }} onClick={() => prefillReEnroll(r)}>Re-enroll</button>
                      )}
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
          onClose={() => { if (!editSaving) { setEditing(null); setDocs([]); } }}
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
                    <SearchInput
                      placeholder="Search subjects by code or title…"
                      value={editSearch}
                      onChange={(e) => setEditSearch(e.target.value)}
                    />
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

                <div style={{ marginTop: 16 }}>
                  <label style={{ fontWeight: 600 }}>Requirements (PSA, Form 138, ...)</label>
                  <div className="hint">Upload scanned copies — attached to this enrollment record.</div>
                  {docs.length === 0 ? (
                    <Empty text="No requirement files attached yet." />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                      {docs.map((d) => (
                        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6 }}>
                          <FileText size={14} style={{ opacity: 0.6, flexShrink: 0 }} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{DOC_LABELS[d.doc_type] || d.doc_type}</div>
                            <div className="hint">{d.file_name || d.file_url}{d.uploaded_by_name ? ` · ${d.uploaded_by_name}` : ''}</div>
                          </div>
                          <a className="btn btn-sm" href={d.file_url} target="_blank" rel="noreferrer">View</a>
                          <button className="btn btn-sm" aria-label="Remove requirement" onClick={() => deleteDoc(d)}><Trash2 size={13} style={{ verticalAlign: -2 }} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="form-row" style={{ marginTop: 8 }}>
                    <div style={{ flex: 1 }}>
                      <select value={newDocType} onChange={(e) => setNewDocType(e.target.value)} aria-label="Requirement type">
                        {ENROLLMENT_DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 2 }}>
                      <input type="file" className="input" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={handleDocUpload} disabled={docUploading} aria-label="Select requirement file to upload" />
                    </div>
                  </div>
                  {docUploading && <div className="hint" style={{ marginTop: 6 }}>Uploading…</div>}
                </div>

                <div className="modal-actions" style={{ marginTop: 16 }}>
                  <button className="btn" onClick={() => { if (!editSaving) { setEditing(null); setDocs([]); } }}>Cancel</button>
                  <button className="btn btn-primary" onClick={saveEdit} disabled={editSaving}>
                    {editSaving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
</div>
            );
          })()}
        </Modal>
      )}

      {confirmDocDelete && (
        <ConfirmModal
          message={t('enrollments.removeDocConfirm', 'Remove this requirement file from the enrollment?')}
          danger
          onCancel={() => setConfirmDocDelete(null)}
          onConfirm={async () => {
            const doc = confirmDocDelete;
            setConfirmDocDelete(null);
            setError(null);
            try {
              await api(`/enrollments/documents/${doc.id}`, { method: 'DELETE' });
              toast.success('Requirement removed.');
              loadDocs(editing.id);
            } catch (e) {
              setError(e.message);
            }
          }}
        />
      )}
    </>
  );
}
