import { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Gauge, TriangleAlert, Clock4, CheckCircle2, FileWarning, Undo } from 'lucide-react';
import { api } from '../lib/api';
import { SCHOOL_YEARS } from '../lib/constants';
import { PageHead, ErrorBanner } from '../components/ui';

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
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [sy, setSy] = useState('2026-2027');
  const [statusFilter, setStatusFilter] = useState('all');

  const SUB_BADGES = {
    draft: 'badge-gray', submitted: 'badge-blue', reviewed: 'badge-yellow',
    approved: 'badge-green', returned: 'badge-red',
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api(`/submissions/compliance?school_year=${encodeURIComponent(sy)}`);
      setData(res);
    } catch (e) {
      setError(e.message);
    }
  }, [sy]);

  useEffect(() => { load(); }, [load]);

  const teachers = useMemo(() => (data?.teachers || []).slice().sort((a, b) => a.percent - b.percent), [data]);

  const submissionRows = useMemo(() => {
    const rows = [];
    (data?.teachers || []).forEach((t) => {
      (t.submissions || []).forEach((s) => rows.push({ ...s, teacher_name: t.name }));
    });
    if (statusFilter === 'all') return rows;
    if (statusFilter === 'complied') return rows.filter((r) => r.complied);
    if (statusFilter === 'not complied') return rows.filter((r) => !r.complied);
    if (statusFilter === 'overdue') return rows.filter((r) => r.overdue);
    return rows.filter((r) => r.status === statusFilter);
  }, [data, statusFilter]);

  const complianceBadge = (r) => {
    if (r.complied) return <span className="badge badge-green">{t('compliance.statusComplied', 'Complied')}</span>;
    if (r.overdue) return <span className="badge badge-red">{t('compliance.statusOverdue', 'Overdue')}</span>;
    return <span className="badge badge-red">{t('compliance.statusNotComplied', 'Not complied')}</span>;
  };

  if (!data) {
    return (
      <div>
        <PageHead title={t('compliance.title', 'Compliance Dashboard')} sub={t('compliance.subtitle', 'Compliance with the report tasks given by the school administration.')} />
        <ErrorBanner error={error} />
        <div className="spinner" />
      </div>
    );
  }

  const kpis = [
    { label: t('compliance.kpiOverall', 'Overall compliance'), value: data.overall != null ? data.overall + '%' : '—', icon: Gauge, color: 'var(--accent)' },
    { label: t('compliance.kpiApproved', 'Approved'), value: data.kpis.approved, icon: CheckCircle2, color: 'var(--success)' },
    { label: t('compliance.kpiPendingReview', 'Pending review'), value: data.kpis.submitted + data.kpis.reviewed, icon: Clock4, color: 'var(--warn)' },
    { label: t('compliance.kpiReturned', 'Returned for revision'), value: data.kpis.returned, icon: Undo, color: 'var(--warn)' },
    { label: t('compliance.kpiOverdue', 'Overdue'), value: data.kpis.overdue, icon: Clock4, color: 'var(--danger)' },
    { label: t('compliance.kpiIncomplete', 'Incomplete tasks'), value: data.kpis.missing, icon: FileWarning, color: 'var(--danger)' },
  ];

  return (
    <div>
      <PageHead title={t('compliance.title', 'Compliance Dashboard')} sub={t('compliance.subtitle2', 'Only the report tasks given or initiated by the administration appear here — per teacher, per department, per category.')}>
        <select className="input" value={sy} onChange={(e) => setSy(e.target.value)} style={{ width: 130 }}>
          {SCHOOL_YEARS.map((y) => <option key={y}>{y}</option>)}
        </select>
      </PageHead>
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
        <h3>{t('compliance.byTeacher', 'Compliance by teacher')} <span className="count-pill">{t('compliance.assignedTasksCount', '{{count}} assigned tasks', { count: data.assigned_tasks })}</span></h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>{t('compliance.colTeacher', 'Teacher')}</th><th>{t('compliance.colRole', 'Role')}</th><th>{t('compliance.colTasks', 'Tasks')}</th><th>{t('compliance.colDone', 'Done')}</th><th>{t('compliance.colCompliance', 'Compliance')}</th><th>{t('compliance.colProgress', 'Progress')}</th><th>{t('compliance.colIncomplete', 'Incomplete')}</th></tr>
            </thead>
            <tbody>
              {teachers.slice(0, 40).map((tc) => (
                <tr key={tc.user_id} onClick={() => setSelected(selected?.user_id === tc.user_id ? null : tc)} style={{ cursor: 'pointer' }}>
                  <td><strong>{tc.name}</strong> <span className="muted">@{tc.username}</span></td>
                  <td>{tc.role}</td>
                  <td>{tc.required}</td>
                  <td>{tc.done}</td>
                  <td><strong>{tc.percent}%</strong></td>
                  <td><Bar percent={tc.percent} /></td>
                  <td className="muted">{tc.missing.length ? `${tc.missing.length} ${t('compliance.tasksWord', 'task(s)')}` : t('compliance.none', 'none')}</td>
                </tr>
              ))}
              {teachers.length === 0 && (
                <tr><td colSpan={7} className="sub">{t('compliance.noTasks', 'No assigned tasks for {{sy}} yet — admins can give tasks under Teacher Submissions → Assign task.', { sy })}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {selected && (
          <div style={{ marginTop: 12 }}>
            <h4 style={{ margin: '6px 0' }}><TriangleAlert size={14} style={{ verticalAlign: -2 }} /> {t('compliance.incompleteFor', 'Incomplete tasks — {{name}}', { name: selected.name })}</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {selected.missing.map((c) => <span className="section-chip" key={c}>{c.replace(/_/g, ' ')}</span>)}
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0 }}>{t('compliance.submission', 'Submission compliance — every assigned task')} <span className="count-pill">{submissionRows.length}</span></h3>
          <select className="input" style={{ width: 170 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">{t('compliance.statusAll', 'All statuses')}</option>
            <option value="complied">{t('compliance.statusComplied', 'Complied')}</option>
            <option value="not complied">{t('compliance.statusNotComplied', 'Not complied')}</option>
            <option value="overdue">{t('compliance.statusOverdue', 'Overdue')}</option>
            <option value="draft">{t('compliance.statusDraft', 'Draft')}</option>
            <option value="submitted">{t('compliance.statusSubmitted', 'Submitted')}</option>
            <option value="reviewed">{t('compliance.statusReviewed', 'Reviewed')}</option>
            <option value="approved">{t('compliance.statusApproved', 'Approved')}</option>
            <option value="returned">{t('compliance.statusReturned', 'Returned')}</option>
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>{t('compliance.colTeacher', 'Teacher')}</th><th>{t('compliance.colReport', 'Report')}</th><th>{t('compliance.colCategory', 'Category')}</th><th>{t('compliance.colDueDate', 'Due date')}</th><th>{t('compliance.colStatus', 'Status')}</th><th>{t('compliance.colCompliance', 'Compliance')}</th></tr>
            </thead>
            <tbody>
              {submissionRows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.teacher_name}</td>
                    <td>{r.code.replace(/_/g, ' ')}<br /><span className="muted">{r.report_name}</span></td>
                    <td>{r.group_name}</td>
                    <td>{r.due_date || '—'}</td>
                    <td><span className={`badge ${SUB_BADGES[r.status] || 'badge-gray'}`}>{r.status}</span></td>
                    <td>{complianceBadge(r)}</td>
                  </tr>
              ))}
              {submissionRows.length === 0 && (
                <tr><td colSpan={6} className="sub">{t('compliance.noTasks', 'No assigned tasks for {{sy}} yet — admins can give tasks under Teacher Submissions → Assign task.', { sy })}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <h3>{t('compliance.deptRole', 'Department / role compliance')}</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t('compliance.colDepartment', 'Department')}</th><th>{t('compliance.colTeachers', 'Teachers')}</th><th>{t('compliance.colCompliance', 'Compliance')}</th><th></th></tr></thead>
              <tbody>
                {data.departments.map((d) => (
                  <tr key={d.role}>
                    <td><strong>{d.role.replace(/_/g, ' ')}</strong></td>
                    <td>{d.teachers}</td>
                    <td><strong>{d.percent}%</strong></td>
                    <td><Bar percent={d.percent} /></td>
                  </tr>
                ))}
                {data.departments.length === 0 && (
                  <tr><td colSpan={4} className="sub">{t('compliance.noDepartments', 'No departments with assigned tasks yet.')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h3>{t('compliance.categoryCoverage', 'Category coverage')} <span className="muted">{t('compliance.assignedOnly', '(assigned tasks only)')}</span></h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t('compliance.colReportCategory', 'Report category')}</th><th>{t('compliance.colDone', 'Done')}</th><th>{t('compliance.colCompliance', 'Compliance')}</th></tr></thead>
              <tbody>
                {data.groups.map((g) => (
                  <tr key={g.group}>
                    <td><strong>{g.group}</strong></td>
                    <td>{g.covered}/{g.required}</td>
                    <td><strong style={{ color: g.percent < 50 ? 'var(--danger)' : 'inherit' }}>{g.percent}%</strong></td>
                  </tr>
                ))}
                {data.groups.length === 0 && (
                  <tr><td colSpan={3} className="sub">{t('compliance.noAssigned', 'No assigned tasks yet.')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
