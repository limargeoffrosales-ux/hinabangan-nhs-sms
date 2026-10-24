-- ============================================================
-- 079: School Form 9 - Learner's Progress Report Card
-- Individual academic, behavioral and attendance report by quarter
-- Prepared by: Class Adviser
-- Schedule: Quarterly (EoSY of each quarter)
-- Note: Replaces former Form 138
-- ============================================================

-- Table: school_forms_sf9
-- Stores per-learner quarterly progress data

CREATE TABLE IF NOT EXISTS school_forms_sf9 (
  id SERIAL PRIMARY KEY,
  school_id VARCHAR(20) NOT NULL,
  school_year VARCHAR(15) NOT NULL,
  grade_level VARCHAR(10) NOT NULL,
  quarter VARCHAR(10) NOT NULL,
  
  -- Learner information
  lrn VARCHAR(20) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  sex CHAR(1),
  
  -- Quarterly grades per learning area
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
  
  -- General average
  general_average DECIMAL(5,2),
  
  -- Behavioral and attendance
  attendance_rate DECIMAL(5,2),
  behavioral_rating VARCHAR(50),
  outstanding_subjects VARCHAR(255),
  
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
  CONSTRAINT unique_sf9_record UNIQUE (school_id, school_year, grade_level, quarter, lrn)
);

-- Indexes for common queries
CREATE INDEX idx_sf9_school_year_grade_quarter ON school_forms_sf9 (school_id, school_year, grade_level, quarter);
CREATE INDEX idx_sf9_lrn ON school_forms_sf9 (lrn);
CREATE INDEX idx_sf9_promotion ON school_forms_sf9 (promotion_status);
