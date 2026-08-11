import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { BookOpenCheck, Plus, Sparkles, TrendingUp, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, Badge, Empty, Spinner, ErrorBanner, Modal } from '../components/ui';

const LEVELS = ['Independent', 'Instructional', 'Frustration', 'Non-Reader'];
const KINDS = [
  ['reading', 'PHIL-IRI'],
  ['reading', 'EGRA'],
  ['reading', 'Reading Inventory'],
  ['numeracy', 'Numeracy Assessment'],
];

export default function ReadingNumeracy() {
  const [students, setStudents] = useState(null);
  const [records, setRecords] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ student_id: '', kind: 'reading', assessment_type: 'PHIL-IRI', date: new Date().toISOString().slice(0, 10), score: '', max_score: 20, level: '', fluency: '', remarks: '' });
  const [recommend, setRecommend] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [s, r, st] = await Promise.all([
        api('/learner-progress/students'),
        api('/learner-progress'),
        api('/learner-progress/stats'),
      ]);
      setStudents(s.data);
      setRecords(r.data);
      setStats(st);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!form.student_id || !form.date) return alert('Select a learner and date');
    setBusy(true);
    try {
      await api('/learner-progress', { method: 'POST', body: { ...form, score: form.score === '' ? null : form.score, max_score: form.max_score === '' ? null : form.max_score } });
      setModal(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!confirm('Delete this assessment record?')) return;
    await api(`/learner-progress/${id}`, { method: 'DELETE' });
    await load();
  }

  async function recommendFor(sid) {
    setBusy(true);
    try {
      const r = await api('/learner-progress/ai/recommend', { method: 'POST', body: { student_id: sid } });
      setRecommend(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const levelBadge = (lvl) => {
    const map = { Independent: 'green', Instructional: 'blue', Frustration: 'yellow', 'Non-Reader': 'red', Developing: 'blue', 'Non-Numerate': 'red' };
    return lvl ? <Badge status={map[lvl]} /> : <span className="sub">Not assessed</span>;
  };

  return (
    <div>
      <PageHead title="Reading & Numeracy" sub="PHIL-IRI, EGRA, reading inventories, and numeracy assessments with AI risk prediction and growth analytics.">
        <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={15} /> Record assessment</button>
      </PageHead>
      <ErrorBanner error={error} />

      <div className="grid-4">
        <div className="card kpi"><div className="kpi-num">{stats ? stats.assessed : '—'}</div><div className="kpi-lbl">Learners assessed</div></div>
        <div className="card kpi"><div className="kpi-num accent">{stats ? stats.risk_count : '—'}</div><div className="kpi-lbl">At risk (Frustration/Non-Reader)</div></div>
        <div className="card kpi"><div className="kpi-num">{stats ? (stats.growth.length ? `${stats.growth[stats.growth.length - 1].pct}%` : '—') : '—'}</div><div className="kpi-lbl">Latest mean reading score</div></div>
        <div className="card kpi"><div className="kpi-num warn">{students ? students.filter((s) => s.risk === 'At risk').length : '—'}</div><div className="kpi-lbl">Students flagged at risk</div></div>
      </div>

      <div className="two-col" style={{ alignItems: 'start' }}>
        <div className="card">
          <h4>Learner reading levels</h4>
          {!stats ? <Spinner /> : stats.distribution.every((d) => d.value === 0) ? <Empty text="No PHIL-IRI results encoded yet." /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--text-dim)" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--text-dim)" />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 }} />
                <Bar dataKey="value" name="Learners" fill="var(--accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {stats && stats.growth.length > 0 && (
            <div className="mini-note"><TrendingUp size={13} /> Reading growth tracked across {stats.growth.length} assessment dates.</div>
          )}
        </div>

        <div className="card">
          <h4>Interventions</h4>
          <button className="btn btn-sm" onClick={() => recommendFor('')} disabled={busy}>
            <Sparkles size={13} /> {recommend ? 'Refresh recommendations' : 'AI recommendations'}
          </button>
          {recommend && (
            <div className="suggest-list" style={{ marginTop: 10 }}>
              {recommend.level ? <div className="sub">Based on current level: <b>{recommend.level}</b></div> : <div className="sub">No reading record yet — encode results to unlock recommendations.</div>}
              {recommend.suggestions.map((s, i) => <div key={i} className="suggest-item" style={{ cursor: 'default' }}>{s}</div>)}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h4>Learner results <span className="sub">(PHIL-IRI / EGRA / numeracy)</span></h4>
        {!students ? <Spinner /> : (
          <table className="table">
            <thead>
              <tr><th>Learner</th><th>Section</th><th>Reading level</th><th>Last reading score</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>{s.first_name} {s.last_name}</td>
                  <td>{s.section_name || '—'}</td>
                  <td>{levelBadge(s.reading_level)}</td>
                  <td>{s.last_reading_score != null ? `${s.last_reading_score}/${s.last_reading_max}` : '—'}</td>
                  <td>{s.reading_level && s.reading_level !== 'Not assessed' ? (s.risk === 'At risk' ? <span className="badge-red badge">AT RISK</span> : <span className="badge-green badge">ON TRACK</span>) : <span className="sub">—</span>}</td>
                  <td><button className="btn btn-sm" onClick={() => recommendFor(s.id)}><Sparkles size={12} /> Advise</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h4>Assessment log <span className="sub">(latest records)</span></h4>
        {!records ? <Spinner /> : records.length === 0 ? <Empty text="No assessment records yet." /> : (
          <table className="table">
            <thead><tr><th>Date</th><th>Learner</th><th>Kind</th><th>Type</th><th>Score</th><th>Level</th><th>Fluency</th><th></th></tr></thead>
            <tbody>
              {records.slice(0, 15).map((r) => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>{r.first_name} {r.last_name}</td>
                  <td>{r.kind}</td>
                  <td>{r.assessment_type}</td>
                  <td>{r.score != null ? `${r.score}/${r.max_score}` : '—'}</td>
                  <td>{levelBadge(r.level)}</td>
                  <td>{r.fluency || '—'}</td>
                  <td><button className="btn btn-sm btn-danger" onClick={() => remove(r.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <Modal title="Record learner assessment" sub="Score is optional — levels are auto-derived from percentages when blank." onClose={() => setModal(null)} wide>
          <div className="form-row">
            <label>Learner *
              <select value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
                <option value="">Select learner...</option>
                {(students || []).map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.grade_level})</option>)}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>Area
              <select value={form.kind} onChange={(e) => { const k = KINDS.find((x) => x[0] === e.target.value); setForm({ ...form, kind: e.target.value, assessment_type: k ? k[1] : 'PHIL-IRI' }); }}>
                <option value="reading">Reading</option>
                <option value="numeracy">Numeracy</option>
              </select>
            </label>
            <label>Assessment
              <select value={form.assessment_type} onChange={(e) => setForm({ ...form, assessment_type: e.target.value })}>
                {KINDS.filter((k) => k[0] === form.kind).map((k) => <option key={k[1]}>{k[1]}</option>)}
              </select>
            </label>
            <label>Date *<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          </div>
          <div className="form-row">
            <label>Score<input type="number" min="0" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} /></label>
            <label>Max score<input type="number" min="1" value={form.max_score} onChange={(e) => setForm({ ...form, max_score: e.target.value })} /></label>
            <label>Level
              <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                <option value="">Auto from percentage</option>
                {LEVELS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>Fluency
              <select value={form.fluency} onChange={(e) => setForm({ ...form, fluency: e.target.value })}>
                <option value="">—</option>
                {['Fluent', 'Fairly Fluent', 'Slow', 'Non-Fluent'].map((f) => <option key={f}>{f}</option>)}
              </select>
            </label>
            <label>Remarks<input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} placeholder="Optional" /></label>
          </div>
          <div className="modal-footer">
            <button className="btn" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save record'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}