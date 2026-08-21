-- Migration 040: Add file upload infrastructure
-- Adds files_json to report_submissions for attachment tracking
-- Ensures photo_url column exists on students (may already exist)

-- report_submissions: file attachments JSON column
ALTER TABLE report_submissions ADD COLUMN IF NOT EXISTS files_json TEXT;

-- students: ensure photo_url exists (may already exist from 001)
-- ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_url TEXT;
-- (photo_url already exists in core schema)
