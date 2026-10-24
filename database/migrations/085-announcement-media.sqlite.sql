-- Migration 085: Announcement media attachments (SQLite mirror)
-- Mirrors the PG migration — media is a JSON array of {url, type, name}.

ALTER TABLE announcements ADD COLUMN media TEXT NOT NULL DEFAULT '[]';