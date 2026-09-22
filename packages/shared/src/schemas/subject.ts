import { z } from 'zod';
import { zGradeLevel, zGradeScaleType } from '../enums';
import { PaginationParamsSchema } from './user';

export const SubjectSchema = z.object({
  id: z.number().int().positive(),
  code: z.string().min(1).max(20),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  grade_level: zGradeLevel,
  track: z.string().max(50).default('general'),
  units: z.number().nonnegative().default(0),
  scale_id: z.number().int().positive().nullable().optional(),
  created_at: z.string().datetime(),
  // Joined fields
  scale_code: z.string().nullable().optional(),
  scale_name: z.string().nullable().optional(),
  scale_type: zGradeScaleType.nullable().optional(),
  passing_grade: z.number().nullable().optional(),
});

export type Subject = z.infer<typeof SubjectSchema>;

export const CreateSubjectRequestSchema = z.object({
  code: z.string().min(1).max(20).regex(/^[A-Z0-9_-]+$/),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  grade_level: zGradeLevel,
  track: z.string().max(50).default('general'),
  units: z.number().nonnegative().default(0),
  scale_id: z.number().int().positive().optional(),
});

export type CreateSubjectRequest = z.infer<typeof CreateSubjectRequestSchema>;

export const UpdateSubjectRequestSchema = CreateSubjectRequestSchema.partial();

export type UpdateSubjectRequest = z.infer<typeof UpdateSubjectRequestSchema>;

export const SubjectListQuerySchema = z.object({
  grade_level: zGradeLevel.optional(),
  track: z.string().optional(),
  ...PaginationParamsSchema.shape,
});

export type SubjectListQuery = z.infer<typeof SubjectListQuerySchema>;