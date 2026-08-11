import { useEffect, useMemo, useState } from 'react';
import { Gauge, TriangleAlert, Clock4, CheckCircle2, FileWarning, Undo } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, Badge, Empty, ErrorBanner } from '../components/ui';

function Bar({ percent }) {
  return (
    <div style={{ background: 'var(--border)', borderRadius: 99, height: 8, minWidth: 90, overflow: 'hidden' }}>
      <div
        style={{
          width: `${Math.min(100, percent)}%`, height: '100%',
          background: percent >= 80 ? 'var(--success)' : percent >= 50 ? 'var(--warn)' : 'var(--danger)',
        }}
      />
    </div>
  );
}

export default function Compliance() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  async function load() {
    setError(null);
    try {
      const res = await api('/submissions/compliance?school_year=2025-2026');
      setData(res);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  const teachers = useMemo(() => (data?.teachers || []).slice().sort((a, b) => a.percent - b.percent), [data]);

  if (!data) {
    return (
      <div>
        <PageHead title="Compliance Dashboard" sub="Real-time tracker of paperless submissions across the school." />
        <ErrorBanner error={error} />
        <div className="spinner" />
      </div>
    );
  }

  const kpis = [
    { label: 'Overall compliance', value: data.overall + '%', icon: Gauge, color: '#4D96FF' },
    { label: 'Approved', value: data.kpis.approved, icon: CheckCircle2, color: '#34C77B' },
    { label: 'Pending review', value: data.kpis.submitted + data.kpis.reviewed, icon: Clock4, color: '#F5B942' },
    { label: 'Returned for revision', value: data.kpis.returned, icon: Undo, color: '#F5B942' },
    { label: 'Overdue', value: data.kpis.overdue, icon: Clock4, color: '#F2555A' },
    { label: 'Missing documents', value: data.kpis.missing, icon: FileWarning, color: '#F2555A' },
  ];

  return (
    <div>
      <PageHead title="Compliance Dashboard" sub="School-wide compliance with every required report: pending, submitted, approved, returned, overdue, and missing — per teacher, per department, per category." />
      <ErrorBanner error={error} />

      <div className="grid grid-4">
        {kpis.map((k) => (
          <div className="card kpi" key={k.label}>
            <div className="icon" style={{ background: `${k.color}22`, color: k.color }}><k.icon size={20} /></div>
            <div className="value">{k.value}</div>
            <div className="label">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Compliance by teacher <span className="count-pill">{teachers.length} staff</span></h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Teacher</th><th>Role</th><th>Required</th><th>Done</th><th>Compliance</th><th>Progress</th><th>Missing</th></tr>
            </thead>
            <tbody>
              {teachers.slice(0, 40).map((t) => (
                <tr key={t.user_id} onClick={() => setSelected(selected?.user_id === t.user_id ? null : t)} style={{ cursor: 'pointer' }}>
                  <td><strong>{t.name}</strong> <span className="muted">@{t.username}</span></td>
                  <td><Badge status="late" /> {t.role}</td>
                  <td>{t.required}</td>
                  <td>{t.done}</td>
                  <td><strong>{t.percent}%</strong></td>
                  <td><Bar percent={t.percent} /></td>
                  <td className="muted">{t.missing.length ? `${t.missing.length} docs` : 'none'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selected && (
          <div style={{ marginTop: 12 }}>
            <h4 style={{ margin: '6px 0' }}><TriangleAlert size={14} style={{ verticalAlign: -2 }} /> Missing documents — {selected.name}</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {selected.missing.map((c) => <span className="section-chip" key={c}>{c.replace(/_/g, ' ')}</span>)}
            </div>
          </div>
        )}
      </div>

      <div className="two-col">
        <div className="card">
          <h3>Department / role compliance</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Department</th><th>Teachers</th><th>Compliance</th><th></th></tr></thead>
              <tbody>
                {data.departments.map((d) => (
                  <tr key={d.role}>
                    <td><strong>{d.role.replace(/_/g, ' ')}</strong></td>
                    <td>{d.teachers}</td>
                    <td><strong>{d.percent}%</strong></td>
                    <td><Bar percent={d.percent} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h3>Category gaps <span className="muted">(coverage of required reports)</span></h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Report category</th><th>Covered</th><th>Compliance</th></tr></thead>
              <tbody>
                {data.groups.map((g) => (
                  <tr key={g.group}>
                    <td><strong>{g.group}</strong></td>
                    <td>{g.covered}/{g.required}</td>
                    <td><strong style={{ color: g.percent < 50 ? 'var(--danger)' : 'inherit' }}>{g.percent}%</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}