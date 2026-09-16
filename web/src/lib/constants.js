export const CURRENT_SCHOOL_YEAR = '2026-2027';

export const SCHOOL_YEARS = ['2027-2028', '2026-2027', '2025-2026', '2024-2025'];

// Shared option lists for forms across the system.

export const SUFFIXES = ['Jr.', 'Sr.', 'II', 'III', 'IV', 'V'];

// The school's official SHS strands/tracks.
export const SHS_TRACKS = [
  'TechPro - Electrical Installation and Maintenance',
  'TechPro - Garment Artisanry',
  'TechPro - Computer System and Servicing',
  'Academics',
];

// Values stay lowercase (server filters rely on them); labels are capitalized for display.
export const STUDENT_STATUSES = [
  { value: 'enrolled', label: 'Enrolled' },
  { value: 'transferred', label: 'Transferred' },
  { value: 'dropped', label: 'Dropped' },
  { value: 'graduated', label: 'Graduated' },
];

export const ENROLLMENT_STATUSES = [
  { value: 'pre_registered', label: 'Pre-registered (Early Enrolment)' },
  { value: 'pending', label: 'Pending' },
  { value: 'provisional', label: 'Provisional' },
  { value: 'conditional', label: 'Conditional' },
  { value: 'enrolled', label: 'Enrolled' },
];

// Requirement documents a registrar can attach to an enrollment record.
export const ENROLLMENT_DOC_TYPES = [
  { value: 'psa_birth', label: 'PSA Birth Certificate' },
  { value: 'form_138', label: 'Form 138 / SF9 (Report Card)' },
  { value: 'good_moral', label: 'Good Moral Certificate' },
  { value: 'report_card', label: 'Report Card' },
  { value: 'other', label: 'Other' },
];

export const TEACHER_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'on-leave', label: 'On Leave' },
];

export const SECTION_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' },
];

export const TEACHER_POSITIONS = [
  'Teacher I',
  'Teacher II',
  'Teacher III',
  'Teacher IV',
  'Master Teacher I',
  'Master Teacher II',
  'Master Teacher III',
  'Master Teacher IV',
  'Head Teacher I',
  'Head Teacher II',
  'Head Teacher III',
  'Principal I',
  'Principal II',
  'Principal III',
  'Principal IV',
  'Guidance Counselor',
  'School Librarian',
  'School Nurse',
  'ICT Coordinator',
  'Registrar',
  'Cashier',
  'Administrative Officer I',
  'Administrative Officer II',
  'Administrative Officer III',
  'Administrative Aide',
];

export const ADMIN_ROLES = ['super_admin', 'school_admin'];
export const CAN_MANAGE_STUDENTS = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];
export const CAN_WRITE_STUDENTS = [...CAN_MANAGE_STUDENTS, 'teacher', 'guidance'];
export const CAN_MANAGE_GRADES = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];
export const CAN_WRITE_GRADES = [...CAN_MANAGE_GRADES, 'teacher'];
export const CAN_MANAGE_ATTENDANCE = ['super_admin', 'school_admin', 'principal', 'assistant_principal'];
export const CAN_WRITE_ATTENDANCE = [...CAN_MANAGE_ATTENDANCE, 'teacher'];
export const CAN_MANAGE_USERS = ['super_admin', 'school_admin'];
export const CAN_VIEW_ANALYTICS = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'teacher'];
export const CAN_MANAGE_GUIDANCE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'guidance'];
export const CAN_MANAGE_CLINIC = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'nurse'];
export const CAN_MANAGE_LIBRARY = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'librarian'];
export const CAN_MANAGE_REPORTS = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];
export const MAX_INPUT_LENGTH = 1000;
