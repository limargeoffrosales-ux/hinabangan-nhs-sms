import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Download, Printer, FileText, Wand2, Scissors, Maximize2, Upload, Trash2, Layers, Clock, FolderOpen } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { PageHead, Spinner, ErrorBanner } from '../components/ui';
import { downloadDoc, downloadTxt, printHtml } from '../lib/export';

const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];

const QUICK_FIELDS = {
  subject: 'General Mathematics',
  grade_level: 'Grade 11',
  section: 'TECHPRO 11-A',
  quarter: 'First',
  topic: '',
  period: '',
  prepared_by: '',
  noted_by: '',
  date: new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }),
};

function detectFields(body) {
  const set = new Set();
  for (const m of String(body || '').matchAll(/\{([a-z_][a-z0-9_]*)\}/gi)) set.add(m[1].toLowerCase());
  return [...set];
}

export default function AiDocs() {
  const { user } = useAuth();
  const canWrite = can(user?.role, ...WRITE);
  const [catalog, setCatalog] = useState(null);
  const [formats, setFormats] = useState([]);
  const [docs, setDocs] = useState([]);
  const [purge, setPurge] = useState(null);
  const [tab, setTab] = useState('templates');
  const [group, setGroup] = useState(null);
  const [selected, setSelected] = useState(null);
  const [fields, setFields] = useState({});
  const [prompt, setPrompt] = useState('');
  const [doc, setDoc] = useState(null);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [upName, setUpName] = useState('');
  const [upBody, setUpBody] = useState('');

  useEffect(() => {
    api('/ai/templates').then((r) => setCatalog(r)).catch((e) => setError(e.message));
    loadFormats();
    loadDocs();
    api('/ai/cleanup').then(setPurge).catch(() => {});
  }, []);

  useEffect(() => {
    if (catalog && !group) setGroup(Object.keys(catalog.groups)[0]);
  }, [catalog, group]);

  async function loadFormats() {
    try {
      const r = await api('/ai/formats');
      setFormats(r.data || []);
    } catch (e) {
      setError(e.message);
    }
  }

  async function loadDocs() {
    try {
      const r = await api('/ai/documents');
      setDocs(r.data || []);
    } catch (e) {
      setError(e.message);
    }
  }

  function pick(id) {
    const t = Object.values(catalog?.groups || {}).flat().find((x) => x.id === id);
    setSelected(t);
    setDoc(null);
    setNote('');
    setFields({ ...QUICK_FIELDS, prepared_by: user?.name || '', noted_by: user?.name || '' });
  }

  function pickFormat(f) {
    setSelected({ id: `format_${f.id}`, name: f.name, fields: (JSON.parse(f.fields || '[]')) || detectFields(f.body) });
    setDoc(null);
    setNote('');
    const flds = { ...QUICK_FIELDS, prepared_by: user?.name || '', noted_by: user?.name || '' };
    for (const k of detectFields(f.body)) if (flds[k] === undefined) flds[k] = '';
    setFields(flds);
  }

  async function generate() {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const isFormat = String(selected.id).startsWith('format_');
      const body = {
        ...(isFormat
          ? { format_id: selected.id.replace('format_', '') }
          : { template_id: selected.id }),
        context: fields,
        prompt: prompt.trim() || undefined,
      };
      const r = await api('/ai/generate', { method: 'POST', body });
      setDoc(r);
      setEditing(r.body);
      setNote(r.prompt ? 'Auto-written from your description — review and edit freely.' : '');
      if (r.values && Object.keys(r.values).length) {
        setFields((f) => ({ ...f, ...r.values }));
      }
      setPrompt('');
      await loadDocs();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function openDoc(d) {
    setBusy(true);
    setError('');
    try {
      const r = await api(`/ai/documents/${d.id}`);
      setDoc({ id: r.id, name: r.name, kind: r.kind, body: r.body });
      setEditing(r.body);
      setNote('Opened from saved documents.');
      setSelected(null);
      setTab('saved');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteDoc(id) {
    if (!confirm('Delete this generated document? (Saved documents are auto-deleted every Saturday anyway.)')) return;
    await api(`/ai/documents/${id}`, { method: 'DELETE' });
    if (doc?.id === id) setDoc(null);
    await loadDocs();
  }

  async function improve(mode) {
    if (!editing) return;
    setBusy(true);
    try {
      const r = await api('/ai/improve', { method: 'POST', body: { text: editing, mode } });
      setEditing(r.body);
      setNote(r.note);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function summarizeIt() {
    if (!editing) return;
    setBusy(true);
    try {
      const r = await api('/ai/summarize', { method: 'POST', body: { text: editing, sentences: 3 } });
      setEditing((prev) => prev + '\n\n--- AI SUMMARY ---\n' + r.summary);
      setNote(r.note);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveFormat() {
    if (!upName.trim() || !upBody.trim()) return setError('Provide a name and the format body.');
    setBusy(true);
    setError('');
    try {
      await api('/ai/formats', { method: 'POST', body: { name: upName.trim(), body: upBody, fields: detectFields(upBody) } });
      setUpName('');
      setUpBody('');
      await loadFormats();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteFormat(id) {
    if (!confirm('Delete this custom format?')) return;
    await api(`/ai/formats/${id}`, { method: 'DELETE' });
    if (selected?.id === `format_${id}`) setSelected(null);
    await loadFormats();
  }

  function onUploadFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.(txt|md|text)$/i.test(file.name)) return setError('Please upload a .txt or .md file.');
    setUpName(file.name.replace(/\.(txt|md|text)$/i, '').replace(/[-_]+/g, ' '));
    const reader = new FileReader();
    reader.onload = () => setUpBody(String(reader.result || ''));
    reader.onerror = () => setError('Could not read the file.');
    reader.readAsText(file);
  }

  function setF(k, v) {
    setFields((f) => ({ ...f, [k]: v }));
  }

  const fInput = (k) => (
    <input value={fields[k] || ''} onChange={(e) => setF(k, e.target.value)} placeholder={k.replace(/_/g, ' ')} />
  );

  const contextFields = useMemo(() => {
    if (!selected) return [];
    if (String(selected.id).startsWith('format_')) {
      return ['subject', 'grade_level', 'section', 'quarter', ...(selected.fields || []).filter((f) => !['subject', 'grade_level', 'section', 'quarter', 'prepared_by', 'noted_by'].includes(f))];
    }
    return ['subject', 'grade_level', 'section', 'quarter', ...(selected.fields || []).filter((f) => !['subject', 'grade_level', 'section', 'quarter'].includes(f))];
  }, [selected]);

  return (
    <div>
      <PageHead title="AI Document Generator" sub="Describe what you need — the AI writes a complete, professional document that follows the uploaded format. Editable and export-ready.">
        <span className="badge badge-blue">✨ {catalog ? catalog.count : ''} templates · {formats.length} custom formats</span>
      </PageHead>
      <ErrorBanner error={error} />
      {!catalog ? (
        <div className="center-pad"><Spinner /></div>
      ) : (
        <div className="two-col" style={{ alignItems: 'start' }}>
          <div>
            <div className="card">
              <div className="seg" style={{ flexWrap: 'wrap' }}>
                <button className={tab === 'templates' ? 'seg-btn active' : 'seg-btn'} onClick={() => setTab('templates')}>
                  <Layers size={13} /> Templates
                </button>
                <button className={tab === 'formats' ? 'seg-btn active' : 'seg-btn'} onClick={() => setTab('formats')}>
                  <Upload size={13} /> Custom Format
                </button>
                <button className={tab === 'saved' ? 'seg-btn active' : 'seg-btn'} onClick={() => setTab('saved')}>
                  <Clock size={13} /> Saved <span className="sub">({docs.length})</span>
                </button>
              </div>

              {tab === 'templates' && (
                <>
                  <div className="seg" style={{ flexWrap: 'wrap', marginTop: 10 }}>
                    {Object.keys(catalog.groups).map((g) => (
                      <button key={g} className={group === g ? 'seg-btn active' : 'seg-btn'} onClick={() => setGroup(g)}>{g}</button>
                    ))}
                  </div>
                  <div className="template-grid">
                    {(catalog.groups[group] || []).map((t) => (
                      <button
                        key={t.id}
                        className={`template-card ${selected?.id === t.id ? 'active' : ''}`}
                        onClick={() => pick(t.id)}
                        title={t.name}
                      >
                        <FileText size={16} />
                        <div className="tpl-name">{t.name}</div>
                        <div className="tpl-fields">{t.fields.join(', ')}</div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {tab === 'formats' && (
                <>
                  <div className="form-row" style={{ marginTop: 10 }}>
                    <label>Format name
                      <input value={upName} onChange={(e) => setUpName(e.target.value)} placeholder="e.g. School Form 1 — School Register" />
                    </label>
                    <label>Upload layout (.txt / .md)
                      <input type="file" accept=".txt,.md,.text" onChange={onUploadFile} />
                    </label>
                  </div>
                  <div className="hint" style={{ marginBottom: 8 }}>
                    Use <code>{'{'}</code>placeholders<code>{'}'}</code> in the layout, e.g. <code>{'{student_name}'}</code>, <code>{'{date}'}</code> — they become fill-in fields.
                  </div>
                  <textarea
                    className="doc-editor"
                    value={upBody}
                    onChange={(e) => setUpBody(e.target.value)}
                    rows={10}
                    placeholder={'PASTE OR UPLOAD YOUR OFFICIAL FORMAT HERE\n\nExample:\nRepublic of the Philippines\n{region} Schools Division\nHinabangan National High School\n\nSCHOOL FORM 1\nLearner: {student_name}    LRN: {lrn}\nGrade & Section: {grade_level}-{section}    School Year: {school_year}'}
                  />
                  {detectFields(upBody).length > 0 && (
                    <div className="hint">Detected fields: {detectFields(upBody).join(', ')}</div>
                  )}
                  <button className="btn btn-primary" onClick={saveFormat} disabled={busy || !canWrite} style={{ marginTop: 10 }}>
                    <Upload size={15} /> {busy ? 'Saving…' : 'Save format'}
                  </button>
                  {!canWrite && <span className="hint" style={{ marginLeft: 8 }}>Only admins can save formats.</span>}

                  <h4 style={{ margin: '16px 0 8px' }}>Saved formats ({formats.length})</h4>
                  {formats.length === 0 ? (
                    <div className="empty">No custom formats yet — upload your school&apos;s official layout above.</div>
                  ) : (
                    formats.map((f) => (
                      <div key={f.id} className="template-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left', marginBottom: 6 }}>
                        <button
                          className={`template-card ${selected?.id === `format_${f.id}` ? 'active' : ''}`}
                          style={{ flex: 1, border: 'none', background: 'none', textAlign: 'left' }}
                          onClick={() => pickFormat(f)}
                          title={f.body}
                        >
                          <div className="tpl-name">{f.name}</div>
                          <div className="tpl-fields">{detectFields(f.body).slice(0, 6).join(', ') || 'no fields'}</div>
                        </button>
                        {canWrite && (
                          <button className="icon-btn" title="Delete" aria-label="Delete" onClick={() => deleteFormat(f.id)} style={{ marginLeft: 8 }}>
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </>
              )}
              {tab === 'saved' && (
                <>
                  <div className="hint" style={{ marginTop: 10 }}>
                    <Clock size={11} style={{ verticalAlign: -1 }} /> Generated documents are saved here for the week and deleted automatically every Saturday
                    {purge ? ` (next purge: ${new Date(purge.next_purge).toLocaleString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })})` : ''}.
                  </div>
                  {docs.length === 0 ? (
                    <div className="empty" style={{ marginTop: 10 }}>No saved documents this week — generate one and it appears here until Saturday.</div>
                  ) : (
                    docs.map((d) => (
                      <div key={d.id} className="template-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left', marginBottom: 6 }}>
                        <button
                          className="template-card"
                          style={{ flex: 1, border: 'none', background: 'none', textAlign: 'left' }}
                          onClick={() => openDoc(d)}
                          title={d.name}
                        >
                          <div className="tpl-name"><FolderOpen size={13} style={{ verticalAlign: -2, marginRight: 4 }} />{d.name}</div>
                          <div className="tpl-fields">{d.kind === 'format' ? 'custom format' : 'template'} · saved {new Date(d.created_at).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
                        </button>
                        <button className="icon-btn" title="Delete" aria-label="Delete" onClick={() => deleteDoc(d.id)} style={{ marginLeft: 8 }}>
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>

            {selected && (
              <div className="card">
                <h4>{selected.name} — describe or fill in</h4>
                <label>What do you need? <span className="hint">(the AI writes the document from this)</span></label>
                <textarea
                  className="doc-editor"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  placeholder={'Describe the document, e.g.\n"Brigada Eskwela accomplishment report for the month of May, Grade 11"\n"Certificate of recognition for Juan Dela Cruz for Best in Math"\n"Daily lesson log on Quadratic Equations for General Mathematics"'}
                />
                <div className="hint" style={{ marginBottom: 10 }}>Leave blank to fill the fields yourself. When a description is given, the fields below are auto-filled with excellent content that follows the format.</div>
                <div className="form-row">
                  <label>Subject {fInput('subject')}</label>
                </div>
                <div className="form-row">
                  <label>Grade Level {fInput('grade_level')}</label>
                  <label>Section {fInput('section')}</label>
                  <label>Quarter {fInput('quarter')}</label>
                </div>
                {contextFields.slice(4).map((k) => (
                  <div className="form-row" key={k}>
                    <label>{k.replace(/_/g, ' ')[0].toUpperCase() + k.replace(/_/g, ' ').slice(1)} {fInput(k)}</label>
                  </div>
                ))}
                <div className="form-row">
                  <label>Prepared by {fInput('prepared_by')}</label>
                  <label>Noted by {fInput('noted_by')}</label>
                </div>
                <button className="btn btn-primary" onClick={generate} disabled={busy}>
                  <Sparkles size={15} /> {busy ? 'Generating...' : 'Generate document'}
                </button>
              </div>
            )}
          </div>

          <div>
            <div className="card">
              <div className="doc-toolbar">
                <h4 style={{ margin: 0 }}>{doc ? doc.name : 'Document preview'}</h4>
                {note && <span className="badge badge-blue">{note}</span>}
              </div>
              {!doc ? (
                <div className="empty">Pick a template (or a saved custom format) on the left and generate. You can then edit, improve, and export.</div>
              ) : (
                <>
                  <div className="doc-actions">
                    <button className="btn btn-sm" onClick={() => improve('formalize')}><Wand2 size={13} /> Formalize</button>
                    <button className="btn btn-sm" onClick={() => improve('bullet')}>Bullet</button>
                    <button className="btn btn-sm" onClick={() => improve('concise')}><Scissors size={13} /> Condense</button>
                    <button className="btn btn-sm" onClick={summarizeIt}><Maximize2 size={13} /> Add summary</button>
                  </div>
                  <textarea
                    className="doc-editor"
                    value={editing || ''}
                    onChange={(e) => setEditing(e.target.value)}
                    rows={22}
                    spellCheck
                  />
                  <div className="doc-export">
                    <button className="btn btn-primary btn-sm" onClick={() => downloadDoc(doc.name, editing, `${doc.name.toLowerCase().replace(/\s+/g, '-')}.doc`)}>
                      <Download size={13} /> Word (.doc)
                    </button>
                    <button className="btn btn-sm" onClick={() => printHtml(doc.name, editing)}>
                      <Printer size={13} /> PDF (print)
                    </button>
                    <button className="btn btn-sm" onClick={() => downloadTxt(editing, `${doc.name.toLowerCase().replace(/\s+/g, '-')}.txt`)}>
                      <FileText size={13} /> TXT
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
