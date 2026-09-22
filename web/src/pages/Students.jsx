import { useEffect, useState, useRef, useCallback } from 'react';
import { Plus, Pencil, Trash2, Link2, Upload, Camera, AlertTriangle, UserPlus, CheckCircle2, XCircle, Download, FileSpreadsheet } from 'lucide-react';
import readXlsxFile from 'read-excel-file';
import { useTranslation } from 'react-i18next';
import { api, fileUrl } from '../lib/api';
import { downloadFromApi } from '../lib/export';
import { useAuth, can } from '../lib/auth';
import { SUFFIXES, SHS_TRACKS, STUDENT_STATUSES } from '../lib/constants';
import { PageHead, Badge, Modal, Empty, ErrorBanner, Spinner, ConfirmModal, SearchInput, SkeletonTable } from '../components/ui';

const EMPTY_FORM = {
  lrn: '', first_name: '', middle_name: '', last_name: '', suffix: '', sex: 'Male',
  birth_date: '', birth_place: '', religion: '', address: '', contact: '',
  guardian_name: '', guardian_contact: '', guardian_relation: 'Parent',
  father_name: '', mother_name: '', mother_tongue: '', learner_status: '', learner_type: '', remarks: '',
  grade_level: 'Grade 11', track_strand: '', status: 'enrolled',
};

const GRADE_LEVELS = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', 'College'];

