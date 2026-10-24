-- ============================================================
-- 081: Summary of Grades (SQLite)
-- Computed grades per subject per quarter with general average
-- Prepared by: Class Adviser / Registrar
-- Schedule: End of each Grading Period / End of School Year
-- ============================================================

-- Table: summary_of_grades
-- Stores computed grade summaries per student per subject

CREATE TABLE IF NOT EXISTS summary_of_grades (
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
  
  -- Subject areas with per-quarter grades
  -- MATATAG 25-50-25 grading system: Written Works (25%), Performance Tasks (50%), Quarterly Assessment (25%)
  
  -- Subject 1
  subject_1 VARCHAR(100),
  written_works_1 DECIMAL(5,2),
  performance_tasks_1 DECIMAL(5,2),
  quarterly_assessment_1 DECIMAL(5,2),
  final_grade_1 DECIMAL(5,2),
  
  -- Subject 2
  subject_2 VARCHAR(100),
  written_works_2 DECIMAL(5,2),
  performance_tasks_2 DECIMAL(5,2),
  quarterly_assessment_2 DECIMAL(5,2),
  final_grade_2 DECIMAL(5,2),
  
  -- Subject 3
  subject_3 VARCHAR(100),
  written_works_3 DECIMAL(5,2),
  performance_tasks_3 DECIMAL(5,2),
  quarterly_assessment_3 DECIMAL(5,2),
  final_grade_3 DECIMAL(5,2),
  
  -- Subject 4
  subject_4 VARCHAR(100),
  written_works_4 DECIMAL(5,2),
  performance_tasks_4 DECIMAL(5,2),
  quarterly_assessment_4 DECIMAL(5,2),
  final_grade_4 DECIMAL(5,2),
  
  -- Subject 5 (optional for SHS)
  subject_5 VARCHAR(100),
  written_works_5 DECIMAL(5,2),
  performance_tasks_5 DECIMAL(5,2),
  quarterly_assessment_5 DECIMAL(5,2),
  final_grade_5 DECIMAL(5,2),
  
  -- Subject 6 (optional for SHS)
  subject_6 VARCHAR(100),
  written_works_6 DECIMAL(5,2),
  performance_tasks_6 DECIMAL(5,2),
  quarterly_assessment_6 DECIMAL(5,2),
  final_grade_6 DECIMAL(5,2),
  
  -- General average across all subjects
  general_average DECIMAL(5,2),
  class_standing DECIMAL(5,2),
  percentile_rank DECIMAL(5,2),
  
  -- Honor status
  honor_status VARCHAR(20) DEFAULT 'NONE',
  
  -- Attendance
  total_days_enrolled INT DEFAULT 0,
  total_days_present INT DEFAULT 0,
  attendance_rate DECIMAL(5,2),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ,
  
  -- Indexes
  UNIQUE (school_id, school_year, grade_level, lrn)
);

-- Indexes for common queries
-- CREATE INDEX idx_summary_school_year ON summary_of_grades (school_id, school_year);
-- CREATE INDEX idx_summary_lrn ON summary_of_grades (lrn);
-- CREATE INDEX idx_summary_grade_level ON summary_of_grades (grade_level);
-- CREATE INDEX idx_summary_honor ON summary_of_grades (honor_status);