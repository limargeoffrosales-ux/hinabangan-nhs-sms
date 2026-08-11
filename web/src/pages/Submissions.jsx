import { useEffect, useMemo, useState } from 'react';
import { FileText, Plus, Upload, Download, Wand2, CheckCheck, Undo2, Send } from 'lucide-react';
import { api, getApiBase, getToken } from '../lib/api';
import { useAuth } from '../lib/auth';
import { PageHead, Badge, Empty, Spinner, ErrorBanner, Modal } from '../components/ui';

const FREQS = ['daily', 'weekly', 'monthly', 'quarterly', 'annual', 'periodic'];
const STATUS_BADGE = {
  draft: 'badge-gray', submitted: 'badge-blue', reviewed: 'badge-yellow',
  approved: 'badge-green', returned: 'badge-red',
};

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
  return 'SY 2025-2026';
}

function fmtBytes(n) {
  if (!n) return '—';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

async function downloadFile(fileId, filename) {
  const res = await fetch(`${getApiBase()}/submissions/files/${fileId}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename || 'download';
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Submissions() {
  const { user } = useAuth();
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
        api('/submissions?school_year=2025-2026'),
        api('/submissions?school_year=2025-2026'),
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
      <PageHead title="Teacher Submissions" sub="Paperless submission of every required report — DLLs, accomplishment reports, DepEd forms, and more. Configurable review & approval workflows.">
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
                <tr><th>Report</th><th>Period</th><th>Status</th><th>Attachments</th><th>Last updated</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {shown.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.report_name}</strong>
                      {s.is_deped_form ? ' ' : ''}
                      {s.is_deped_form === 1 || s.is_deped_form === true ? <Badge status="high" /> : ''}
                      <br /><span className="muted">{s.group_name} · {s.frequency}</span>
                      {s.review_note && s.status === 'returned' && <div className="muted" style={{ color: 'var(--danger)' }}>Note: {s.review_note}</div>}
                    </td>
                    <td>{s.period}</td>
                    <td><Badge status={s.status} /></td>
                    <td>
                      {s.files && s.files.length ? s.files.map((f) => (
                        <div key={f.id}>
                          <a className="link" onClick={() => downloadFile(f.id, f.filename)} style={{ cursor: 'pointer' }}>
                            <Download size={11} style={{ verticalAlign: -1 }} /> {f.filename} <span className="muted">({fmtBytes(f.size_bytes)})</span>
                          </a>
                        </div>
                      )) : <span className="muted">none</span>}
                    </td>
                    <td className="muted">{(s.updated_at || '').slice(0, 10)}</td>
                    <td className="row-actions">
                      {(s.status === 'draft' || s.status === 'returned') && (
                        <button className="btn btn-sm" onClick={() => setModal({ mode: 'edit', s })}><Upload size={13} /> Files / submit</button>
                      )}
                      {s.status === 'draft' && (
                        <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => act(s.id, 'submit', {})}><Send size={13} /> Submit</button>
                      )}
                      {s.status === 'returned' && (
                        <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => act(s.id, 'submit', {})}><Send size={13} /> Re-submit</button>
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

      {modal && (
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

function SubmissionModal({ mode, submission, types, onClose, onSaved, onNotice }) {
  const groups = useMemo(() => [...new Set(types.map((t) => t.group_name))], [types]);
  const [typeId, setTypeId] = useState(submission?.report_type_id ? String(submission.report_type_id) : '');
  const type = types.find((t) => String(t.id) === typeId);
  const [period, setPeriod] = useState(submission?.period || '');
  const [notes, setNotes] = useState(submission?.notes || '');
  const [due, setDue] = useState(submission?.due_date || '');
  const [draft, setDraft] = useState(submission?.draft_body || '');
  const [files, setFiles] = useState([]);
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
        body: { report_type_id: type.id, period, school_year: '2025-2026' },
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
          body: {
            report_type_id: Number(typeId), period, notes, due_date: due || null,
            draft_body: draft || null, school_year: '2025-2026',
          },
        });
        id = res.id;
      } else {
        await api(`/submissions/${id}`, {
          method: 'PATCH',
          body: { period, notes, due_date: due || null, draft_body: draft || null },
        });
      }
      if (files.length) {
        const form = new FormData();
        for (const f of files) form.append('files', f);
        await fetch(`${getApiBase()}/submissions/${id}/files`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${getToken()}` },
          body: form,
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
    <Modal title={mode === 'new' ? 'New report submission' : 'Update submission'} sub="Attach files, use the AI draft builder, then save as draft or submit for review." onClose={onClose} wide>
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
          <input className="input" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="e.g. 2026-08-11 or Q1 2025-2026" />
        </label>
        <label>Due date <span className="muted">(optional)</span>
          <input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
      </div>
      <label>Notes for the reviewer</label>
      <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      {type?.auto_generate ? (
        <>
          <label>AI draft</label>
          <textarea className="input" rows={8} value={draft} onChange={(e) => setDraft(e.target.value)} style={{ fontFamily: 'monospace', fontSize: 12.5 }} />
          <div style={{ margin: '8px 0' }}>
            <button type="button" className="btn" onClick={generateDraft} disabled={busy || !typeId}>
              <Wand2 size={14} /> {busy ? 'Generating…' : 'Generate draft'}
            </button>
          </div>
        </>
      ) : null}
      <label>Attachments <span className="muted">(up to 10 files, 25 MB each — DLL, PDF, images…)</span></label>
      <input type="file" multiple className="input" onChange={(e) => setFiles([...e.target.files])} />
      {submission?.files?.length ? (
        <div className="muted" style={{ marginTop: 6 }}>
          Already attached: {submission.files.map((f) => f.filename).join(', ')}
        </div>
      ) : null}
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn" disabled={busy} onClick={() => save(false)}>Save as draft</button>
        <button type="button" className="btn btn-primary" disabled={busy || !typeId && !submission} onClick={() => save(true)}>
          <Send size={14} /> {busy ? 'Saving…' : 'Save & submit for review'}
        </button>
      </div>
    </Modal>
  );
}