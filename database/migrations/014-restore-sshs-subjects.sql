-- 014-restore-sshs-subjects.sql
-- Restore every SHS subject from the official SSHS curriculum list that was
-- previously hidden, and assign each to its enrollment category so they appear
-- under the right group on the Enrollment page.
--
-- Two codes stay hidden because an identical subject is already offered:
--   CORE-ENTREP  (Entrepreneurship)      -> AAC-ENTREP      (offered)
--   TVL-EMPOWER  (Empowerment Tech)      -> S12-EMPOWTECH   (offered)

UPDATE subjects
SET is_offered = TRUE,
    category = CASE code
      WHEN 'AAC-ARTS1' THEN 'arts-humanities'
      WHEN 'AAC-ARTS2' THEN 'arts-humanities'
      WHEN 'STP-ANIPROD' THEN 'tvl-agri-fishery'
      WHEN 'STP-AUTO' THEN 'tvl-automotive'
      WHEN 'STP-BPP' THEN 'tvl-hospitality'
      WHEN 'STP-COOK' THEN 'tvl-hospitality'
      WHEN 'STP-DRESS' THEN 'tvl-artisanry'
      WHEN 'STP-PROG' THEN 'tvl-ict'
      WHEN 'ABM-APPECON' THEN 'business-entrepreneurship'
      WHEN 'ABM-BUSETH' THEN 'business-entrepreneurship'
      WHEN 'ABM-BUSFIN' THEN 'business-entrepreneurship'
      WHEN 'ABM-FABM2' THEN 'business-entrepreneurship'
      WHEN 'CORE-MIL' THEN 'core'
      WHEN 'CORE-PR2' THEN 'core'
      WHEN 'HUMSS-CESC' THEN 'arts-humanities'
      WHEN 'HUMSS-CRWRTG' THEN 'arts-humanities'
      WHEN 'HUMSS-DIASS' THEN 'arts-humanities'
      WHEN 'HUMSS-DISS' THEN 'arts-humanities'
      WHEN 'HUMSS-PPG' THEN 'arts-humanities'
      WHEN 'HUMSS-TRENDS' THEN 'arts-humanities'
      WHEN 'STEM-CAPSTONE' THEN 'stem'
      WHEN 'STEM-GENBIO2' THEN 'stem'
      WHEN 'STEM-GENCHEM2' THEN 'stem'
      WHEN 'STEM-GENPHYS2' THEN 'stem'
      WHEN 'STEM-PHYSCI' THEN 'stem'
      ELSE category
    END
WHERE code IN (
  'AAC-ARTS1','AAC-ARTS2',
  'STP-ANIPROD','STP-AUTO','STP-BPP','STP-COOK','STP-DRESS','STP-PROG',
  'ABM-APPECON','ABM-BUSETH','ABM-BUSFIN','ABM-FABM2',
  'CORE-MIL','CORE-PR2',
  'HUMSS-CESC','HUMSS-CRWRTG','HUMSS-DIASS','HUMSS-DISS','HUMSS-PPG','HUMSS-TRENDS',
  'STEM-CAPSTONE','STEM-GENBIO2','STEM-GENCHEM2','STEM-GENPHYS2','STEM-PHYSCI'
);
