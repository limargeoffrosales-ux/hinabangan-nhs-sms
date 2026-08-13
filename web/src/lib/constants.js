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
  { value: 'enrolled', label: 'Enrolled' },
  { value: 'provisional', label: 'Provisional' },
  { value: 'conditional', label: 'Conditional' },
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
