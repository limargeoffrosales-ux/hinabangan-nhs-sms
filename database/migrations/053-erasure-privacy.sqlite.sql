ALTER TABLE consent_responses ADD COLUMN student_id INTEGER REFERENCES students(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_consent_resp_student ON consent_responses(student_id);