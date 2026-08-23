import { useEffect, useState } from 'react';
import { Plus, AlertTriangle, Users, FileText, PhoneCall } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, Badge, Empty, Spinner, ErrorBanner, Modal } from '../components/ui';
import { downloadDoc } from '../lib/export';

const CATEGORIES = [
  ['academic_recovery', 'Academic Recovery'],
  ['remediation', 'Remediation'],
  ['enrichment', 'Enrichment'],
  ['attendance', 'Attendance'],
  ['behavior', 'Behavior'],
  ['guidance', 'Guidance'],
  ['health', 'Health'],
  ['reading', 'Reading'],
  ['numeracy', 'Numeracy'],
  ['home_visitation', 'Home Visitation'],
];
const RISK_CLASS = { High: 'badge-red', Moderate: 'badge-yellow', Low: 'badge-blue', None: 'badge-gray' };

const blank = { student_id: '', title: '', category: 'academic_recovery', strategy: '', frequency: '', start_date: '', end_date: '', status: 'active', progress_notes: '' };

export default function Interventions() {
  const [plans, setPlans] = useState(null);
  const [atRisk, setAtRisk] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [students, setStudents] = useState([]);

  async function load() {
    try {
      const [p, a, s] = await Promise.all([
        api('/interventions'),
        api('/interventions/at-risk'),
        api('/interventions/stats'),
      ]);
      setPlans(p.data);
      setAtRisk(a.data);
      setStats(s);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (modal && students.length === 0) {
      api('/students?limit=200').then((r) => setStudents(r.data)).catch(() => {});
    }
  }, [modal, students.length]);

  async function save() {
    if (!form.student_id || !form.title) return alert('Select a learner and give the plan a title');
    setBusy(true);
    try {
      await api('/interventions', { method: 'POST', body: form });
      setModal(false);
      setForm(blank);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(p, status) {
    await api(`/interventions/${p.id}`, { method: 'PATCH', body: { status } });
    await load();
  }

  async function remove(p) {
    if (!confirm('Delete this intervention plan?')) return;
    await api(`/interventions/${p.id}`, { method: 'DELETE' });
    await load();
  }

  async function parentNotice(p) {
    setBusy(true);
    try {
      const r = await api('/interventions/ai/parent-notice', { method: 'POST', body: { student_id: p.student_id, reason: p.progress_notes || `the ongoing ${p.category} intervention` } });
      setNotice({ text: r.body || r.text || '', meta: p });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const catName = (c) => (CATEGORIES.find((x) => x[0] === c) || [c, c])[1];

  return (
    <div>
      <PageHead title="Learner Intervention" sub="Predictive risk detection, intervention plans, parent engagement, and effectiveness analytics.">
        <button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={15} /> New intervention plan</button>
      </PageHead>
      <ErrorBanner error={error} />

      <div className="grid-4">
        <div className="card kpi"><div className="kpi-num danger">{atRisk ? atRisk.filter((a) => a.risk === 'High').length : '—'}</div><div className="kpi-lbl">High-risk learners</div></div>
        <div className="card kpi"><div className="kpi-num warn">{atRisk ? atRisk.filter((a) => a.risk === 'Moderate').length : '—'}</div><div className="kpi-lbl">Moderate risk</div></div>
        <div className="card kpi"><div className="kpi-num">{stats ? stats.active : '—'}</div><div className="kpi-lbl">Active plans</div></div>
        <div className="card kpi"><div className="kpi-num accent">{atRisk ? atRisk.filter((a) => a.risk !== 'None' && !a.has_plan).length : '—'}</div><div className="kpi-lbl">Risk without a plan</div></div>
      </div>

      <div className="card">
        <h4><AlertTriangle size={15} /> Predictive risk detection <span className="sub">(grades + attendance + reading)</span></h4>
        {!atRisk ? <Spinner /> : (
          <table className="table">
            <thead>
              <tr><th>Learner</th><th>Section</th><th>Avg grade</th><th>Attendance</th><th>Reading</th><th>Risk</th><th>Indicators</th><th>Plan?</th></tr>
            </thead>
            <tbody>
              {atRisk.filter((a) => a.risk !== 'None').slice(0, 12).map((a) => (
                <tr key={a.student_id}>
                  <td>{a.name}</td>
                  <td>{a.section_name || '—'}</td>
                  <td>{a.avg_grade}</td>
                  <td>{a.attendance_rate}%</td>
                  <td>{a.reading_level || '—'}</td>
                  <td><span className={`badge ${RISK_CLASS[a.risk]}`}>{a.risk}</span></td>
                  <td className="sub">{a.indicators.join(', ') || '—'}</td>
                  <td>{a.has_plan ? <span className="badge badge-green">ON FILE</span> : <button className="btn btn-sm" onClick={() => { setForm({ ...blank, student_id: a.student_id, title: `Intervention for ${a.name}` }); setModal(true); }}><Plus size={12} /> Plan</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h4>Intervention plans</h4>
        {!plans ? <Spinner /> : plans.length === 0 ? <Empty text="No intervention plans yet. Flag a learner above and create one." /> : (
          <div className="grid-2">
            {plans.map((p) => (
              <div className="card card-inset" key={p.id}>
                <div className="card-top">
                  <Users size={16} className="accent-ic" />
                  <Badge status={p.status} />
                </div>
                <h5>{p.title}</h5>
                <p className="sub">{p.first_name} {p.last_name} · {catName(p.category)}</p>
                <p className="sub">{p.strategy}</p>
                <p className="sub">Frequency: {p.frequency || '—'} · {p.start_date || '—'} to {p.end_date || 'ongoing'}</p>
                {p.progress_notes && <div className="notice ok">{p.progress_notes}</div>}
                {(p.contacts || []).length > 0 && <div className="mini-stats"><span><PhoneCall size={12} /> {(p.contacts || []).length} parent contacts logged</span></div>}
                <div className="card-actions">
                  <button className="btn btn-sm" onClick={() => parentNotice(p)} disabled={busy}><FileText size={13} /> Parent notice</button>
                  {p.status === 'active' && <button className="btn btn-sm" onClick={() => updateStatus(p, 'completed')}>Complete</button>}
                  <button className="btn btn-sm btn-danger" onClick={() => remove(p)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <Modal title="New Intervention Plan" sub="Interventions protect learners — AI detects risk, you prescribe the response." onClose={() => setModal(null)} wide>
          <div className="form-row">
            <label>Learner *
              <select value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
                <option value="">Select learner...</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} — {s.lrn}</option>)}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>Plan title *<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          </div>
          <div className="form-row">
            <label>Category
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
            </label>
            <label>Status
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>Strategy<input value={form.strategy} onChange={(e) => setForm({ ...form, strategy: e.target.value })} placeholder="e.g. Daily 20-min guided reading" /></label>
            <label>Frequency<input value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} placeholder="e.g. 3x per week" /></label>
          </div>
          <div className="form-row">
            <label>Start<input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></label>
            <label>End<input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></label>
          </div>
          <div className="form-row">
            <label>Progress notes<textarea rows={2} value={form.progress_notes} onChange={(e) => setForm({ ...form, progress_notes: e.target.value })} /></label>
          </div>
          <div className="modal-footer">
            <button className="btn" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save plan'}</button>
          </div>
        </Modal>
      )}

      {notice && (
        <Modal title="AI parent notification draft" sub={`For ${notice.meta.first_name} ${notice.meta.last_name}`} onClose={() => setNotice(null)} wide>
          <textarea className="doc-editor" rows={16} value={notice.text} readOnly />
          <div className="doc-export">
            <button className="btn btn-primary btn-sm" onClick={() => downloadDoc('Parent Notice', notice.text, 'parent-notice.doc')}>Download (.doc)</button>
            <button className="btn btn-sm" onClick={() => setNotice(null)}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}