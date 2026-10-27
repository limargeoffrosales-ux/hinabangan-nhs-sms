const express = require('express');
const { q, qa, qi, qr } = require('../db');
const { authenticate } = require('../auth');
const { asyncH, audit } = require('../utils');

const router = express.Router();
router.use(authenticate);

// GET /messages — list messages sent or received by current user
router.get('/', asyncH(async (req, res) => {
  const userId = req.user.id;
  const rows = await qa(
    `SELECT m.*,
            s.name AS sender_name, r.name AS recipient_name,
            st.first_name AS student_first, st.last_name AS student_last
     FROM messages m
     LEFT JOIN users s ON s.id = m.sender_id
     LEFT JOIN users r ON r.id = m.recipient_id
     LEFT JOIN students st ON st.id = m.student_id
     WHERE m.sender_id = ? OR m.recipient_id = ?
     ORDER BY m.created_at DESC LIMIT 100`,
    [userId, userId]
  );
  res.json({ data: rows });
}));

// POST /messages — send a message to a parent, teacher, or advisor
router.post('/', asyncH(async (req, res) => {
  const b = req.body || {};
  const recipient_id = Number(b.recipient_id);
  const student_id = b.student_id ? Number(b.student_id) : null;
  const subject = String(b.subject || '').trim() || 'Parent-Teacher Communication';
  const body = String(b.body || '').trim();

  if (!recipient_id) return res.status(400).json({ error: 'Recipient is required' });
  if (!body) return res.status(400).json({ error: 'Message body is required' });

  const id = await qi(
    `INSERT INTO messages (sender_id, recipient_id, student_id, subject, body) VALUES (?, ?, ?, ?, ?)`,
    [req.user.id, recipient_id, student_id, subject, body]
  );
  await audit(req, 'SEND_MESSAGE', 'messages', id, { recipient_id, student_id });
  res.json({ ok: true, id });
}));

// PATCH /messages/:id/read — mark message as read
router.patch('/:id/read', asyncH(async (req, res) => {
  const msgId = req.params.id;
  await qr(
    `UPDATE messages SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND recipient_id = ?`,
    [msgId, req.user.id]
  );
  res.json({ ok: true });
}));

module.exports = router;
