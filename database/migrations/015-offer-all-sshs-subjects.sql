-- 015-offer-all-sshs-subjects.sql
-- Per school decision: EVERY subject in the official SSHS curriculum list is
-- offered again (nothing hidden, nothing missing). Covers the last two codes
-- intentionally left hidden in 014 because a near-identical subject existed.
-- Admins can still unoffer any subject individually via the Subjects page.

UPDATE subjects
SET is_offered = TRUE,
    category = CASE
      WHEN code = 'CORE-ENTREP' THEN 'business-entrepreneurship'
      WHEN code = 'TVL-EMPOWER' THEN 'core'
      ELSE category
    END
WHERE code IN ('CORE-ENTREP', 'TVL-EMPOWER');
