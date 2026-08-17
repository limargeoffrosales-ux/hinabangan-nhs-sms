import { useEffect, useState } from 'react';
import { Plus, Download, RefreshCw, Trash2, Star } from 'lucide-react';
import { api, getToken, getApiBase } from '../lib/api';
import { PageHead, Badge, Modal, Empty, ErrorBanner, Spinner } from '../components/ui';

const TYPE_LABELS = { numeric: 'Numeric', letter: 'Letter', gpa: 'GPA', ib: 'IB', cambridge: 'Cambridge', custom: 'Custom' };
const TYPE_OPTIONS = ['numeric', 'letter', 'gpa', 'ib', 'cambridge', 'custom'];
const BAND_FIELDS = ['min', 'max', 'letter', 'points', 'label'];
const BAND_PLACEHOLDERS = { min: 'Min', max: 'Max', letter: 'Letter', points: 'Points', label: 'Proficiency' };

function emptyBand() { return { min: '', max: '', letter: '', points: '', label: '' }; }

function downloadBlob(res, name) {
  return res.blob().then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}

export default function GradingScales() {
  const [scales, setScales] = useState([]);
  const [defId, setDefId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // { mode: 'create' } | { mode: 'edit', scale }
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const [convValue, setConvValue] = useState('');
  const [convScale, setConvScale] = useState('');
  const [convResult, setConvResult] = useState(null);
  const [convLoading, setConvLoading] = useState(false);

  const [students, setStudents] = useState([]);
  const [trStudent, setTrStudent] = useState('');
  const [trYear, setTrYear] = useState('2026-2027');
  const [trScale, setTrScale] = useState('');
  const [trFormat, setTrFormat] = useState('pdf');
  const [trLoading, setTrLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [sc, cf] = await Promise.all([api('/grading/scales'), api('/grading/config')]);
      setScales(sc.data);
      setDefId(sc.default_id);
      setConvScale(cf.scale ? String(cf.scale.id) : '');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    api('/students?limit=200').then((r) => setStudents(r.data)).catch(() => {});
  }, []);

  function openCreate() {
    setDraft({
      name: '', code: '', scale_type: 'numeric', description: '', passing_grade: 75,
      weights: { written_work: 25, performance_task: 45, quarterly_exam: 20 },
      credits_pass_only: true, bands: [emptyBand()],
    });
    setModal({ mode: 'create' });
  }

  function openEdit(scale) {
    setDraft({
      name: scale.name, code: scale.code, scale_type: scale.scale_type, description: scale.description || '',
      passing_grade: scale.passing_grade, weights: { ...scale.weights },
      credits_pass_only: scale.credits_pass_only,
      bands: scale.bands.length ? scale.bands.map((b) => ({ ...b })) : [emptyBand()],
    });
    setModal({ mode: 'edit', scale });
  }

  function setBand(i, field, value) {
    setDraft((d) => ({ ...d, bands: d.bands.map((b, j) => (j === i ? { ...b, [field]: value } : b)) }));
  }

  async function saveScale(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...draft,
        weights: {
          written_work: Number(draft.weights.written_work) || 25,
          performance_task: Number(draft.weights.performance_task) || 45,
          quarterly_exam: Number(draft.weights.quarterly_exam) || 30,
        },
        bands: draft.bands.map((b) => ({
          min: Number(b.min), max: Number(b.max),
          letter: String(b.letter || '').trim(),
          points: b.points === '' ? null : Number(b.points),
          label: String(b.label || '').trim(),
        })).filter((b) => !Number.isNaN(b.min) && !Number.isNaN(b.max)),
      };
      if (modal.mode === 'create') await api('/grading/scales', { method: 'POST', body: payload });
      else await api(`/grading/scales/${modal.scale.id}`, { method: 'PUT', body: payload });
      setModal(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function setDefault(id) {
    try {
      await api(`/grading/scales/${id}/set-default`, { method: 'POST' });
      load();
    } catch (err) { setError(err.message); }
  }

  async function removeScale(id) {
    if (!window.confirm('Delete this grading scale?')) return;
    try {
      await api(`/grading/scales/${id}`, { method: 'DELETE' });
      load();
    } catch (err) { setError(err.message); }
  }

  async function runConvert(e) {
    e.preventDefault();
    setConvLoading(true);
    setError(null);
    try {
      const body = { value: Number(convValue) };
      if (convScale) body.scale_id = Number(convScale);
      setConvResult(await api('/grading/convert', { method: 'POST', body }));
    } catch (err) { setError(err.message); } finally { setConvLoading(false); }
  }

  async function genTranscript(e) {
    e.preventDefault();
    if (!trStudent || !trYear) return;
    setTrLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ student_id: trStudent, school_year: trYear, mode: 'international', format: trFormat });
      if (trScale) qs.set('scale_id', trScale);
      const res = await fetch(`${getApiBase()}/exchange/export/transcript?${qs}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Download failed (${res.status})`);
      }
      const student = students.find((s) => String(s.id) === String(trStudent));
      const file = `transcript-${(student ? student.last_name : trStudent).replace(/\s+/g, '_')}-${trYear}.${trFormat}`;
      await downloadBlob(res, file);
    } catch (err) { setError(err.message); } finally { setTrLoading(false); }
  }

  const active = scales.filter((s) => s.active);
  const convScaleObj = scales.find((s) => String(s.id) === String(convScale));

  return (
    <>
      <PageHead
        title="Grading Scales"
        sub="Configure grading scales (DepEd, letter grades, GPA, IB, Cambridge), component weights, and the international transcript format."
      >
        <button className="btn btn-primary" onClick={openCreate}><Plus size={14} /> New scale</button>
      </PageHead>
      <ErrorBanner error={error} />

      {loading ? <Spinner /> : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="form-row" style={{ margin: 0 }}>
              <div style={{ flex: 2 }}>
                <strong>Active scale</strong>
                {(() => {
                  const d = scales.find((s) => s.id === defId);
                  return d ? (
                    <p style={{ margin: '4px 0 0', color: 'var(--text-dim)' }}>
                      <Badge status="active" /> {d.name} · passing {d.passing_grade} · WW {d.weights.written_work}% / PT {d.weights.performance_task}% / QA {d.weights.quarterly_exam}%
                    </p>
                  ) : <p style={{ margin: '4px 0 0', color: 'var(--text-dim)' }}>No default scale set.</p>;
                })()}
              </div>
              <div style={{ flex: 1, textAlign: 'right' }}>
                <button className="btn" onClick={load}><RefreshCw size={14} /> Reload</button>
              </div>
            </div>
          </div>

          <div className="card table-wrap" style={{ marginBottom: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Scale</th><th>Type</th><th style={{ textAlign: 'center' }}>Passing</th>
                  <th style={{ textAlign: 'center' }}>Weights WW/PT/QA</th><th>Bands</th><th></th>
                </tr>
              </thead>
              <tbody>
                {active.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.name}</strong>
                      {s.is_default && <Badge status="active" />} {s.is_system && <span className="badge badge-blue">BUILT-IN</span>}
                      <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>{s.description}</div>
                    </td>
                    <td><span className="badge badge-gray">{TYPE_LABELS[s.scale_type] || s.scale_type}</span></td>
                    <td style={{ textAlign: 'center' }}>{s.passing_grade}</td>
                    <td style={{ textAlign: 'center', fontSize: 12.5 }}>{s.weights.written_work}% / {s.weights.performance_task}% / {s.weights.quarterly_exam}%</td>
                    <td style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>
                      {s.bands.length ? `${s.bands.length} bands` : '—'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {!s.is_default && <button className="btn btn-sm" title="Make default" onClick={() => setDefault(s.id)} aria-label="Make default"><Star size={13} aria-hidden="true" /></button>}{' '}
                      <button className="btn btn-sm" title="Edit" onClick={() => openEdit(s)}>Edit</button>{' '}
                      {!s.is_system && <button className="btn btn-sm btn-danger" title="Delete" onClick={() => removeScale(s.id)} aria-label="Delete scale"><Trash2 size={13} aria-hidden="true" /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!active.length && <Empty text="No grading scales yet." />}
          </div>

          <div className="two-col">
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Grade converter</h3>
              <p className="sub">See what a numeric grade maps to on the selected scale.</p>
              <form onSubmit={runConvert} className="form-row" style={{ alignItems: 'end' }}>
                <div>
                  <label>Numeric grade</label>
                  <input type="number" min="0" max="100" step="0.1" value={convValue} onChange={(e) => setConvValue(e.target.value)} required />
                </div>
                <div>
                  <label>Scale</label>
                  <select value={convScale} onChange={(e) => setConvScale(e.target.value)}>
                    {scales.map((s) => <option key={s.id} value={s.id}>{s.name}{s.is_default ? ' (default)' : ''}</option>)}
                  </select>
                </div>
                <button className="btn btn-primary" disabled={convLoading || convValue === ''}>{convLoading ? '…' : 'Convert'}</button>
              </form>
              {convResult && (
                <div style={{ marginTop: 14, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <div><span className="sub">Grade</span><div style={{ fontSize: 22, fontWeight: 700 }}>{convResult.value}</div></div>
                  <div><span className="sub">Letter</span><div style={{ fontSize: 22, fontWeight: 700 }}>{convResult.result.letter || '—'}</div></div>
                  <div><span className="sub">Points</span><div style={{ fontSize: 22, fontWeight: 700 }}>{convResult.result.points ?? '—'}</div></div>
                  <div><span className="sub">Proficiency</span><div style={{ fontSize: 22, fontWeight: 700 }}>{convResult.result.proficiency || '—'}</div></div>
                  <div><span className="sub">Status</span><div style={{ fontSize: 22, fontWeight: 700 }}>{convResult.result.passed ? 'PASSED' : 'FAILED'}</div></div>
                </div>
              )}
            </div>

            <div className="card">
              <h3 style={{ marginTop: 0 }}>International transcript</h3>
              <p className="sub">Generate an international-format transcript (letter grades, grade points, credits, GPA) as PDF / Excel / CSV.</p>
              <form onSubmit={genTranscript} className="form-row" style={{ alignItems: 'end' }}>
                <div>
                  <label>Student</label>
                  <select value={trStudent} onChange={(e) => setTrStudent(e.target.value)}>
                    <option value="">— select —</option>
                    {students.map((s) => <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} ({s.lrn})</option>)}
                  </select>
                </div>
                <div>
                  <label>School year</label>
                  <input value={trYear} onChange={(e) => setTrYear(e.target.value)} />
                </div>
                <div>
                  <label>Scale</label>
                  <select value={trScale} onChange={(e) => setTrScale(e.target.value)}>
                    <option value="">Default ({convScaleObj ? convScaleObj.name : '…'})</option>
                    {scales.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label>Format</label>
                  <select value={trFormat} onChange={(e) => setTrFormat(e.target.value)}>
                    <option value="pdf">PDF</option>
                    <option value="xlsx">Excel</option>
                    <option value="csv">CSV</option>
                  </select>
                </div>
                <button className="btn btn-primary" disabled={trLoading || !trStudent || !trYear}><Download size={14} /> {trLoading ? 'Generating…' : 'Generate'}</button>
              </form>
            </div>
          </div>
        </>
      )}

      {modal && (
        <Modal
          title={modal.mode === 'create' ? 'New grading scale' : `Edit — ${draft.name}`}
          sub="Bands map the numeric 0–100 grade to a letter, grade points and proficiency label."
          onClose={() => setModal(null)}
          wide
        >
          {draft && (
            <form onSubmit={saveScale}>
              <div className="form-row">
                <div><label>Name *</label><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required /></div>
                <div><label>Code *</label><input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="e.g. my-scale" required /></div>
                <div>
                  <label>Type</label>
                  <select value={draft.scale_type} onChange={(e) => setDraft({ ...draft, scale_type: e.target.value })}>
                    {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div><label>Description</label><input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Optional note" /></div>
                <div><label>Passing grade</label><input type="number" min="0" max="100" step="0.01" value={draft.passing_grade} onChange={(e) => setDraft({ ...draft, passing_grade: Number(e.target.value) })} /></div>
              </div>
              <div className="form-row">
                <div><label>Written Work %</label><input type="number" min="0" max="100" value={draft.weights.written_work} onChange={(e) => setDraft({ ...draft, weights: { ...draft.weights, written_work: e.target.value } })} /></div>
                <div><label>Performance Task %</label><input type="number" min="0" max="100" value={draft.weights.performance_task} onChange={(e) => setDraft({ ...draft, weights: { ...draft.weights, performance_task: e.target.value } })} /></div>
                <div><label>Quarterly Exam %</label><input type="number" min="0" max="100" value={draft.weights.quarterly_exam} onChange={(e) => setDraft({ ...draft, weights: { ...draft.weights, quarterly_exam: e.target.value } })} /></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 22 }}>
                  <input type="checkbox" checked={draft.credits_pass_only} onChange={(e) => setDraft({ ...draft, credits_pass_only: e.target.checked })} id="cpo" />
                  <label htmlFor="cpo" style={{ margin: 0 }}>Credits only when passed</label>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <strong style={{ fontSize: 14 }}>Grade bands</strong>
                <div className="table-wrap" style={{ marginTop: 8 }}>
                  <table>
                    <thead>
                      <tr>{BAND_FIELDS.map((f) => <th key={f} style={{ textAlign: 'center' }}>{f.toUpperCase()}</th>)}<th></th></tr>
                    </thead>
                    <tbody>
                      {draft.bands.map((b, i) => (
                        <tr key={i}>
                          {BAND_FIELDS.map((f) => (
                            <td key={f} style={{ textAlign: 'center' }}>
                              <input type={f === 'min' || f === 'max' || f === 'points' ? 'number' : 'text'} step={f === 'min' || f === 'max' ? '0.1' : '0.01'} style={{ width: 84 }} placeholder={BAND_PLACEHOLDERS[f]} value={b[f] ?? ''} onChange={(e) => setBand(i, f, e.target.value)} />
                            </td>
                          ))}
                          <td style={{ textAlign: 'center' }}>
                            <button type="button" className="btn btn-sm btn-danger" onClick={() => setDraft({ ...draft, bands: draft.bands.filter((_, j) => j !== i) })}>×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ marginTop: 8 }}>
                    <button type="button" className="btn btn-sm" onClick={() => setDraft({ ...draft, bands: [...draft.bands, emptyBand()] })}><Plus size={13} /> Add band</button>
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save scale'}</button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
