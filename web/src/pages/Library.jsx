import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Plus, Pencil, Trash2, Filter, BookMarked, ArrowDownToLine, ArrowUpFromLine, Search } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { PageHead, Spinner, Empty, Modal, ErrorBanner, ConfirmModal } from '../components/ui';

const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'librarian'];
const EMPTY_BOOK = { title: '', author: '', isbn: '', category: '', publisher: '', year_published: '', total_copies: 1, available_copies: 1, location: '', status: 'active' };

export default function Library() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = can(user?.role, ...WRITE);
  const [books, setBooks] = useState([]);
  const [borrows, setBorrows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('catalog');
  const [form, setForm] = useState({ ...EMPTY_BOOK });
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showBorrowModal, setShowBorrowModal] = useState(null);
  const [borrowForm, setBorrowForm] = useState({ borrower_type: 'student', borrower_id: '', due_date: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState({ category: '', status: '' });
  const [search, setSearch] = useState('');
  const [borrowFilter, setBorrowFilter] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [b, s, br] = await Promise.allSettled([
        api('/library'), api('/library/summary'), api('/library/borrows/all'),
      ]);
      if (b.status === 'fulfilled') setBooks(b.value.data);
      if (s.status === 'fulfilled') setSummary(s.value);
      if (br.status === 'fulfilled') setBorrows(br.value.data);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  function openForm(book) {
    if (book) { setEditing(book.id); setForm({ ...book, year_published: book.year_published || '' }); }
    else { setEditing(null); setForm({ ...EMPTY_BOOK }); }
    setShowModal(true);
  }

  async function saveBook(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const body = { ...form, total_copies: Number(form.total_copies), available_copies: Number(form.available_copies), year_published: form.year_published ? Number(form.year_published) : null };
      if (editing) await api(`/library/${editing}`, { method: 'PATCH', body });
      else await api('/library', { method: 'POST', body });
      await loadData(); setShowModal(false);
    } catch (e2) { setError(e2.message); } finally { setSaving(false); }
  }

  async function removeBook(id) {
    setConfirmAction({ message: 'Delete this book?', action: async () => {
      try { await api(`/library/${id}`, { method: 'DELETE' }); setBooks((r) => r.filter((x) => x.id !== id)); } catch (e2) { setError(e2.message); }
    } });
  }

  async function borrowBook(e) {
    e.preventDefault(); setSaving(true);
    try {
      await api(`/library/${showBorrowModal.id}/borrow`, { method: 'POST', body: { ...borrowForm, borrower_id: Number(borrowForm.borrower_id) } });
      await loadData(); setShowBorrowModal(null);
    } catch (e2) { setError(e2.message); } finally { setSaving(false); }
  }

  async function returnBook(id) {
    try { await api(`/library/borrows/${id}/return`, { method: 'POST' }); await loadData(); } catch (e2) { setError(e2.message); }
  }

  const filteredBooks = books.filter((b) =>
    (!filter.category || b.category === filter.category) && (!filter.status || b.status === filter.status) &&
    (!search || `${b.title} ${b.author} ${b.isbn}`.toLowerCase().includes(search.toLowerCase()))
  );
  const filteredBorrows = borrows.filter((b) => !borrowFilter || b.status === borrowFilter);

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHead title="School Library" sub="Book catalog and loan management">
        {isAdmin && <button className="btn btn-primary" onClick={() => openForm(null)}><Plus size={15} /> Add Book</button>}
      </PageHead>
      <ErrorBanner error={error} />

      {summary && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="kpi-row">
            <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: 'var(--accent)' }}>{summary.total}</div><div className="kpi-mini-label">Titles</div></div>
            <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: 'var(--accent-2)' }}>{summary.total_copies}</div><div className="kpi-mini-label">Total Copies</div></div>
            <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: 'var(--success)' }}>{summary.available_copies}</div><div className="kpi-mini-label">Available</div></div>
            <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: 'var(--accent)' }}>{summary.active_borrows}</div><div className="kpi-mini-label">On Loan</div></div>
            <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: 'var(--danger)' }}>{summary.overdue}</div><div className="kpi-mini-label">Overdue</div></div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <button className={`btn btn-sm ${tab === 'catalog' ? 'btn-primary' : ''}`} onClick={() => setTab('catalog')}><BookMarked size={14} /> Catalog</button>
        <button className={`btn btn-sm ${tab === 'loans' ? 'btn-primary' : ''}`} onClick={() => setTab('loans')}><ArrowDownToLine size={14} /> Loans</button>
      </div>

      {tab === 'catalog' && (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="form-row" style={{ gap: 8, flexWrap: 'wrap', display: 'flex', alignItems: 'center' }}>
              <input placeholder="Search title, author, ISBN…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
              <label style={{ margin: 0 }}><Filter size={14} /> Category <select value={filter.category} onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value }))} style={{ marginTop: 4 }}>
                <option value="">All</option>{['Textbook', 'Reference', 'Fiction', 'Non-fiction', 'Periodical', 'Other'].map((c) => <option key={c}>{c}</option>)}
              </select></label>
              <label style={{ margin: 0 }}>Status <select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))} style={{ marginTop: 4 }}>
                <option value="">All</option><option value="active">Active</option><option value="archived">Archived</option>
              </select></label>
            </div>
          </div>
          {filteredBooks.length === 0 ? <Empty text="No books in the catalog." /> : (
            <div className="card"><div className="table-wrap"><table>
              <thead><tr><th>Title</th><th>Author</th><th>ISBN</th><th>Category</th><th style={{ textAlign: 'center' }}>Copies</th><th style={{ textAlign: 'center' }}>Available</th><th style={{ textAlign: 'center' }}>Status</th>{isAdmin && <th></th>}</tr></thead>
              <tbody>{filteredBooks.map((b) => (
                <tr key={b.id}>
                  <td><strong>{b.title}</strong>{b.publisher && <div className="sub" style={{ fontSize: 11 }}>{b.publisher}{b.year_published ? ` (${b.year_published})` : ''}</div>}</td>
                  <td className="sub">{b.author || '—'}</td>
                  <td className="sub">{b.isbn || '—'}</td>
                  <td className="sub">{b.category || '—'}</td>
                  <td style={{ textAlign: 'center' }}>{b.total_copies}</td>
                  <td style={{ textAlign: 'center' }}><strong style={{ color: b.available_copies > 0 ? 'var(--success)' : 'var(--danger)' }}>{b.available_copies}</strong></td>
                  <td style={{ textAlign: 'center' }}><span className={`badge ${b.status === 'active' ? 'badge-green' : 'badge-gray'}`}>{b.status}</span></td>
                  {isAdmin && <td><div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-sm" onClick={() => openForm(b)} title="Edit"><Pencil size={12} /></button>
                    <button className="btn btn-sm" onClick={() => setShowBorrowModal(b)} title="Borrow" disabled={b.available_copies <= 0}><ArrowDownToLine size={12} /></button>
                    <button className="btn btn-sm" onClick={() => removeBook(b.id)} title="Delete"><Trash2 size={12} /></button>
                  </div></td>}
                </tr>
              ))}</tbody>
            </table></div></div>
          )}
        </>
      )}

      {tab === 'loans' && (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
            <select value={borrowFilter} onChange={(e) => setBorrowFilter(e.target.value)} style={{ width: 150 }}>
              <option value="">All loans</option><option value="borrowed">Active</option><option value="returned">Returned</option><option value="overdue">Overdue</option>
            </select>
          </div>
          {filteredBorrows.length === 0 ? <Empty text="No loan records." /> : (
            <div className="card"><div className="table-wrap"><table>
              <thead><tr><th>Book</th><th>Borrower</th><th style={{ textAlign: 'center' }}>Borrowed</th><th style={{ textAlign: 'center' }}>Due</th><th style={{ textAlign: 'center' }}>Returned</th><th style={{ textAlign: 'center' }}>Status</th><th></th></tr></thead>
              <tbody>{filteredBorrows.map((b) => (
                <tr key={b.id}>
                  <td><strong>{b.book_title}</strong><div className="sub" style={{ fontSize: 11 }}>{b.book_author}</div></td>
                  <td>{b.borrower_name} <span className="badge badge-gray" style={{ marginLeft: 4 }}>{b.borrower_type}</span></td>
                  <td style={{ textAlign: 'center' }} className="sub">{b.borrow_date?.slice(0, 10)}</td>
                  <td style={{ textAlign: 'center' }} className="sub">{b.due_date?.slice(0, 10)}</td>
                  <td style={{ textAlign: 'center' }} className="sub">{b.returned_date?.slice(0, 10) || '—'}</td>
                  <td style={{ textAlign: 'center' }}><span className={`badge ${b.status === 'returned' ? 'badge-green' : b.status === 'overdue' ? 'badge-red' : 'badge-blue'}`}>{b.status}</span></td>
                  {b.status !== 'returned' && <td><button className="btn btn-sm" onClick={() => returnBook(b.id)}><ArrowUpFromLine size={12} /> Return</button></td>}
                </tr>
              ))}</tbody>
            </table></div></div>
          )}
        </>
      )}

      {showModal && (
        <Modal title={editing ? 'Edit Book' : 'Add Book'} onClose={() => setShowModal(false)}>
          <form onSubmit={saveBook}>
            <div className="grid-2" style={{ gap: 12 }}>
              <label>Title *<input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></label>
              <label>Author<input value={form.author} onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))} /></label>
              <label>ISBN<input value={form.isbn} onChange={(e) => setForm((f) => ({ ...f, isbn: e.target.value }))} /></label>
              <label>Category<select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                <option value="">None</option>{['Textbook', 'Reference', 'Fiction', 'Non-fiction', 'Periodical', 'Other'].map((c) => <option key={c}>{c}</option>)}
              </select></label>
              <label>Publisher<input value={form.publisher} onChange={(e) => setForm((f) => ({ ...f, publisher: e.target.value }))} /></label>
              <label>Year<input type="number" value={form.year_published} onChange={(e) => setForm((f) => ({ ...f, year_published: e.target.value }))} /></label>
              <label>Total Copies<input type="number" min="1" value={form.total_copies} onChange={(e) => setForm((f) => ({ ...f, total_copies: e.target.value }))} /></label>
              <label>Location<input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. Shelf A-3" /></label>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {showBorrowModal && (
        <Modal title={`Borrow: ${showBorrowModal.title}`} onClose={() => setShowBorrowModal(null)}>
          <form onSubmit={borrowBook}>
            <label>Borrower Type<select value={borrowForm.borrower_type} onChange={(e) => setBorrowForm((f) => ({ ...f, borrower_type: e.target.value }))}>
              <option value="student">Student</option><option value="teacher">Teacher</option>
            </select></label>
            <label>Borrower ID *<input required type="number" value={borrowForm.borrower_id} onChange={(e) => setBorrowForm((f) => ({ ...f, borrower_id: e.target.value }))} placeholder="Student or Teacher ID" /></label>
            <label>Due Date<input type="date" value={borrowForm.due_date} onChange={(e) => setBorrowForm((f) => ({ ...f, due_date: e.target.value }))} /></label>
            <label>Notes<textarea rows={2} value={borrowForm.notes} onChange={(e) => setBorrowForm((f) => ({ ...f, notes: e.target.value }))} /></label>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowBorrowModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Processing…' : 'Borrow'}</button>
            </div>
          </form>
        </Modal>
      )}
      {confirmAction && <ConfirmModal message={confirmAction.message} danger onConfirm={() => { confirmAction.action(); setConfirmAction(null); }} onCancel={() => setConfirmAction(null)} />}
    </div>
  );
}
