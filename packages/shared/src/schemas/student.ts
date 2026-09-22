import { z } from 'zod';
import { zStudentStatus, zSex, zGradeLevel, zTermOption } from '../enums';
import { PaginationParamsSchema, PaginatedResponseSchema } from './user';

// Student from database
export const StudentSchema = z.object({
  id: z.number().int().positive(),
  lrn: z.string().length(12).regex(/^\d{12}$/),
  first_name: z.string().min(1).max(100),
  middle_name: z.string().max(100).nullable().optional(),
  last_name: z.string().min(1).max(100),
  suffix: z.string().max(20).nullable().optional(),
  sex: zSex,
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  birth_place: z.string().max(200).nullable().optional(),
  religion: z.string().max(100).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  contact: z.string().max(40).nullable().optional(),
  guardian_name: z.string().max(200).nullable().optional(),
  guardian_contact: z.string().max(40).nullable().optional(),
  guardian_relation: z.string().max(100).nullable().optional(),
  father_name: z.string().max(200).nullable().optional(),
  mother_name: z.string().max(200).nullable().optional(),
  mother_tongue: z.string().max(100).nullable().optional(),
  learner_status: z.string().max(100).nullable().optional(),
  learner_type: z.string().max(100).nullable().optional(),
  remarks: z.string().max(1000).nullable().optional(),
  grade_level: zGradeLevel,
  track_strand: z.string().max(100).nullable().optional(),
  status: zStudentStatus.default('enrolled'),
  global_learner_id: z.string().max(20).nullable().optional(),
  indigenous_people: z.string().max(200).default('No').optional(),
  special_needs: z.string().max(200).nullable().optional(),
  photo_url: z.string().url().nullable().optional(),
  user_id: z.number().int().positive().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  // Computed fields
  age: z.number().int().nonnegative().optional(),
  subject_count: z.number().int().nonnegative().optional(),
  has_subjects: z.boolean().optional(),
  enrollments: z.array(z.unknown()).optional(),
});

export type Student = z.infer<typeof StudentSchema>;

// Student with PII masked (for teachers/guidance)
export const StudentPublicSchema = StudentSchema.omit({
  contact: true,
  guardian_contact: true,
  guardian_name: true,
  guardian_relation: true,
  address: true,
  birth_place: true,
  religion: true,
});

export type StudentPublic = z.infer<typeof StudentPublicSchema>;

// Create student
export const CreateStudentRequestSchema = z.object({
  lrn: z.string().length(12).regex(/^\d{12}$/).optional(),
  first_name: z.string().min(1).max(100),
  middle_name: z.string().max(100).optional(),
  last_name: z.string().min(1).max(100),
  suffix: z.string().max(20).optional(),
  sex: zSex,
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  birth_place: z.string().max(200).optional(),
  religion: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  contact: z.string().max(40).optional(),
  guardian_name: z.string().max(200).optional(),
  guardian_contact: z.string().max(40).optional(),
  guardian_relation: z.string().max(100).optional(),
  father_name: z.string().max(200).optional(),
  mother_name: z.string().max(200).optional(),
  mother_tongue: z.string().max(100).optional(),
  learner_status: z.string().max(100).optional(),
  learner_type: z.string().max(100).optional(),
  remarks: z.string().max(1000).optional(),
  grade_level: zGradeLevel,
  track_strand: z.string().max(100).optional(),
  status: zStudentStatus.default('enrolled'),
  global_learner_id: z.string().max(20).optional(),
  indigenous_people: z.string().max(200).optional(),
  special_needs: z.string().max(200).optional(),
});

export type CreateStudentRequest = z.infer<typeof CreateStudentRequestSchema>;

// Update student
export const UpdateStudentRequestSchema = CreateStudentRequestSchema.partial();

export type UpdateStudentRequest = z.infer<typeof UpdateStudentRequestSchema>;

// Student list query
export const StudentListQuerySchema = z.object({
  q: z.string().optional(),
  grade_level: zGradeLevel.optional(),
  sort: z.enum(['name', 'recent_enrolled']).optional(),
  ...PaginationParamsSchema.shape,
});

export type StudentListQuery = z.infer<typeof StudentListQuerySchema>;

// Student export query
export const StudentExportQuerySchema = z.object({
  q: z.string().optional(),
  grade_level: zGradeLevel.optional(),
  format: z.enum(['xlsx', 'csv']).default('xlsx').optional(),
});

export type StudentExportQuery = z.infer<typeof StudentExportQuerySchema>;

// Link requests
export const LinkRequestSchema = z.object({
  id: z.number().int().positive(),
  student_id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  status: z.enum(['pending', 'approved', 'rejected']),
  verified: z.string().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  created_at: z.string().datetime(),
  decided_by: z.number().int().positive().nullable().optional(),
  decided_at: z.string().datetime().nullable().optional(),
  // Joined fields
  lrn: z.string(),
  first_name: z.string(),
  middle_name: z.string().nullable().optional(),
  last_name: z.string(),
  sex: z.string(),
  birth_date: z.string().nullable().optional(),
  grade_level: z.string(),
  track_strand: z.string().nullable().optional(),
  username: z.string(),
  user_name: z.string(),
});

export type LinkRequest = z.infer<typeof LinkRequestSchema>;

export const ApproveLinkRequestSchema = z.object({});

export const RejectLinkRequestSchema = z.object({
  note: z.string().max(500).optional(),
});

// Student account linking
export const StudentAccountSchema = z.object({
  id: z.number().int().positive(),
  username: z.string(),
  name: z.string(),
  role: z.string(),
  status: z.string(),
});

export const ParentLinkSchema = z.object({
  student_id: z.number().int().positive(),
  relation: z.string().max(60),
  user_id: z.number().int().positive(),
  username: z.string(),
  name: z.string(),
  status: z.string(),
});

export const StudentAccountsResponseSchema = z.object({
  student_account: StudentAccountSchema.nullable(),
  parents: z.array(ParentLinkSchema),
});

export const LinkStudentAccountRequestSchema = z.object({
  user_id: z.number().int().positive().nullable(),
});

export const LinkParentRequestSchema = z.object({
  user_id: z.number().int().positive(),
  relation: z.string().max(60).default('Parent'),
});