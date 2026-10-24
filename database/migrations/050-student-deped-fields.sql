-- Add missing DepEd learner fields to students (SF1 / SF10 / SF9 compliance)
ALTER TABLE students ADD COLUMN IF NOT EXISTS father_name TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS mother_name TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS mother_tongue TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS learner_status TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS learner_type TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS remarks TEXT;
