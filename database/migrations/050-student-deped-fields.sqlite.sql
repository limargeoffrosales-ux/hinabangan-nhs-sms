-- Add missing DepEd learner fields to students (SF1 / SF10 / SF9 compliance)
ALTER TABLE students ADD COLUMN father_name TEXT;
ALTER TABLE students ADD COLUMN mother_name TEXT;
ALTER TABLE students ADD COLUMN mother_tongue TEXT;
ALTER TABLE students ADD COLUMN learner_status TEXT;
ALTER TABLE students ADD COLUMN learner_type TEXT;
ALTER TABLE students ADD COLUMN remarks TEXT;
