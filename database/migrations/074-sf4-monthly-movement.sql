-- ============================================================
-- 074: School Form 4 - Monthly Learner's Movement and Attendance
-- Monthly enrollment movement: transferred in/out, dropout by grade level
-- Prepared by: School Head
-- Schedule: Monthly (submitted on or before 10th day of succeeding month)
-- ============================================================

-- Table: school_forms_sf4
-- Stores monthly learner movement data

CREATE TABLE IF NOT EXISTS school_forms_sf4 (
  id SERIAL PRIMARY KEY,
  school_id VARCHAR(20) NOT NULL,
  school_year VARCHAR(15) NOT NULL,
  month_reported VARCHAR(15) NOT NULL,
  
  -- Grade level breakdown
  grade_level VARCHAR(10) NOT NULL,
  
  -- Enrollment counts
  enrollment_male INT DEFAULT 0,
  enrollment_female INT DEFAULT 0,
  enrollment_total INT DEFAULT 0,
  
  -- Movement counts
  transferred_in_male INT DEFAULT 0,
  transferred_in_female INT DEFAULT 0,
  transferred_in_total INT DEFAULT 0,
  
  transferred_out_male INT DEFAULT 0,
  transferred_out_female INT DEFAULT 0,
  transferred_out_total INT DEFAULT 0,
  
  -- Dropout counts
  dropout_male INT DEFAULT 0,
  dropout_female INT DEFAULT 0,
  dropout_total INT DEFAULT 0,
  
  -- Attendance
  average_daily_attendance DECIMAL(5,2),
  percentage_attendance DECIMAL(5,2),
  
  -- Signatures
  school_head_signature VARCHAR(255),
  school_head_name VARCHAR(255),
  registered_by VARCHAR(255),
  registered_by_name VARCHAR(255),
  
  -- Metadata
  total_learners_male INT DEFAULT 0,
  total_learners_female INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  CONSTRAINT unique_sf4_record UNIQUE (school_id, school_year, month_reported, grade_level)
);

-- Indexes for common queries
CREATE INDEX idx_sf4_school_year_month ON school_forms_sf4 (school_id, school_year, month_reported);
CREATE INDEX idx_sf4_grade_level ON school_forms_sf4 (grade_level);
CREATE INDEX idx_sf4_total ON school_forms_sf4 (enrollment_total);
