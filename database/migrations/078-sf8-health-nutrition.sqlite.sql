-- ============================================================
-- 078: School Form 8 - Learner's Basic Health and Nutrition Report (SQLite)
-- Per-learner BMI and nutritional status assessment
-- Prepared by: Class Adviser / MAPEH Teacher
-- Schedule: Beginning of School Year (BoSY) and End of School Year (EoSY)
-- ============================================================

-- Table: school_forms_sf8
-- Stores learner health and nutrition data

CREATE TABLE IF NOT EXISTS school_forms_sf8 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id VARCHAR(20) NOT NULL,
  school_year VARCHAR(15) NOT NULL,
  grade_level VARCHAR(10) NOT NULL,
  
  -- Learner information
  lrn VARCHAR(20) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  sex CHAR(1),
  
  -- Physical measurements (at BoSY and EoSY)
  weight_bosy DECIMAL(5,2),
  weight_eosy DECIMAL(5,2),
  height_bosy DECIMAL(5,2),
  height_eosy DECIMAL(5,2),
  
  -- Computed BMI
  bmi_bosy DECIMAL(5,2),
  bmi_eosy DECIMAL(5,2),
  
  -- Nutritional status categories
  nutritional_status_bosy VARCHAR(20) DEFAULT 'NORMAL',
  nutritional_status_eosy VARCHAR(20) DEFAULT 'NORMAL',
  
  -- Additional health data
  chest_circumference_bosy DECIMAL(5,2),
  chest_circumference_eosy DECIMAL(5,2),
  blood_pressure_bosy VARCHAR(20),
  blood_pressure_eosy VARCHAR(20),
  
  -- Signatures
  prepared_by VARCHAR(255),
  prepared_by_name VARCHAR(255),
  school_head_signature VARCHAR(255),
  school_head_name VARCHAR(255),
  
  -- Metadata
  total_learners_measured INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ,
  
  -- Indexes
  UNIQUE (school_id, school_year, grade_level, lrn)
);

-- Indexes for common queries
-- CREATE INDEX idx_sf8_school_year_grade ON school_forms_sf8 (school_id, school_year, grade_level);
-- CREATE INDEX idx_sf8_lrn ON school_forms_sf8 (lrn);
-- CREATE INDEX idx_sf8_nutritional ON school_forms_sf8 (nutritional_status_bosy);