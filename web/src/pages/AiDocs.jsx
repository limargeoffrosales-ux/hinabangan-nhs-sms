import { useEffect, useState } from 'react';
import { Sparkles, Download, Printer, FileText, Wand2, Scissors, Maximize2 } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, Spinner, ErrorBanner } from '../components/ui';
import { downloadDoc, downloadTxt, printHtml } from '../lib/export';
import { useAuth } from '../lib/auth';

const QUICK_FIELDS = {
  subject: 'General Mathematics',
  grade_level: 'Grade 11',
  section: 'HUMSS 11-A',
  quarter: 'First',
  topic: '',
  period: '',
  prepared_by: '',
  noted_by: '',
  date: new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }),
};

export default function AiDocs() {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState(null);
  const [group, setGroup] = useState(null);
  const [selected, setSelected] = useState(null);
  const [fields, setFields] = useState({});
  const [doc, setDoc] = useState(null);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api('/ai/templates').then((r) => setCatalog(r)).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (catalog && !group) setGroup(Object.keys(catalog.groups)[0]);
  }, [catalog, group]);

  function pick(id) {
    const t = Object.values(catalog?.groups || {}).flat().find((x) => x.id === id);
    setSelected(t);
    setDoc(null);
    setNote('');
    setFields({ ...QUICK_FIELDS, prepared_by: user?.name || '', noted_by: user?.name || '' });
  }

  async function generate() {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const r = await api('/ai/generate', { method: 'POST', body: { template_id: selected.id, context: fields } });
      setDoc(r);
      setEditing(r.body);
      setNote('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
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

  function setF(k, v) {
    setFields((f) => ({ ...f, [k]: v }));
  }

  const fInput = (k) => (
    <input value={fields[k] || ''} onChange={(e) => setF(k, e.target.value)} placeholder={k.replace(/_/g, ' ')} />
  );

  return (
    <div>
      <PageHead title="AI Document Generator" sub="One-click professional documents for teaching, assessment, and school operations — editable and export-ready.">
        <span className="badge badge-blue">✨ {catalog ? catalog.count : ''} templates</span>
      </PageHead>
      <ErrorBanner error={error} />
      {!catalog ? (
        <div className="center-pad"><Spinner /></div>
      ) : (
        <div className="two-col" style={{ alignItems: 'start' }}>
          <div>
            <div className="card">
              <div className="seg" style={{ flexWrap: 'wrap' }}>
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
            </div>

            {selected && (
              <div className="card">
                <h4>{selected.name} — context</h4>
                <div className="form-row">
                  <label>Subject {fInput('subject')}</label>
                </div>
                <div className="form-row">
                  <label>Grade Level {fInput('grade_level')}</label>
                  <label>Section {fInput('section')}</label>
                  <label>Quarter {fInput('quarter')}</label>
                </div>
                <div className="form-row">
                  <label>Topic / Activity {fInput('topic')}</label>
                </div>
                <div className="form-row">
                  <label>Period {fInput('period')}</label>
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
                <div className="empty">Pick a template on the left and generate. You can then edit, improve, and export.</div>
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