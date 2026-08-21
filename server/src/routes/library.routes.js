const express = require('express');
const db = require('../db');
const { q, qa, qi, qr, nowSql } = db;
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit } = require('../utils');

const router = express.Router();
router.use(authenticate);
const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'librarian'];

/* ── List books ────────────────────────────────────── */
router.get('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const { category, status, search } = req.query;
  let sql = 'SELECT * FROM library_books';
  const where = [];
  const params = [];
  if (category) { where.push('category = ?'); params.push(category); }
  if (status) { where.push('status = ?'); params.push(status); }
  if (search) { where.push('(LOWER(title) LIKE ? OR LOWER(author) LIKE ? OR isbn = ?)'); const s = `%${search.toLowerCase()}%`; params.push(s, s, search); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY title ASC';
  res.json({ data: await qa(sql, params) });
}));

/* ── Summary ───────────────────────────────────────── */
router.get('/summary', requireRole(...WRITE), asyncH(async (req, res) => {
  const total = await q('SELECT COUNT(*) AS count, COALESCE(SUM(total_copies),0) AS copies, COALESCE(SUM(available_copies),0) AS available FROM library_books WHERE status = \'active\'');
  const borrows = await q('SELECT COUNT(*) AS active FROM book_borrows WHERE status = \'borrowed\'');
  const overdue = await q('SELECT COUNT(*) AS count FROM book_borrows WHERE status = \'borrowed\' AND due_date < CURRENT_DATE');
  const byCategory = await qa('SELECT category, COUNT(*) AS count FROM library_books WHERE status = \'active\' GROUP BY category ORDER BY count DESC');
  res.json({ total: total.count, total_copies: total.copies, available_copies: total.available, active_borrows: borrows.active, overdue: overdue.count, by_category: byCategory });
}));

/* ── List borrows ──────────────────────────────────── */
router.get('/borrows/all', requireRole(...WRITE), asyncH(async (req, res) => {
  const { status } = req.query;
  let sql = `SELECT bb.*, lb.title AS book_title, lb.author AS book_author,
    CASE WHEN bb.borrower_type = 'student' THEN st.first_name || ' ' || st.last_name
      ELSE t.first_name || ' ' || t.last_name END AS borrower_name
    FROM book_borrows bb
    JOIN library_books lb ON lb.id = bb.book_id
    LEFT JOIN students st ON st.id = bb.borrower_id AND bb.borrower_type = 'student'
    LEFT JOIN teachers t ON t.id = bb.borrower_id AND bb.borrower_type = 'teacher'`;
  const params = [];
  if (status) { sql += ' WHERE bb.status = ?'; params.push(status); }
  sql += ' ORDER BY bb.borrow_date DESC';
  res.json({ data: await qa(sql, params) });
}));

/* ── Get single book ───────────────────────────────── */
router.get('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM library_books WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Book not found' });
  const borrows = await qa(
    `SELECT bb.*, CASE WHEN bb.borrower_type = 'student' THEN st.first_name || ' ' || st.last_name
      ELSE t.first_name || ' ' || t.last_name END AS borrower_name
     FROM book_borrows bb
     LEFT JOIN students st ON st.id = bb.borrower_id AND bb.borrower_type = 'student'
     LEFT JOIN teachers t ON t.id = bb.borrower_id AND bb.borrower_type = 'teacher'
     WHERE bb.book_id = ? ORDER BY bb.borrow_date DESC`, [row.id]);
  res.json({ ...row, borrows });
}));

/* ── Create book ───────────────────────────────────── */
router.post('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.title) return res.status(400).json({ error: 'title is required' });
  const id = await qi(
    `INSERT INTO library_books (title, author, isbn, category, publisher, year_published, total_copies, available_copies, location, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [b.title, b.author || null, b.isbn || null, b.category || null, b.publisher || null,
      b.year_published || null, b.total_copies || 1, b.available_copies ?? b.total_copies ?? 1,
      b.location || null, b.status || 'active']
  );
  await audit(req, 'CREATE_BOOK', 'library_books', id, { title: b.title });
  res.status(201).json({ id });
}));

/* ── Update book ───────────────────────────────────── */
router.patch('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM library_books WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Book not found' });
  const b = req.body || {};
  const f = (k, d) => b[k] !== undefined ? b[k] : d;
  await qr(
    `UPDATE library_books SET title=?, author=?, isbn=?, category=?, publisher=?,
      year_published=?, total_copies=?, available_copies=?, location=?, status=?,
      updated_at=${nowSql()} WHERE id=?`,
    [f('title', row.title), f('author', row.author), f('isbn', row.isbn),
      f('category', row.category), f('publisher', row.publisher),
      f('year_published', row.year_published), f('total_copies', row.total_copies),
      f('available_copies', row.available_copies), f('location', row.location),
      f('status', row.status), row.id]
  );
  await audit(req, 'UPDATE_BOOK', 'library_books', row.id);
  res.json({ ok: true });
}));

/* ── Delete book ───────────────────────────────────── */
router.delete('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT id FROM library_books WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Book not found' });
  await qr('DELETE FROM library_books WHERE id = ?', [row.id]);
  await audit(req, 'DELETE_BOOK', 'library_books', row.id);
  res.json({ ok: true });
}));

/* ── Borrow book ───────────────────────────────────── */
router.post('/:id/borrow', requireRole(...WRITE), asyncH(async (req, res) => {
  const book = await q('SELECT * FROM library_books WHERE id = ?', [req.params.id]);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  if (book.available_copies <= 0) return res.status(400).json({ error: 'No copies available' });
  const b = req.body || {};
  if (!b.borrower_type || !b.borrower_id) return res.status(400).json({ error: 'borrower_type and borrower_id required' });
  const id = await qi(
    `INSERT INTO book_borrows (book_id, borrower_type, borrower_id, borrowed_by, borrow_date, due_date, notes)
     VALUES (?, ?, ?, ?, CURRENT_DATE, ?, ?)`,
    [book.id, b.borrower_type, b.borrower_id, req.user.id, b.due_date || null, b.notes || null]
  );
  await qr('UPDATE library_books SET available_copies = available_copies - 1 WHERE id = ?', [book.id]);
  await audit(req, 'BORROW_BOOK', 'book_borrows', id, { book_id: book.id });
  res.status(201).json({ id });
}));

/* ── Return book ───────────────────────────────────── */
router.post('/borrows/:id/return', requireRole(...WRITE), asyncH(async (req, res) => {
  const borrow = await q('SELECT * FROM book_borrows WHERE id = ?', [req.params.id]);
  if (!borrow) return res.status(404).json({ error: 'Borrow record not found' });
  if (borrow.status === 'returned') return res.status(400).json({ error: 'Already returned' });
  await qr(
    `UPDATE book_borrows SET status = 'returned', returned_date = CURRENT_DATE WHERE id = ?`,
    [borrow.id]
  );
  await qr('UPDATE library_books SET available_copies = available_copies + 1 WHERE id = ?', [borrow.book_id]);
  await audit(req, 'RETURN_BOOK', 'book_borrows', borrow.id);
  res.json({ ok: true });
}));

module.exports = router;
