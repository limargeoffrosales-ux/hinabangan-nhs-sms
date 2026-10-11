-- ============================================================
-- MeridianEd MVP — Row-Level Security (RLS) Policies
-- PostgreSQL-only migration (SQLite does not support RLS)
-- Applies to all core tables holding user/school data
-- ============================================================

-- Helper function to get current user context from session variables
-- The application MUST call: SET LOCAL app.current_user_id = '123'; SET LOCAL app.current_user_role = 'teacher';
-- before any query in a request transaction.
CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS BIGINT
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::BIGINT
$$;

CREATE OR REPLACE FUNCTION app.current_user_role() RETURNS TEXT
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_user_role', true), '')
$$;

-- Admin roles that can see all data within their school
-- (school_admin, principal, assistant_principal, registrar, super_admin, region_admin, division_admin)
CREATE OR REPLACE FUNCTION app.is_admin_role() RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT app.current_user_role() IN (
    'super_admin','region_admin','division_admin',
    'school_admin','principal','assistant_principal','registrar'
  )
$$;

-- Teacher role check
CREATE OR REPLACE FUNCTION app.is_teacher() RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT app.current_user_role() = 'teacher'
$$;

-- Guidance role check
CREATE OR REPLACE FUNCTION app.is_guidance() RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT app.current_user_role() = 'guidance'
$$;

-- Student role check
CREATE OR REPLACE FUNCTION app.is_student() RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT app.current_user_role() = 'student'
$$;

-- Parent/guardian role check
CREATE OR REPLACE FUNCTION app.is_parent() RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT app.current_user_role() IN ('parent','guardian')
$$;

-- ────────────────────────────────────────────────────────────
-- USERS table: users can see themselves; admins see all
-- ────────────────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_self ON users
  FOR SELECT USING (id = app.current_user_id());

CREATE POLICY users_admin ON users
  FOR SELECT USING (app.is_admin_role());

CREATE POLICY users_insert_self ON users
  FOR INSERT WITH CHECK (id = app.current_user_id());

CREATE POLICY users_update_self ON users
  FOR UPDATE USING (id = app.current_user_id()) WITH CHECK (id = app.current_user_id());

CREATE POLICY users_admin_write ON users
  FOR ALL USING (app.is_admin_role()) WITH CHECK (app.is_admin_role());

-- ────────────────────────────────────────────────────────────
-- REFRESH_TOKENS: users only their own tokens; admins all
-- ────────────────────────────────────────────────────────────
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY rt_self ON refresh_tokens
  FOR ALL USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());

CREATE POLICY rt_admin ON refresh_tokens
  FOR ALL USING (app.is_admin_role()) WITH CHECK (app.is_admin_role());

-- ────────────────────────────────────────────────────────────
-- STUDENTS: core student PII
-- ────────────────────────────────────────────────────────────
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Students see their own record (via user_id link)
CREATE POLICY students_self ON students
  FOR SELECT USING (user_id = app.current_user_id());

-- Parents see linked children
CREATE POLICY students_parent ON students
  FOR SELECT USING (
    app.is_parent() AND id IN (
      SELECT student_id FROM parent_students WHERE parent_user_id = app.current_user_id()
    )
  );

-- Teachers see students in their sections (advisory or assigned)
CREATE POLICY students_teacher ON students
  FOR SELECT USING (
    app.is_teacher() AND id IN (
      SELECT e.student_id
      FROM enrollments e
      JOIN sections s ON s.id = e.section_id
      WHERE e.status = 'enrolled'
        AND s.id IN (
          SELECT section_id FROM class_assignments WHERE teacher_id = (
            SELECT id FROM teachers WHERE user_id = app.current_user_id()
          )
          UNION
          SELECT id FROM sections WHERE adviser_teacher_id = (
            SELECT id FROM teachers WHERE user_id = app.current_user_id()
          )
        )
    )
  );

-- Guidance sees all students in their school (admin scope)
CREATE POLICY students_guidance ON students
  FOR SELECT USING (app.is_guidance() OR app.is_admin_role());

-- Admins see all
CREATE POLICY students_admin ON students
  FOR ALL USING (app.is_admin_role()) WITH CHECK (app.is_admin_role());

-- ────────────────────────────────────────────────────────────
-- TEACHERS: teacher profiles
-- ────────────────────────────────────────────────────────────
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY teachers_self ON teachers
  FOR SELECT USING (user_id = app.current_user_id());

CREATE POLICY teachers_admin ON teachers
  FOR ALL USING (app.is_admin_role()) WITH CHECK (app.is_admin_role());

-- ────────────────────────────────────────────────────────────
-- SECTIONS: class sections
-- ────────────────────────────────────────────────────────────
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;

