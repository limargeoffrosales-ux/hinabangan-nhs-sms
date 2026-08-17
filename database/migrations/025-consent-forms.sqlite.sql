-- 025-consent-forms.sqlite.sql

CREATE TABLE IF NOT EXISTS consent_forms (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  description   TEXT,
  content       TEXT NOT NULL,
  form_type     TEXT NOT NULL DEFAULT 'custom',
  is_active     INTEGER NOT NULL DEFAULT 1,
  require_sign  INTEGER NOT NULL DEFAULT 1,
  created_by    INTEGER REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS consent_responses (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  form_id       INTEGER NOT NULL REFERENCES consent_forms(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  status        TEXT NOT NULL DEFAULT 'signed',
  signature_name TEXT,
  ip_address    TEXT,
  signed_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(form_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_consent_resp_form ON consent_responses(form_id);
CREATE INDEX IF NOT EXISTS idx_consent_resp_user ON consent_responses(user_id);

INSERT OR IGNORE INTO consent_forms (title, description, content, form_type, is_active, require_sign) VALUES
('Data Privacy Consent — RA 10173', 'Mandatory consent for collection and processing of personal data under the Philippine Data Privacy Act of 2012.',
 'I, _________________________, parent/legal guardian of _________________________, hereby consent to the collection, recording, and processing of personal data of my child/ward by Hinabangan National High School.',
 'data_privacy', 1, 1),
('Photo/Video Usage Consent', 'Consent for use of student photographs and video in school publications and media.',
 'I, _________________________, parent/legal guardian of _________________________, grant permission for the school to take and use photographs/video of my child.',
 'custom', 1, 1),
('AI Features Usage Agreement', 'Consent for student use of AI-powered features in the school management system.',
 'I, _________________________, parent/legal guardian of _________________________, acknowledge and consent to the use of AI-powered features within the school management system.',
 'custom', 1, 1);
