import { useEffect, useState, useCallback } from 'react';
import { Download, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { Spinner, ErrorBanner, Empty } from './ui';

const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar', 'teacher'];
const STATUSES = ['present', 'late', 'absent', 'excused'];
const STATUS_COLORS = { present: 'badge-green', late: 'badge-yellow', absent: 'badge-red', excused: 'badge-blue' };

function computeHours(tIn, tOut) {
  if (!tIn || !tOut) return null;
  const diff = new Date(`2000-01-01T${tOut}`) - new Date(`2000-01-01T${tIn}`);
  return (diff / 3600000).toFixed(1);
}

export default function JdvpDailyAttendance() {
  const { user } = useAuth();
  const canWrite = can(user?.role, ...WRITE);
  const [batch, setBatch] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  const loadRoster = useCallback(async () => {
    if (!batch || !date) return;
    setLoading(true);
    setError(null);
    try {
      const r = await api(`/jdvp/attendance/roster?batch=${encodeURIComponent(batch)}&date=${date}`);
      setRoster(r.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [batch, date]);

  useEffect(() => { loadRoster(); }, [loadRoster]);

  function setStatus(jdvpId, status) {
    setRoster(prev => prev.map(r => r.jdvp_recipient_id === jdvpId ? { ...r, status } : r));
  }

  function setTimeIn(jdvpId, time) {
    setRoster(prev => prev.map(r => r.jdvp_recipient_id === jdvpId ? { ...r, time_in: time } : r));
  }

  function setTimeOut(jdvpId, time) {
    setRoster(prev => prev.map(r => r.jdvp_recipient_id === jdvpId ? { ...r, time_out: time } : r));
  }

  function markAll(status) {
    setRoster(prev => prev.map(r => ({ ...r, status })));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSuccess('');
    try {
      const records = roster.map(r => ({
        jdvp_recipient_id: r.jdvp_recipient_id,
        status: r.status || 'present',
        time_in: r.time_in || null,
        time_out: r.time_out || null,
        hours: computeHours(r.time_in, r.time_out),
        remarks: r.remarks || null,
      }));
      const res = await api('/jdvp/attendance', { method: 'POST', body: { date, records } });
      setSuccess(`Saved ${res.saved} attendance record(s).`);
      await loadRoster();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const exportXlsx = async () => {
    try {
      const params = batch ? `?batch=${encodeURIComponent(batch)}` : '';
      const res = await fetch(`/api/v1/jdvp/attendance/export${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jdvp-attendance${batch ? '-' + batch : ''}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  };

  const counts = { present: 0, late: 0, absent: 0, excused: 0 };
  roster.forEach(r => { if (r.status && counts[r.status] !== undefined) counts[r.status]++; });

  return (
    <>
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>Batch</label>
            <select className="input" value={batch} onChange={e => setBatch(e.target.value)} style={{ minWidth: 140 }}>
              <option value="">Select batch…</option>
              <option value="Batch 1">Batch 1</option>
              <option value="Batch 2">Batch 2</option>
              <option value="Batch 3">Batch 3</option>
              <option value="Batch 4">Batch 4</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>Date</label>
            <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          {canWrite && roster.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              <button className="btn btn-sm" onClick={() => markAll('present')}><CheckCircle2 size={13} /> All Present</button>
              <button className="btn btn-sm" onClick={() => markAll('late')}>All Late</button>
              <button className="btn btn-sm" onClick={() => markAll('absent')}>All Absent</button>
              <button className="btn btn-sm" onClick={() => markAll('excused')}>All Excused</button>
              <button className="btn btn-sm" onClick={exportXlsx}><Download size={13} /> Export</button>
              <button className="btn btn-sm btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save attendance'}</button>
            </div>
          )}
        </div>
        {roster.length > 0 && (
          <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12, color: 'var(--text-dim)' }}>
            <span><span className="badge badge-green">{counts.present}</span> Present</span>
            <span><span className="badge badge-yellow">{counts.late}</span> Late</span>
            <span><span className="badge badge-red">{counts.absent}</span> Absent</span>
            <span><span className="badge badge-blue">{counts.excused}</span> Excused</span>
            <span style={{ marginLeft: 'auto' }}>{roster.length} JDVP recipient(s)</span>
          </div>
        )}
      </div>

      {error && <ErrorBanner error={error} />}
      {success && <div className="notice" role="status">{success}</div>}

      {loading ? <Spinner /> : !batch ? (
        <Empty text="Select a batch and date to load the attendance roster." />
      ) : roster.length === 0 ? (
        <Empty text="No JDVP recipients found for this batch." />
      ) : (
        <div className="table-wrap card">
          <table>
            <thead>
              <tr>
                <th>LRN</th>
                <th>Name</th>
                <th>Program</th>
                <th>Status</th>
                <th>Time In</th>
                <th>Time Out</th>
                <th>Hours</th>
              </tr>
            </thead>
            <tbody>
              {roster.map(r => {
                const hrs = computeHours(r.time_in, r.time_out);
                return (
                  <tr key={r.jdvp_recipient_id}>
                    <td className="mono">{r.lrn}</td>
                    <td>{r.last_name}, {r.first_name} {r.middle_name || ''}</td>
                    <td>{r.program}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {STATUSES.map(s => (
                          <button key={s} className={`btn btn-xs ${r.status === s ? STATUS_COLORS[s] : ''}`}
                            style={{ textTransform: 'capitalize' }}
                            onClick={() => setStatus(r.jdvp_recipient_id, s)}>{s}</button>
                        ))}
                      </div>
                    </td>
                    <td><input className="input" type="time" value={r.time_in || ''} onChange={e => setTimeIn(r.jdvp_recipient_id, e.target.value)} style={{ width: 110 }} /></td>
                    <td><input className="input" type="time" value={r.time_out || ''} onChange={e => setTimeOut(r.jdvp_recipient_id, e.target.value)} style={{ width: 110 }} /></td>
                    <td>{hrs ? `${hrs}h` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
