import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, CheckCheck, Download, Clock } from 'lucide-react';
import { api } from '../lib/api';
import { downloadFromApi } from '../lib/export';
import { PageHead, Empty, ErrorBanner, Spinner } from '../components/ui';
import { useToast } from '../components/Toast';

const STATUSES = ['present', 'late', 'absent', 'excused'];
const STATUS_SHORTCUTS = { '1': 'present', '2': 'late', '3': 'absent', '4': 'excused' };

export default function Attendance() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sectionId, setSectionId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [session, setSession] = useState('');
  const [roster, setRoster] = useState([]);
  const [showTime, setShowTime] = useState(false);
  const [focusRow, setFocusRow] = useState(-1);
  const tableRef = useRef(null);

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

  const load = useCallback(async () => {
    if (!sectionId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ section_id: sectionId, date, limit: '500' });
      if (session) params.set('session', session);
      const existing = await api(`/attendance?${params.toString()}`);
      const byStudent = {};
      for (const r of existing.data) byStudent[r.student_id] = r;
      const rosterRes = await api(`/sections/${sectionId}/students`);
      setRoster(rosterRes.data.map((s) => ({
        ...s,
        status: byStudent[s.id]?.status || 'present',
        remarks: byStudent[s.id]?.remarks || '',
        time_in: byStudent[s.id]?.time_in || '',
        time_out: byStudent[s.id]?.time_out || '',
      })));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [sectionId, date, session]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!sectionId) return;
    const interval = setInterval(() => {
      const params = new URLSearchParams({ section_id: sectionId, date, limit: '500' });
      if (session) params.set('session', session);
      api(`/attendance?${params.toString()}`)
        .then((existing) => {
          const byStudent = {};
          for (const r of existing.data) byStudent[r.student_id] = r;
          setRoster((prev) => prev.map((s) => ({
            ...s,
            status: byStudent[s.id]?.status || s.status,
            remarks: byStudent[s.id]?.remarks ?? s.remarks,
            time_in: byStudent[s.id]?.time_in ?? s.time_in,
            time_out: byStudent[s.id]?.time_out ?? s.time_out,
          })));
        })
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [sectionId, date, session]);

  function setStatus(studentId, status) {
    setRoster((rs) => rs.map((r) => (r.id === studentId ? { ...r, status } : r)));
  }

  function setTimeIn(studentId, time) {
    setRoster((rs) => rs.map((r) => (r.id === studentId ? { ...r, time_in: time } : r)));
  }

  function setTimeOut(studentId, time) {
    setRoster((rs) => rs.map((r) => (r.id === studentId ? { ...r, time_out: time } : r)));
  }

  function markAll(status) {
    setRoster((rs) => rs.map((r) => ({ ...r, status })));
  }

  function handleKeyDown(e) {
    if (!roster.length) return;
    const key = e.key;
    if (key >= '1' && key <= '4' && focusRow >= 0 && focusRow < roster.length) {
      e.preventDefault();
      setStatus(roster[focusRow].id, STATUS_SHORTCUTS[key]);
    } else if (key === 'ArrowDown' && focusRow < roster.length - 1) {
      e.preventDefault();
      setFocusRow((r) => r + 1);
    } else if (key === 'ArrowUp' && focusRow > 0) {
      e.preventDefault();
      setFocusRow((r) => r - 1);
    } else if (key === 'Tab' && focusRow >= 0) {
      e.preventDefault();
      const next = e.shiftKey
        ? (focusRow > 0 ? focusRow - 1 : roster.length - 1)
        : (focusRow < roster.length - 1 ? focusRow + 1 : 0);
      setFocusRow(next);
    }
  }

  useEffect(() => {
    if (tableRef.current) tableRef.current.focus();
  }, [focusRow]);

  async function save() {
    setLoading(true);
    setError(null);
    try {
      const res = await api('/attendance/bulk', {
        method: 'POST',
        body: {
          section_id: Number(sectionId),
          date,
          session: session || undefined,
          records: roster.map((r) => ({
            student_id: r.id,
            status: r.status,
            remarks: r.remarks || null,
            time_in: r.time_in || null,
            time_out: r.time_out || null,
          })),
        },
      });
      toast.success(`Attendance saved for ${res.recorded} learner(s).`);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const exportAttendance = async () => {
    try {
      const params = new URLSearchParams({ format: 'xlsx' });
      if (sectionId) params.set('section_id', sectionId);
      if (date) params.set('date', date);
      if (session) params.set('session', session);
      await downloadFromApi(`/attendance/export?${params.toString()}`, 'attendance.xlsx');
    } catch (e) {
      setError(e.message);
    }
  };

  const counts = roster.reduce((m, r) => {
    m[r.status] = (m[r.status] || 0) + 1;
    return m;
  }, {});

  return (
    <>
      <PageHead title={t('attendance.title')} sub={t('attendance.subtitle')} />
      <ErrorBanner error={error} />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row" style={{ alignItems: 'end' }}>
          <div>
            <label>{t('attendance.section')}</label>
            <select value={sectionId} onChange={(e) => { setSectionId(e.target.value); setRoster([]); }}>
              <option value="">{t('common.select')}</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label>{t('attendance.date')}</label>
            <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setRoster([]); }} />
          </div>
          <div>
            <label>{t('attendance.session', 'Session')}</label>
            <select value={session} onChange={(e) => { setSession(e.target.value); setRoster([]); }}>
              <option value="">{t('attendance.sessionAll', 'All')}</option>
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={load} disabled={!sectionId}>{t('attendance.loadRoster')}</button>
        </div>
      </div>

      {loading && <Spinner />}

      {roster.length > 0 && (
        <>
          <div className="card" style={{ marginBottom: 16, padding: '12px 18px' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600 }}>{t('attendance.bulkActions')}</span>
              <button className="btn btn-sm" onClick={() => markAll('present')}><CheckCheck size={13} /> {t('attendance.allPresent')}</button>
              <button className="btn btn-sm" onClick={() => markAll('late')}>{t('attendance.allLate')}</button>
              <button className="btn btn-sm" onClick={() => markAll('absent')}>{t('attendance.allAbsent')}</button>
              <button className="btn btn-sm" onClick={() => markAll('excused')}>{t('attendance.allExcused', 'All Excused')}</button>
              <button className="btn btn-sm" onClick={() => setShowTime((v) => !v)}>
                <Clock size={13} /> {showTime ? t('attendance.hideTime', 'Hide Time') : t('attendance.showTime', 'Show Time')}
              </button>
              <span style={{ marginLeft: 'auto', color: 'var(--text-dim)', fontSize: 13 }}>
                {Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(' · ')}
              </span>
              <button className="btn btn-primary btn-sm" onClick={save}><Save size={13} /> {t('attendance.saveAttendance')}</button>
              <button className="btn btn-sm" onClick={exportAttendance} disabled={!roster.length}><Download size={13} /> {t('attendance.export')}</button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
              {t('attendance.keyboardHint', 'Keyboard: 1=Present, 2=Late, 3=Absent, 4=Excused · ↑↓ navigate · Tab next student')}
            </div>
          </div>
          <div className="card table-wrap">
            <table ref={tableRef} tabIndex={0} onKeyDown={handleKeyDown} style={{ outline: 'none' }}>
              <thead>
                <tr>
                  <th>{t('attendance.lrn')}</th><th>{t('attendance.learner')}</th><th>{t('attendance.sex')}</th>
                  <th style={{ textAlign: 'center' }}>{t('attendance.status')}</th>
                  {showTime && <th>{t('attendance.timeIn', 'Time In')}</th>}
                  {showTime && <th>{t('attendance.timeOut', 'Time Out')}</th>}
                  <th>{t('attendance.remarks')}</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((r, idx) => (
                  <tr key={r.id}
                    onClick={() => setFocusRow(idx)}
                    style={{
                      cursor: 'pointer',
                      background: idx === focusRow ? 'var(--card-hover)' : undefined,
                      outline: idx === focusRow ? '2px solid var(--accent)' : undefined,
                      outlineOffset: -2,
                    }}>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12.5 }}>{r.lrn}</td>
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
                    {showTime && <td><input className="input" type="time" value={r.time_in || ''} onChange={(e) => setTimeIn(r.id, e.target.value)} style={{ width: 110 }} /></td>}
                    {showTime && <td><input className="input" type="time" value={r.time_out || ''} onChange={(e) => setTimeOut(r.id, e.target.value)} style={{ width: 110 }} /></td>}
                    <td><input value={r.remarks || ''} onChange={(e) => setRoster((rs) => rs.map((x) => (x.id === r.id ? { ...x, remarks: e.target.value } : x)))} placeholder={t('attendance.remarksPlaceholder')} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && sectionId && roster.length === 0 && <Empty text={t('attendance.noData')} />}
    </>
  );
}
