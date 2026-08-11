import { useEffect, useState } from 'react';
import { BookOpenCheck, Plus, Wand2, History, Milestone, Quote } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, Badge, Empty, Spinner, ErrorBanner, Modal } from '../components/ui';
import { downloadDoc } from '../lib/export';

const TYPES = ['Action Research', 'BERF Proposal', 'Innovation', 'Research Ethics', 'IMRAD Paper', 'Conference Paper', 'Published Paper'];
const STATUSES = ['draft', 'in_progress', 'completed', 'archived'];
const FAMILY = { draft: 'gray', in_progress: 'blue', completed: 'green', archived: 'gray' };

const blank = { title: '', research_type: 'Action Research', status: 'draft', abstract: '', funding_source: '', timeline_start: '', timeline_end: '' };

export default function Research() {
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [titles, setTitles] = useState([]);
  const [citation, setCitation] = useState(null);
  const [cTask, setCTask] = useState(null);

  async function load() {
    try {
      const r = await api('/research');
      setProjects(r.data);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!form.title) return alert('Title is required');
    setBusy(true);
    try {
      const r = await api('/research', { method: 'POST', body: form });
      await load();
      setModal(false);
      setForm(blank);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!confirm('Delete this research project?')) return;
    await api(`/research/${id}`, { method: 'DELETE' });
    await load();
  }

  async function genTitles() {
    if (!form.title) return alert('Enter a working topic first');
    setBusy(true);
    try {
      const r = await api('/research/ai/title', { method: 'POST', body: { topic: form.title } });
      setTitles(r.titles);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function genCitation() {
    setBusy(true);
    try {
      const r = await api('/research/ai/citation', { method: 'POST', body: {
        author: prompt('Author (e.g. Dela Cruz, M. C.):') || 'Author, A. A.',
        year: prompt('Year:') || '2026',
        title: form.title || 'Title of the Work',
        venue: prompt('Venue / journal:') || 'Journal Name, Volume(Issue), pages',
      } });
      setCitation(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function exportProject(p) {
    const body = [
      'Hinabangan National High School — Research Management',
      '',
      `TITLE: ${p.title}`,
      `Type: ${p.research_type}   Status: ${p.status}`,
      `Timeline: ${p.timeline_start || '—'} to ${p.timeline_end || '—'}   Funding: ${p.funding_source || '—'}`,
      '',
      'ABSTRACT', p.abstract || '—',
      '', 'METHODOLOGY', p.methodology || '—',
      '', 'FINDINGS', p.findings || '—',
      '', 'CONCLUSION', p.conclusion || '—',
      '',
      `Versions: ${(p.versions || []).map((v) => `v${v.version_no}`).join(', ') || 'none'}`,
      `Milestones: ${(p.milestones || []).map((m) => `${m.milestone} (${m.status})`).join(' | ') || 'none'}`,
    ].join('\n');
    downloadDoc(p.title, body, `research-${p.id}.doc`);
  }

  return (
    <div>
      <PageHead title="Research Management" sub="Action research, BERF proposals, and innovations — with AI title generation, APA 7 citations, versioning, and monitoring.">
        <button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={15} /> New research project</button>
      </PageHead>
      <ErrorBanner error={error} />
      {!projects ? <div className="center-pad"><Spinner /></div> : projects.length === 0 ? <Empty text="No research projects yet. Create your first action research proposal." /> : (
        <div className="grid-2">
          {projects.map((p) => (
            <div className="card" key={p.id}>
              <div className="card-top">
                <BookOpenCheck size={18} className="accent-ic" />
                <Badge status={FAMILY[p.status]} />
              </div>
              <h4>{p.title}</h4>
              <p className="sub">{p.research_type} · {p.user_name}</p>
              <p className="sub">{p.abstract || 'No abstract yet.'}</p>
              <div className="mini-stats">
                <span><History size={12} /> {(p.versions || []).length} versions</span>
                <span><Milestone size={12} /> {(p.milestones || []).filter((m) => m.status === 'completed').length}/{p.milestones.length} milestones</span>
              </div>
              <div className="card-actions">
                <button className="btn btn-sm" onClick={() => exportProject(p)}>Export</button>
                <button className="btn btn-sm" onClick={() => { setCTask(p); }}>
                  <History size={13} /> Versions
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => remove(p.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title="New Research Project" sub="AI can suggest research titles from your topic." onClose={() => setModal(false)} wide>
          <div className="form-row">
            <label>Working topic / title *<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          </div>
          <button className="btn btn-sm" onClick={genTitles} disabled={busy}><Wand2 size={13} /> Suggest AI titles</button>
          {titles.length > 0 && (
            <div className="suggest-list">
              {titles.map((t, i) => (
                <button key={i} className="suggest-item" onClick={() => setForm({ ...form, title: t })}>{t}</button>
              ))}
            </div>
          )}
          <div className="form-row">
            <label>Type
              <select value={form.research_type} onChange={(e) => setForm({ ...form, research_type: e.target.value })}>
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label>Status
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>Funding source<input value={form.funding_source} onChange={(e) => setForm({ ...form, funding_source: e.target.value })} /></label>
            <label>Start<input type="date" value={form.timeline_start} onChange={(e) => setForm({ ...form, timeline_start: e.target.value })} /></label>
            <label>End<input type="date" value={form.timeline_end} onChange={(e) => setForm({ ...form, timeline_end: e.target.value })} /></label>
          </div>
          <div className="form-row">
            <label>Abstract<textarea rows={3} value={form.abstract} onChange={(e) => setForm({ ...form, abstract: e.target.value })} /></label>
          </div>
          <button className="btn btn-sm" onClick={genCitation} disabled={busy}><Quote size={13} /> APA 7 citation</button>
          {citation && (
            <div className="notice ok" style={{ marginTop: 8 }}>
              <p><b>APA 7:</b> {citation.apa7}</p>
              <p><b>In-text:</b> {citation.intext}</p>
            </div>
          )}
          <div className="modal-footer">
            <button className="btn" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save project'}</button>
          </div>
        </Modal>
      )}

      {cTask && (
        <Modal title={cTask.title} sub="Version history and milestone monitoring" onClose={() => setCTask(null)} wide>
          <h4>Versions</h4>
          {cTask.versions.length === 0 ? <Empty text="No saved versions." /> : (
            <table className="table">
              <thead><tr><th>Version</th><th>Note</th><th>Date</th></tr></thead>
              <tbody>
                {cTask.versions.map((v) => (
                  <tr key={v.id}><td>v{v.version_no}</td><td>{v.note}</td><td>{String(v.created_at).slice(0, 10)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          <h4 style={{ marginTop: 14 }}>Milestones</h4>
          {cTask.milestones.length === 0 ? <Empty text="No milestones." /> : (
            <table className="table">
              <thead><tr><th>Milestone</th><th>Target</th><th>Status</th></tr></thead>
              <tbody>
                {cTask.milestones.map((m) => (
                  <tr key={m.id}><td>{m.milestone}</td><td>{m.target_date || '—'}</td><td><Badge status={m.status} /></td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}
    </div>
  );
}