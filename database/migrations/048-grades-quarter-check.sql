-- Tighten quarter CHECK to match 3-term system (terms 1-3 only)
ALTER TABLE grades DROP CONSTRAINT IF EXISTS grades_quarter_check;
ALTER TABLE grades ADD CONSTRAINT grades_quarter_check CHECK (quarter BETWEEN 1 AND 3);
