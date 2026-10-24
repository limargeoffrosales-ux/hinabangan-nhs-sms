-- ============================================================
-- 072: School Form 2 - Daily Attendance Report of Learners (SQLite)
-- Daily attendance tracking per learner
-- Prepared by: Class Adviser
-- Schedule: Daily (submitted monthly to Principal)
-- ============================================================

-- Table: school_forms_sf2
-- Stores daily attendance records for each learner

CREATE TABLE IF NOT EXISTS school_forms_sf2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id VARCHAR(20) NOT NULL,
  school_year VARCHAR(15) NOT NULL,
  grade_level VARCHAR(10) NOT NULL,
  section VARCHAR(10) NOT NULL,
  date_reported DATE NOT NULL,
  month_reported VARCHAR(15) NOT NULL,
  
  -- Learner information
  lrn VARCHAR(20) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  sex CHAR(1),
  grade_level_original VARCHAR(10),
  
  -- Daily attendance records (M T W Th F)
  -- Status codes: blank=Present, x=Absent, Tardy=Late
  -- Stored as JSON array of daily statuses per day of month
  daily_status JSON NOT NULL,
  
  -- Monthly summaries
  total_present INT DEFAULT 0,
  total_absent INT DEFAULT 0,
  total_tardy INT DEFAULT 0,
  total_half_day INT DEFAULT 0,
  
  -- Computed fields
  average_daily_attendance DECIMAL(5,2),
  percentage_attendance DECIMAL(5,2),
  
  -- Promotion/Retention
  promotion_status VARCHAR(20) DEFAULT 'PROMOTED',
  
  -- Remarks
  remarks TEXT,
  
  -- Signatures
  teacher_signature VARCHAR(255),
  teacher_name VARCHAR(255),
  school_head_signature VARCHAR(255),
  school_head_name VARCHAR(255),
  
  -- Metadata
  total_learners_in_section INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ,
  
  -- Indexes
  UNIQUE (school_id, school_year, grade_level, section, lrn, date_reported)
);

-- Indexes for common queries
CREATE INDEX idx_sf2_school_year_grade_month ON school_forms_sf2 (school_id, school_year, grade_level, section, month_reported);
CREATE INDEX idx_sf2_lrn ON school_forms_sf2 (lrn);
CREATE INDEX idx_sf2_date_reported ON school_forms_sf2 (date_reported);
CREATE INDEX idx_sf2_promotion ON school_forms_sf2 (promotion_status);