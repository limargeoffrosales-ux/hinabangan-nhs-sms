-- ============================================================
-- 073: School Form 3 - Books Issued and Returned (SQLite)
-- Tracks textbooks issued to and returned by learners
-- Prepared by: Class Adviser
-- Schedule: Beginning of School Year (BoSY) and End of School Year (EoSY)
-- ============================================================

-- Table: school_forms_sf3
-- Stores textbook issuance and return records

CREATE TABLE IF NOT EXISTS school_forms_sf3 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id VARCHAR(20) NOT NULL,
  school_year VARCHAR(15) NOT NULL,
  grade_level VARCHAR(10),
  section VARCHAR(10),

  -- Book information
  subject_area_title VARCHAR(200) NOT NULL,
  date_issued DATE,
  date_returned DATE,

  -- Return codes: FM=Force Majeure, TDO=Transferred/Dropout, NEG=Negligence
  remark_action_taken VARCHAR(50),

  -- Learner information
  lrn VARCHAR(20) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  sex CHAR(1),

  -- Quantity
  copies_issued INT DEFAULT 1,
  copies_returned INT DEFAULT 0,

  -- Signatures
  prepared_by VARCHAR(255),
  prepared_by_name VARCHAR(255),
  school_head_signature VARCHAR(255),
  school_head_name VARCHAR(255),

  -- Metadata
  total_male INT DEFAULT 0,
  total_female INT DEFAULT 0,
  total_learners INT DEFAULT 0,
  total_copies_issued INT DEFAULT 0,
  total_copies_returned INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sf3_school_year_grade ON school_forms_sf3 (school_id, school_year, grade_level, section);
CREATE INDEX IF NOT EXISTS idx_sf3_lrn ON school_forms_sf3 (lrn);
CREATE INDEX IF NOT EXISTS idx_sf3_subject ON school_forms_sf3 (subject_area_title);