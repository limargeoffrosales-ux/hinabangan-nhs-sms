import { useEffect, useMemo, useState } from 'react';
import { FileText, Plus, Wand2, CheckCheck, Undo2, Send, ClipboardList } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { PageHead, Badge, Empty, Spinner, ErrorBanner, Modal } from '../components/ui';

const ADMIN = ['super_admin', 'school_admin'];
const FREQS = ['daily', 'weekly', 'monthly', 'quarterly', 'annual', 'periodic'];
const STATUS_BADGE = {
  draft: 'badge-gray', submitted: 'badge-blue', reviewed: 'badge-yellow',
  approved: 'badge-green', returned: 'badge-red',
};
const SCHOOL_YEARS = ['2027-2028', '2026-2027', '2025-2026', '2024-2025'];

function complianceOf(s) {
  if (['submitted', 'reviewed', 'approved'].includes(s.status)) return { label: 'Compiled', cls: 'badge-green' };
  if (s.due_date && s.due_date < new Date().toISOString().slice(0, 10) && s.status !== 'returned') return { label: 'Overdue', cls: 'badge-red' };
  return { label: 'Not complied', cls: 'badge-red' };
}

function defaultPeriod(freq) {
  const now = new Date();
  const iso = now.toISOString().slice(0, 10);
  if (freq === 'daily') return iso;
  if (freq === 'weekly') {
    const d = new Date(now);
    d.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return 'Week of ' + d.toISOString().slice(0, 10);
  }
  if (freq === 'monthly') return iso.slice(0, 7);
  if (freq === 'quarterly') return 'Q' + (Math.floor(now.getMonth() / 3) + 1) + ' ' + now.getFullYear();
  if (freq === 'annual') return 'SY ' + iso.slice(0, 4);
  return 'SY 2026-2027';
}

