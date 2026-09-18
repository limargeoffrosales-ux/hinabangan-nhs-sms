import { useEffect, useState, useCallback } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { api } from '../lib/api';
import { ErrorBanner, Empty, Spinner } from './ui';

const STATUSES = ['present', 'late', 'absent', 'excused'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ImmersionDailyAttendance() {
  const [batches, setBatches] = useState([]);
  const [batch, setBatch] = useState('');
  const [date, setDate] = useState(today());
  const [roster, setRoster] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedMsg, setSavedMsg] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api('/immersion?limit=200');
        const set = new Set((r.data || []).map((p) => p.batch).filter(Boolean));
        setBatches([...set].sort());
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  const load = useCallback(async (b = batch, d = date) => {
    if (!b) return;
    setLoading(true);
    setError(null);
    try {
      const r = await api(`/immersion/attendance?batch=${encodeURIComponent(b)}&date=${encodeURIComponent(d)}`);
      const rows = (r.rows || []).map((row) => ({
        ...row,
        status: row.status || 'present',
        time_in: row.time_in || '',
        time_out: row.time_out || '',
        remarks: row.remarks || '',
      }));
      setRoster(rows);
      setSavedMsg(null);
    } catch (e) {
      setError(e.message);
      setRoster([]);
    } finally {
      setLoading(false);
    }
  }, [batch, date]);

  function setRow(id, patch) {
    setRoster((rs) => rs.map((r) => (r.immersion_id === id ? { ...r, ...patch } : r)));
  }

  async function save() {
    if (!roster.length) return;
    setSaving(true);
    setError(null);
    try {
      const r = await api('/immersion/attendance', {
        method: 'POST',
        body: {
          batch,
          date,
          records: roster.map((row) => ({
            immersion_id: row.immersion_id,
            status: row.status,
            time_in: row.time_in || null,
            time_out: row.time_out || null,
            remarks: row.remarks || null,
          })),
        },
      });
      setSavedMsg(`Attendance saved for ${r.recorded} learner(s).`);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const counts = roster ? roster.reduce((m, r) => {
    m[r.status] = (m[r.status] || 0) + 1;
    return m;
  }, {}) : {};

  return (
    <>
      <ErrorBanner error={error} />
      {savedMsg && <div className="ok-banner" role="status">{savedMsg}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row" style={{ alignItems: 'end' }}>
          <div>
            <label>Batch</label>
            <select value={batch} onChange={(e) => { setBatch(e.target.value); setRoster(null); setSavedMsg(null); }}>
              <option value="">— select batch —</option>
              {batches.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setRoster(null); setSavedMsg(null); }} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
            <button className="btn btn-primary" onClick={() => load()} disabled={!batch || loading}>
              {loading ? 'Loading…' : 'Load roster'}
            </button>
            {roster && (
              <button className="btn btn-sm" onClick={() => { setRoster(null); setSavedMsg(null); }}>
                <RotateCcw size={13} /> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {loading && <Spinner />}

      {roster && (
        <>
          <div className="card" style={{ marginBottom: 16, padding: '12px 18px' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600 }}>Daily attendance — {date}</span>
              <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                {Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(' · ')}
              </span>
              <span style={{ marginLeft: 'auto' }}>
                <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
                  <Save size={13} /> {saving ? 'Saving…' : 'Save attendance'}
                </button>
              </span>
            </div>
          </div>

          <div className="table-wrap card">
            <table>
              <thead>
                <tr>
                  <th>Learner</th><th>LRN</th><th>Program</th><th>Partner Institution</th>
                  <th style={{ textAlign: 'center' }}>Status</th><th>Time in</th><th>Time out</th>
                  <th>Hours</th><th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((r) => (
                  <tr key={r.immersion_id}>
                    <td>{r.student_name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12.5 }}>{r.lrn}</td>
                    <td>{r.program}</td>
                    <td className="sub">{r.partner_institution || '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="seg" style={{ flexWrap: 'wrap' }}>
                        {STATUSES.map((s) => (
                          <button
                            key={s}
                            type="button"
                            className={r.status === s ? 'on' : ''}
                            onClick={() => setRow(r.immersion_id, { status: s })}
                            style={{ padding: '6px 10px', fontSize: 12 }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td><input type="time" className="input" style={{ minWidth: 96 }} value={r.time_in} onChange={(e) => setRow(r.immersion_id, { time_in: e.target.value })} /></td>
                    <td><input type="time" className="input" style={{ minWidth: 96 }} value={r.time_out} onChange={(e) => setRow(r.immersion_id, { time_out: e.target.value })} /></td>
                    <td className="sub">{r.hours != null ? r.hours : '—'}</td>
                    <td><input className="input" style={{ minWidth: 140 }} value={r.remarks} onChange={(e) => setRow(r.immersion_id, { remarks: e.target.value })} placeholder="Optional" /></td>
                  </tr>
                ))}
                {!roster.length && (
                  <tr><td colSpan={9}><Empty text="No placements in this batch. Add immersion records first." /></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}