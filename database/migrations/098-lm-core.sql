-- 098-lm-core.sql (PostgreSQL 16)
-- Learning Management module: spaces, modules, materials, attachments
-- Only new lm_* tables; links to existing users/teachers/sections/subjects/class_assignments/enrollments.

CREATE TABLE IF NOT EXISTS lm_spaces (
  id BIGSERIAL PRIMARY KEY,
  school_year TEXT NOT NULL,
  section_id BIGINT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  subject_id BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id BIGINT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  class_assignment_id BIGINT REFERENCES class_assignments(id) ON DELETE SET NULL,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_year, section_id, subject_id, teacher_id)
);
CREATE INDEX IF NOT EXISTS idx_lm_spaces_section ON lm_spaces(section_id);
CREATE INDEX IF NOT EXISTS idx_lm_spaces_subject ON lm_spaces(subject_id);
CREATE INDEX IF NOT EXISTS idx_lm_spaces_teacher ON lm_spaces(teacher_id);
CREATE INDEX IF NOT EXISTS idx_lm_spaces_sy ON lm_spaces(school_year);

CREATE TABLE IF NOT EXISTS lm_modules (
  id BIGSERIAL PRIMARY KEY,
  space_id BIGINT NOT NULL REFERENCES lm_spaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  quarter SMALLINT CHECK (quarter BETWEEN 1 AND 3),
  week_or_module TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lm_modules_space ON lm_modules(space_id);
CREATE INDEX IF NOT EXISTS idx_lm_modules_quarter ON lm_modules(quarter);

CREATE TABLE IF NOT EXISTS lm_materials (
  id BIGSERIAL PRIMARY KEY,
  space_id BIGINT NOT NULL REFERENCES lm_spaces(id) ON DELETE CASCADE,
  module_id BIGINT REFERENCES lm_modules(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT NOT NULL DEFAULT 'reading' CHECK (type IN ('reading','presentation','document','video','link','activity','other')),
  url TEXT,
  drive_url TEXT,
  youtube_url TEXT,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  is_remedial BOOLEAN NOT NULL DEFAULT FALSE,
  is_enrichment BOOLEAN NOT NULL DEFAULT FALSE,
  is_differentiated BOOLEAN NOT NULL DEFAULT FALSE,
  competency_id BIGINT REFERENCES competencies(id) ON DELETE SET NULL,
  dll_url TEXT,
  lesson_plan_url TEXT,
  target_student_ids JSONB,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lm_materials_space ON lm_materials(space_id);
CREATE INDEX IF NOT EXISTS idx_lm_materials_module ON lm_materials(module_id);
CREATE INDEX IF NOT EXISTS idx_lm_materials_comp ON lm_materials(competency_id);
CREATE INDEX IF NOT EXISTS idx_lm_materials_published ON lm_materials(published);

CREATE TABLE IF NOT EXISTS lm_attachments (
  id BIGSERIAL PRIMARY KEY,
  material_id BIGINT NOT NULL REFERENCES lm_materials(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  stored_key TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lm_attachments_material ON lm_attachments(material_id);
CREATE INDEX IF NOT EXISTS idx_lm_attachments_key ON lm_attachments(stored_key);

CREATE TABLE IF NOT EXISTS lm_downloads (
  id BIGSERIAL PRIMARY KEY,
  material_id BIGINT REFERENCES lm_materials(id) ON DELETE SET NULL,
  attachment_id BIGINT REFERENCES lm_attachments(id) ON DELETE SET NULL,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lm_downloads_material ON lm_downloads(material_id);
CREATE INDEX IF NOT EXISTS idx_lm_downloads_user ON lm_downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_lm_downloads_created ON lm_downloads(created_at);
