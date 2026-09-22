-- ============================================================
-- 075: School Form 5 - Report on Promotion & Level of Proficiency
-- Per-learner promotion status and grades per subject area
-- Prepared by: Class Adviser
-- Schedule: End of School Year (EoSY)
-- ============================================================

-- Table: school_forms_sf5
-- Stores promotion and proficiency data per learner

CREATE TABLE IF NOT EXISTS school_forms_sf5 (
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
  
  -- Subject areas and grades per quarter
  -- Quarter 1-4 grades, plus final grade
  subject_1_v1 VARCHAR(100),
  grade_1_q1 DECIMAL(5,2),
  grade_1_q2 DECIMAL(5,2),
  grade_1_q3 DECIMAL(5,2),
  grade_1_q4 DECIMAL(5,2),
  grade_1_final DECIMAL(5,2),
  
  subject_2_v1 VARCHAR(100),
  grade_2_q1 DECIMAL(5,2),
  grade_2_q2 DECIMAL(5,2),
  grade_2_q3 DECIMAL(5,2),
  grade_2_q4 DECIMAL(5,2),
  grade_2_final DECIMAL(5,2),
  
  subject_3_v1 VARCHAR(100),
  grade_3_q1 DECIMAL(5,2),
  grade_3_q2 DECIMAL(5,2),
  grade_3_q3 DECIMAL(5,2),
  grade_3_q4 DECIMAL(5,2),
  grade_3_final DECIMAL(5,2),
  
  subject_4_v1 VARCHAR(100),
  grade_4_q1 DECIMAL(5,2),
  grade_4_q2 DECIMAL(5,2),
  grade_4_q3 DECIMAL(5,2),
  grade_4_q4 DECIMAL(5,2),
  grade_4_final DECIMAL(5,2),
  
  subject_5_v1 VARCHAR(100),
  grade_5_q1 DECIMAL(5,2),
  grade_5_q2 DECIMAL(5,2),
  grade_5_q3 DECIMAL(5,2),
  grade_5_q4 DECIMAL(5,2),
  grade_5_final DECIMAL(5,2),
  
  subject_6_v1 VARCHAR(100),
  grade_6_q1 DECIMAL(5,2),
  grade_6_q2 DECIMAL(5,2),
  grade_6_q3 DECIMAL(5,2),
  grade_6_q4 DECIMAL(5,2),
  grade_6_final DECIMAL(5,2),
  
  subject_7_v1 VARCHAR(100),
  grade_7_q1 DECIMAL(5,2),
  grade_7_q2 DECIMAL(5,2),
  grade_7_q3 DECIMAL(5,2),
  grade_7_q4 DECIMAL(5,2),
  grade_7_final DECIMAL(5,2),
  
  subject_8_v1 VARCHAR(100),
  grade_8_q1 DECIMAL(5,2),
  grade_8_q2 DECIMAL(5,2),
  grade_8_q3 DECIMAL(5,2),
  grade_8_q4 DECIMAL(5,2),
  grade_8_final DECIMAL(5,2),
  
  -- General average
  general_average DECIMAL(5,2),
  
  -- Promotion status
  promotion_status TEXT NOT NULL DEFAULT 'PROMOTED' CHECK (promotion_status IN ('PROMOTED', 'PROMOTED_WITH_COND', 'RETAINED', 'IRREGULAR')),
  
  -- Remarks
  remarks TEXT,
  
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
  CONSTRAINT unique_sf5_record UNIQUE (school_id, school_year, grade_level, lrn)
);

-- Indexes for common queries
CREATE INDEX idx_sf5_school_year_grade ON school_forms_sf5 (school_id, school_year, grade_level);
CREATE INDEX idx_sf5_lrn ON school_forms_sf5 (lrn);
CREATE INDEX idx_sf5_promotion ON school_forms_sf5 (promotion_status);
