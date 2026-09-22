-- ============================================================
-- 076: School Form 6 - Summarized Report on Promotion (SQLite)
-- Summary of promotion/retention counts by grade level
-- Prepared by: School Head
-- Schedule: End of School Year (EoSY)
-- ============================================================

-- Table: school_forms_sf6
-- Stores summarized promotion data by grade level

CREATE TABLE IF NOT EXISTS school_forms_sf6 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id VARCHAR(20) NOT NULL,
  school_year VARCHAR(15) NOT NULL,
  
  -- Grade level
  grade_level VARCHAR(10) NOT NULL,
  
  -- Promotion counts
  total_enrolled_male INT DEFAULT 0,
  total_enrolled_female INT DEFAULT 0,
  total_enrolled INT DEFAULT 0,
  
  total_promoted_male INT DEFAULT 0,
  total_promoted_female INT DEFAULT 0,
  total_promoted INT DEFAULT 0,
  
  total_retained_male INT DEFAULT 0,
  total_retained_female INT DEFAULT 0,
  total_retained INT DEFAULT 0,
  
  total_irregular_male INT DEFAULT 0,
  total_irregular_female INT DEFAULT 0,
  total_irregular INT DEFAULT 0,
  
  -- Percentage computations
  promotion_percentage DECIMAL(5,2),
  retention_percentage DECIMAL(5,2),
  
  -- Signatures
  school_head_signature VARCHAR(255),
  school_head_name VARCHAR(255),
  
  -- Metadata
  total_grade_level INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ,
  
  -- Indexes
  UNIQUE (school_id, school_year, grade_level)
);

-- Indexes for common queries
-- CREATE INDEX idx_sf6_school_year ON school_forms_sf6 (school_id, school_year);
-- CREATE INDEX idx_sf6_grade_level ON school_forms_sf6 (grade_level);