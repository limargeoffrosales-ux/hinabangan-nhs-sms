import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen, Video, Link2, Presentation, ListChecks, File as FileIcon,
  FileText, Paperclip, ChevronDown, ChevronRight, Layers,
} from 'lucide-react';
import { api, getApiBase } from '../lib/api';
import { safeHttpUrl } from '../lib/utils';
import { useAuth } from '../lib/auth';
import DOMPurify from 'dompurify';
import { PageHead, Empty, ErrorBanner, Spinner } from '../components/ui';

const TYPE_META = {
  reading: { icon: BookOpen, color: 'var(--accent)' },
  presentation: { icon: Presentation, color: 'var(--accent-2, #6366f1)' },
  document: { icon: FileText, color: 'var(--accent)' },
  video: { icon: Video, color: 'var(--danger, #e11d48)' },
  link: { icon: Link2, color: 'var(--accent-2, #6366f1)' },
  activity: { icon: ListChecks, color: 'var(--warning, #d97706)' },
  other: { icon: FileIcon, color: 'var(--text-dim)' },
};

function MaterialCard({ m, spaceId }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [atts, setAtts] = useState(null);
  const meta = TYPE_META[m.type] || TYPE_META.other;
  const Icon = meta.icon;

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && atts === null) {
      try {
        const r = await api(`/lm/spaces/${spaceId}/materials/${m.id}/attachments`);
        setAtts(r.data || []);
      } catch { setAtts([]); }
    }
  }

  const links = [
    ['lm.url', m.url], ['lm.driveUrl', m.drive_url], ['lm.youtubeUrl', m.youtube_url],
    ['lm.lessonPlanUrl', m.lesson_plan_url], ['lm.dllUrl', m.dll_url],
  ].filter(([, u]) => safeHttpUrl(u));

  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div onClick={toggle} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <Icon size={17} style={{ color: meta.color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ fontSize: 14.5 }}>{m.title}</strong>
          <div className="sub" style={{ fontSize: 11.5, textTransform: 'capitalize' }}>{t(`lm.type.${m.type}`, m.type)}</div>
        </div>
        {(m.is_remedial || m.is_enrichment || m.is_differentiated) && (
          <span className="badge badge-blue">{t('lm.differentiated', 'Differentiated')}</span>
        )}
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </div>
      {open && (
        <div style={{ marginTop: 10 }}>
          {m.body && <div style={{ fontSize: 13.5, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(m.body) }} />}
          {links.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {links.map(([k, u]) => (
                <a key={k} className="btn btn-sm" href={safeHttpUrl(u)} target="_blank" rel="noreferrer">
                  <Link2 size={13} /> {t(k)}
                </a>
              ))}
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <div className="sub" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Paperclip size={13} /> {t('lm.attachments', 'Attachments')}
            </div>
            {atts === null ? <Spinner /> : !atts.length ? (
              <div className="sub">{t('lm.noAttachments', 'No files.')}</div>
            ) : atts.map((a) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '2px 0' }}>
                <FileText size={14} style={{ color: 'var(--text-dim)' }} />
                <a href={`${getApiBase()}/lm/attachments/${a.id}/download`} target="_blank" rel="noreferrer" style={{ flex: 1 }}>{a.original_name}</a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PortalLearning() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [sy, setSy] = useState('2026-2027');
  const [spaces, setSpaces] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [spaceId, setSpaceId] = useState('');
  const [modules, setModules] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loadingSpace, setLoadingSpace] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await api(`/lm/spaces?school_year=${encodeURIComponent(sy)}`);
      const list = d.data || [];
      setSpaces(list);
      if (list.length && !spaceId) setSpaceId(String(list[0].id));
    } catch (e) {
      setError(e.message);
      setSpaces([]);
    } finally {
      setLoading(false);
    }
  }, [sy, spaceId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!spaceId) { setModules([]); setMaterials([]); return; }
    setLoadingSpace(true);
    Promise.all([
      api(`/lm/spaces/${spaceId}/modules`),
      api(`/lm/spaces/${spaceId}/materials`),
    ]).then(([mod, mat]) => {
      setModules(mod.data || []);
      setMaterials(mat.data || []);
    }).catch((e) => setError(e.message))
      .finally(() => setLoadingSpace(false));
  }, [spaceId]);

  if (user && user.role !== 'student') {
    return (
      <>
        <PageHead title={t('portal.materials', 'Learning Materials')} />
        <Empty text={t('lm.studentsOnly', 'Learning materials are available to student accounts.')} />
      </>
    );
  }

  const byModule = (moduleId) => materials.filter((m) => (m.module_id ? Number(m.module_id) : null) === moduleId);
  const unlinked = materials.filter((m) => !m.module_id);

  return (
    <>
      <PageHead title={t('portal.materials', 'Learning Materials')} sub={t('portal.materialsSub', 'Modules and materials posted by your teachers.')} />
      <ErrorBanner error={error} />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row" style={{ margin: 0, alignItems: 'end' }}>
          <div><label>{t('lm.schoolYear', 'School year')}</label>
            <input value={sy} onChange={(e) => setSy(e.target.value)} /></div>
          <button className="btn" onClick={load}>{t('lm.refresh', 'Refresh')}</button>
        </div>
      </div>

      {loading ? <Spinner /> : !spaces || !spaces.length ? (
        <Empty text={t('lm.noPublished', 'Nothing has been published to you yet.')} />
      ) : (
        <>
          {spaces.length > 1 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <label>{t('lm.classLabel', 'Class')}</label>
              <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>{s.section_name} · {s.subject_code} — {s.subject_title}</option>
                ))}
              </select>
            </div>
          )}

          {loadingSpace ? <Spinner /> : !materials.length ? (
            <Empty text={t('lm.noPublished', 'Nothing has been published to you yet.')} />
          ) : (
            <>
              {modules.map((mod) => {
                const list = byModule(Number(mod.id));
                if (!list.length) return null;
                return (
                  <div key={mod.id} style={{ marginBottom: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Layers size={16} style={{ color: 'var(--accent)' }} />
                      <strong>{mod.title}</strong>
                      {mod.week_or_module ? <span className="sub">{mod.week_or_module}</span> : null}
                    </div>
                    {mod.description && <div className="sub" style={{ marginBottom: 8 }}>{mod.description}</div>}
                    {list.map((m) => <MaterialCard key={m.id} m={m} spaceId={spaceId} />)}
                  </div>
                );
              })}
              {unlinked.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div className="sub" style={{ marginBottom: 8 }}>{t('lm.otherMaterials', 'Other materials')}</div>
                  {unlinked.map((m) => <MaterialCard key={m.id} m={m} spaceId={spaceId} />)}
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
