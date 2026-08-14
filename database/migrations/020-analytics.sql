-- 020-analytics.sql
-- Postgres variant: GPA / class rank / honor roll support.

CREATE INDEX IF NOT EXISTS idx_grades_sy_q_grade ON grades (school_year, quarter, computed_grade);

INSERT INTO app_settings (key, value) VALUES
  ('honor_roll', '{"highest":98,"high":95,"honors":90,"floors":{"highest":90,"high":90,"honors":80}}')
  ON CONFLICT (key) DO NOTHING;
