CREATE TABLE IF NOT EXISTS consent_forms (
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

CREATE TABLE IF NOT EXISTS consent_responses (
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

INSERT INTO consent_forms (title, description, content, form_type, is_active, require_sign) VALUES
(
  'Data Privacy Consent — RA 10173',
  'Mandatory consent for collection and processing of personal data under the Philippine Data Privacy Act of 2012.',
  $c$I, _________________________, parent/legal guardian of _________________________, hereby consent to the collection, recording, and processing of personal data of my child/ward by Hinabangan National High School for the following purposes:


1. Student enrollment, academic records, and grading.
2. Attendance monitoring and reporting.
3. Health and safety records.
4. Communication via email, SMS, or the school portal.
5. AI-assisted document generation and analytics (no personally identifiable information is shared externally).

Under RA 10173, I understand that:
- The school will protect the confidentiality of the data collected.
- Data will not be shared with third parties without explicit consent, except as required by law.
- I may withdraw consent at any time by contacting the school registrar.
- I have the right to access, correct, or request deletion of my child's data.

Signed this ______ day of _________________, 20_____.

Parent/Legal Guardian Signature: ______________________________
Printed Name: ______________________________
Contact No.: ______________________________$c$,
  'data_privacy',
  TRUE,
  TRUE
),
(
  'Photo/Video Usage Consent',
  'Consent for use of student photographs and video in school publications and media.',
  $c$I, _________________________, parent/legal guardian of _________________________, student of Hinabangan National High School, hereby grant permission for the school to:

1. Take photographs and video recordings of my child during school activities, events, and classes.
2. Use such photographs and video in school publications, website, social media, and promotional materials.
3. Share images with DepEd for official reporting and recognition purposes.

I understand that:
- My child's full name will NOT be published alongside photographs unless separately consented.
- I may request removal of specific images by contacting the school.
- This consent does not authorize commercial use of my child's image.

Signed this ______ day of _________________, 20_____.

Parent/Legal Guardian Signature: ______________________________
Printed Name: ______________________________$c$,
  'custom',
  TRUE,
  TRUE
),
(
  'AI Features Usage Agreement',
  'Consent for student use of AI-powered features in the school management system.',
  $c$I, _________________________, parent/legal guardian of _________________________, acknowledge and consent to the use of AI-powered features within the Hinabangan NHS school management system, including:

1. AI document generation for school forms and reports.
2. AI-assisted reading level assessment.
3. Learner risk prediction analytics.
4. AI chatbot for DepEd policy inquiries.

I understand that:
- No personally identifiable student data is transmitted to external AI services.
- AI-generated outputs are reviewed by school staff before use.
- AI recommendations are advisory only and do not replace professional judgment.
- The school maintains data privacy standards in compliance with RA 10173.

Signed this ______ day of _________________, 20_____.

Parent/Legal Guardian Signature: ______________________________
Printed Name: ______________________________$c$,
  'custom',
  TRUE,
  TRUE
);
