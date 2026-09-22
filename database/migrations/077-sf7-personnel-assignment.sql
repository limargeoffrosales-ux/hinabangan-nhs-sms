-- ============================================================
-- 077: School Form 7 - School Personnel Assignment List and Basic Profile
-- List of teaching and non-teaching personnel with basic profile
-- Prepared by: School Head
-- Schedule: Beginning of School Year (BoSY) and as needed
-- ============================================================

-- Table: school_forms_sf7
-- Stores school personnel assignment data

CREATE TABLE IF NOT EXISTS school_forms_sf7 (
  id SERIAL PRIMARY KEY,
  school_id VARCHAR(20) NOT NULL,
  school_year VARCHAR(15) NOT NULL,
  
  -- Personnel information
  last_name VARCHAR(100) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  
  -- Position/Designation
  position VARCHAR(100) NOT NULL,
  rank_salary_group VARCHAR(50),
  status TEXT NOT NULL DEFAULT 'TEACHING' CHECK (status IN ('TEACHING', 'NON_TEACHING', 'OIC')),
  
  -- Assignment details
  assigned_grade_level VARCHAR(10),
  assigned_section VARCHAR(10),
  teaching_load_per_week DECIMAL(5,2),
  number_of_classes INT DEFAULT 0,
  
  -- Profile information
  civil_status VARCHAR(20),
  date_of_birth DATE,
  place_of_birth VARCHAR(255),
  email VARCHAR(100),
  contact_number VARCHAR(20),
  
  -- Education background
  highest_education VARCHAR(100),
  major_field_of_study VARCHAR(100),
  license_number VARCHAR(50),
  license_valid_until DATE,
  
  -- Employment information
  date_appointed DATE,
  date_served DATE,
  name_of_school_previous VARCHAR(255),
  
  -- Signatures
  school_head_signature VARCHAR(255),
  school_head_name VARCHAR(255),
  
  -- Metadata
  total_teaching INT DEFAULT 0,
  total_nonteaching INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  CONSTRAINT unique_sf7_record UNIQUE (school_id, school_year, last_name, first_name, middle_name)
);

-- Indexes for common queries
CREATE INDEX idx_sf7_school_year ON school_forms_sf7 (school_id, school_year);
CREATE INDEX idx_sf7_position ON school_forms_sf7 (position);
CREATE INDEX idx_sf7_status ON school_forms_sf7 (status);
