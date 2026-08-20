import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Award, ExternalLink } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { PageHead, Spinner, Empty } from '../components/ui';

const STATUS_COLORS = { active: 'badge-green', expired: 'badge-red', pending: 'badge-yellow' };
const TYPE_COLORS = { NCII: 'badge-blue', TESDA: 'badge-purple', OTHER: 'badge-gray' };

export default function PortalCertifications() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/portal/certifications').then((r) => setRows(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHead title="My Certifications" sub="NCII, TESDA, and other vocational certifications" />
      {rows.length === 0 ? (
        <Empty text="No certification records found." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {rows.map((r) => (
            <div key={r.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 4px', fontSize: 15 }}><Award size={14} /> {r.cert_name}</h3>
                  <div className="sub" style={{ fontSize: 12 }}>
                    <span className={`badge ${TYPE_COLORS[r.certification_type] || 'badge-gray'}`}>{r.certification_type}</span>
                    {r.specialization && <span style={{ marginLeft: 6 }}>{r.specialization}</span>}
                  </div>
                </div>
                <span className={`badge ${STATUS_COLORS[r.status]}`}>{r.status}</span>
              </div>
              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-dim)' }}>
                {r.issuing_body && <div>Issued by: {r.issuing_body}</div>}
                {r.certificate_no && <div>Certificate #: {r.certificate_no}</div>}
                {r.date_acquired && <div>Acquired: {r.date_acquired.slice(0, 10)}</div>}
                {r.expiry_date && <div>Expires: {r.expiry_date.slice(0, 10)}</div>}
              </div>
              {r.notes && <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '8px 0 0' }}>{r.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
