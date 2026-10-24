CREATE TABLE IF NOT EXISTS achievements (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  author_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'academic', 'sports', 'arts', 'community', 'competition', 'milestone')),
  media JSONB DEFAULT '[]'::jsonb,
  visibility TEXT NOT NULL DEFAULT 'school' CHECK (visibility IN ('school', 'staff', 'public')),
  pinned BOOLEAN DEFAULT FALSE,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_achievements_author ON achievements(author_id);
CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);
CREATE INDEX IF NOT EXISTS idx_achievements_created ON achievements(created_at DESC);

CREATE TABLE IF NOT EXISTS achievement_comments (
  id BIGSERIAL PRIMARY KEY,
  achievement_id BIGINT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  author_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_achievement_comments_achievement ON achievement_comments(achievement_id);

CREATE TABLE IF NOT EXISTS achievement_likes (
  id BIGSERIAL PRIMARY KEY,
  achievement_id BIGINT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (achievement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_achievement_likes_achievement ON achievement_likes(achievement_id);
