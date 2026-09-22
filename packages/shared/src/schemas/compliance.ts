import { z } from 'zod';
import { zComplianceStatus } from '../enums';
import { PaginationParamsSchema } from './user';

export const ComplianceTaskSchema = z.object({
  id: z.number().int().positive(),
  report_type_id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  teacher_id: z.number().int().positive().nullable().optional(),
  school_year: z.string().min(1),
  period: z.string().min(1),
  status: zComplianceStatus.default('draft'),
  notes: z.string().max(1000).nullable().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  draft_body: z.string().nullable().optional(),
  assigned_by: z.number().int().positive().nullable().optional(),
  assigned_at: z.string().datetime().nullable().optional(),
  files_json: z.string().nullable().optional(),
  reviewer_id: z.number().int().positive().nullable().optional(),
  review_note: z.string().max(1000).nullable().optional(),
  reviewed_at: z.string().datetime().nullable().optional(),
  approver_id: z.number().int().positive().nullable().optional(),
  approved_at: z.string().datetime().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  // Joined
  report_type_code: z.string().optional(),
  report_type_name: z.string().optional(),
  teacher_name: z.string().nullable().optional(),
  reviewer_name: z.string().nullable().optional(),
  approver_name: z.string().nullable().optional(),
});

export type ComplianceTask = z.infer<typeof ComplianceTaskSchema>;

export const ComplianceListQuerySchema = z.object({
  school_year: z.string().min(1).optional(),
  status: zComplianceStatus.optional(),
  teacher_id: z.coerce.number().int().positive().optional(),
  ...PaginationParamsSchema.shape,
});

export type ComplianceListQuery = z.infer<typeof ComplianceListQuerySchema>;

export const ComplianceByTeacherSchema = z.object({
  teacher: z.object({
    id: z.number().int().positive(),
    name: z.string(),
    role: z.string(),
  }),
  tasks: z.number().int().nonnegative(),
  done: z.number().int().nonnegative(),
  compliance: z.number(),
  progress: z.number(),
  incomplete: z.number().int().nonnegative(),
});

export type ComplianceByTeacher = z.infer<typeof ComplianceByTeacherSchema>;

export const ComplianceByDepartmentSchema = z.object({
  department: z.string(),
  teachers: z.number().int().nonnegative(),
  tasks: z.number().int().nonnegative(),
  done: z.number().int().nonnegative(),
  compliance: z.number(),
});

export type ComplianceByDepartment = z.infer<typeof ComplianceByDepartmentSchema>;

export const CategoryCoverageSchema = z.object({
  report_category: z.string(),
  total_assigned: z.number().int().nonnegative(),
  complied: z.number().int().nonnegative(),
  compliance_rate: z.number(),
});

export type CategoryCoverage = z.infer<typeof CategoryCoverageSchema>;

export const TeacherIncompleteSchema = z.object({
  name: z.string(),
  tasks: z.array(z.object({
    report: z.string(),
    category: z.string(),
    due_date: z.string().nullable().optional(),
    status: zComplianceStatus,
  })),
});

export type TeacherIncomplete = z.infer<typeof TeacherIncompleteSchema>;