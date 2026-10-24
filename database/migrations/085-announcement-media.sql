-- Migration 085: Announcement media attachments
-- Adds a media column (JSON array of {url, type, name}) to announcements so
-- admins can attach images/videos to announcements. Mirrors the achievements
-- media pattern.

ALTER TABLE announcements ADD COLUMN IF NOT EXISTS media JSONB NOT NULL DEFAULT '[]'::jsonb;