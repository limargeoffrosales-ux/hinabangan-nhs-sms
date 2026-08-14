-- 019-grading-scales.sqlite.sql
-- SQLite variant: configurable grading scales + per-subject scale override.

CREATE TABLE grading_scales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  scale_type TEXT NOT NULL DEFAULT 'numeric',
  description TEXT,
  passing_grade REAL NOT NULL DEFAULT 75.00,
  weights TEXT NOT NULL DEFAULT '{"written_work":25,"performance_task":45,"quarterly_exam":30}',
  bands TEXT,
  credits_pass_only INTEGER NOT NULL DEFAULT 1,
  is_system INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE subjects ADD COLUMN scale_id INTEGER REFERENCES grading_scales(id);

INSERT OR IGNORE INTO grading_scales (code, name, scale_type, description, passing_grade, weights, bands, credits_pass_only, is_system, is_default, active) VALUES
('deped', 'DepEd K-12 (Numeric)', 'numeric',
 'Philippine DepEd DO 8 s. 2015 - weighted Written Work / Performance Task / Quarterly Exam, 75 passing.',
 75, '{"written_work":25,"performance_task":45,"quarterly_exam":30}',
 '[{"min":90,"max":100,"label":"Advanced"},{"min":85,"max":89.9,"label":"Proficient"},{"min":80,"max":84.9,"label":"Approaching Proficiency"},{"min":75,"max":79.9,"label":"Developing"},{"min":0,"max":74.9,"label":"Beginning"}]',
 1, 1, 1, 1),
('letter', 'Letter Grades (A-F)', 'letter',
 'Traditional A-F letter grades with 4.0-point equivalency.',
 60, '{"written_work":25,"performance_task":45,"quarterly_exam":30}',
 '[{"min":90,"max":100,"letter":"A","points":4.0},{"min":80,"max":89.9,"letter":"B","points":3.0},{"min":70,"max":79.9,"letter":"C","points":2.0},{"min":60,"max":69.9,"letter":"D","points":1.0},{"min":0,"max":59.9,"letter":"F","points":0.0}]',
 1, 1, 0, 1),
('gpa4', 'GPA 0-4.0 (International)', 'gpa',
 'Standard international unweighted 4.0-point GPA with +/- grading.',
 60, '{"written_work":25,"performance_task":45,"quarterly_exam":30}',
 '[{"min":97,"max":100,"letter":"A+","points":4.0},{"min":93,"max":96.9,"letter":"A","points":4.0},{"min":90,"max":92.9,"letter":"A-","points":3.7},{"min":87,"max":89.9,"letter":"B+","points":3.3},{"min":83,"max":86.9,"letter":"B","points":3.0},{"min":80,"max":82.9,"letter":"B-","points":2.7},{"min":77,"max":79.9,"letter":"C+","points":2.3},{"min":73,"max":76.9,"letter":"C","points":2.0},{"min":70,"max":72.9,"letter":"C-","points":1.7},{"min":67,"max":69.9,"letter":"D+","points":1.3},{"min":60,"max":66.9,"letter":"D","points":1.0},{"min":0,"max":59.9,"letter":"F","points":0.0}]',
 1, 1, 0, 1),
('gpa5', 'GPA 0-5.0 (Extended)', 'gpa',
 'Extended 5.0-point GPA scale.',
 60, '{"written_work":25,"performance_task":45,"quarterly_exam":30}',
 '[{"min":90,"max":100,"letter":"A","points":5.0},{"min":80,"max":89.9,"letter":"B","points":4.0},{"min":70,"max":79.9,"letter":"C","points":3.0},{"min":60,"max":69.9,"letter":"D","points":2.0},{"min":0,"max":59.9,"letter":"F","points":0.0}]',
 1, 1, 0, 1),
('ib', 'IB 1-7', 'ib',
 'International Baccalaureate 1-7 point scale (4 = passing).',
 64, '{"written_work":25,"performance_task":45,"quarterly_exam":30}',
 '[{"min":96,"max":100,"letter":"7","points":7,"label":"Excellent"},{"min":88,"max":95.9,"letter":"6","points":6,"label":"Very Good"},{"min":76,"max":87.9,"letter":"5","points":5,"label":"Good"},{"min":64,"max":75.9,"letter":"4","points":4,"label":"Satisfactory"},{"min":52,"max":63.9,"letter":"3","points":3,"label":"Mediocre"},{"min":40,"max":51.9,"letter":"2","points":2,"label":"Poor"},{"min":0,"max":39.9,"letter":"1","points":1,"label":"Very Poor"}]',
 1, 1, 0, 1),
('cambridge', 'Cambridge (A*-U)', 'cambridge',
 'Cambridge / IGCSE A*-U grades.',
 40, '{"written_work":25,"performance_task":45,"quarterly_exam":30}',
 '[{"min":90,"max":100,"letter":"A*"},{"min":80,"max":89.9,"letter":"A"},{"min":70,"max":79.9,"letter":"B"},{"min":60,"max":69.9,"letter":"C"},{"min":50,"max":59.9,"letter":"D"},{"min":40,"max":49.9,"letter":"E"},{"min":0,"max":39.9,"letter":"U"}]',
 1, 1, 0, 1);