export default function Students() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = can(user?.role, 'super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar');
  const canManageAccounts = can(user?.role, 'super_admin', 'school_admin');
  const canApproveRegistrations = can(user?.role, 'super_admin');
  const canViewPhoto = can(user?.role, 'super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar', 'teacher');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accountsRow, setAccountsRow] = useState(null);
  const [accountsData, setAccountsData] = useState(null);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [linkQuery, setLinkQuery] = useState('');
  const [linkResults, setLinkResults] = useState([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const importFileRef = useRef(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState(null);
  const photoInputRef = useRef(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [reqOpen, setReqOpen] = useState(false);
  const [requests, setRequests] = useState([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqBusy, setReqBusy] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectNote, setRejectNote] = useState('');

  async function loadRequests() {
    setReqLoading(true);
    try {
      const res = await api('/students/link-requests');
      setRequests(res.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setReqLoading(false);
    }
  }

  async function openRequests() {
    setReqOpen(true);
    setRejectTarget(null);
    setRejectNote('');
    await loadRequests();
  }

  async function approveRequest(id) {
    setReqBusy(true);
    try {
      await api(`/students/link-requests/${id}/approve`, { method: 'POST', body: {} });
      await loadRequests();
    } catch (e) {
      setError(e.message);
    } finally {
      setReqBusy(false);
    }
  }

  async function rejectRequest(id) {
    setReqBusy(true);
    try {
      await api(`/students/link-requests/${id}/reject`, { method: 'POST', body: { note: rejectNote } });
      setRejectTarget(null);
      setRejectNote('');
      await loadRequests();
    } catch (e) {
      setError(e.message);
    } finally {
      setReqBusy(false);
    }
  }

  const pendingRequests = requests.filter((r) => r.status === 'pending');

  useEffect(() => {
    if (canApproveRegistrations) loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAccounts(id) {
    setAccountsLoading(true);
    try {
      const res = await api(`/students/${id}/accounts`);
      setAccountsData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setAccountsLoading(false);
    }
  }

  async function openAccounts(s) {
    setAccountsRow(s);
    setAccountsData(null);
    setLinkQuery('');
    setLinkResults([]);
    await loadAccounts(s.id);
  }

  async function searchAccounts() {
    const q = linkQuery.trim();
    if (!q) return;
    try {
      const res = await api(`/users?q=${encodeURIComponent(q)}&limit=8`);
      setLinkResults(res.data);
    } catch (e) {
      setError(e.message);
    }
  }

  async function linkStudentAccount(userId) {
    try {
      await api(`/students/${accountsRow.id}/account`, { method: 'PUT', body: { user_id: userId } });
      setLinkQuery('');
      setLinkResults([]);
      await loadAccounts(accountsRow.id);
    } catch (e) {
      setError(e.message);
    }
  }

  async function unlinkStudentAccount() {
    setConfirmAction({ message: t('students.unlinkConfirm'), action: async () => {
      try {
        await api(`/students/${accountsRow.id}/account`, { method: 'PUT', body: { user_id: null } });
        await loadAccounts(accountsRow.id);
      } catch (e) {
        setError(e.message);
      }
    } });
  }

  async function linkParent(userId) {
    try {
      await api(`/students/${accountsRow.id}/parents`, { method: 'POST', body: { user_id: userId, relation: 'Parent' } });
      setLinkQuery('');
      setLinkResults([]);
      await loadAccounts(accountsRow.id);
    } catch (e) {
      setError(e.message);
    }
  }

  async function unlinkParent(userId) {
    setConfirmAction({ message: t('students.removeParentConfirm'), action: async () => {
      try {
        await api(`/students/${accountsRow.id}/parents/${userId}`, { method: 'DELETE' });
        await loadAccounts(accountsRow.id);
      } catch (e) {
        setError(e.message);
      }
    } });
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api(query ? `/students?q=${encodeURIComponent(query)}&sort=recent_enrolled&limit=100` : '/students?sort=recent_enrolled&limit=100');
      setRows(res.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [query, load]);

  const exportStudents = async () => {
    try {
      const params = new URLSearchParams({ format: 'xlsx' });
      if (query.trim()) params.set('q', query.trim());
      await downloadFromApi(`/students/export?${params.toString()}`, 'students.xlsx');
    } catch (e) {
      setError(e.message);
    }
  };

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setShowModal(true);
  }

  const IMPORT_HEADERS = [
    { key: 'lrn', label: 'LRN' },
    { key: 'first_name', label: 'First Name' },
    { key: 'middle_name', label: 'Middle Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'suffix', label: 'Suffix' },
    { key: 'sex', label: 'Sex' },
    { key: 'birth_date', label: 'Birth Date' },
    { key: 'grade_level', label: 'Grade Level' },
    { key: 'section', label: 'Section' },
    { key: 'school_year', label: 'School Year' },
    { key: 'track_strand', label: 'Track/Strand' },
    { key: 'guardian_name', label: 'Guardian Name' },
    { key: 'guardian_contact', label: 'Guardian Contact' },
    { key: 'address', label: 'Address' },
  ];

  function csvCell(v) {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function downloadTemplate() {
    const header = IMPORT_HEADERS.map((h) => h.label);
    const sample = ['234567890123', 'Juan', 'Cruz', 'Dela Rosa', '', 'Male', '2008-05-15', 'Grade 11', 'ACAD 11-A', '2026-2027', 'STEM', 'Maria Dela Rosa', '09171234567', 'Rawis, Hinabangan'];
    const csv = [header, sample].map((r) => r.map(csvCell).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { cur += '"'; i++; }
          else inQuotes = false;
        } else cur += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); cur = '';
        rows.push(row); row = [];
      } else cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter((r) => r.some((v) => String(v).trim() !== ''));
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    setImportResult(null);
    try {
      const normalize = (v) => (v === undefined || v === null ? '' : String(v)).trim();
      let raw;
      if (/\.csv$/i.test(file.name)) raw = parseCsv(await file.text());
      else raw = await readXlsxFile(file);
      if (!Array.isArray(raw) || !raw.length) throw new Error('empty');
      // Drop a header row when present (tolerate partial matches).
      const first = raw[0] || [];
      const matchedLabels = IMPORT_HEADERS.reduce((n, h, i) => n + (normalize(first[i]) === normalize(h.label) ? 1 : 0), 0);
      const hasHeader = matchedLabels >= IMPORT_HEADERS.length - 2;
      const data = hasHeader ? raw.slice(1) : raw;
      const mapped = data.map((row) => {
        const r = {};
        IMPORT_HEADERS.forEach((h, i) => { r[h.key] = normalize(row ? row[i] : ''); });
        return r;
      }).filter((r) => r.last_name || r.first_name || r.lrn);
      setImportRows(mapped);
    } catch {
      setError('Could not read the file. Make sure it is a valid .xlsx, .xls or .csv file.');
    }
    e.target.value = '';
  }

  async function importEnrollments() {
    if (!importRows.length) return;
    setImportBusy(true);
    setImportResult(null);
    try {
      const r = await api('/enrollments/import', { method: 'POST', body: { rows: importRows } });
      setImportResult(r);
      if (r.imported) load();
    } catch (e) {
      setError(e.message);
    } finally {
      setImportBusy(false);
    }
  }

  function openEdit(s) {
    setForm({ ...EMPTY_FORM, ...s, birth_date: (s.birth_date || '').slice(0, 10) });
    setEditing(s.id);
    setPhotoUrl(fileUrl(s.photo_url) || null);
    setPhotoError(null);
    setShowModal(true);
  }

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e) {
    e.preventDefault();
    if (!form.last_name?.trim()) { setError(t('students.lastNameRequired', 'Last name is required')); return; }
    if (!form.first_name?.trim()) { setError(t('students.firstNameRequired', 'First name is required')); return; }
    const lrn = (form.lrn || '').trim();
    if (lrn && !/^\d{12}$/.test(lrn)) { setError(t('students.lrnInvalid', 'LRN must be exactly 12 digits')); return; }
    const body = { ...form, lrn: lrn || null };
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await api(`/students/${editing}`, { method: 'PATCH', body });
      } else {
        await api('/students', { method: 'POST', body });
      }
      setShowModal(false);
      load();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(s) {
    setConfirmAction({ message: t('students.deleteConfirm') + ` ${s.first_name} ${s.last_name}?`, action: async () => {
      try {
        await api(`/students/${s.id}`, { method: 'DELETE' });
      } catch (e) {
        setError(e.message);
      } finally {
        load();
      }
    } });
  }

  const field = (k, opts = {}) => {
    const p = { value: form[k] || '', onChange: (e) => set(k, e.target.value), disabled: !canWrite, ...opts };
    if (opts.options) {
      return (
        <select {...p}>
          <option value="">{t('common.select')}</option>
          {opts.options.map((o) => {
            const val = typeof o === 'object' ? o.value : o;
            const lbl = typeof o === 'object' ? o.label : o;
            return <option key={val} value={val}>{lbl}</option>;
          })}
        </select>
      );
    }
    return <input {...p} />;
  };

  return (
    <>
      <PageHead title={t('students.title')} sub={t('students.subtitle')}>
        {canApproveRegistrations && (
          <button className="btn" onClick={openRequests} title={t('students.linkRequestsTitle', 'Approve or reject self-service portal registrations')}>
            <UserPlus size={15} /> {t('students.linkRequests')}
            {pendingRequests.length > 0 && (
              <span className="count-pill">{pendingRequests.length}</span>
            )}
          </button>
        )}
        {canWrite && <button className="btn btn-primary" onClick={openCreate}><Plus size={15} /> {t('students.newStudent')}</button>}
        {can(user?.role, 'teacher', 'guidance', 'super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar') && (
          <button className="btn" onClick={exportStudents} title={t('students.export')}><Download size={15} /> {t('students.export')}</button>
        )}
      </PageHead>
      <ErrorBanner error={error} />
      <div className="search-row">
        <SearchInput value={query} onChange={setQuery} placeholder={t('students.search')} />
      </div>
      {canWrite && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setImportOpen(!importOpen)}>
            <FileSpreadsheet size={14} style={{ color: 'var(--accent)' }} />
            <strong style={{ fontSize: 13 }}>Bulk Student Import</strong>
            <span className="sub" style={{ fontSize: 11 }}>Upload Excel to add new students and enroll them</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-dim)' }}>{importOpen ? '▲ Collapse' : '▼ Expand'}</span>
          </div>
          {importOpen && (
            <div style={{ marginTop: 10 }}>
              <div className="sub" style={{ marginBottom: 8 }}>
                Upload an <strong>.xlsx</strong>, <strong>.xls</strong> or <strong>.csv</strong> file with columns: LRN, First Name, Middle Name, Last Name, Suffix, Sex, Birth Date, Grade Level, Section, School Year, Track/Strand, Guardian Name, Guardian Contact, Address.
                Missing sections are created automatically. Existing students (by LRN) are updated; new ones are created.
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button className="btn" type="button" onClick={downloadTemplate}>
                  <Download size={13} /> Download template
                </button>
                <button className="btn" type="button" onClick={() => importFileRef.current?.click()}>
                  <Upload size={13} /> Choose Excel file
                </button>
                <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFileUpload} />
                {importFileName && <span className="sub" style={{ alignSelf: 'center' }}>{importFileName} — {importRows.length} row(s)</span>}
              </div>
              {importRows.length > 0 && (
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8 }}>
                  <table style={{ fontSize: 11.5 }}>
                    <thead>
                      <tr>
                        <th>#</th>
                        {IMPORT_HEADERS.slice(0, 8).map((h) => <th key={h.key}>{h.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.slice(0, 15).map((r, i) => (
                        <tr key={i}>
                          <td className="sub">{i + 1}</td>
                          <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.lrn || '—'}</td>
                          <td>{r.first_name}</td>
                          <td className="sub">{r.middle_name || ''}</td>
                          <td>{r.last_name}</td>
                          <td className="sub">{r.suffix || ''}</td>
                          <td>{r.sex}</td>
                          <td className="sub">{r.birth_date || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importRows.length > 15 && <div className="sub" style={{ padding: '4px 8px', fontSize: 11 }}>… and {importRows.length - 15} more rows</div>}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn btn-primary" onClick={importEnrollments} disabled={importBusy || !importRows.length}>
                  <Upload size={13} /> {importBusy ? 'Importing...' : `Import ${importRows.length} student(s)`}
                </button>
                {importRows.length > 0 && (
                  <button className="btn btn-sm" onClick={() => { setImportRows([]); setImportFileName(''); setImportResult(null); }}>
                    Clear
                  </button>
                )}
                {importResult && (
                  <span className="sub">
                    Created/updated: <strong>{importResult.imported}</strong> | Enrolled: <strong>{importResult.enrolled}</strong> | Skipped: <strong>{importResult.skipped}</strong>
                    {importResult.errors?.length > 0 && <> | Errors: <strong>{importResult.errors.length}</strong></>}
                  </span>
                )}
              </div>
              {importResult?.errors?.length > 0 && (
                <div className="err-banner" style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={14} />
                    <strong style={{ fontSize: 13 }}>{importResult.errors.length} row(s) had issues</strong>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, maxHeight: 140, overflowY: 'auto', fontVariantNumeric: 'tabular-nums' }}>
                    {importResult.errors.map((e, i) => <div key={i}>{e}</div>)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {loading ? <SkeletonTable rows={8} cols={5} /> : rows.length === 0 ? <Empty text={t('students.noData')} /> : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('students.lrn')}</th><th>{t('students.name')}</th><th>{t('students.sex')}</th><th>{t('students.gradeLevel')}</th><th>{t('students.strandTrack')}</th>
                <th>{t('students.guardian')}</th><th>{t('students.status')}</th>{canWrite && <th className="actions" style={{ textAlign: 'right' }}>{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{s.lrn}</td>
                  <td><strong>{s.last_name}, {s.first_name} {s.middle_name || ''}</strong> {s.suffix}</td>
                  <td>{s.sex}</td>
                  <td>{s.grade_level}</td>
                  <td>{s.track_strand || '—'}</td>
                  <td>{s.guardian_name || '—'}</td>
                  <td><Badge status={s.status} /></td>
                  {canWrite && (
                    <td className="row-actions" style={{ textAlign: 'right' }}>
                      <button className="btn btn-sm" title={t('students.portalAccounts')} onClick={() => openAccounts(s)}><Link2 size={13} /></button>{' '}
                       {canViewPhoto && <button className="btn btn-sm" onClick={() => openEdit(s)} aria-label="Edit student"><Pencil size={13} aria-hidden="true" /></button>}{' '}
                       <button className="btn btn-sm btn-danger" onClick={() => remove(s)} aria-label="Delete student"><Trash2 size={13} aria-hidden="true" /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal
          title={editing ? t('students.editStudent') : t('students.newStudent')}
          sub={editing ? t('students.updatingRecord', { lrn: form.lrn }) : t('students.lrnAuto')}
          onClose={() => setShowModal(false)}
          wide
        >
          <form onSubmit={save}>
            {editing && (
              <div style={{ display: 'flex', gap: 20, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="form-row">
                    <div style={{ flex: 2 }}><label>{t('students.lrn')}</label>{field('lrn', { maxLength: 12, placeholder: '12-digit LRN', inputMode: 'numeric', onChange: (e) => set('lrn', e.target.value.replace(/\D/g, '').slice(0, 12)) })}</div>
                  </div>
                  <div className="form-row">
                    <div><label>{t('students.firstName')} *</label>{field('first_name', { required: true })}</div>
                    <div><label>{t('students.middleName')}</label>{field('middle_name')}</div>
                    <div><label>{t('students.lastName')} *</label>{field('last_name', { required: true })}</div>
                    <div><label>{t('students.suffix')}</label>{field('suffix', { options: SUFFIXES })}</div>
                  </div>
                  <div className="form-row">
                    <div><label>{t('students.sex')} *</label>{field('sex', { options: ['Male', 'Female'] })}</div>
                    <div><label>{t('students.gradeLevel')} *</label>{field('grade_level', { options: GRADE_LEVELS })}</div>
                    <div><label>{t('students.strandTrack')} (SHS)</label>{field('track_strand', { options: SHS_TRACKS })}</div>
                    <div><label>{t('students.status')}</label>{field('status', { options: STUDENT_STATUSES })}</div>
                  </div>
                </div>
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 150, height: 180, borderRadius: 10, overflow: 'hidden', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-soft)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                    {photoUrl ? (
                      <img src={photoUrl} alt="Student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Camera size={40} style={{ color: 'var(--text-dim)' }} />
                    )}
                  </div>
                  <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setPhotoUploading(true);
                    setPhotoError(null);
                    try {
                      const fd = new FormData();
                      fd.append('photo', file);
                      const res = await api(`/uploads/student-photo/${editing}`, { method: 'POST', body: fd });
                      setPhotoUrl(res.url);
                    } catch (err) {
                      setPhotoError(err.message);
                    } finally {
                      setPhotoUploading(false);
                      if (photoInputRef.current) photoInputRef.current.value = '';
                    }
                  }} />
                  <button type="button" className="btn btn-sm" onClick={() => photoInputRef.current?.click()} disabled={photoUploading}>
                    {photoUploading ? 'Uploading...' : photoUrl ? 'Change Photo' : 'Upload Photo'}
                  </button>
                  {photoError && <div style={{ fontSize: 11, color: 'var(--danger)', textAlign: 'center' }}>{photoError}</div>}
                </div>
              </div>
            )}
            {!editing && (
              <>
                <div className="form-row">
                  <div style={{ flex: 2 }}><label>{t('students.lrn')}</label>{field('lrn', { maxLength: 12, placeholder: '12-digit LRN', inputMode: 'numeric', onChange: (e) => set('lrn', e.target.value.replace(/\D/g, '').slice(0, 12)) })}</div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}><span className="sub" style={{ marginBottom: 10 }}>{t('students.lrnAuto')}</span></div>
                </div>
                <div className="form-row">
                  <div><label>{t('students.firstName')} *</label>{field('first_name', { required: true })}</div>
                  <div><label>{t('students.middleName')}</label>{field('middle_name')}</div>
                  <div><label>{t('students.lastName')} *</label>{field('last_name', { required: true })}</div>
                  <div><label>{t('students.suffix')}</label>{field('suffix', { options: SUFFIXES })}</div>
                </div>
                <div className="form-row">
                  <div><label>{t('students.sex')} *</label>{field('sex', { options: ['Male', 'Female'] })}</div>
                  <div><label>{t('students.gradeLevel')} *</label>{field('grade_level', { options: GRADE_LEVELS })}</div>
                  <div><label>{t('students.strandTrack')} (SHS)</label>{field('track_strand', { options: SHS_TRACKS })}</div>
                  <div><label>{t('students.status')}</label>{field('status', { options: STUDENT_STATUSES })}</div>
                </div>
              </>
            )}
            <div className="form-row">
              <div><label>{t('students.birthDate')}</label>{field('birth_date', { type: 'date' })}</div>
              <div><label>{t('students.birthPlace')}</label>{field('birth_place')}</div>
              <div><label>{t('students.religion')}</label>{field('religion')}</div>
              <div><label>{t('students.contactNo')}</label>{field('contact')}</div>
            </div>
            <div className="form-row">
              <div><label>{t('students.address')}</label>{field('address')}</div>
              <div><label>{t('students.guardianName')}</label>{field('guardian_name')}</div>
              <div><label>{t('students.guardianContact')}</label>{field('guardian_contact')}</div>
              <div><label>{t('students.relationship')}</label>{field('guardian_relation')}</div>
            </div>
            <div className="form-row">
              <div><label>{t('students.fatherName')}</label>{field('father_name')}</div>
              <div><label>{t('students.motherName')}</label>{field('mother_name')}</div>
              <div><label>{t('students.motherTongue')}</label>{field('mother_tongue')}</div>
              <div><label>{t('students.learnerStatus')}</label>{field('learner_status', { options: ['New', 'Old', 'Transferee', 'Balik-Aral (Continuing)'] })}</div>
            </div>
            <div className="form-row">
              <div><label>{t('students.learnerType')}</label>{field('learner_type', { options: ['Regular', 'Irregular', 'SPED', 'ALS'] })}</div>
              <div style={{ flex: 3 }}><label>{t('students.remarks')}</label><textarea style={{ width: '100%' }} value={form.remarks || ''} onChange={(e) => set('remarks', e.target.value)} disabled={!canWrite} /></div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
              {canWrite && <button className="btn btn-primary" disabled={saving}>{saving ? t('common.saving') : t('students.saveStudent')}</button>}
            </div>
          </form>
        </Modal>
      )}

      {accountsRow && (
        <Modal
          title={`${t('students.portalAccounts')} — ${accountsRow.last_name}, ${accountsRow.first_name}`}
          sub={t('students.linkStudentLogin')}
          onClose={() => setAccountsRow(null)}
          wide
        >
          {accountsLoading ? <Spinner /> : accountsData && (
            <>
              <h4 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-dim)' }}>{t('students.studentLogin')}</h4>
              {accountsData.student_account ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div><strong>{accountsData.student_account.username}</strong> <span className="sub">— {accountsData.student_account.name || ''} · {accountsData.student_account.status}</span></div>
                  {canManageAccounts && <button className="btn btn-sm btn-danger" onClick={unlinkStudentAccount}>{t('students.unlink')}</button>}
                </div>
              ) : (
                <div className="sub" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>{t('students.noStudentLogin')}</div>
              )}

              {canManageAccounts && (
                <div className="form-row" style={{ marginTop: 12 }}>
                  <div style={{ flex: 2 }}><label>{t('students.linkByUsername')}</label><input placeholder={t('students.searchPortal')} value={linkQuery} onChange={(e) => setLinkQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchAccounts()} /></div>
                  <div><button className="btn" onClick={searchAccounts}>{t('common.search')}</button></div>
                </div>
              )}
              {canManageAccounts && linkResults.map((u) => (
                <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ minWidth: 0 }}><strong>{u.username}</strong> <span className="sub">— {u.name || ''} · {u.role} · {u.status}</span></div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="btn btn-sm" disabled={u.role !== 'student'} onClick={() => linkStudentAccount(u.id)}>{t('students.setAsStudent')}</button>
                    <button className="btn btn-sm" disabled={u.role !== 'parent'} onClick={() => linkParent(u.id)}>{t('students.linkAsParent')}</button>
                  </div>
                </div>
              ))}

              <h4 style={{ margin: '16px 0 4px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-dim)' }}>{t('students.linkedParents')}</h4>
              {(accountsData.parents || []).length === 0 && <div className="sub" style={{ padding: '8px 0' }}>{t('students.noParents')}</div>}
              {(accountsData.parents || []).map((p) => (
                <div key={p.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <div><strong>{p.name || p.username}</strong> <span className="sub">— {p.username} · {p.relation} · {p.status}</span></div>
                  {canManageAccounts && <button className="btn btn-sm btn-danger" onClick={() => unlinkParent(p.user_id)}>{t('students.unlink')}</button>}
                </div>
              ))}
            </>
          )}
        </Modal>
      )}
      {confirmAction && <ConfirmModal message={confirmAction.message} danger onConfirm={() => { confirmAction.action(); setConfirmAction(null); }} onCancel={() => setConfirmAction(null)} />}

      {reqOpen && (
        <Modal
          title={t('students.linkRequestsTitle', 'Portal Registration Requests')}
          sub={t('students.linkRequestsSub', 'Students created these accounts on the public sign-up page. Approving links the account to the learner record and activates their portal access.')}
          onClose={() => setReqOpen(false)}
          wide
        >
          {reqLoading ? <Spinner /> : pendingRequests.length === 0 ? (
            <Empty text={t('students.linkRequestsEmpty', 'No pending registration requests.')} />
          ) : (
            pendingRequests.map((r) => (
              <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div><strong>{r.last_name}, {r.first_name} {r.middle_name || ''}</strong> <span className="sub" style={{ fontFamily: 'monospace' }}> — {r.lrn}</span></div>
                    <div className="sub" style={{ marginTop: 2 }}>
                      {[r.grade_level, r.track_strand].filter(Boolean).join(' · ')}{r.grade_level ? ' · ' : ''}
                      submitted {String(r.created_at).replace('T', ' ').slice(0, 16)} · username <strong>{r.username}</strong>
                    </div>
                    <div className="sub" style={{ marginTop: 2 }}>
                      {[r.email, r.phone].filter(Boolean).join(' · ') || 'No contact info'}
                      {' · verified: '}{(() => { try { const v = JSON.parse(r.verified || '[]'); return v.map((f) => f.replace(/_/g, ' ')).join(', ') || '—'; } catch { return '—'; } })()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="btn btn-sm" disabled={reqBusy} onClick={() => approveRequest(r.id)}>
                      <CheckCircle2 size={13} /> {t('students.approve')}
                    </button>
                    <button className="btn btn-sm" disabled={reqBusy} onClick={() => { setRejectTarget(r.id); setRejectNote(''); }}>
                      <XCircle size={13} /> {t('students.reject')}
                    </button>
                  </div>
                </div>
                {rejectTarget === r.id && (
                  <div className="form-row" style={{ marginTop: 10 }}>
                    <div style={{ flex: 3 }}>
                      <input placeholder={t('students.rejectNote', 'Optional note to the student (reason for rejection)')} value={rejectNote} onChange={(e) => setRejectNote(e.target.value.slice(0, 500))} />
                    </div>
                    <button className="btn btn-danger" disabled={reqBusy} onClick={() => rejectRequest(r.id)}>{t('students.confirmReject')}</button>
                  </div>
                )}
              </div>
            ))
          )}
        </Modal>
      )}
    </>
  );
}
