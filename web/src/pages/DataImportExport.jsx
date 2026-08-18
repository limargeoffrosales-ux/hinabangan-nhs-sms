import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Upload, FileSpreadsheet, Filter, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Search } from 'lucide-react';
import { api, getToken, getApiBase } from '../lib/api';
import { downloadBlob } from '../lib/export';
import { PageHead, Badge, Empty, ErrorBanner, Spinner } from '../components/ui';

const TABS = [
  { key: 'export', labelKey: 'die.export' },
  { key: 'import-students', labelKey: 'die.importStudents' },
  { key: 'import-teachers', labelKey: 'die.importTeachers' },
  { key: 'oneroster', labelKey: 'die.oneRoster' },
];

export default function DataImportExport() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('export');
  const [error, setError] = useState(null);

  // Export state
  const [expEntity, setExpEntity] = useState('students');
  const [expFormat, setExpFormat] = useState('csv');
  const [expLoading, setExpLoading] = useState(false);
  const [expSections, setExpSections] = useState([]);
  const [expSubjects, setExpSubjects] = useState([]);
  const [expSectionId, setExpSectionId] = useState('');
  const [expSubjectId, setExpSubjectId] = useState('');
  const [expSY, setExpSY] = useState('');
  const [expTerm, setExpTerm] = useState('');
  const [expStudentId, setExpStudentId] = useState('');
  const [expStudents, setExpStudents] = useState([]);

  // Import state (shared for students/teachers)
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  // OneRoster state
  const [orFileType, setOrFileType] = useState('');
  const [orFiles, setOrFiles] = useState([]);
  const [orPreview, setOrPreview] = useState(null);
  const [orImporting, setOrImporting] = useState(false);
  const [orResult, setOrResult] = useState(null);

  useEffect(() => {
    if (tab === 'export') {
      api('/exchange/oneroster').then((d) => {
        setExpSections([]);
        setExpSubjects([]);
      }).catch(() => {});
    }
  }, [tab]);

  useEffect(() => {
    if (tab === 'export' && (expEntity === 'gradebook' || expEntity === 'attendance')) {
      api('/sections').then((d) => setExpSections(d.data || [])).catch(() => {});
    }
    if (tab === 'export' && expEntity === 'gradebook' && expSectionId) {
      api(`/class-assignments?section_id=${expSectionId}`).then((d) => {
        const subs = [...new Set((d.data || []).map((a) => a.subject_id))];
        api(`/subjects`).then((s) => {
          setExpSubjects((s.data || []).filter((su) => subs.includes(su.id)));
        });
      }).catch(() => {});
    }
    if (tab === 'export' && expEntity === 'transcript') {
      api('/students?limit=500').then((d) => setExpStudents(d.data || [])).catch(() => {});
    }
  }, [tab, expEntity, expSectionId]);

  async function handleExport() {
    setExpLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ format: expFormat });
      if (expEntity === 'gradebook') {
        if (!expSectionId || !expSubjectId || !expSY || !expTerm) {
          throw new Error('gradebook requires section, subject, school year, and term');
        }
        params.set('section_id', expSectionId);
        params.set('subject_id', expSubjectId);
        params.set('school_year', expSY);
        params.set('term', expTerm);
      } else if (expEntity === 'attendance') {
        if (!expSectionId || !expSY) throw new Error('attendance requires section and school year');
        params.set('section_id', expSectionId);
        params.set('school_year', expSY);
      } else if (expEntity === 'transcript') {
        if (!expStudentId || !expSY) throw new Error('transcript requires student and school year');
        params.set('student_id', expStudentId);
        params.set('school_year', expSY);
      }
      const res = await fetch(`${getApiBase()}/exchange/export/${expEntity}?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Export failed (${res.status})`);
      }
      const ext = expFormat === 'xlsx' ? 'xlsx' : expFormat;
      downloadBlob(await res.blob(), `${expEntity}-${Date.now()}.${ext}`, res.headers.get('content-type') || 'application/octet-stream');
    } catch (e) { setError(e.message); } finally { setExpLoading(false); }
  }

  function resetImport() { setFile(null); setPreview(null); setResult(null); }

  async function previewImport(entity) {
    if (!file) return;
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mode', 'preview');
      const res = await fetch(`${getApiBase()}/exchange/import/${entity}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Import failed (${res.status})`);
      setPreview(data);
    } catch (e) { setError(e.message); } finally { setImporting(false); }
  }

  async function applyImport(entity) {
    if (!file) return;
    setImporting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mode', 'apply');
      const res = await fetch(`${getApiBase()}/exchange/import/${entity}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Import failed (${res.status})`);
      setResult(data);
      setPreview(null);
    } catch (e) { setError(e.message); } finally { setImporting(false); }
  }

  async function previewOneRoster() {
    if (!file || !orFileType) return;
    setOrImporting(true);
    setError(null);
    setOrResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('fileType', orFileType);
      fd.append('mode', 'preview');
      const res = await fetch(`${getApiBase()}/exchange/oneroster/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Import failed (${res.status})`);
      setOrPreview(data);
    } catch (e) { setError(e.message); } finally { setOrImporting(false); }
  }

  async function applyOneRoster() {
    if (!file || !orFileType) return;
    setOrImporting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('fileType', orFileType);
      fd.append('mode', 'apply');
      const res = await fetch(`${getApiBase()}/exchange/oneroster/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Import failed (${res.status})`);
      setOrResult(data);
      setOrPreview(null);
    } catch (e) { setError(e.message); } finally { setOrImporting(false); }
  }

  function onerosterExport(fileType) {
    window.open(`${getApiBase()}/exchange/oneroster/${fileType}`, '_blank');
  }

  const IMPORTER_COLS = {
    'import-students': [
      { csv: 'LRN', db: 'lrn' }, { csv: 'First Name', db: 'first_name' }, { csv: 'Middle Name', db: 'middle_name' },
      { csv: 'Last Name', db: 'last_name' }, { csv: 'Sex', db: 'sex' }, { csv: 'Birth Date', db: 'birth_date' },
      { csv: 'Grade Level', db: 'grade_level' }, { csv: 'Strand/Track', db: 'track_strand' },
      { csv: 'Status', db: 'status' }, { csv: 'Contact', db: 'contact' },
    ],
    'import-teachers': [
      { csv: 'Employee No', db: 'employee_no' }, { csv: 'First Name', db: 'first_name' },
      { csv: 'Middle Name', db: 'middle_name' }, { csv: 'Last Name', db: 'last_name' },
      { csv: 'Sex', db: 'sex' }, { csv: 'Position', db: 'position' },
      { csv: 'Email', db: 'email' }, { csv: 'Contact', db: 'contact' },
    ],
  };

  return (
    <div>
      <PageHead title={t('die.title')} sub={t('die.subtitle')} />
      <ErrorBanner error={error} />

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map((tabDef) => (
          <button key={tabDef.key} className={`btn ${tab === tabDef.key ? 'btn-primary' : ''}`} onClick={() => { setTab(tabDef.key); resetImport(); setPreview(null); setResult(null); setOrPreview(null); setOrResult(null); }}>
            {t(tabDef.labelKey)}
          </button>
        ))}
      </div>

      {/* ── Export Tab ── */}
      {tab === 'export' && (
        <div className="card">
          <h3><Download size={16} style={{ verticalAlign: -2, marginRight: 6 }} />{t('die.exportData')}</h3>
          <p className="sub" style={{ marginTop: 0 }}>{t('die.exportDesc')}</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 12 }}>
            <div>
              <label className="label">{t('die.entity')}</label>
              <select value={expEntity} onChange={(e) => setExpEntity(e.target.value)}>
                <option value="students">{t('die.students')}</option>
                <option value="teachers">{t('die.teachers')}</option>
                <option value="sections">{t('die.sections')}</option>
                <option value="gradebook">{t('die.gradebook')}</option>
                <option value="attendance">{t('die.attendanceSummary')}</option>
                <option value="transcript">{t('die.transcript')}</option>
              </select>
            </div>
            <div>
              <label className="label">{t('die.format')}</label>
              <select value={expFormat} onChange={(e) => setExpFormat(e.target.value)}>
                <option value="csv">CSV</option>
                <option value="xlsx">XLSX (Excel)</option>
                <option value="pdf">PDF</option>
              </select>
            </div>
            {(expEntity === 'gradebook' || expEntity === 'attendance' || expEntity === 'transcript') && (
              <div>
                <label className="label">{t('die.schoolYear')}</label>
                <input value={expSY} onChange={(e) => setExpSY(e.target.value)} placeholder="2026-2027" />
              </div>
            )}
            {expEntity === 'gradebook' && (
              <>
                <div>
                  <label className="label">{t('die.section')}</label>
                  <select value={expSectionId} onChange={(e) => setExpSectionId(e.target.value)}>
                    <option value="">—</option>
                    {expSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t('die.subject')}</label>
                  <select value={expSubjectId} onChange={(e) => setExpSubjectId(e.target.value)}>
                    <option value="">—</option>
                    {expSubjects.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t('die.term')}</label>
                  <select value={expTerm} onChange={(e) => setExpTerm(e.target.value)}>
                    <option value="">—</option>
                    <option value="1">Q1</option><option value="2">Q2</option><option value="3">Q3</option><option value="4">Q4</option>
                  </select>
                </div>
              </>
            )}
            {expEntity === 'attendance' && (
              <div>
                <label className="label">{t('die.section')}</label>
                <select value={expSectionId} onChange={(e) => setExpSectionId(e.target.value)}>
                  <option value="">—</option>
                  {expSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            {expEntity === 'transcript' && (
              <div>
                <label className="label">{t('die.student')}</label>
                <select value={expStudentId} onChange={(e) => setExpStudentId(e.target.value)}>
                  <option value="">—</option>
                  {expStudents.map((s) => <option key={s.id} value={s.id}>{s.last_name}, {s.first_name}</option>)}
                </select>
              </div>
            )}
          </div>

          <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={expLoading} onClick={handleExport}>
            <Download size={14} /> {expLoading ? t('die.exporting') + '…' : t('die.export')}
          </button>
        </div>
      )}

      {/* ── Import Students / Teachers Tab ── */}
      {(tab === 'import-students' || tab === 'import-teachers') && (() => {
        const entity = tab === 'import-students' ? 'students' : 'teachers';
        const cols = IMPORTER_COLS[tab] || [];
        return (
          <div className="card">
            <h3><Upload size={16} style={{ verticalAlign: -2, marginRight: 6 }} />{tab === 'import-students' ? t('die.importStudentsTitle') : t('die.importTeachersTitle')}</h3>
            <p className="sub" style={{ marginTop: 0 }}>{t('die.importDesc')}</p>

            <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-secondary, #f8fafc)', borderRadius: 8, fontSize: 12 }}>
              <strong>{t('die.expectedColumns')}</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {cols.map((c) => <span key={c.db} style={{ padding: '2px 8px', borderRadius: 4, background: 'var(--bg, #fff)', border: '1px solid var(--border, #e2e8f0)' }}>{c.csv}{c.db === 'first_name' || c.db === 'last_name' ? ' *' : ''}</span>)}
              </div>
              <span style={{ color: 'var(--muted, #94a3b8)', marginTop: 4, display: 'block' }}>* = {t('die.required')}</span>
            </div>

            <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); setResult(null); }} />
              <button className="btn" disabled={!file || importing} onClick={() => previewImport(entity)}>
                <Search size={14} /> {t('die.preview')}
              </button>
              {preview && (
                <button className="btn btn-primary" disabled={importing} onClick={() => applyImport(entity)}>
                  <Upload size={14} /> {t('die.applyImport')}
                </button>
              )}
              <button className="btn" onClick={resetImport}><RefreshCw size={14} /> {t('die.reset')}</button>
            </div>

            {/* Preview */}
            {preview && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                  <Badge className="badge-blue">{preview.total} {t('die.totalRows')}</Badge>
                  <Badge className="badge-green">{preview.previewed} {t('die.previewed')}</Badge>
                  {preview.errors?.length > 0 && <Badge className="badge-red">{preview.errors.length} {t('die.errors')}</Badge>}
                </div>
                {preview.preview?.length > 0 && (
                  <div className="table-wrap" style={{ maxHeight: 400, overflow: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          {cols.filter((c) => preview.preview[0]?.data?.[c.db] !== undefined).map((c) => <th key={c.db}>{c.csv}</th>)}
                          <th>{t('die.status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.preview.map((row) => (
                          <tr key={row.row} style={row.errors?.length ? { background: 'var(--red-light, #fef2f2)' } : {}}>
                            <td>{row.row}</td>
                            {cols.filter((c) => row.data?.[c.db] !== undefined).map((c) => <td key={c.db}>{row.data[c.db]}</td>)}
                            <td>
                              {row.errors?.length ? (
                                <span style={{ color: 'var(--red, #ef4444)', fontSize: 12 }}><XCircle size={12} /> {row.errors.join(', ')}</span>
                              ) : (
                                <span style={{ color: 'var(--green, #22c55e)', fontSize: 12 }}><CheckCircle2 size={12} /> OK</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Result */}
            {result && (
              <div style={{ marginTop: 16, padding: 16, borderRadius: 8, background: result.errors?.length ? 'var(--amber-light, #fffbeb)' : 'var(--green-light, #f0fdf4)' }}>
                <h4 style={{ margin: '0 0 8px' }}>{result.created !== undefined ? t('die.importComplete') : t('die.importResult')}</h4>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <Badge className="badge-blue">{result.total} {t('die.totalRows')}</Badge>
                  {result.created !== undefined && <Badge className="badge-green">{result.created} {t('die.created')}</Badge>}
                  {result.updated !== undefined && <Badge className="badge-yellow">{result.updated} {t('die.updated')}</Badge>}
                  {result.errors?.length > 0 && <Badge className="badge-red">{result.errors.length} {t('die.errors')}</Badge>}
                </div>
                {result.errors?.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, maxHeight: 150, overflow: 'auto' }}>
                    {result.errors.slice(0, 20).map((e, i) => <div key={i} style={{ color: 'var(--red, #ef4444)' }}>Row {e.row}: {e.error}</div>)}
                    {result.errors.length > 20 && <div>… {result.errors.length - 20} more errors</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── OneRoster Tab ── */}
      {tab === 'oneroster' && (
        <div className="card">
          <h3><FileSpreadsheet size={16} style={{ verticalAlign: -2, marginRight: 6 }} />{t('die.oneRosterTitle')}</h3>
          <p className="sub" style={{ marginTop: 0 }}>{t('die.oneRosterDesc')}</p>

          <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-secondary, #f8fafc)', borderRadius: 8 }}>
            <strong>{t('die.oneRosterExport')}</strong>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {['users', 'courses', 'classes', 'enrollments', 'orgs', 'academicSessions', 'demographics', 'gradebooks', 'results', 'attendanceEvents', 'manifest'].map((f) => (
                <button key={f} className="btn btn-sm" onClick={() => onerosterExport(f)}>
                  <Download size={12} /> {f}.csv
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <strong>{t('die.oneRosterImport')}</strong>
            <div style={{ display: 'flex', gap: 10, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={orFileType} onChange={(e) => { setOrFileType(e.target.value); setOrPreview(null); setOrResult(null); }}>
                <option value="">— {t('die.selectFileType')} —</option>
                {['users', 'courses', 'classes', 'enrollments'].map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <input type="file" accept=".csv" onChange={(e) => { setFile(e.target.files?.[0] || null); setOrPreview(null); setOrResult(null); }} />
              <button className="btn" disabled={!file || !orFileType || orImporting} onClick={previewOneRoster}>
                <Search size={14} /> {t('die.preview')}
              </button>
              {orPreview && (
                <button className="btn btn-primary" disabled={orImporting} onClick={applyOneRoster}>
                  <Upload size={14} /> {t('die.applyImport')}
                </button>
              )}
            </div>
          </div>

          {/* OneRoster Preview */}
          {orPreview && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                <Badge className="badge-blue">{orPreview.total || orPreview.plans?.length || 0} {t('die.totalRows')}</Badge>
                {orPreview.plans?.length > 0 && <Badge className="badge-green">{orPreview.plans.length} {t('die.previewed')}</Badge>}
                {orPreview.error && <Badge className="badge-red">{orPreview.error}</Badge>}
              </div>
              {orPreview.plans?.length > 0 && (
                <div className="table-wrap" style={{ maxHeight: 350, overflow: 'auto' }}>
                  <table>
                    <thead>
                      <tr><th>#</th><th>Type</th><th>Action</th><th>Detail</th></tr>
                    </thead>
                    <tbody>
                      {orPreview.plans.slice(0, 50).map((p, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td><code style={{ fontSize: 11 }}>{p.action}</code></td>
                          <td><Badge className={p.action === 'insert' ? 'badge-green' : p.action === 'update' ? 'badge-yellow' : 'badge-blue'}>{p.action}</Badge></td>
                          <td style={{ fontSize: 12, maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.detail || JSON.stringify(p.data || {}).slice(0, 100)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* OneRoster Result */}
          {orResult && (
            <div style={{ marginTop: 16, padding: 16, borderRadius: 8, background: orResult.errors?.length ? 'var(--amber-light, #fffbeb)' : 'var(--green-light, #f0fdf4)' }}>
              <h4 style={{ margin: '0 0 8px' }}>{t('die.importComplete')}</h4>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {orResult.total !== undefined && <Badge className="badge-blue">{orResult.total} {t('die.totalRows')}</Badge>}
                {orResult.ok !== undefined && <Badge className="badge-green">{orResult.ok} {t('die.applied')}</Badge>}
                {orResult.errors?.length > 0 && <Badge className="badge-red">{orResult.errors.length} {t('die.errors')}</Badge>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
