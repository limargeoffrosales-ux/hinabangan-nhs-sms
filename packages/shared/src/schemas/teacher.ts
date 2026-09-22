import { z } from 'zod';
import { zSex } from '../enums';
import { PaginationParamsSchema } from './user';

export const TeacherSchema = z.object({
  id: z.number().int().positive(),
  employee_no: z.string().max(50).nullable().optional(),
  first_name: z.string().min(1).max(100),
  middle_name: z.string().max(100).nullable().optional(),
  last_name: z.string().min(1).max(100),
  suffix: z.string().max(20).nullable().optional(),
  sex: zSex.nullable().optional(),
  position: z.string().max(100).nullable().optional(),
  prc_no: z.string().max(50).nullable().optional(),
  email: z.string().email().max(200).nullable().optional(),
  contact: z.string().max(40).nullable().optional(),
  status: z.enum(['active', 'inactive', 'on_leave']).default('active'),
  user_id: z.number().int().positive().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  // Joined fields
  user_name: z.string().nullable().optional(),
  user_role: z.string().nullable().optional(),
});

export type Teacher = z.infer<typeof TeacherSchema>;

export const CreateTeacherRequestSchema = z.object({
  employee_no: z.string().max(50).optional(),
  first_name: z.string().min(1).max(100),
  middle_name: z.string().max(100).optional(),
  last_name: z.string().min(1).max(100),
  suffix: z.string().max(20).optional(),
  sex: zSex.optional(),
  position: z.string().max(100).optional(),
  prc_no: z.string().max(50).optional(),
  email: z.string().email().max(200).optional(),
  contact: z.string().max(40).optional(),
  status: z.enum(['active', 'inactive', 'on_leave']).default('active'),
  user_id: z.number().int().positive().optional(),
});

export type CreateTeacherRequest = z.infer<typeof CreateTeacherRequestSchema>;

export const UpdateTeacherRequestSchema = CreateTeacherRequestSchema.partial();

export type UpdateTeacherRequest = z.infer<typeof UpdateTeacherRequestSchema>;

export const TeacherListQuerySchema = z.object({
  status: z.enum(['active', 'inactive', 'on_leave']).optional(),
  ...PaginationParamsSchema.shape,
});

export type TeacherListQuery = z.infer<typeof TeacherListQuerySchema>;

// Teacher with scope
export const TeacherScopeSchema = z.object({
  teacherId: z.number().int().positive(),
  advisory: z.array(z.number().int().positive()),
  classes: z.array(z.object({
    section_id: z.number().int().positive(),
    subject_id: z.number().int().positive(),
  })),
  sections: z.array(z.number().int().positive()),
});

export type TeacherScope = z.infer<typeof TeacherScopeSchema>;