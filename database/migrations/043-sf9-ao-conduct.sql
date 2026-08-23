-- 043: Update conduct ratings to use AO/SO/RO/NO (DepEd standard)

-- Drop old CHECK constraints
ALTER TABLE student_conduct_ratings DROP CONSTRAINT IF EXISTS student_conduct_ratings_makadiyos_check;
ALTER TABLE student_conduct_ratings DROP CONSTRAINT IF EXISTS student_conduct_ratings_makatao_check;
ALTER TABLE student_conduct_ratings DROP CONSTRAINT IF EXISTS student_conduct_ratings_makakalikasan_check;
ALTER TABLE student_conduct_ratings DROP CONSTRAINT IF EXISTS student_conduct_ratings_makabansa_check;

-- Migrate old values to new AO/SO/RO/NO format
UPDATE student_conduct_ratings SET makadiyos = CASE makadiyos WHEN 'always' THEN 'ao' WHEN 'often' THEN 'so' WHEN 'sometimes' THEN 'ro' WHEN 'rarely' THEN 'no' ELSE makadiyos END;
UPDATE student_conduct_ratings SET makatao = CASE makatao WHEN 'always' THEN 'ao' WHEN 'often' THEN 'so' WHEN 'sometimes' THEN 'ro' WHEN 'rarely' THEN 'no' ELSE makatao END;
UPDATE student_conduct_ratings SET makakalikasan = CASE makakalikasan WHEN 'always' THEN 'ao' WHEN 'often' THEN 'so' WHEN 'sometimes' THEN 'ro' WHEN 'rarely' THEN 'no' ELSE makakalikasan END;
UPDATE student_conduct_ratings SET makabansa = CASE makabansa WHEN 'always' THEN 'ao' WHEN 'often' THEN 'so' WHEN 'sometimes' THEN 'ro' WHEN 'rarely' THEN 'no' ELSE makabansa END;

-- Add new CHECK constraints
ALTER TABLE student_conduct_ratings ADD CONSTRAINT student_conduct_ratings_makadiyos_check CHECK (makadiyos IN ('ao','so','ro','no'));
ALTER TABLE student_conduct_ratings ADD CONSTRAINT student_conduct_ratings_makatao_check CHECK (makatao IN ('ao','so','ro','no'));
ALTER TABLE student_conduct_ratings ADD CONSTRAINT student_conduct_ratings_makakalikasan_check CHECK (makakalikasan IN ('ao','so','ro','no'));
ALTER TABLE student_conduct_ratings ADD CONSTRAINT student_conduct_ratings_makabansa_check CHECK (makabansa IN ('ao','so','ro','no'));
