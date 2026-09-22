import { z } from 'zod';
import { zGradeLevel } from '../enums';
import { PaginationParamsSchema } from './user';

export const SectionSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  grade_level: zGradeLevel,
  strand: z.string().max(100).nullable().optional(),
  adviser_teacher_id: z.number().int().positive().nullable().optional(),
  room: z.string().max(100).nullable().optional(),
  capacity: z.number().int().positive().default(40),
  school_year: z.string().min(1),
  status: z.enum(['active', 'inactive', 'archived']).default('active'),
  created_at: z.string().datetime(),
  // Joined fields
  adviser_name: z.string().nullable().optional(),
  enrollment_count: z.number().int().nonnegative().optional(),
});

export type Section = z.infer<typeof SectionSchema>;

export const CreateSectionRequestSchema = z.object({
  name: z.string().min(1).max(100),
  grade_level: zGradeLevel,
  strand: z.string().max(100).optional(),
  adviser_teacher_id: z.number().int().positive().optional(),
  room: z.string().max(100).optional(),
  capacity: z.number().int().positive().default(40),
  school_year: z.string().min(1),
  status: z.enum(['active', 'inactive']).default('active'),
});

export type CreateSectionRequest = z.infer<typeof CreateSectionRequestSchema>;

export const UpdateSectionRequestSchema = CreateSectionRequestSchema.partial();

export type UpdateSectionRequest = z.infer<typeof UpdateSectionRequestSchema>;

export const SectionListQuerySchema = z.object({
  school_year: z.string().min(1).optional(),
  grade_level: zGradeLevel.optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
  ...PaginationParamsSchema.shape,
});

export type SectionListQuery = z.infer<typeof SectionListQuerySchema>;

export const SectionStudentsQuerySchema = z.object({
  status: z.enum(['enrolled', 'transferred', 'dropped', 'graduated']).default('enrolled'),
  ...PaginationParamsSchema.shape,
});

export type SectionStudentsQuery = z.infer<typeof SectionStudentsQuerySchema>;