-- Teachers see their advisory/assigned sections
CREATE POLICY sections_teacher ON sections
  FOR SELECT USING (
    app.is_teacher() AND (
      adviser_teacher_id = (SELECT id FROM teachers WHERE user_id = app.current_user_id())
      OR id IN (SELECT section_id FROM class_assignments WHERE teacher_id = (SELECT id FROM teachers WHERE user_id = app.current_user_id()))
    )
  );

-- Students see their enrolled sections
CREATE POLICY sections_student ON sections
  FOR SELECT USING (
    app.is_student() AND id IN (
      SELECT section_id FROM enrollments WHERE student_id = (SELECT id FROM students WHERE user_id = app.current_user_id()) AND status = 'enrolled'
    )
  );

-- Parents see their children's sections
CREATE POLICY sections_parent ON sections
  FOR SELECT USING (
    app.is_parent() AND id IN (
      SELECT e.section_id
      FROM enrollments e
      JOIN students s ON s.id = e.student_id
      JOIN parent_students ps ON ps.student_id = s.id
      WHERE ps.parent_user_id = app.current_user_id() AND e.status = 'enrolled'
    )
  );

-- Admins see all
CREATE POLICY sections_admin ON sections
  FOR ALL USING (app.is_admin_role()) WITH CHECK (app.is_admin_role());

-- ────────────────────────────────────────────────────────────
-- ENROLLMENTS: student-section enrollments
-- ────────────────────────────────────────────────────────────
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- Students see their own enrollments
CREATE POLICY enrollments_self ON enrollments
  FOR SELECT USING (student_id = (SELECT id FROM students WHERE user_id = app.current_user_id()));

-- Parents see their children's enrollments
CREATE POLICY enrollments_parent ON enrollments
  FOR SELECT USING (
    app.is_parent() AND student_id IN (
      SELECT student_id FROM parent_students WHERE parent_user_id = app.current_user_id()
    )
  );

-- Teachers see enrollments in their sections
CREATE POLICY enrollments_teacher ON enrollments
  FOR SELECT USING (
    app.is_teacher() AND section_id IN (
      SELECT section_id FROM class_assignments WHERE teacher_id = (SELECT id FROM teachers WHERE user_id = app.current_user_id())
      UNION
      SELECT id FROM sections WHERE adviser_teacher_id = (SELECT id FROM teachers WHERE user_id = app.current_user_id())
    )
  );

-- Admins see all
CREATE POLICY enrollments_admin ON enrollments
  FOR ALL USING (app.is_admin_role()) WITH CHECK (app.is_admin_role());

-- ────────────────────────────────────────────────────────────
-- ATTENDANCE: daily attendance records
-- ────────────────────────────────────────────────────────────
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Students see their own attendance
CREATE POLICY attendance_self ON attendance
  FOR SELECT USING (student_id = (SELECT id FROM students WHERE user_id = app.current_user_id()));

-- Parents see their children's attendance
CREATE POLICY attendance_parent ON attendance
  FOR SELECT USING (
    app.is_parent() AND student_id IN (
      SELECT student_id FROM parent_students WHERE parent_user_id = app.current_user_id()
    )
  );

-- Teachers see attendance for their sections
CREATE POLICY attendance_teacher ON attendance
  FOR SELECT USING (
    app.is_teacher() AND (
      section_id IN (
        SELECT section_id FROM class_assignments WHERE teacher_id = (SELECT id FROM teachers WHERE user_id = app.current_user_id())
        UNION
        SELECT id FROM sections WHERE adviser_teacher_id = (SELECT id FROM teachers WHERE user_id = app.current_user_id())
      )
      OR recorded_by = app.current_user_id()
    )
  );

-- Guidance/Admin see all
CREATE POLICY attendance_admin ON attendance
  FOR ALL USING (app.is_admin_role() OR app.is_guidance()) WITH CHECK (app.is_admin_role() OR app.is_guidance());

-- ────────────────────────────────────────────────────────────
-- GRADES: student grades
-- ────────────────────────────────────────────────────────────
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

-- Students see their own grades
CREATE POLICY grades_self ON grades
  FOR SELECT USING (student_id = (SELECT id FROM students WHERE user_id = app.current_user_id()));

-- Parents see their children's grades
CREATE POLICY grades_parent ON grades
  FOR SELECT USING (
    app.is_parent() AND student_id IN (
      SELECT student_id FROM parent_students WHERE parent_user_id = app.current_user_id()
    )
  );

