-- 016-user-preferences.sqlite.sql
-- Per-user preference store. The dashboard persists its view state
-- (school year / term / date) here so the data view survives refreshes
-- and is stored on the server rather than lost in the browser.

CREATE TABLE IF NOT EXISTS user_preferences (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pref_key    TEXT NOT NULL,
  pref_value  TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, pref_key)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences (user_id);
