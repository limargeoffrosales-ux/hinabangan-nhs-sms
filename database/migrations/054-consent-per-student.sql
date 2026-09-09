-- 054-consent-per-student.sql
-- Consent signatures are per student (per data privacy / photo-video consent of a minor),
-- so a guardian may sign the same form once for each of their children.

ALTER TABLE consent_responses DROP CONSTRAINT IF EXISTS consent_responses_form_id_user_id_key;
ALTER TABLE consent_responses ADD CONSTRAINT consent_responses_form_id_student_user_key UNIQUE (form_id, student_id, user_id);