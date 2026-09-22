-- ============================================================
-- 071: School Form 1 - School Register
-- Master list of class enrollment
-- Prepared by: Class Adviser
-- Schedule: Beginning of School Year (BoSY) and as needed
-- ============================================================

-- Table: school_forms_sf1
-- Stores the master list of enrolled learners per class section

CREATE TABLE IF NOT EXISTS school_forms_sf1 (
  id SERIAL PRIMARY KEY,
  school_id VARCHAR(20) NOT NULL,
  school_year VARCHAR(15) NOT NULL,
  grade_level VARCHAR(10) NOT NULL,
  section VARCHAR(10) NOT NULL,
  date_reported DATE NOT NULL,
  
  -- School information
  school_name VARCHAR(255) NOT NULL,
  division VARCHAR(100) NOT NULL,
  district VARCHAR(100) NOT NULL,
  
  -- Learner information per row
  lrn VARCHAR(20) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  sex TEXT NOT NULL CHECK (sex IN ('M', 'F')),
  age_as_of_june DECIMAL(3,1),
  birth_date DATE,
  mother_tongue VARCHAR(50),
  
  -- Enrollment status
  status TEXT NOT NULL DEFAULT 'ENROLLED' CHECK (status IN ('ENROLLED', 'WITHDRAWN', 'TRANSFERRED_OUT', 'LATE_ENROLMENT')),
  date_enrolled DATE,
  date_graduated DATE,
  
  -- Monthly tracking
  date_reported_month DATE,
  registered_learner SMALLINT DEFAULT 1,
  
  -- Signatures
  teacher_signature VARCHAR(255),
  teacher_name VARCHAR(255),
  school_head_signature VARCHAR(255),
  school_head_name VARCHAR(255),
  
  -- Metadata
  total_male INT DEFAULT 0,
  total_female INT DEFAULT 0,
  total_learners INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique constraint per school/year/grade/section
  CONSTRAINT unique_sf1_record UNIQUE (school_id, school_year, grade_level, section, lrn)
);

-- Indexes for common queries
CREATE INDEX idx_sf1_school_year_grade ON school_forms_sf1 (school_id, school_year, grade_level, section);
CREATE INDEX idx_sf1_lrn ON school_forms_sf1 (lrn);
CREATE INDEX idx_sf1_date_reported ON school_forms_sf1 (date_reported);
