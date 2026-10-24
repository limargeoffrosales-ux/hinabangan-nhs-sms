-- Migration 035: Add room_id FK to schedule_entries + schema fixes
-- Fixes rooms.routes.js crash (queries room_id but column didn't exist)

-- ── Add room_id to schedule_entries ────────────────────────────────
ALTER TABLE schedule_entries ADD COLUMN room_id BIGINT REFERENCES rooms(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_schedule_room ON schedule_entries(room_id);

-- Backfill room_id from room TEXT by matching rooms.name
UPDATE schedule_entries se
   SET room_id = r.id
  FROM rooms r
 WHERE se.room = r.name
   AND se.room_id IS NULL;

-- ── Add missing ON DELETE clauses ──────────────────────────────────
-- Consent forms: prevent user deletion FK violation
ALTER TABLE consent_forms DROP CONSTRAINT IF EXISTS consent_forms_created_by_fkey;
ALTER TABLE consent_forms ADD CONSTRAINT consent_forms_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE consent_responses DROP CONSTRAINT IF EXISTS consent_responses_user_id_fkey;
ALTER TABLE consent_responses ADD CONSTRAINT consent_responses_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Data erasure requests
ALTER TABLE data_erasure_requests DROP CONSTRAINT IF EXISTS data_erasure_requests_requested_by_fkey;
ALTER TABLE data_erasure_requests ADD CONSTRAINT data_erasure_requests_requested_by_fkey
  FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE data_erasure_requests DROP CONSTRAINT IF EXISTS data_erasure_requests_processed_by_fkey;
ALTER TABLE data_erasure_requests ADD CONSTRAINT data_erasure_requests_processed_by_fkey
  FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL;

-- ── Add missing FK constraints ────────────────────────────────────
ALTER TABLE data_access_logs ADD CONSTRAINT data_access_logs_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL;

ALTER TABLE security_incidents ADD CONSTRAINT security_incidents_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE security_incidents ADD CONSTRAINT security_incidents_resolved_by_fkey
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL;

-- ── Add missing indexes on FK columns ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_parent_students_parent  ON parent_students(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_parent_students_student ON parent_students(student_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_competency_scores_section ON student_competency_scores(section_id);
CREATE INDEX IF NOT EXISTS idx_research_versions_project ON research_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_research_milestones_project ON research_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_report_submissions_teacher ON report_submissions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_lessons_scheduled ON lessons(scheduled_date);
