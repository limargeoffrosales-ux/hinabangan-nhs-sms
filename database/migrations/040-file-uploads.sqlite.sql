-- Migration 040 (SQLite): Add file upload infrastructure
ALTER TABLE report_submissions ADD COLUMN files_json TEXT;
