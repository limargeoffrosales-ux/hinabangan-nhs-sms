import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Layers } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { PageHead, Badge, Modal, Empty, ErrorBanner, Spinner, ConfirmModal, SkeletonTable } from '../components/ui';

const TABS = ['Tracks & Strands', 'Competencies', 'Subject Mapping'];
const GRADE_LEVELS = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];
const QUARTERS = [1, 2, 3, 4];
const COMPETENCY_TYPES = [
  { value: 'knowledge', label: 'Knowledge' },
  { value: 'skill', label: 'Skill' },
  { value: 'understanding', label: 'Understanding' },
  { value: 'process', label: 'Process' },
];

const EMPTY_TRACK = { code: '', name: '', description: '' };
const EMPTY_STRAND = { code: '', name: '', description: '', track_id: '' };
const EMPTY_COMPETENCY = { code: '', title: '', description: '', strand_id: '', track_id: '', grade_level: 'Grade 7', quarter: 1, subject_area: '', competency_type: 'knowledge' };
const EMPTY_MAPPING = { competency_id: '', quarter: 1, sort_order: 0 };

const TYPE_BADGE = { knowledge: 'blue', skill: 'green', understanding: 'purple', process: 'yellow' };

export default function Curriculum() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = can(user?.role, 'super_admin', 'school_admin');

  const [tab, setTab] = useState(TABS[0]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [tracks, setTracks] = useState([]);
  const [strands, setStrands] = useState([]);
  const [expandedTrack, setExpandedTrack] = useState(null);

  const [competencies, setCompetencies] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const [compTrackFilter, setCompTrackFilter] = useState('');
  const [compStrandFilter, setCompStrandFilter] = useState('');
  const [compGradeFilter, setCompGradeFilter] = useState('');
  const [compQuarterFilter, setCompQuarterFilter] = useState('');
  const [compTypeFilter, setCompTypeFilter] = useState('');

  const [mapSubjectId, setMapSubjectId] = useState('');
  const [mappings, setMappings] = useState([]);

  const [trackModal, setTrackModal] = useState(false);
  const [trackForm, setTrackForm] = useState(EMPTY_TRACK);
  const [trackEditing, setTrackEditing] = useState(null);

  const [strandModal, setStrandModal] = useState(false);
  const [strandForm, setStrandForm] = useState(EMPTY_STRAND);
  const [strandEditing, setStrandEditing] = useState(null);

  const [compModal, setCompModal] = useState(false);
  const [compForm, setCompForm] = useState(EMPTY_COMPETENCY);
  const [compEditing, setCompEditing] = useState(null);

  const [mapModal, setMapModal] = useState(false);
  const [mapForm, setMapForm] = useState(EMPTY_MAPPING);
  const [confirmAction, setConfirmAction] = useState(null);

  const loadTracks = useCallback(async () => {
    try {
      const res = await api('/curriculum/tracks?limit=300');
      setTracks(res.data);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const loadStrands = useCallback(async () => {
    try {
      const res = await api('/curriculum/strands?limit=500');
      setStrands(res.data);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const loadCompetencies = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ limit: '500' });
      if (compTrackFilter) qs.set('track_id', compTrackFilter);
      if (compStrandFilter) qs.set('strand_id', compStrandFilter);
      if (compGradeFilter) qs.set('grade_level', compGradeFilter);
      if (compQuarterFilter) qs.set('quarter', compQuarterFilter);
      if (compTypeFilter) qs.set('competency_type', compTypeFilter);
      const res = await api(`/curriculum/competencies?${qs}`);
      setCompetencies(res.data);
    } catch (e) {
      setError(e.message);
    }
  }, [compTrackFilter, compStrandFilter, compGradeFilter, compQuarterFilter, compTypeFilter]);

  const loadSubjects = useCallback(async () => {
    try {
      const res = await api('/subjects?limit=300');
      setSubjects(res.data);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const loadMappings = useCallback(async () => {
    if (!mapSubjectId) { setMappings([]); return; }
    try {
      const res = await api(`/curriculum/subject-competencies?subject_id=${mapSubjectId}`);
      setMappings(res.data);
    } catch (e) {
      setError(e.message);
    }
  }, [mapSubjectId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadTracks(), loadStrands(), loadSubjects()]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [loadTracks, loadStrands, loadSubjects]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { if (tab === 'Competencies') loadCompetencies(); }, [tab, compTrackFilter, compStrandFilter, compGradeFilter, compQuarterFilter, compTypeFilter, loadCompetencies]);
  useEffect(() => { if (tab === 'Subject Mapping') { loadSubjects(); loadMappings(); } }, [tab, mapSubjectId, loadSubjects, loadMappings]);

  const allStrands = strands.map((s) => ({ ...s, track_name: s.track_name || (tracks.find((t) => String(t.id) === String(s.track_id)) || {}).name || null }));
  const filteredStrands = compTrackFilter ? allStrands.filter((s) => String(s.track_id) === String(compTrackFilter)) : allStrands;

  function setTrack(k, v) { setTrackForm((f) => ({ ...f, [k]: v })); }
  function setStrand(k, v) { setStrandForm((f) => ({ ...f, [k]: v })); }
  function setComp(k, v) { setCompForm((f) => ({ ...f, [k]: v })); }
  function setMap(k, v) { setMapForm((f) => ({ ...f, [k]: v })); }

  function openCreateTrack() { setTrackForm(EMPTY_TRACK); setTrackEditing(null); setTrackModal(true); }
  function openEditTrack(t) { setTrackForm({ ...EMPTY_TRACK, ...t }); setTrackEditing(t.id); setTrackModal(true); }

  async function saveTrack(e) {
    e.preventDefault();
    setError(null);
    try {
      if (trackEditing) await api(`/curriculum/tracks/${trackEditing}`, { method: 'PATCH', body: trackForm });
      else await api('/curriculum/tracks', { method: 'POST', body: trackForm });
      setTrackModal(false);
      await loadTracks();
    } catch (e2) { setError(e2.message); }
  }

  async function removeTrack(tr) {
    setConfirmAction({ message: t('cur.deleteTrackConfirm', { name: tr.name }), action: async () => { await api(`/curriculum/tracks/${tr.id}`, { method: 'DELETE' }); await loadTracks(); } });
  }

  function openCreateStrand(trackId) {
    setStrandForm({ ...EMPTY_STRAND, track_id: trackId });
    setStrandEditing(null);
    setStrandModal(true);
  }

  function openEditStrand(s) {
    setStrandForm({ ...EMPTY_STRAND, ...s });
    setStrandEditing(s.id);
    setStrandModal(true);
  }

  async function saveStrand(e) {
    e.preventDefault();
    setError(null);
    try {
      if (strandEditing) await api(`/curriculum/strands/${strandEditing}`, { method: 'PATCH', body: strandForm });
      else await api('/curriculum/strands', { method: 'POST', body: strandForm });
      setStrandModal(false);
      await Promise.all([loadTracks(), loadStrands()]);
    } catch (e2) { setError(e2.message); }
  }

  async function removeStrand(s) {
    setConfirmAction({ message: t('cur.deleteStrandConfirm', { name: s.name }), action: async () => {
      try {
        await api(`/curriculum/strands/${s.id}`, { method: 'DELETE' });
        await Promise.all([loadTracks(), loadStrands()]);
      } catch (e2) { setError(e2.message); }
    } });
  }

  function openCreateComp() {
    setCompForm(EMPTY_COMPETENCY);
    setCompEditing(null);
    setCompModal(true);
  }

  function openEditComp(c) {
    setCompForm({ ...EMPTY_COMPETENCY, ...c, quarter: c.quarter || 1 });
    setCompEditing(c.id);
    setCompModal(true);
  }

  async function saveComp(e) {
    e.preventDefault();
    setError(null);
    try {
      const body = { ...compForm, quarter: Number(compForm.quarter), strand_id: compForm.strand_id || null, track_id: compForm.track_id || null };
      if (compEditing) await api(`/curriculum/competencies/${compEditing}`, { method: 'PATCH', body });
      else await api('/curriculum/competencies', { method: 'POST', body });
      setCompModal(false);
      await loadCompetencies();
    } catch (e2) { setError(e2.message); }
  }

  async function removeComp(c) {
    setConfirmAction({ message: t('cur.deleteCompConfirm', { title: c.title }), action: async () => {
      try {
        await api(`/curriculum/competencies/${c.id}`, { method: 'DELETE' });
        await loadCompetencies();
      } catch (e2) { setError(e2.message); }
    } });
  }

  async function saveMapping(e) {
    e.preventDefault();
    setError(null);
    try {
      await api('/curriculum/subject-competencies', { method: 'POST', body: { ...mapForm, subject_id: mapSubjectId, competency_id: Number(mapForm.competency_id), quarter: Number(mapForm.quarter), sort_order: Number(mapForm.sort_order) } });
      setMapModal(false);
      setMapForm(EMPTY_MAPPING);
      await loadMappings();
    } catch (e2) { setError(e2.message); }
  }

  async function removeMapping(m) {
    setConfirmAction({ message: t('cur.deleteMappingConfirm'), action: async () => {
      try {
        await api(`/curriculum/subject-competencies/${m.id}`, { method: 'DELETE' });
        await loadMappings();
      } catch (e2) { setError(e2.message); }
    } });
  }

  const strandName = (id) => allStrands.find((s) => s.id === id)?.name || '—';

  return (
    <>
      <PageHead title={t('cur.title', 'Curriculum Management')} sub={t('cur.subtitle', 'Manage tracks, strands, competencies, and subject mappings')}>
        {canWrite && tab === 'Tracks & Strands' && <button className="btn btn-primary" onClick={openCreateTrack}><Plus size={15} /> {t('cur.newTrack', 'New Track')}</button>}
        {canWrite && tab === 'Competencies' && <button className="btn btn-primary" onClick={openCreateComp}><Plus size={15} /> {t('cur.newCompetency', 'New Competency')}</button>}
        {canWrite && tab === 'Subject Mapping' && mapSubjectId && <button className="btn btn-primary" onClick={() => { setMapForm(EMPTY_MAPPING); setMapModal(true); }}><Plus size={15} /> {t('cur.addMapping', 'Add Mapping')}</button>}
      </PageHead>

      <div className="seg" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t} className={tab === t ? 'seg-btn active' : 'seg-btn'} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      <ErrorBanner error={error} />

      {loading ? <SkeletonTable rows={8} cols={4} /> : (
        <>
          {tab === 'Tracks & Strands' && (
            tracks.length === 0 ? <Empty text={t('cur.noTracks', 'No tracks defined yet.')} /> : (
              <div className="card table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}></th>
                      <th>{t('cur.code', 'Code')}</th>
                      <th>{t('cur.name', 'Name')}</th>
                      <th>{t('cur.description', 'Description')}</th>
                      <th style={{ textAlign: 'center' }}>{t('cur.strandCount', 'Strands')}</th>
                      {canWrite && <th style={{ textAlign: 'right' }}>{t('common.actions')}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {tracks.map((tr) => {
                      const strandsForTrack = strands.filter((s) => String(s.track_id) === String(tr.id));
                      const isExpanded = expandedTrack === tr.id;
                      return [
                        <tr key={tr.id} style={{ cursor: 'pointer' }} onClick={() => setExpandedTrack(isExpanded ? null : tr.id)}>
                          <td><Layers size={14} style={{ color: 'var(--accent)', verticalAlign: -2 }} /></td>
                          <td style={{ fontVariantNumeric: 'tabular-nums' }}><strong>{tr.code}</strong></td>
                          <td>{tr.name}</td>
                          <td className="sub">{tr.description || '—'}</td>
                          <td style={{ textAlign: 'center' }}><Badge status={strandsForTrack.length ? 'active' : 'normal'} /> {strandsForTrack.length}</td>
                          {canWrite && (
                            <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                              <button className="btn btn-sm" onClick={() => openEditTrack(tr)} aria-label="Edit track"><Pencil size={13} aria-hidden="true" /></button>{' '}
                              <button className="btn btn-sm btn-danger" onClick={() => removeTrack(tr)} aria-label="Delete track"><Trash2 size={13} aria-hidden="true" /></button>{' '}
                              <button className="btn btn-sm" onClick={() => openCreateStrand(tr.id)} aria-label="Add strand"><Plus size={13} aria-hidden="true" /></button>
                            </td>
                          )}
                        </tr>,
                        isExpanded && strandsForTrack.map((s) => (
                          <tr key={`s-${s.id}`} style={{ background: 'var(--bg-muted, #f9f9fb)' }}>
                            <td></td>
                            <td style={{ fontVariantNumeric: 'tabular-nums', paddingLeft: 28 }}>{s.code}</td>
                            <td style={{ paddingLeft: 28 }}>{s.name}</td>
                            <td className="sub">{s.description || '—'}</td>
                            <td></td>
                            {canWrite && (
                              <td className="row-actions">
                                <button className="btn btn-sm" onClick={() => openEditStrand(s)} aria-label="Edit strand"><Pencil size={13} aria-hidden="true" /></button>{' '}
                                <button className="btn btn-sm btn-danger" onClick={() => removeStrand(s)} aria-label="Delete strand"><Trash2 size={13} aria-hidden="true" /></button>
                              </td>
                            )}
                          </tr>
                        )),
                      ];
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}

          {tab === 'Competencies' && (
            <div className="card" style={{ marginBottom: 12, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <select className="input" style={{ maxWidth: 180 }} value={compTrackFilter} onChange={(e) => setCompTrackFilter(e.target.value)}>
                <option value="">{t('cur.allTracks', 'All Tracks')}</option>
                {tracks.map((tr) => <option key={tr.id} value={tr.id}>{tr.name}</option>)}
              </select>
              <select className="input" style={{ maxWidth: 180 }} value={compStrandFilter} onChange={(e) => setCompStrandFilter(e.target.value)}>
                <option value="">{t('cur.allStrands', 'All Strands')}</option>
                {filteredStrands.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select className="input" style={{ maxWidth: 140 }} value={compGradeFilter} onChange={(e) => setCompGradeFilter(e.target.value)}>
                <option value="">{t('cur.allGrades', 'All Grades')}</option>
                {GRADE_LEVELS.map((g) => <option key={g}>{g}</option>)}
              </select>
              <select className="input" style={{ maxWidth: 130 }} value={compQuarterFilter} onChange={(e) => setCompQuarterFilter(e.target.value)}>
                <option value="">{t('cur.allQuarters', 'All Quarters')}</option>
                {QUARTERS.map((q) => <option key={q} value={q}>{t('cur.quarter', 'Quarter')} {q}</option>)}
              </select>
              <select className="input" style={{ maxWidth: 160 }} value={compTypeFilter} onChange={(e) => setCompTypeFilter(e.target.value)}>
                <option value="">{t('cur.allTypes', 'All Types')}</option>
                {COMPETENCY_TYPES.map((ct) => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
              </select>
              <button className="btn btn-sm" onClick={loadCompetencies}>{t('common.refresh')}</button>
            </div>
          )}

          {tab === 'Competencies' && (
            loading ? <Spinner /> : competencies.length === 0 ? <Empty text={t('cur.noCompetencies', 'No competencies match the current filters.')} /> : (
              <div className="card table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t('cur.code', 'Code')}</th>
                      <th>{t('cur.title', 'Title')}</th>
                      <th>{t('cur.strand', 'Strand')}</th>
                      <th>{t('cur.gradeLevel', 'Grade')}</th>
                      <th>{t('cur.quarter', 'Quarter')}</th>
                      <th>{t('cur.type', 'Type')}</th>
                      {canWrite && <th style={{ textAlign: 'right' }}>{t('common.actions')}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {competencies.map((c) => (
                      <tr key={c.id}>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}><strong>{c.code}</strong></td>
                        <td>{c.title}</td>
                        <td className="sub">{c.strand_name || strandName(c.strand_id)}</td>
                        <td>{c.grade_level}</td>
                        <td>{c.quarter}</td>
                        <td><Badge status={TYPE_BADGE[c.competency_type] || 'gray'} /> {c.competency_type}</td>
                        {canWrite && (
                          <td className="row-actions">
                            <button className="btn btn-sm" onClick={() => openEditComp(c)} aria-label="Edit competency"><Pencil size={13} aria-hidden="true" /></button>{' '}
                            <button className="btn btn-sm btn-danger" onClick={() => removeComp(c)} aria-label="Delete competency"><Trash2 size={13} aria-hidden="true" /></button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {tab === 'Subject Mapping' && (
            <>
              <div className="card" style={{ marginBottom: 12, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
                <label style={{ margin: 0, fontWeight: 500 }}>{t('cur.selectSubject', 'Subject:')}</label>
                <select className="input" style={{ maxWidth: 320 }} value={mapSubjectId} onChange={(e) => setMapSubjectId(e.target.value)}>
                  <option value="">{t('cur.chooseSubject', 'Choose a subject…')}</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.title}</option>)}
                </select>
              </div>
              {!mapSubjectId ? <Empty text={t('cur.selectSubjectHint', 'Select a subject above to view and manage its competency mappings.')} /> : (
                loading ? <Spinner /> : mappings.length === 0 ? <Empty text={t('cur.noMappings', 'No competencies mapped to this subject yet.')} /> : (
                  <div className="card table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{t('cur.order', 'Order')}</th>
                          <th>{t('cur.competency', 'Competency')}</th>
                          <th>{t('cur.code', 'Code')}</th>
                          <th>{t('cur.strand', 'Strand')}</th>
                          <th>{t('cur.quarter', 'Quarter')}</th>
                          {canWrite && <th style={{ textAlign: 'right' }}>{t('common.actions')}</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {mappings.map((m) => (
                          <tr key={m.id}>
                            <td>{m.sort_order}</td>
                            <td>{m.competency_title || '—'}</td>
                            <td style={{ fontVariantNumeric: 'tabular-nums' }}>{m.competency_code || '—'}</td>
                            <td className="sub">{m.strand_name || '—'}</td>
                            <td>{m.quarter}</td>
                            {canWrite && (
                              <td style={{ textAlign: 'right' }}>
                                <button className="btn btn-sm btn-danger" onClick={() => removeMapping(m)} aria-label="Remove mapping"><Trash2 size={13} aria-hidden="true" /></button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </>
          )}
        </>
      )}

      {trackModal && (
        <Modal
          title={trackEditing ? t('cur.editTrack', 'Edit Track') : t('cur.newTrack', 'New Track')}
          sub={t('cur.trackInfo', 'Tracks define major academic pathways.')}
          onClose={() => setTrackModal(false)}
        >
          <form onSubmit={saveTrack}>
            <div className="form-row">
              <div><label>{t('cur.code', 'Code')} *</label><input required value={trackForm.code} onChange={(e) => setTrack('code', e.target.value)} placeholder="STEM" className="input" /></div>
              <div><label>{t('cur.name', 'Name')} *</label><input required value={trackForm.name} onChange={(e) => setTrack('name', e.target.value)} placeholder="Science, Technology, Engineering & Mathematics" className="input" /></div>
            </div>
            <label>{t('cur.description', 'Description')}</label>
            <textarea rows={3} value={trackForm.description || ''} onChange={(e) => setTrack('description', e.target.value)} />
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setTrackModal(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary">{t('cur.saveTrack', 'Save Track')}</button>
            </div>
          </form>
        </Modal>
      )}

      {strandModal && (
        <Modal
          title={strandEditing ? t('cur.editStrand', 'Edit Strand') : t('cur.newStrand', 'New Strand')}
          sub={t('cur.strandInfo', 'Strands are specializations within a track.')}
          onClose={() => setStrandModal(false)}
        >
          <form onSubmit={saveStrand}>
            <label>{t('cur.track', 'Track')} *</label>
            <select required className="input" value={strandForm.track_id} onChange={(e) => setStrand('track_id', e.target.value)}>
              <option value="">{t('cur.selectTrack', 'Select a track…')}</option>
              {tracks.map((tr) => <option key={tr.id} value={tr.id}>{tr.code} — {tr.name}</option>)}
            </select>
            <div className="form-row" style={{ marginTop: 10 }}>
              <div><label>{t('cur.code', 'Code')} *</label><input required value={strandForm.code} onChange={(e) => setStrand('code', e.target.value)} placeholder="HUMSS" className="input" /></div>
              <div><label>{t('cur.name', 'Name')} *</label><input required value={strandForm.name} onChange={(e) => setStrand('name', e.target.value)} placeholder="Humanities & Social Sciences" className="input" /></div>
            </div>
            <label>{t('cur.description', 'Description')}</label>
            <textarea rows={3} value={strandForm.description || ''} onChange={(e) => setStrand('description', e.target.value)} />
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setStrandModal(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary">{t('cur.saveStrand', 'Save Strand')}</button>
            </div>
          </form>
        </Modal>
      )}

      {compModal && (
        <Modal
          title={compEditing ? t('cur.editCompetency', 'Edit Competency') : t('cur.newCompetency', 'New Competency')}
          sub={t('cur.compInfo', 'Define learning competencies linked to strands.')}
          onClose={() => setCompModal(false)}
          wide
        >
          <form onSubmit={saveComp}>
            <div className="form-row">
              <div><label>{t('cur.code', 'Code')} *</label><input required value={compForm.code} onChange={(e) => setComp('code', e.target.value)} placeholder="K-12-..." className="input" /></div>
              <div><label>{t('cur.title', 'Title')} *</label><input required value={compForm.title} onChange={(e) => setComp('title', e.target.value)} className="input" /></div>
            </div>
            <div className="form-row">
              <div>
                <label>{t('cur.track', 'Track')}</label>
                <select className="input" value={compForm.track_id} onChange={(e) => setComp('track_id', e.target.value)}>
                  <option value="">{t('cur.none', 'None')}</option>
                  {tracks.map((tr) => <option key={tr.id} value={tr.id}>{tr.code} — {tr.name}</option>)}
                </select>
              </div>
              <div>
                <label>{t('cur.strand', 'Strand')}</label>
                <select className="input" value={compForm.strand_id} onChange={(e) => setComp('strand_id', e.target.value)}>
                  <option value="">{t('cur.none', 'None')}</option>
                  {allStrands.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                </select>
              </div>
              <div>
                <label>{t('cur.gradeLevel', 'Grade Level')} *</label>
                <select required className="input" value={compForm.grade_level} onChange={(e) => setComp('grade_level', e.target.value)}>
                  {GRADE_LEVELS.map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div>
                <label>{t('cur.quarter', 'Quarter')} *</label>
                <select required className="input" value={compForm.quarter} onChange={(e) => setComp('quarter', e.target.value)}>
                  {QUARTERS.map((q) => <option key={q} value={q}>{t('cur.quarterLabel', 'Quarter')} {q}</option>)}
                </select>
              </div>
              <div>
                <label>{t('cur.type', 'Type')} *</label>
                <select required className="input" value={compForm.competency_type} onChange={(e) => setComp('competency_type', e.target.value)}>
                  {COMPETENCY_TYPES.map((ct) => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
                </select>
              </div>
              <div>
                <label>{t('cur.subjectArea', 'Subject Area')}</label>
                <input value={compForm.subject_area || ''} onChange={(e) => setComp('subject_area', e.target.value)} className="input" placeholder={t('cur.subjectAreaPlaceholder', 'e.g. Mathematics')} />
              </div>
            </div>
            <label>{t('cur.description', 'Description')}</label>
            <textarea rows={3} value={compForm.description || ''} onChange={(e) => setComp('description', e.target.value)} />
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setCompModal(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary">{t('cur.saveCompetency', 'Save Competency')}</button>
            </div>
          </form>
        </Modal>
      )}

      {mapModal && (
        <Modal
          title={t('cur.addMapping', 'Add Competency Mapping')}
          sub={t('cur.mappingInfo', 'Map a competency to this subject with a quarter and sort order.')}
          onClose={() => setMapModal(false)}
        >
          <form onSubmit={saveMapping}>
            <label>{t('cur.competency', 'Competency')} *</label>
            <select required className="input" value={mapForm.competency_id} onChange={(e) => setMap('competency_id', e.target.value)}>
              <option value="">{t('cur.selectCompetency', 'Select a competency…')}</option>
              {competencies.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
            </select>
            <div className="form-row" style={{ marginTop: 10 }}>
              <div>
                <label>{t('cur.quarter', 'Quarter')} *</label>
                <select required className="input" value={mapForm.quarter} onChange={(e) => setMap('quarter', e.target.value)}>
                  {QUARTERS.map((q) => <option key={q} value={q}>{t('cur.quarterLabel', 'Quarter')} {q}</option>)}
                </select>
              </div>
              <div>
                <label>{t('cur.sortOrder', 'Sort Order')} *</label>
                <input required type="number" min="0" className="input" value={mapForm.sort_order} onChange={(e) => setMap('sort_order', e.target.value)} />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setMapModal(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary">{t('cur.saveMapping', 'Save Mapping')}</button>
            </div>
          </form>
        </Modal>
      )}
      {confirmAction && <ConfirmModal message={confirmAction.message} danger onConfirm={() => { confirmAction.action(); setConfirmAction(null); }} onCancel={() => setConfirmAction(null)} />}
    </>
  );
}
