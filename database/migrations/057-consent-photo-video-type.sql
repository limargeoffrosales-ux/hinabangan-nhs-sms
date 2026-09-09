-- 057-consent-photo-video-type.sql
-- The seeded "Photo/Video Usage Consent" was marked `custom`, so the per-student
-- Signed status added by 054 (which only applies to form_type = 'photo_video')
-- never populated for it. Reclassify the seed so it behaves like every other
-- photo/video form.

UPDATE consent_forms
SET form_type = 'photo_video'
WHERE title = 'Photo/Video Usage Consent'
  AND form_type = 'custom';