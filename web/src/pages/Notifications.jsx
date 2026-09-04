import { useEffect, useState, useCallback } from 'react';
import { Mail, MessageSquare, RefreshCw, Pencil, Send } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, Badge, Modal, Empty, ErrorBanner, Spinner } from '../components/ui';

const EVENTS = {
  assignment_created: 'Assignment posted',
  assignment_graded: 'Assignment graded',
  attendance_alert: 'Attendance alert',
  announcement_posted: 'Announcement',
  grade_posted: 'Grades posted',
  test: 'Test message',
};
const TOKENS = ['{{name}}', '{{title}}', '{{subject}}', '{{section}}', '{{due_date}}', '{{points}}', '{{score}}', '{{total}}', '{{student}}', '{{status}}', '{{date}}', '{{term}}', '{{school_year}}', '{{school}}'];

export default function Notifications() {
  const [settings, setSettings] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [filter, setFilter] = useState({ status: '', channel: '' });
  const [test, setTest] = useState({ email: '', phone: '' });
  const [editing, setEditing] = useState(null);
  const [blast, setBlast] = useState({ message: '' });
  const [blastBusy, setBlastBusy] = useState(false);
  const [blastResult, setBlastResult] = useState(null);
  const [push, setPush] = useState({ title: '', body: '', platform: '' });
  const [pushBusy, setPushBusy] = useState(false);
  const [pushResult, setPushResult] = useState(null);
  const [pushError, setPushError] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, t, l] = await Promise.all([
        api('/notifications/settings'),
        api('/notifications/templates'),
        api(`/notifications?limit=100${filter.status ? `&status=${filter.status}` : ''}${filter.channel ? `&channel=${filter.channel}` : ''}`),
      ]);
      setSettings(s);
      setTemplates(t.data);
      setRows(l.data);
      setTotal(l.total);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function toggle(key, value) {
    setBusy(true);
    setNotice(null);
    try {
      const s = await api('/notifications/settings', { method: 'PATCH', body: { [key]: value } });
      setSettings(s);
      setNotice(`${key === 'email_enabled' ? 'Email' : 'SMS'} notifications ${value ? 'enabled' : 'disabled'}.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendTest(kind) {
    const addr = kind === 'email' ? test.email.trim() : test.phone.trim();
    if (!addr) return setError(`Enter a ${kind === 'email' ? 'email address' : 'phone number'} to test.`);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const r = await api('/notifications/test', { method: 'POST', body: kind === 'email' ? { email: addr } : { phone: addr } });
      setNotice(`Test ${kind}: ${r.sent} delivered, ${r.failed} failed, ${r.created} total.`);
      loadAll();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveTemplate(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/notifications/templates/${editing.event}/${editing.channel}`, {
        method: 'PUT',
        body: { subject: editing.subject, body: editing.body },
      });
      setEditing(null);
      setNotice('Template saved.');
      loadAll();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function resend(row) {
    setBusy(true);
    setError(null);
    try {
      const r = await api(`/notifications/${row.id}/resend`, { method: 'POST' });
      setNotice(r.ok ? 'Message re-queued and delivery attempted.' : r.error || 'Done.');
      loadAll();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendBlast() {
    const msg = blast.message.trim();
    if (!msg) return setError('Enter a message to send.');
    if (msg.length > 160) return setError('SMS messages must be 160 characters or less.');
    setBlastBusy(true);
    setError(null);
    setBlastResult(null);
    try {
      const r = await api('/notifications/blast', { method: 'POST', body: { message: msg } });
      setBlastResult(r);
      setBlast({ message: '' });
      loadAll();
    } catch (e) {
      setError(e.message);
    } finally {
      setBlastBusy(false);
    }
  }

  async function sendPush() {
    if (!push.title.trim() || !push.body.trim()) return setPushError('Both a title and message body are required.');
    setPushBusy(true);
    setPushError(null);
    setPushResult(null);
    try {
      const r = await api('/push/send', {
        method: 'POST',
        body: { title: push.title.trim(), body: push.body.trim(), platform: push.platform || undefined },
      });
      setPushResult(r);
      setPush({ title: '', body: '', platform: '' });
    } catch (e) {
      setPushError(e.message);
    } finally {
      setPushBusy(false);
    }
  }

  const statusBadge = (s) => (s === 'sent' ? 'ok' : s === 'failed' ? 'absent' : 'normal');

  return (
    <>
      <PageHead title="Notifications" sub="Email & SMS engine — guardians, learners and staff are notified automatically when assignments, grades or attendance change" />

      {notice && <div className="notice" style={{ margin: '10px 0' }}>{notice}</div>}
      <ErrorBanner error={error} />

      {loading && !settings ? <Spinner /> : (
        <div className="two-col">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card">
              <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Mail size={16} style={{ color: 'var(--accent)' }} /> Email (SMTP)
                <span className="badge" style={{ marginLeft: 'auto' }}>
                  {settings?.email_configured ? 'CONFIGURED' : 'NOT CONFIGURED'}
                </span>
              </h3>
              <div className="form-row">
                <label className="toggle-line">
                  <input type="checkbox" checked={!!settings?.email_enabled} disabled={busy}
                    onChange={(e) => toggle('email_enabled', e.target.checked)} />
                  Send email notifications
                </label>
                <div className="sub">Outbound mail flows through the SMTP server set on the host (SMTP_HOST). While disabled, events are still recorded in the log.</div>
              </div>
              {settings?.mail_from && <div className="sub">From: <strong>{settings.mail_from}</strong></div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                <input className="input" style={{ flex: 1 }} placeholder="test@school.edu.ph" value={test.email}
                  onChange={(e) => setTest({ ...test, email: e.target.value })} />
                <button className="btn btn-sm" disabled={busy} onClick={() => sendTest('email')}>
                  <Send size={13} /> Send test email
                </button>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={16} style={{ color: 'var(--accent)' }} /> SMS
                <span className="badge" style={{ marginLeft: 'auto' }}>
                  {settings?.sms_configured ? 'PROVIDER CONFIGURED' : 'NO PROVIDER'}
                </span>
              </h3>
              <div className="form-row">
                <label className="toggle-line">
                  <input type="checkbox" checked={!!settings?.sms_enabled} disabled={busy}
                    onChange={(e) => toggle('sms_enabled', e.target.checked)} />
                  Send SMS notifications to guardian phones
                </label>
                <div className="sub">SMS posts to SMS_PROVIDER_URL (guardian contacts on learner records). Queued messages retry automatically once a provider is configured.</div>
              </div>
              {settings?.sms_sender && <div className="sub">Sender ID: <strong>{settings.sms_sender}</strong></div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                <input className="input" style={{ flex: 1 }} placeholder="09xxxxxxxxx" value={test.phone}
                  onChange={(e) => setTest({ ...test, phone: e.target.value })} />
                <button className="btn btn-sm" disabled={busy} onClick={() => sendTest('sms')}>
                  <Send size={13} /> Send test SMS
                </button>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={16} style={{ color: 'var(--accent)' }} /> SMS Blast
              </h3>
              <div className="sub" style={{ marginBottom: 8 }}>Send a message to all parents/guardians. Messages must be 160 characters or less (standard SMS length).</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Type your message here... e.g. Parent-teacher conference on Friday at 2pm."
                  value={blast.message}
                  onChange={(e) => setBlast({ message: e.target.value })}
                  maxLength={160}
                />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="sub" style={{ marginRight: 'auto' }}>{blast.message.length}/160 characters</span>
                  <button className="btn btn-primary" disabled={blastBusy || !blast.message.trim()} onClick={sendBlast}>
                    <Send size={13} /> {blastBusy ? 'Sending...' : 'Send to All Parents'}
                  </button>
                </div>
              </div>
              {blastResult && (
                <div className="notice" style={{ marginTop: 8 }}>
                  Blast queued: {blastResult.sent} messages queued, {blastResult.failed} failed, {blastResult.total} parents contacted.
                </div>
              )}
            </div>

            <div className="card">
              <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={16} style={{ color: 'var(--accent)' }} /> Push (FCM)
              </h3>
              <div className="sub" style={{ marginBottom: 8 }}>Send an app push notification to registered device tokens. Requires FCM_SERVER_KEY on the server.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  className="input"
                  placeholder="Notification title"
                  value={push.title}
                  onChange={(e) => setPush({ ...push, title: e.target.value })}
                />
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Message body"
                  value={push.body}
                  onChange={(e) => setPush({ ...push, body: e.target.value })}
                />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select className="input" style={{ width: 150 }} value={push.platform} onChange={(e) => setPush({ ...push, platform: e.target.value })}>
                    <option value="">All platforms</option>
                    <option value="android">Android</option>
                    <option value="ios">iOS</option>
                    <option value="web">Web</option>
                  </select>
                  <button className="btn btn-primary" style={{ marginLeft: 'auto' }} disabled={pushBusy || !push.title.trim() || !push.body.trim()} onClick={sendPush}>
                    <Send size={13} /> {pushBusy ? 'Sending...' : 'Send push'}
                  </button>
                </div>
              </div>
              {pushError && <div className="notice warn" style={{ marginTop: 8 }}>{pushError}</div>}
              {pushResult && pushResult.ok && (
                <div className="notice" style={{ marginTop: 8 }}>
                  Push sent: {pushResult.sent} delivered, {pushResult.failed} failed.
                </div>
              )}
            </div>
          </div>

          <div className="card table-wrap">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, marginRight: 'auto' }}>Delivery log ({total})</h3>
              <select className="input" style={{ width: 130 }} value={filter.channel} onChange={(e) => setFilter({ ...filter, channel: e.target.value })}>
                <option value="">All channels</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </select>
              <select className="input" style={{ width: 130 }} value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
                <option value="">All statuses</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
                <option value="queued">Queued</option>
              </select>
            </div>
            {rows.length === 0 ? <Empty text="No notifications yet — they appear automatically as events happen." /> : (
              <table>
                <thead>
                  <tr><th>Time</th><th>Channel</th><th>Event</th><th>Recipient</th><th>Message</th><th>Status</th><th /></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{r.created_at?.replace('T', ' ').slice(0, 16)}</td>
                      <td><span className={`badge ${r.channel === 'email' ? 'badge-blue' : 'badge-green'}`}>{r.channel.toUpperCase()}</span></td>
                      <td style={{ fontSize: 12.5 }}>{EVENTS[r.event] || r.event}</td>
                      <td style={{ fontSize: 12.5 }}>{r.recipient_name || r.recipient_address}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-dim)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.subject || r.body}>
                        {r.subject || r.body}
                      </td>
                      <td><Badge status={statusBadge(r.status)} /></td>
                      <td>
                        {r.status !== 'sent' && (
                          <button className="btn btn-sm" disabled={busy} title="Retry now" onClick={() => resend(r)}>
                            <RefreshCw size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0 }}>Message templates</h3>
          <span className="sub">Available tokens: {TOKENS.join(' ')}</span>
        </div>
        {templates.length === 0 ? <Empty text="No templates." /> : (
          <table>
            <thead>
              <tr><th>Event</th><th>Channel</th><th>Subject</th><th>Body</th><th /></tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={`${t.event}:${t.channel}`}>
                  <td style={{ fontSize: 12.5 }}>{EVENTS[t.event] || t.event}</td>
                  <td><span className={`badge ${t.channel === 'email' ? 'badge-blue' : 'badge-green'}`}>{t.channel.toUpperCase()}</span></td>
                  <td style={{ fontSize: 12.5 }}>{t.subject || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-dim)', maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.body}>{t.body}</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => setEditing({ ...t })} aria-label="Edit template"><Pencil size={13} aria-hidden="true" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <Modal title={`Edit template — ${EVENTS[editing.event] || editing.event} (${editing.channel})`}
          sub="Use {{tokens}} for learner/guardian names, titles, scores and dates" onClose={() => setEditing(null)}>
          <form onSubmit={saveTemplate}>
            {editing.channel === 'email' && (
              <>
                <label>Subject</label>
                <input className="input" value={editing.subject || ''} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} />
              </>
            )}
            <label>Body</label>
            <textarea className="input" rows={7} required value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
            <div className="sub">Tokens: {TOKENS.join(' ')}</div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save template'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
