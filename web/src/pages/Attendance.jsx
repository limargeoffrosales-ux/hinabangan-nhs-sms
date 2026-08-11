import { useEffect, useState } from 'react';
import { Save, CheckCheck } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, Empty, ErrorBanner, Spinner } from '../components/ui';

const STATUSES = ['present', 'late', 'absent', 'excused'];

export default function Attendance() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sectionId, setSectionId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [roster, setRoster] = useState([]);
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await api('/sections?limit=200');
        setSections(s.data);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  async function load() {
    if (!sectionId) return;
    setLoading(true);
    setError(null);
    try {
      const existing = await api(`/attendance?section_id=${sectionId}&date=${date}`);
      const byStudent = {};
      for (const r of existing.data) byStudent[r.student_id] = r;
      const rosterRes = await api(`/sections/${sectionId}/students`);
      setRoster(rosterRes.data.map((s) => ({
        ...s,
        status: byStudent[s.id]?.status || 'present',
        remarks: byStudent[s.id]?.remarks || '',
      })));
      setSaved(existing.data.length);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function setStatus(studentId, status) {
    setRoster((rs) => rs.map((r) => (r.id === studentId ? { ...r, status } : r)));
  }

  function markAll(status) {
    setRoster((rs) => rs.map((r) => ({ ...r, status })));
  }

  async function save() {
    setLoading(true);
    setError(null);
    try {
      const res = await api('/attendance/bulk', {
        method: 'POST',
        body: {
          section_id: Number(sectionId),
          date,
          records: roster.map((r) => ({ student_id: r.id, status: r.status, remarks: r.remarks || null })),
        },
      });
      alert(`Attendance saved for ${res.recorded} learner(s).`);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const counts = roster.reduce((m, r) => {
    m[r.status] = (m[r.status] || 0) + 1;
    return m;
  }, {});

  return (
    <>
      <PageHead title="Attendance" sub="Daily learner attendance per section (QR / NFC / manual — MVP uses manual entry)" />
      <ErrorBanner error={error} />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row" style={{ alignItems: 'end' }}>
          <div>
            <label>Section</label>
            <select value={sectionId} onChange={(e) => { setSectionId(e.target.value); setRoster([]); }}>
              <option value="">— select —</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={load} disabled={!sectionId}>Load roster</button>
        </div>
      </div>

      {loading && <Spinner />}

      {roster.length > 0 && (
        <>
          <div className="card" style={{ marginBottom: 16, padding: '12px 18px' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600 }}>Bulk actions:</span>
              <button className="btn btn-sm" onClick={() => markAll('present')}><CheckCheck size={13} /> All present</button>
              <button className="btn btn-sm" onClick={() => markAll('late')}>All late</button>
              <button className="btn btn-sm" onClick={() => markAll('absent')}>All absent</button>
              <span style={{ marginLeft: 'auto', color: 'var(--text-dim)', fontSize: 13 }}>
                {Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(' · ')}
              </span>
              <button className="btn btn-primary btn-sm" onClick={save}><Save size={13} /> Save attendance</button>
            </div>
          </div>
          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th>LRN</th><th>Learner</th><th>Sex</th><th style={{ textAlign: 'center' }}>Status</th><th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12.5 }}>{r.lrn}</td>
                    <td>{r.last_name}, {r.first_name}</td>
                    <td>{r.sex}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="seg" style={{ flexWrap: 'wrap' }}>
                        {STATUSES.map((s) => (
                          <button
                            key={s}
                            className={r.status === s ? 'on' : ''}
                            onClick={() => setStatus(r.id, s)}
                            type="button"
                            style={{ padding: '6px 10px', fontSize: 12 }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td><input value={r.remarks || ''} onChange={(e) => setRoster((rs) => rs.map((x) => (x.id === r.id ? { ...x, remarks: e.target.value } : x)))} placeholder="e.g. with excuse letter" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && sectionId && roster.length === 0 && <Empty text="No learners in this section, or attendance for this date is unloaded. Click Load roster." />}
    </>
  );
}
