import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { PageHead, Empty, ErrorBanner, SkeletonTable } from '../components/ui';

export default function AuditLogs() {
  const [rows, setRows] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [a, ac] = await Promise.all([api('/audit?limit=100'), api('/audit/actions')]);
        setRows(a.data);
        setActions(ac.data);
        setError(null);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <PageHead title="Audit Logs" sub="Immutable activity trail — every action is recorded for compliance (RA 10173, DepEd)" />
      <ErrorBanner error={error} />
      {loading ? <SkeletonTable rows={10} cols={4} /> : (
        <div className="two-col">
          <div className="card table-wrap">
            <table>
              <thead>
                <tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>{r.created_at?.replace('T', ' ').slice(0, 16)}</td>
                    <td>{r.username || '—'}</td>
                    <td><strong style={{ fontSize: 12.5 }}>{r.action}</strong></td>
                    <td style={{ fontSize: 12.5 }}>{r.entity}{r.entity_id ? ` #${r.entity_id}` : ''}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      {r.details ? String(r.details).slice(0, 60) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Activity by Action</h3>
            {actions.length === 0 ? <Empty text="No activity yet." /> : (
              actions.slice(0, 12).map((a) => (
                <div key={a.action} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13.5 }}>{a.action}</span>
                  <strong style={{ fontSize: 13.5 }}>{a.n}</strong>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
