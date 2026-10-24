-- Remove non-DepEd international grading scales (not used by Philippine DepEd schools)
DELETE FROM grading_scales WHERE code IN ('letter', 'gpa4', 'gpa5', 'ib', 'cambridge');
