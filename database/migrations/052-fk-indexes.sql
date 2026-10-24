-- Add index support for frequently joined FK columns. Improves cascade/lookup
-- performance on the two busiest child tables (enrollments -> subjects,
-- intervention plans -> contacts) and speeds up filtered list reads.
CREATE INDEX IF NOT EXISTS idx_enroll_subj_enrollment ON enrollment_subjects (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_interv_contact_plan ON intervention_contacts (plan_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs (action, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_channel ON notifications (channel);