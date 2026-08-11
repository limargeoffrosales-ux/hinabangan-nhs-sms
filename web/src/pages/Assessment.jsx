import { useEffect, useState } from 'react';
import { Plus, Trash2, Sparkles, Calculator, ClipboardList, Star } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, Badge, Empty, Spinner, ErrorBanner, Modal } from '../components/ui';
import { downloadDoc } from '../lib/export';

const TABS = ['Question Bank', 'AI Question Generator', 'Rubrics & TOS', 'Item Analysis'];

export default function Assessment() {
  const [tab, setTab] = useState(TABS[0]);
  const [questions, setQuestions] = useState(null);
  const [rubrics, setRubrics] = useState(null);
  const [tos, setTos] = useState(null);
  const [analyses, setAnalyses] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [qModal, setQModal] = useState(false);
  const [qForm, setQForm] = useState({ question: '', options: ['', '', '', ''], answer: 'A', subject_id: '', competency: '', qtype: 'mcq', difficulty: 2, grade_level: 'Grade 11' });

  const [aiTopic, setAiTopic] = useState('');
  const [aiCount, setAiCount] = useState(5);
  const [aiResult, setAiResult] = useState([]);

  const [tosForm, setTosForm] = useState({ title: '', subject_id: '', quarter: 1, rows: [{ competency: '', items: 1, type: 'mcq' }] });

  const [iaForm, setIaForm] = useState({ title: '', subject_id: '', school_year: '2025-2026', learners: 30, items: [{ competency: '', correct_upper: '', correct_lower: '' }] });
  const [iaResult, setIaResult] = useState(null);

  async function load() {
    try {
      const [qq, rr, tt, aa, ss] = await Promise.all([
        api('/assessment/questions'),
        api('/assessment/rubrics'),
        api('/assessment/tos'),
        api('/assessment/analyses'),
        api('/subjects?limit=200'),
      ]);
      setQuestions(qq.data);
      setRubrics(rr.data);
      setTos(tt.data);
      setAnalyses(aa.data);
      setSubjects(ss.data);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => { load(); }, []);

  async function saveQuestion() {
    if (!qForm.question) return alert('Question is required');
    setBusy(true);
    try {
      await api('/assessment/questions', { method: 'POST', body: qForm });
      setQModal(false);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function delQuestion(id) {
    if (!confirm('Delete this question?')) return;
    await api(`/assessment/questions/${id}`, { method: 'DELETE' });
    await load();
  }

  async function genQuestions() {
    if (!aiTopic) return alert('Enter a topic / competency');
    setBusy(true);
    try {
      const r = await api('/assessment/ai/questions', { method: 'POST', body: { topics: aiTopic, count: aiCount } });
      setAiResult(r.questions);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveTos() {
    if (!tosForm.title) return alert('Title is required');
    setBusy(true);
    try {
      await api('/assessment/tos', { method: 'POST', body: { ...tosForm, rows: undefined, data: tosForm.rows.map((r) => ({ competency: r.competency, items: Number(r.items) || 0, type: r.type })) } });
      await load();
      setTosForm({ title: '', subject_id: '', quarter: 1, rows: [{ competency: '', items: 1, type: 'mcq' }] });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function delTos(id) {
    if (!confirm('Delete this TOS?')) return;
    await api(`/assessment/tos/${id}`, { method: 'DELETE' });
    await load();
  }

  async function delRubric(id) {
    if (!confirm('Delete this rubric?')) return;
    await api(`/assessment/rubrics/${id}`, { method: 'DELETE' });
    await load();
  }

  async function runAnalysis() {
    if (iaForm.items.some((i) => i.correct_upper === '' || i.correct_lower === '')) return alert('Fill all correct-count fields');
    setBusy(true);
    try {
      const r = await api('/assessment/item-analysis', { method: 'POST', body: { learners: Number(iaForm.learners), items: iaForm.items.map((i) => ({ competency: i.competency, correct_upper: Number(i.correct_upper), correct_lower: Number(i.correct_lower) })) } });
      setIaResult(r.computed);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveAnalysis() {
    if (!iaForm.title) return alert('Title is required');
    const data = { items: iaForm.items };
    await api('/assessment/analyses', { method: 'POST', body: { title: iaForm.title, subject_id: iaForm.subject_id || null, school_year: iaForm.school_year, learners: Number(iaForm.learners), total_items: iaForm.items.length, data, computed: iaResult } });
    await load();
  }

  function exportTos(t) {
    const rows = t.data || [];
    const total = rows.reduce((s, r) => s + (Number(r.items) || 0), 0);
    const body = [
      'Hinabangan National High School — TABLE OF SPECIFICATIONS',
      `${t.title}   Subject: ${t.subject_title || '—'}   Quarter: ${t.quarter}`,
      '',
      'Competency | No. of Items | Type | %',
      rows.map((r) => `${r.competency} | ${r.items} | ${r.type} | ${total ? Math.round((r.items / total) * 100) : 0}%`).join('\n'),
      '',
      `TOTAL | ${total} | | 100%`,
    ].join('\n');
    downloadDoc(t.title, body, 'tos.doc');
  }

  function exportIa(a) {
    const body = [
      'Hinabangan National High School — ITEM ANALYSIS REPORT',
      `${a.title}   SY ${a.school_year}   Learners: ${a.learners}`,
      '',
      'Item | Difficulty | Level | Discrimination | Level',
      (a.computed?.results || []).map((r) => `${r.item_no} | ${r.difficulty} | ${r.difficulty_level} | ${r.discrimination} | ${r.discrimination_level}`).join('\n'),
      '',
      `Average difficulty: ${a.computed?.average_difficulty ?? '—'}`,
      `Interpretation: ${a.computed?.interpretation || '—'}`,
    ].join('\n');
    downloadDoc(a.title, body, 'item-analysis.doc');
  }

  return (
    <div>
      <PageHead title="Assessment Management" sub="Question bank, AI exam drafting, rubrics, Table of Specifications, and automated item analysis (difficulty & discrimination indices)." />
      <ErrorBanner error={error} />
      <div className="seg" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t} className={tab === t ? 'seg-btn active' : 'seg-btn'} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'Question Bank' && (
        <div className="card">
          <div className="card-top">
            <h4 style={{ margin: 0 }}>Question bank <span className="sub">({questions ? questions.length : 0} items)</span></h4>
            <button className="btn btn-primary btn-sm" onClick={() => setQModal(true)}><Plus size={13} /> Add question</button>
          </div>
          {!questions ? <Spinner /> : questions.length === 0 ? <Empty text="The question bank is empty. Add items or generate AI drafts in the next tab." /> : (
            <table className="table">
              <thead><tr><th>Question</th><th>Competency</th><th>Type</th><th>Answer</th><th>Diff</th><th>Used</th><th></th></tr></thead>
              <tbody>
                {questions.slice(0, 40).map((q) => (
                  <tr key={q.id}>
                    <td>{q.question}</td>
                    <td className="sub">{q.competency || '—'}</td>
                    <td><Badge status={q.qtype} /></td>
                    <td>{q.answer}</td>
                    <td>{'●'.repeat(q.difficulty)}</td>
                    <td>{q.used_count}</td>
                    <td><button className="btn btn-sm btn-danger" onClick={() => delQuestion(q.id)}><Trash2 size={12} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'AI Question Generator' && (
        <div className="two-col" style={{ alignItems: 'start' }}>
          <div className="card">
            <h4><Sparkles size={15} /> AI exam item drafting</h4>
            <div className="form-row">
              <label>Topic / competency *<input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="e.g. Rational functions" /></label>
            </div>
            <div className="form-row">
              <label>Items<select value={aiCount} onChange={(e) => setAiCount(Number(e.target.value))}>{[3, 5, 8, 10, 15].map((n) => <option key={n}>{n}</option>)}</select></label>
            </div>
            <button className="btn btn-primary" onClick={genQuestions} disabled={busy}>{busy ? 'Drafting...' : 'Generate AI questions'}</button>
            <div className="notice warn" style={{ marginTop: 10 }}>AI-drafted items are a starting point — always validate options and distractors against your competencies.</div>
          </div>
          <div className="card">
            <h4>Generated draft</h4>
            {aiResult.length === 0 ? <Empty text="Draft items will appear here." /> : (
              <div className="ai-q-list">
                {aiResult.map((q, i) => (
                  <div key={i} className="ai-q-item">
                    <div className="ai-q-head"><b>{i + 1}. {q.question}</b> <span className={`badge badge-${q.level === 'hard' ? 'red' : q.level === 'average' ? 'yellow' : 'green'}`}>{q.level}</span></div>
                    <ul>{q.options.map((o, j) => <li key={j}>&#9633; {o}</li>)}</ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'Rubrics & TOS' && (
        <div className="two-col" style={{ alignItems: 'start' }}>
          <div>
            <div className="card">
              <h4>Rubrics</h4>
              {!rubrics ? <Spinner /> : rubrics.length === 0 ? <Empty text="No rubrics saved." /> : rubrics.map((r) => (
                <div key={r.id} className="rubric-item">
                  <div>
                    <b>{r.title}</b>
                    <div className="sub">{r.task} · {r.subject_title || 'General'}</div>
                    <div className="mini-stats"><Star size={11} /> {(r.criteria || []).map((c) => `${c.name} (${c.weight})`).join(' · ')}</div>
                  </div>
                  <button className="btn btn-sm btn-danger" onClick={() => delRubric(r.id)}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
            <div className="card">
              <h4>New TOS</h4>
              <div className="form-row">
                <label>Title *<input value={tosForm.title} onChange={(e) => setTosForm({ ...tosForm, title: e.target.value })} /></label>
                <label>Quarter<select value={tosForm.quarter} onChange={(e) => setTosForm({ ...tosForm, quarter: Number(e.target.value) })}>{[1, 2, 3, 4].map((q) => <option key={q}>{q}</option>)}</select></label>
                <label>Subject<select value={tosForm.subject_id} onChange={(e) => setTosForm({ ...tosForm, subject_id: e.target.value })}>
                  <option value="">General</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
                </select></label>
              </div>
              {tosForm.rows.map((r, i) => (
                <div className="form-row" key={i}>
                  <label>Competency<input value={r.competency} onChange={(e) => { const rows = [...tosForm.rows]; rows[i] = { ...r, competency: e.target.value }; setTosForm({ ...tosForm, rows }); }} /></label>
                  <label>Items<input type="number" min="1" value={r.items} onChange={(e) => { const rows = [...tosForm.rows]; rows[i] = { ...r, items: e.target.value }; setTosForm({ ...tosForm, rows }); }} /></label>
                  <label>Type<select value={r.type} onChange={(e) => { const rows = [...tosForm.rows]; rows[i] = { ...r, type: e.target.value }; setTosForm({ ...tosForm, rows }); }}>
                    {['mcq', 'identification', 'essay', 'performance'].map((t) => <option key={t}>{t}</option>)}
                  </select></label>
                </div>
              ))}
              <div className="card-actions">
                <button className="btn btn-sm" onClick={() => setTosForm({ ...tosForm, rows: [...tosForm.rows, { competency: '', items: 1, type: 'mcq' }] })}><Plus size={12} /> Row</button>
                <button className="btn btn-primary btn-sm" onClick={saveTos} disabled={busy}><ClipboardList size={12} /> Save TOS</button>
              </div>
            </div>
          </div>
          <div className="card">
            <h4>Saved TOS</h4>
            {!tos ? <Spinner /> : tos.length === 0 ? <Empty text="No tables of specifications yet." /> : tos.map((t) => (
              <div key={t.id} className="rubric-item">
                <div>
                  <b>{t.title}</b>
                  <div className="sub">Quarter {t.quarter} · {t.subject_title || 'General'}</div>
                  <div className="sub">{(t.data || []).map((r) => `${r.competency} (${r.items})`).join(' · ')}</div>
                </div>
                <div className="card-actions" style={{ gap: 6 }}>
                  <button className="btn btn-sm" onClick={() => exportTos(t)}>Export</button>
                  <button className="btn btn-sm btn-danger" onClick={() => delTos(t.id)}><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'Item Analysis' && (
        <div className="two-col" style={{ alignItems: 'start' }}>
          <div className="card">
            <h4><Calculator size={15} /> Automated item analysis</h4>
            <div className="sub" style={{ marginBottom: 10 }}>Enter, per item, the number of correct answers in the upper and lower 27% of the class. Difficulty and discrimination indices are computed instantly.</div>
            <div className="form-row">
              <label>Title<input value={iaForm.title} onChange={(e) => setIaForm({ ...iaForm, title: e.target.value })} placeholder="e.g. Q1 Gen Math Exam" /></label>
              <label>Learners<input type="number" min="1" value={iaForm.learners} onChange={(e) => setIaForm({ ...iaForm, learners: e.target.value })} /></label>
              <label>Subject<select value={iaForm.subject_id} onChange={(e) => setIaForm({ ...iaForm, subject_id: e.target.value })}>
                <option value="">General</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
              </select></label>
            </div>
            {iaForm.items.map((it, i) => (
              <div className="form-row" key={i}>
                <label>Competency<input style={{ minWidth: 180 }} value={it.competency} onChange={(e) => { const items = [...iaForm.items]; items[i] = { ...it, competency: e.target.value }; setIaForm({ ...iaForm, items }); }} /></label>
                <label>Upper 27% correct<input type="number" min="0" value={it.correct_upper} onChange={(e) => { const items = [...iaForm.items]; items[i] = { ...it, correct_upper: e.target.value }; setIaForm({ ...iaForm, items }); }} /></label>
                <label>Lower 27% correct<input type="number" min="0" value={it.correct_lower} onChange={(e) => { const items = [...iaForm.items]; items[i] = { ...it, correct_lower: e.target.value }; setIaForm({ ...iaForm, items }); }} /></label>
              </div>
            ))}
            <div className="card-actions">
              <button className="btn btn-sm" onClick={() => setIaForm({ ...iaForm, items: [...iaForm.items, { competency: '', correct_upper: '', correct_lower: '' }] })}><Plus size={12} /> Item</button>
              <button className="btn btn-primary btn-sm" onClick={runAnalysis} disabled={busy}>{busy ? 'Computing...' : 'Compute indices'}</button>
            </div>
            {iaResult && (
              <div className="notice ok" style={{ marginTop: 10 }}>
                <b>{iaResult.interpretation}</b> · Poor items: {iaResult.poor_items}
              </div>
            )}
            {iaResult && <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={saveAnalysis} disabled={!iaForm.title || busy}>Save analysis report</button>}
          </div>
          <div className="card">
            <h4>Results</h4>
            {!iaResult ? <Empty text="Run the analysis to see difficulty and discrimination indices." /> : (
              <table className="table">
                <thead><tr><th>Item</th><th>Difficulty</th><th>Level</th><th>Discrimination</th><th>Quality</th></tr></thead>
                <tbody>
                  {iaResult.results.map((r) => (
                    <tr key={r.item_no}>
                      <td>{r.item_no}</td>
                      <td>{r.difficulty}</td>
                      <td><span className={`badge badge-${r.difficulty_level === 'Average' ? 'blue' : r.difficulty_level === 'Easy' ? 'green' : 'yellow'}`}>{r.difficulty_level}</span></td>
                      <td>{r.discrimination}</td>
                      <td><span className={`badge badge-${r.discrimination_level === 'Very Good' || r.discrimination_level === 'Good' ? 'green' : r.discrimination_level === 'Fair' ? 'yellow' : 'red'}`}>{r.discrimination_level}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <h4 style={{ marginTop: 14 }}>Saved analyses</h4>
            {!analyses ? <Spinner /> : analyses.length === 0 ? <Empty text="No saved analyses." /> : analyses.map((a) => (
              <div key={a.id} className="rubric-item">
                <div>
                  <b>{a.title}</b>
                  <div className="sub">SY {a.school_year} · {a.learners} learners · avg difficulty {a.computed?.average_difficulty ?? '—'}</div>
                </div>
                <button className="btn btn-sm" onClick={() => exportIa(a)}>Export</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {qModal && (
        <Modal title="Add question to bank" onClose={() => setQModal(false)} wide>
          <div className="form-row">
            <label>Question *<textarea rows={2} value={qForm.question} onChange={(e) => setQForm({ ...qForm, question: e.target.value })} /></label>
          </div>
          <div className="form-row">
            <label>Subject<select value={qForm.subject_id} onChange={(e) => setQForm({ ...qForm, subject_id: e.target.value })}>
              <option value="">General</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
            </select></label>
            <label>Type<select value={qForm.qtype} onChange={(e) => setQForm({ ...qForm, qtype: e.target.value })}>
              {['mcq', 'identification', 'essay', 'performance'].map((t) => <option key={t}>{t}</option>)}
            </select></label>
            <label>Competency<input value={qForm.competency} onChange={(e) => setQForm({ ...qForm, competency: e.target.value })} /></label>
          </div>
          {qForm.qtype === 'mcq' && (
            <div className="form-row">
              {qForm.options.map((o, i) => (
                <label key={i} style={{ minWidth: 180 }}>
                  Option {String.fromCharCode(65 + i)}
                  <input value={o} onChange={(e) => { const options = [...qForm.options]; options[i] = e.target.value; setQForm({ ...qForm, options }); }} />
                </label>
              ))}
              <label>Answer<select value={qForm.answer} onChange={(e) => setQForm({ ...qForm, answer: e.target.value })}>
                {['A', 'B', 'C', 'D'].map((x) => <option key={x}>{x}</option>)}
              </select></label>
            </div>
          )}
          <div className="form-row">
            <label>Difficulty(1-3)<select value={qForm.difficulty} onChange={(e) => setQForm({ ...qForm, difficulty: Number(e.target.value) })}>
              {[1, 2, 3].map((d) => <option key={d} value={d}>{'●'.repeat(d)}</option>)}
            </select></label>
          </div>
          <div className="modal-footer">
            <button className="btn" onClick={() => setQModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveQuestion} disabled={busy}>{busy ? 'Saving...' : 'Save question'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}