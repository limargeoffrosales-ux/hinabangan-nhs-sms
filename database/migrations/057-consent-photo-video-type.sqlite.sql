-- 057-consent-photo-video-type.sqlite.sql
-- Same as the PostgreSQL migration: reclassify the seeded photo/video consent
-- so the per-student Signed status (054) actually applies to it.

UPDATE consent_forms
SET form_type = 'photo_video'
WHERE title = 'Photo/Video Usage Consent'
  AND form_type = 'custom';