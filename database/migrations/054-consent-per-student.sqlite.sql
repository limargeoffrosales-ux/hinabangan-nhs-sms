-- 054-consent-per-student.sqlite.sql
-- SQLite cannot DROP a UNIQUE constraint, so recreate the table with the
-- per-student unique key: a guardian may sign the same form once per child.

CREATE TABLE IF NOT EXISTS consent_responses_new (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  form_id        INTEGER NOT NULL REFERENCES consent_forms(id) ON DELETE CASCADE,
  user_id        INTEGER NOT NULL REFERENCES users(id),
  student_id     INTEGER REFERENCES students(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'signed',
  signature_name TEXT,
  ip_address     TEXT,
  signed_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (form_id, student_id, user_id)
);

INSERT INTO consent_responses_new (id, form_id, user_id, student_id, status, signature_name, ip_address, signed_at)
SELECT id, form_id, user_id, student_id, status, signature_name, ip_address, signed_at FROM consent_responses;

DROP TABLE IF EXISTS consent_responses;
ALTER TABLE consent_responses_new RENAME TO consent_responses;

CREATE INDEX IF NOT EXISTS idx_consent_resp_form ON consent_responses(form_id);
CREATE INDEX IF NOT EXISTS idx_consent_resp_user ON consent_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_resp_student ON consent_responses(student_id);