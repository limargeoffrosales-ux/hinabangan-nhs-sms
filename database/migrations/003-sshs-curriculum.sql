-- 003: Strengthened SHS Curriculum — subjects get term offering (First/Second/Third Term)
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS term TEXT;