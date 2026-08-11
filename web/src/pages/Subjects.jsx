import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, Modal, Empty, ErrorBanner, Spinner } from '../components/ui';

const TERM_LABELS = { first: 'First Term', second: 'Second Term', third: 'Third Term', all: 'All Terms (Core)' };
const TERM_OPTIONS = [
  { value: 'all', label: 'All Terms — Core subject (whole year)' },
  { value: 'first', label: 'First Term' },
  { value: 'second', label: 'Second Term' },
  { value: 'third', label: 'Third Term' },
  { value: '', label: 'Not term-based (quarter-based)' },
];
const EMPTY_FORM = { code: '', title: '', description: '', grade_level: 'Grade 11', track: 'academic', units: 0, term: '' };

function TermBadge({ term }) {
  if (!term) return <span className="term-badge term-quar">Quarter-based</span>;
  const map = { first: 'term-red', second: 'term-gold', third: 'term-blue', all: 'term-green' };
  return <span className={`term-badge ${map[term] || 'term-gray'}`}>{TERM_LABELS[term]}</span>;
}

export default function Subjects() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [gradeFilter, setGradeFilter] = useState('');
  const [termFilter, setTermFilter] = useState('');

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: '300' });
      if (gradeFilter) qs.set('grade_level', gradeFilter);
      if (termFilter) qs.set('term', termFilter);
      const res = await api(`/subjects?${qs}`);
      setRows(res.data);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [gradeFilter, termFilter]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setShowModal(true);
  }

  function openEdit(s) {
    setForm({ ...EMPTY_FORM, ...s, term: s.term || '' });
    setEditing(s.id);
    setShowModal(true);
  }

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e) {
    e.preventDefault();
    setError(null);
    try {
      const body = { ...form, term: form.term || null };
      if (editing) await api(`/subjects/${editing}`, { method: 'PATCH', body });
      else await api('/subjects', { method: 'POST', body });
      setShowModal(false);
      load();
    } catch (e2) {
      setError(e2.message);
    }
  }

  async function remove(s) {
    if (!confirm(`Delete subject ${s.code}?`)) return;
    await api(`/subjects/${s.id}`, { method: 'DELETE' });
    load();
  }

  const isSHS = form.grade_level === 'Grade 11' || form.grade_level === 'Grade 12';

  const field = (k, opts = {}) => (
    <input value={form[k] ?? ''} onChange={(e) => set(k, e.target.value)} {...opts} />
  );

  return (
    <>
      <PageHead title="Subjects" sub="Curriculum subjects — MATATAG (JHS) and Strengthened SHS Curriculum with term offerings">
        <button className="btn btn-primary" onClick={openCreate}><Plus size={15} /> New Subject</button>
      </PageHead>
      <div className="card filters-row" style={{ marginBottom: 12, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
        <select className="input" style={{ maxWidth: 180 }} value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
          <option value="">All grade levels</option>
          {['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <select className="input" style={{ maxWidth: 200 }} value={termFilter} onChange={(e) => setTermFilter(e.target.value)}>
          <option value="">All terms</option>
          {TERM_OPTIONS.filter((t) => t.value).map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <button className="btn btn-sm" onClick={load}>Refresh</button>
      </div>
      <ErrorBanner error={error} />
      {loading ? <Spinner /> : rows.length === 0 ? <Empty text="No subjects match the filters." /> : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th><th>Title</th><th>Grade Level</th><th>Track</th>
                <th>Term Offered</th><th>Units</th><th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontFamily: 'monospace' }}><strong>{s.code}</strong></td>
                  <td>{s.title}</td>
                  <td>{s.grade_level}</td>
                  <td className="track-chip">{s.track.toUpperCase()}</td>
                  <td><TermBadge term={s.term} /></td>
                  <td>{s.units}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-sm" onClick={() => openEdit(s)}><Pencil size={13} /></button>{' '}
                    <button className="btn btn-sm btn-danger" onClick={() => remove(s)}><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal
          title={editing ? 'Edit Subject' : 'New Subject'}
          sub="Subjects appear in class records and report cards; SHS subjects are assigned to a term offering"
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={save}>
            <div className="form-row">
              <div><label>Code *</label>{field('code', { required: true, placeholder: 'SSHS-GENMATH' })}</div>
              <div><label>Title *</label>{field('title', { required: true })}</div>
            </div>
            <div className="form-row">
              <div><label>Grade level *</label>
                <select value={form.grade_level} onChange={(e) => set('grade_level', e.target.value)}>
                  {['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', 'College'].map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div><label>Track</label>
                <select value={form.track} onChange={(e) => set('track', e.target.value)}>
                  <option value="general">General (JHS)</option>
                  <option value="academic">Academic — SSHS Core / Elective</option>
                  <option value="tvl">Technical-Professional (TechPro)</option>
                  <option value="sports">Sports elective</option>
                  <option value="arts">Arts & Design elective</option>
                </select>
              </div>
              <div><label>Units</label>{field('units', { type: 'number', step: '0.5', min: 0 })}</div>
            </div>
            {isSHS && (
              <label>Term offered (Senior High School) *
                <select required style={{ marginTop: 6 }} value={form.term} onChange={(e) => set('term', e.target.value)}>
                  <option value="">Select term…</option>
                  {TERM_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
            )}
            <label>Description</label>
            <textarea rows={3} value={form.description || ''} onChange={(e) => set('description', e.target.value)} />
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary">Save subject</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}