export default function Submissions() {
  const { user } = useAuth();
  const canAssign = can(user?.role, ...ADMIN);
  const [tab, setTab] = useState('mine');
  const [types, setTypes] = useState([]);
  const [rows, setRows] = useState([]);
  const [freq, setFreq] = useState('all');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [modal, setModal] = useState(null);
  const [queue, setQueue] = useState([]);

  async function load() {
    setError(null);
    try {
      const [t, r, q] = await Promise.all([
        api('/submissions/types'),
        api('/submissions'),
        api('/submissions'),
      ]);
      setTypes(t.data);
      const mine = (r.data || []).filter((s) => String(s.user_id) === String(user.id));
      const actionable = (q.data || []).filter((s) => s.my_review || s.my_approve);
      setRows(mine);
      setQueue(actionable);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  const shown = useMemo(() => {
    let out = rows;
    if (freq !== 'all') out = out.filter((r) => r.frequency === freq);
    if (search.trim()) {
      const s = search.toLowerCase();
      out = out.filter((r) => r.report_name.toLowerCase().includes(s) || r.code.toLowerCase().includes(s) || r.period.toLowerCase().includes(s));
    }
    return [...out].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
  }, [rows, freq, search]);

  async function act(id, action, body) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api(`/submissions/${id}/${action}`, { method: 'POST', body: body || {} });
      setNotice(`Submission updated (${action}).`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function ReviewRow({ s }) {
    return (
      <tr>
        <td>{s.report_name}<br /><span className="muted">{s.group_name} · {s.frequency}</span></td>
        <td>{s.user_name}<br /><span className="muted">@{s.username}</span></td>
        <td>{s.period}</td>
        <td><Badge status={s.status} /></td>
        <td>{s.review_note || '—'}</td>
        <td className="row-actions">
          {s.my_review && <button className="btn btn-sm" disabled={busy} onClick={() => act(s.id, 'review', { approved: true, review_note: 'Reviewed and endorsed.' })}><CheckCheck size={13} /> Endorse</button>}
          {s.my_review && <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => act(s.id, 'return', { review_note: 'Returned for revision.' })}><Undo2 size={13} /> Return</button>}
          {s.my_approve && <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => act(s.id, 'approve', {})}><CheckCheck size={13} /> Approve</button>}
          {!s.my_review && !s.my_approve && <span className="muted">Awaiting other reviewer</span>}
        </td>
      </tr>
    );
  }

  return (
    <div>
      <PageHead title="Teacher Submissions" sub="Paperless submission of every required report — input the data online or mark the task as done. No file uploads.">
        {canAssign && (
          <button className="btn" style={{ marginRight: 8 }} onClick={() => setModal({ mode: 'assign' })}>
            <ClipboardList size={15} /> Assign task
          </button>
        )}
        <button className="btn btn-primary" onClick={() => setModal({ mode: 'new' })}>
          <Plus size={15} /> New submission
        </button>
      </PageHead>
      <ErrorBanner error={error} />
      {notice && <div className="notice ok"><CheckCheck size={15} /> {notice}</div>}

      <div className="seg" style={{ marginBottom: 16 }}>
        <button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>My reports ({rows.length})</button>
        <button className={tab === 'queue' ? 'on' : ''} onClick={() => setTab('queue')}>Review & approval queue ({queue.length})</button>
      </div>

      {tab === 'mine' && (
        <div className="card">
          <div className="search-row">
            <input className="input" placeholder="Search report, code or period…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 340 }} />
            <select className="input" style={{ maxWidth: 170 }} value={freq} onChange={(e) => setFreq(e.target.value)}>
              <option value="all">All frequencies</option>
              {FREQS.map((f) => <option key={f} value={f}>{f[0].toUpperCase() + f.slice(1)}</option>)}
            </select>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Report</th><th>Period</th><th>Status</th><th>Compliance</th><th>Last updated</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {shown.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.report_name}</strong>
                      {s.is_deped_form === 1 || s.is_deped_form === true ? ' ' : ''}
                      {s.is_deped_form === 1 || s.is_deped_form === true ? <Badge status="high" /> : ''}
                      <br /><span className="muted">{s.group_name} · {s.frequency}</span>
                      {s.assigned_by ? <span className="badge badge-blue" style={{ marginLeft: 6 }}>ASSIGNED TASK</span> : null}
                      {s.due_date && <div className="muted" style={{ fontSize: 12 }}>Due: {s.due_date}</div>}
                      {s.review_note && s.status === 'returned' && <div className="muted" style={{ color: 'var(--danger)' }}>Note: {s.review_note}</div>}
                    </td>
                    <td>{s.period}</td>
                    <td><Badge status={s.status} /></td>
                    <td><span className={`badge ${complianceOf(s).cls}`}>{complianceOf(s).label}</span></td>
                    <td className="muted">{(s.updated_at || '').slice(0, 10)}</td>
                    <td className="row-actions">
                      {(s.status === 'draft' || s.status === 'returned') && (
                        <button className="btn btn-sm" onClick={() => setModal({ mode: 'edit', s })}><FileText size={13} /> Fill data</button>
                      )}
                      {(s.status === 'draft' || s.status === 'returned') && (
                        <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => act(s.id, 'submit', {})}><CheckCheck size={13} /> Mark as done</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!shown.length && <Empty text={rows.length ? 'No reports match your filters.' : 'No submissions yet — create your first report submission above.'} />}
          </div>
        </div>
      )}

      {tab === 'queue' && (
        <div className="card">
          <p className="sub">Reports waiting for your review or approval, routed by each report's configured workflow (e.g. Teacher → Department Head → Principal).</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Report</th><th>Submitted by</th><th>Period</th><th>Status</th><th>Review note</th><th>Action</th></tr>
              </thead>
              <tbody>
                {queue.map((s) => <ReviewRow key={s.id} s={s} />)}
              </tbody>
            </table>
            {!queue.length && <Empty text="Nothing waiting for you — every report is handled." />}
          </div>
        </div>
      )}

      {modal && modal.mode === 'assign' && (
        <AssignModal
          types={types}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
          onNotice={(t) => setNotice(t)}
        />
      )}
      {modal && modal.mode !== 'assign' && (
        <SubmissionModal
          mode={modal.mode}
          submission={modal.s}
          types={types}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
          onNotice={(t) => setNotice(t)}
        />
      )}
    </div>
  );
}

function AssignModal({ types, onClose, onSaved, onNotice }) {
  const groups = useMemo(() => [...new Set(types.map((t) => t.group_name))], [types]);
  const [typeId, setTypeId] = useState('');
  const [users, setUsers] = useState([]);
  const [userIds, setUserIds] = useState([]);
  const [period, setPeriod] = useState('');
  const [schoolYear, setSchoolYear] = useState('2026-2027');
  const [due, setDue] = useState('');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/submissions/teachers').then((r) => setUsers(r.data || [])).catch((e) => setErr(e.message));
  }, []);

  const staff = users.filter((u) => !['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'].includes(u.role));
  const type = types.find((t) => String(t.id) === typeId);

  function pickType(id) {
    setTypeId(id);
    const t = types.find((x) => String(x.id) === id);
    if (t) setPeriod(defaultPeriod(t.frequency));
  }

  function toggleUser(id) {
    setUserIds((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const res = await api('/submissions/assign', {
        method: 'POST',
        body: {
          report_type_id: Number(typeId), user_ids: userIds,
          school_year: schoolYear, period, due_date: due || null, notes: notes || null,
        },
      });
      onNotice(`Assigned ${res.count} task${res.count === 1 ? '' : 's'} to teachers.`);
      onSaved();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Assign submission task" sub="Admin gives a report task to selected teachers — they input the data online or mark it as done. No uploads." onClose={onClose} wide>
      <ErrorBanner error={err} />
      <label>Report type</label>
      <select className="input" value={typeId} onChange={(e) => pickType(e.target.value)}>
        <option value="">Select a report…</option>
        {groups.map((g) => (
          <optgroup key={g} label={g}>
            {types.filter((t) => t.group_name === g).map((t) => (
              <option key={t.id} value={String(t.id)}>{t.name}{t.auto_generate ? '  ✦ AI' : ''}</option>
            ))}
          </optgroup>
        ))}
      </select>
      <label>Teachers <span className="muted">({userIds.length} selected)</span></label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 4, maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
        {staff.length === 0 && <div className="muted">No teacher accounts found.</div>}
        {staff.map((u) => (
          <label key={u.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={userIds.includes(u.id)} onChange={() => toggleUser(u.id)} />
            <span>{u.name} <span className="muted">@{u.username}</span></span>
          </label>
        ))}
      </div>
      <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <label>School year
          <select className="input" value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)}>
            {SCHOOL_YEARS.map((y) => <option key={y}>{y}</option>)}
          </select>
        </label>
        <label>Period
          <input className="input" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="e.g. Q1 2026-2027" />
        </label>
      </div>
      <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <label>Due date
          <input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        <label>Notes for the teachers</label>
        <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={busy || !typeId || userIds.length === 0} onClick={save}>
          {busy ? 'Assigning…' : `Assign to ${userIds.length} teacher${userIds.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </Modal>
  );
}

function SubmissionModal({ mode, submission, types, onClose, onSaved, onNotice }) {
  const groups = useMemo(() => [...new Set(types.map((t) => t.group_name))], [types]);
  const [typeId, setTypeId] = useState(submission?.report_type_id ? String(submission.report_type_id) : '');
  const type = types.find((t) => String(t.id) === typeId);
  const [period, setPeriod] = useState(submission?.period || '');
  const [notes, setNotes] = useState(submission?.notes || '');
  const [due, setDue] = useState(submission?.due_date || '');
  const [draft, setDraft] = useState(submission?.draft_body || '');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  function pickType(id) {
    setTypeId(id);
    const t = types.find((x) => String(x.id) === id);
    if (t && !submission) setPeriod(defaultPeriod(t.frequency));
  }

  async function generateDraft() {
    if (!type) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await api('/submissions/generate-draft', {
        method: 'POST',
        body: { report_type_id: type.id, period },
      });
      setDraft(res.draft_body);
      onNotice('Draft generated — review and edit it before submitting.');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function save(submitNow) {
    setBusy(true);
    setErr(null);
    try {
      let id = submission?.id;
      if (!id) {
        const res = await api('/submissions', {
          method: 'POST',
          body: { report_type_id: Number(typeId), period, notes, due_date: due || null, draft_body: draft || null },
        });
        id = res.id;
      } else {
        await api(`/submissions/${id}`, {
          method: 'PATCH',
          body: { period, notes, due_date: due || null, draft_body: draft || null },
        });
      }
      if (submitNow) await api(`/submissions/${id}/submit`, { method: 'POST', body: {} });
      onNotice(submitNow ? 'Submitted for review.' : 'Saved as draft.');
      onSaved();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={mode === 'new' ? 'New report submission' : 'Update submission'} sub="Input the necessary data online, or mark the task as done — file uploads are not required." onClose={onClose} wide>
      <ErrorBanner error={err} />
      {mode === 'new' && (
        <>
          <label>Report type</label>
          <select className="input" value={typeId} onChange={(e) => pickType(e.target.value)}>
            <option value="">Select a report…</option>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {types.filter((t) => t.group_name === g).map((t) => (
                  <option key={t.id} value={String(t.id)}>{t.name}{t.auto_generate ? '  ✦ AI' : ''}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </>
      )}
      <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <label>Period
          <input className="input" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="e.g. Q1 2026-2027" />
        </label>
        <label>Due date <span className="muted">(optional)</span>
          <input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
      </div>
      <label>Report data</label>
      <textarea className="input" rows={7} value={draft} onChange={(e) => setDraft(e.target.value)} style={{ fontFamily: 'monospace', fontSize: 12.5 }} placeholder="Enter the data / details of the report here — or leave blank and just mark the task as done." />
      {type?.auto_generate ? (
        <div style={{ margin: '8px 0' }}>
          <button type="button" className="btn" onClick={generateDraft} disabled={busy || !typeId}>
            <Wand2 size={14} /> {busy ? 'Generating…' : 'Generate AI draft'}
          </button>
        </div>
      ) : null}
      <label>Notes for the reviewer</label>
      <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn" disabled={busy} onClick={() => save(false)}>Save as draft</button>
        <button type="button" className="btn btn-primary" disabled={busy || !typeId && !submission} onClick={() => save(true)}>
          <Send size={14} /> {busy ? 'Saving…' : 'Save & mark as done'}
        </button>
      </div>
    </Modal>
  );
}