-- Teachers see grades for their assigned subjects/sections
CREATE POLICY grades_teacher ON grades
  FOR SELECT USING (
    app.is_teacher() AND student_id IN (
      SELECT e.student_id
      FROM enrollments e
      JOIN sections s ON s.id = e.section_id
      WHERE e.status = 'enrolled'
        AND s.id IN (
          SELECT section_id FROM class_assignments WHERE teacher_id = (
            SELECT id FROM teachers WHERE user_id = app.current_user_id()
          )
          UNION
          SELECT id FROM sections WHERE adviser_teacher_id = (
            SELECT id FROM teachers WHERE user_id = app.current_user_id()
          )
        )
    )
  );

-- Admins/Guidance see all
CREATE POLICY grades_admin ON grades
  FOR ALL USING (app.is_admin_role() OR app.is_guidance()) WITH CHECK (app.is_admin_role() OR app.is_guidance());

-- ────────────────────────────────────────────────────────────
-- CLASS_ASSIGNMENTS: teacher-section-subject assignments
-- ────────────────────────────────────────────────────────────
ALTER TABLE class_assignments ENABLE ROW LEVEL SECURITY;

-- Teachers see their own assignments
CREATE POLICY ca_teacher ON class_assignments
  FOR SELECT USING (teacher_id = (SELECT id FROM teachers WHERE user_id = app.current_user_id()));

-- Students see assignments for their sections
CREATE POLICY ca_student ON class_assignments
  FOR SELECT USING (
    app.is_student() AND section_id IN (
      SELECT section_id FROM enrollments WHERE student_id = (SELECT id FROM students WHERE user_id = app.current_user_id()) AND status = 'enrolled'
    )
  );

-- Parents see assignments for children's sections
CREATE POLICY ca_parent ON class_assignments
  FOR SELECT USING (
    app.is_parent() AND section_id IN (
      SELECT e.section_id
      FROM enrollments e
      JOIN students s ON s.id = e.student_id
      JOIN parent_students ps ON ps.student_id = s.id
      WHERE ps.parent_user_id = app.current_user_id() AND e.status = 'enrolled'
    )
  );

-- Admins see all
CREATE POLICY ca_admin ON class_assignments
  FOR ALL USING (app.is_admin_role()) WITH CHECK (app.is_admin_role());

-- ────────────────────────────────────────────────────────────
-- ANNOUNCEMENTS: school announcements
-- ────────────────────────────────────────────────────────────
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Everyone sees announcements for their audience
CREATE POLICY announcements_read ON announcements
  FOR SELECT USING (
    audience = 'all'
    OR (audience = 'staff' AND app.current_user_role() NOT IN ('student','parent','guardian'))
    OR (audience = 'students' AND app.current_user_role() IN ('student','parent','guardian'))
    OR (audience = 'parents' AND app.current_user_role() IN ('parent','guardian'))
    OR author_id = app.current_user_id()
  );

-- Authors/Admin can write
CREATE POLICY announcements_write ON announcements
  FOR ALL USING (app.is_admin_role() OR author_id = app.current_user_id())
  WITH CHECK (app.is_admin_role() OR author_id = app.current_user_id());

-- ────────────────────────────────────────────────────────────
-- AUDIT_LOGS: security audit trail
-- ────────────────────────────────────────────────────────────
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Users see their own audit logs
CREATE POLICY audit_self ON audit_logs
  FOR SELECT USING (user_id = app.current_user_id());

-- Admins see all
CREATE POLICY audit_admin ON audit_logs
  FOR SELECT USING (app.is_admin_role());

-- System inserts (no policy needed for INSERT by service)

-- ────────────────────────────────────────────────────────────
-- SUBJECTS: course catalog
-- ────────────────────────────────────────────────────────────
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

-- Everyone can read subjects
CREATE POLICY subjects_read ON subjects
  FOR SELECT USING (true);

-- Admins can write
CREATE POLICY subjects_admin ON subjects
  FOR ALL USING (app.is_admin_role()) WITH CHECK (app.is_admin_role());

-- ────────────────────────────────────────────────────────────
-- SCHEDULE_ENTRIES: class schedules
-- ────────────────────────────────────────────────────────────
ALTER TABLE schedule_entries ENABLE ROW LEVEL SECURITY;

-- Teachers see their schedule
CREATE POLICY schedule_teacher ON schedule_entries
  FOR SELECT USING (
    app.is_teacher() AND teacher_id = (SELECT id FROM teachers WHERE user_id = app.current_user_id())
  );

-- Students see their section's schedule
CREATE POLICY schedule_student ON schedule_entries
  FOR SELECT USING (
    app.is_student() AND section_id IN (
      SELECT section_id FROM enrollments WHERE student_id = (SELECT id FROM students WHERE user_id = app.current_user_id()) AND status = 'enrolled'
    )
  );

-- Parents see children's schedule
CREATE POLICY schedule_parent ON schedule_entries
  FOR SELECT USING (
    app.is_parent() AND section_id IN (
      SELECT e.section_id
      FROM enrollments e
      JOIN students s ON s.id = e.student_id
      JOIN parent_students ps ON ps.student_id = s.id
      WHERE ps.parent_user_id = app.current_user_id() AND e.status = 'enrolled'
    )
  );

