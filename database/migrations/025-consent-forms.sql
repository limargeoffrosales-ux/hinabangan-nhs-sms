-- 025-consent-forms.sql
-- Digital consent forms: admin-managed templates (RA 10173 data privacy + custom)
-- and portal-side digital signing by parents/students.

CREATE TABLE consent_forms (
  id            BIGSERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  content       TEXT NOT NULL,
  form_type     TEXT NOT NULL DEFAULT 'custom',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  require_sign  BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    BIGINT REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE consent_responses (
  id            BIGSERIAL PRIMARY KEY,
  form_id       BIGINT NOT NULL REFERENCES consent_forms(id) ON DELETE CASCADE,
  user_id       BIGINT NOT NULL REFERENCES users(id),
  status        TEXT NOT NULL DEFAULT 'signed',
  signature_name TEXT,
  ip_address    TEXT,
  signed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(form_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_consent_resp_form ON consent_responses(form_id);
CREATE INDEX IF NOT EXISTS idx_consent_resp_user ON consent_responses(user_id);

-- Seed default RA 10173 data privacy consent template
INSERT INTO consent_forms (title, description, content, form_type, is_active, require_sign) VALUES
(
  'Data Privacy Consent — RA 10173',
  'Mandatory consent for collection and processing of personal data under the Philippine Data Privacy Act of 2012.',
  E'I, _________________________, parent/legal guardian of _________________________, hereby consent to the collection, recording, and processing of personal data of my child/ward by Hinabangan National High School for the following purposes:\n\n'
  E'1. Student enrollment, academic records, and grading.\n'
  E'2. Attendance monitoring and reporting.\n'
  E'3. Health and safety records.\n'
  E'4. Communication via email, SMS, or the school portal.\n'
  E'5. AI-assisted document generation and analytics (no personally identifiable information is shared externally).\n\n'
  E'Under RA 10173, I understand that:\n'
  E'- The school will protect the confidentiality of the data collected.\n'
  E'- Data will not be shared with third parties without explicit consent, except as required by law.\n'
  E'- I may withdraw consent at any time by contacting the school registrar.\n'
  E'- I have the right to access, correct, or request deletion of my child''s data.\n\n'
  E'Signed this ______ day of _________________, 20_____.\n\n'
  E'Parent/Legal Guardian Signature: ______________________________\n'
  E'Printed Name: ______________________________\n'
  E'Contact No.: ______________________________',
  'data_privacy',
  TRUE,
  TRUE
),
(
  'Photo/Video Usage Consent',
  'Consent for use of student photographs and video in school publications and media.',
  E'I, _________________________, parent/legal guardian of _________________________, student of Hinabangan National High School, hereby grant permission for the school to:\n\n'
  E'1. Take photographs and video recordings of my child during school activities, events, and classes.\n'
  E'2. Use such photographs and video in school publications, website, social media, and promotional materials.\n'
  E'3. Share images with DepEd for official reporting and recognition purposes.\n\n'
  E'I understand that:\n'
  E'- My child''s full name will NOT be published alongside photographs unless separately consented.\n'
  E'- I may request removal of specific images by contacting the school.\n'
  E'- This consent does not authorize commercial use of my child''s image.\n\n'
  E'Signed this ______ day of _________________, 20_____.\n\n'
  E'Parent/Legal Guardian Signature: ______________________________\n'
  E'Printed Name: ______________________________',
  'custom',
  TRUE,
  TRUE
),
(
  'AI Features Usage Agreement',
  'Consent for student use of AI-powered features in the school management system.',
  E'I, _________________________, parent/legal guardian of _________________________, acknowledge and consent to the use of AI-powered features within the Hinabangan NHS school management system, including:\n\n'
  E'1. AI document generation for school forms and reports.\n'
  E'2. AI-assisted reading level assessment.\n'
  E'3. Learner risk prediction analytics.\n'
  E'4. AI chatbot for DepEd policy inquiries.\n\n'
  E'I understand that:\n'
  E'- No personally identifiable student data is transmitted to external AI services.\n'
  E'- AI-generated outputs are reviewed by school staff before use.\n'
  E'- AI recommendations are advisory only and do not replace professional judgment.\n'
  E'- The school maintains data privacy standards in compliance with RA 10173.\n\n'
  E'Signed this ______ day of _________________, 20_____.\n\n'
  E'Parent/Legal Guardian Signature: ______________________________\n'
  E'Printed Name: ______________________________',
  'custom',
  TRUE,
  TRUE
);
