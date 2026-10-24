-- Remove unused research module tables (no route, no UI — dead schema)
DROP TABLE IF EXISTS research_milestones;
DROP TABLE IF EXISTS research_versions;
DROP TABLE IF EXISTS research_projects;
