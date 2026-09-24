-- Migration 086: Tandaya Sport News & Announcements (SQLite mirror)
-- Mirrors the PG migration. media is a JSON array of {url, type, name}.

CREATE TABLE IF NOT EXISTS sports_posts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'announcement',
  status      TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft', 'pinned')),
  audience    TEXT NOT NULL DEFAULT 'all',
  author_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  media       TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sports_posts_status_category ON sports_posts (status, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sports_posts_author ON sports_posts (author_id);

INSERT INTO sports_posts (title, body, category, status, audience, author_id, media)
SELECT
  'Welcome to Tandaya Sport News',
  'Kusog Tandaya, Hugar Samar! This is the official news & announcements board for the Division Sports Meet. Photos, videos, and files will be posted here.',
  'announcement',
  'pinned',
  'all',
  u.id,
  '[]'
FROM users u
WHERE u.username = 'superadmin'
  AND NOT EXISTS (SELECT 1 FROM sports_posts WHERE title = 'Welcome to Tandaya Sport News')
LIMIT 1;