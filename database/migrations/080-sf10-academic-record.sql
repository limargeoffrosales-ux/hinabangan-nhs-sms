-- ============================================================
-- 080: School Form 10 - Learner's Permanent Academic Record
-- Individual academic record by quarter and School Year
-- Prepared by: Class Adviser
-- Schedule: End of School Year (EoSY)
-- Note: Replaces former Form 137
-- ============================================================

-- Table: school_forms_sf10
-- Stores permanent academic record per learner

CREATE TABLE IF NOT EXISTS school_forms_sf10 (
  id SERIAL PRIMARY KEY,
  school_id VARCHAR(20) NOT NULL,
  school_year VARCHAR(15) NOT NULL,
  grade_level VARCHAR(10) NOT NULL,
  
  -- Learner information
  lrn VARCHAR(20) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  sex CHAR(1),
  date_of_birth DATE,
  age DECIMAL(3,1),
  birthplace VARCHAR(255),
  
  -- Academic record per quarter
  learning_area_1 VARCHAR(100),
  grade_1_q1 DECIMAL(5,2),
  grade_1_q2 DECIMAL(5,2),
  grade_1_q3 DECIMAL(5,2),
  grade_1_q4 DECIMAL(5,2),
  grade_1_final DECIMAL(5,2),
  
  learning_area_2 VARCHAR(100),
  grade_2_q1 DECIMAL(5,2),
  grade_2_q2 DECIMAL(5,2),
  grade_2_q3 DECIMAL(5,2),
  grade_2_q4 DECIMAL(5,2),
  grade_2_final DECIMAL(5,2),
  
  learning_area_3 VARCHAR(100),
  grade_3_q1 DECIMAL(5,2),
  grade_3_q2 DECIMAL(5,2),
  grade_3_q3 DECIMAL(5,2),
  grade_3_q4 DECIMAL(5,2),
  grade_3_final DECIMAL(5,2),
  
  learning_area_4 VARCHAR(100),
  grade_4_q1 DECIMAL(5,2),
  grade_4_q2 DECIMAL(5,2),
  grade_4_q3 DECIMAL(5,2),
  grade_4_q4 DECIMAL(5,2),
  grade_4_final DECIMAL(5,2),
  
  learning_area_5 VARCHAR(100),
  grade_5_q1 DECIMAL(5,2),
  grade_5_q2 DECIMAL(5,2),
  grade_5_q3 DECIMAL(5,2),
  grade_5_q4 DECIMAL(5,2),
  grade_5_final DECIMAL(5,2),
  
  learning_area_6 VARCHAR(100),
  grade_6_q1 DECIMAL(5,2),
  grade_6_q2 DECIMAL(5,2),
  grade_6_q3 DECIMAL(5,2),
  grade_6_q4 DECIMAL(5,2),
  grade_6_final DECIMAL(5,2),
  
  learning_area_7 VARCHAR(100),
  grade_7_q1 DECIMAL(5,2),
  grade_7_q2 DECIMAL(5,2),
  grade_7_q3 DECIMAL(5,2),
  grade_7_q4 DECIMAL(5,2),
  grade_7_final DECIMAL(5,2),
  
  -- General average per year
  general_average DECIMAL(5,2),
  
  -- Rating/Performance
  learning_strengths TEXT,
  areas_for_improvement TEXT,
  
  -- Attendance
  total_days_enrolled INT DEFAULT 0,
  total_days_present INT DEFAULT 0,
  attendance_rate DECIMAL(5,2),
  
  -- Promotion status
  promotion_status TEXT NOT NULL DEFAULT 'PROMOTED' CHECK (promotion_status IN ('PROMOTED', 'PROMOTED_WITH_COND', 'RETAINED', 'IRREGULAR')),
  
  -- Signatures
  class_adviser_signature VARCHAR(255),
  class_adviser_name VARCHAR(255),
  school_head_signature VARCHAR(255),
  school_head_name VARCHAR(255),
  
  -- Metadata
  total_learners INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  CONSTRAINT unique_sf10_record UNIQUE (school_id, school_year, lrn)
);

-- Indexes for common queries
CREATE INDEX idx_sf10_school_year ON school_forms_sf10 (school_id, school_year);
CREATE INDEX idx_sf10_lrn ON school_forms_sf10 (lrn);
CREATE INDEX idx_sf10_grade ON school_forms_sf10 (grade_level);
