-- Consent responses must be attributable to the specific student they were
-- signed for. Without this, right-to-erasure cannot remove a student's
-- consents and consent itself cannot be proven per student (RA 10173).
ALTER TABLE consent_responses ADD COLUMN IF NOT EXISTS student_id BIGINT REFERENCES students(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_consent_resp_student ON consent_responses(student_id);