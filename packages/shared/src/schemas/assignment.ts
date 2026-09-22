import { z } from 'zod';
import { zAssignmentKind, zSubmissionStatus } from '../enums';
import { PaginationParamsSchema } from './user';

export const AssignmentSchema = z.object({
  id: z.number().int().positive(),
  class_assignment_id: z.number().int().positive(),
  title: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  kind: zAssignmentKind,
  total_points: z.number().nonnegative().default(0),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  rubric: z.string().nullable().optional(),
  linked_competency: z.string().max(200).nullable().optional(),
  allow_late: z.boolean().default(false),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  // Joined
  subject_code: z.string().optional(),
  section_name: z.string().optional(),
  submitted_count: z.number().int().nonnegative().optional(),
  graded_count: z.number().int().nonnegative().optional(),
});

export type Assignment = z.infer<typeof AssignmentSchema>;

export const CreateAssignmentRequestSchema = z.object({
  class_assignment_id: z.number().int().positive(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  kind: zAssignmentKind,
  total_points: z.number().nonnegative().default(0),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  rubric: z.string().optional(),
  linked_competency: z.string().max(200).optional(),
  allow_late: z.boolean().default(false),
});

export type CreateAssignmentRequest = z.infer<typeof CreateAssignmentRequestSchema>;

export const UpdateAssignmentRequestSchema = CreateAssignmentRequestSchema.partial();

export type UpdateAssignmentRequest = z.infer<typeof UpdateAssignmentRequestSchema>;

export const AssignmentListQuerySchema = z.object({
  class_assignment_id: z.coerce.number().int().positive().optional(),
  school_year: z.string().min(1).optional(),
  ...PaginationParamsSchema.shape,
});

export type AssignmentListQuery = z.infer<typeof AssignmentListQuerySchema>;

// Submission
export const SubmissionSchema = z.object({
  id: z.number().int().positive(),
  assignment_id: z.number().int().positive(),
  student_id: z.number().int().positive(),
  content: z.string().nullable().optional(),
  file_url: z.string().url().nullable().optional(),
  score: z.number().nullable().optional(),
  feedback: z.string().nullable().optional(),
  status: zSubmissionStatus.default('not_submitted'),
  submitted_at: z.string().datetime().nullable().optional(),
  graded_at: z.string().datetime().nullable().optional(),
  graded_by: z.number().int().positive().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  // Joined
  student_lrn: z.string().optional(),
  student_name: z.string().optional(),
});

export type Submission = z.infer<typeof SubmissionSchema>;

export const GradeSubmissionRequestSchema = z.object({
  score: z.number().nonnegative(),
  feedback: z.string().max(5000).optional(),
  return_for_revision: z.boolean().default(false),
});

export type GradeSubmissionRequest = z.infer<typeof GradeSubmissionRequestSchema>;

export const ReturnSubmissionRequestSchema = z.object({
  feedback: z.string().max(5000).optional(),
});

export type ReturnSubmissionRequest = z.infer<typeof ReturnSubmissionRequestSchema>;

export const RubricCriterionSchema = z.object({
  criterion: z.string().min(1).max(200),
  points: z.number().int().positive(),
});

export type RubricCriterion = z.infer<typeof RubricCriterionSchema>;

export const RubricSchema = z.array(RubricCriterionSchema);

export type Rubric = z.infer<typeof RubricSchema>;