-- Admins see all
CREATE POLICY schedule_admin ON schedule_entries
  FOR ALL USING (app.is_admin_role()) WITH CHECK (app.is_admin_role());

-- ────────────────────────────────────────────────────────────
-- REPORT_SUBMISSIONS: DepEd/workflow reports
-- ────────────────────────────────────────────────────────────
ALTER TABLE report_submissions ENABLE ROW LEVEL SECURITY;

-- Owner sees their submissions
CREATE POLICY rs_owner ON report_submissions
  FOR SELECT USING (user_id = app.current_user_id());

-- Reviewers/approvers see assigned
CREATE POLICY rs_reviewer ON report_submissions
  FOR SELECT USING (
    reviewer_id = app.current_user_id() OR approver_id = app.current_user_id()
  );

-- Admins see all
CREATE POLICY rs_admin ON report_submissions
  FOR ALL USING (app.is_admin_role()) WITH CHECK (app.is_admin_role());

-- ────────────────────────────────────────────────────────────
-- SUBMISSION_FILES: attached files
-- ────────────────────────────────────────────────────────────
ALTER TABLE submission_files ENABLE ROW LEVEL SECURITY;

-- Access via parent submission
CREATE POLICY sf_owner ON submission_files
  FOR SELECT USING (
    submission_id IN (
      SELECT id FROM report_submissions WHERE user_id = app.current_user_id()
    )
  );

CREATE POLICY sf_reviewer ON submission_files
  FOR SELECT USING (
    submission_id IN (
      SELECT id FROM report_submissions WHERE reviewer_id = app.current_user_id() OR approver_id = app.current_user_id()
    )
  );

CREATE POLICY sf_admin ON submission_files
  FOR ALL USING (app.is_admin_role()) WITH CHECK (app.is_admin_role());

-- ────────────────────────────────────────────────────────────
-- PARENT_STUDENTS: parent-child links (from portal migration)
-- ────────────────────────────────────────────────────────────
ALTER TABLE parent_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY ps_parent ON parent_students
  FOR SELECT USING (parent_user_id = app.current_user_id());

CREATE POLICY ps_admin ON parent_students
  FOR ALL USING (app.is_admin_role()) WITH CHECK (app.is_admin_role());

-- ────────────────────────────────────────────────────────────
-- STUDENT_HEALTH: health records (from student-health migration)
-- ────────────────────────────────────────────────────────────
ALTER TABLE student_health ENABLE ROW LEVEL SECURITY;

-- Student/parent see their health
CREATE POLICY sh_self ON student_health
  FOR SELECT USING (
    student_id = (SELECT id FROM students WHERE user_id = app.current_user_id())
    OR (app.is_parent() AND student_id IN (SELECT student_id FROM parent_students WHERE parent_user_id = app.current_user_id()))
  );

-- Clinic staff (nurse) + guidance + admin see all
CREATE POLICY sh_clinic ON student_health
  FOR ALL USING (
    app.current_user_role() IN ('nurse','guidance')
    OR app.is_admin_role()
  ) WITH CHECK (
    app.current_user_role() IN ('nurse','guidance')
    OR app.is_admin_role()
  );

-- ────────────────────────────────────────────────────────────
-- NOTIFICATIONS: user notifications
-- ────────────────────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notif_self ON notifications
  FOR SELECT USING (
    (channel = 'email' AND recipient_address IN (SELECT email FROM users WHERE id = app.current_user_id()))
    OR (channel = 'sms' AND recipient_address IN (SELECT phone FROM users WHERE id = app.current_user_id()))
    OR user_id = app.current_user_id()
  );

CREATE POLICY notif_admin ON notifications
  FOR ALL USING (app.is_admin_role()) WITH CHECK (app.is_admin_role());

-- ────────────────────────────────────────────────────────────
-- CSRF_TOKENS: CSRF protection
-- ────────────────────────────────────────────────────────────
ALTER TABLE csrf_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY csrf_self ON csrf_tokens
  FOR ALL USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());

CREATE POLICY csrf_admin ON csrf_tokens
  FOR ALL USING (app.is_admin_role()) WITH CHECK (app.is_admin_role());

-- ────────────────────────────────────────────────────────────
-- APP_SETTINGS: global settings (admin only)
-- ────────────────────────────────────────────────────────────
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY settings_read ON app_settings
  FOR SELECT USING (true); -- All authenticated users can read settings

CREATE POLICY settings_admin ON app_settings
  FOR ALL USING (app.is_admin_role()) WITH CHECK (app.is_admin_role());