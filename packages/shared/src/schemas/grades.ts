import { z } from 'zod';
import { zGradeScaleType } from '../enums';
import { PaginationParamsSchema } from './user';

// Grade weights (grading_scales.weights JSON / DEFAULT_GRADE_WEIGHTS)
export const GradeWeightsSchema = z.object({
  written_work: z.number(),
  performance_task: z.number(),
  quarterly_exam: z.number(),
});

export type GradeWeights = z.infer<typeof GradeWeightsSchema>;

// Grade record from database
export const GradeSchema = z.object({
  id: z.number().int().positive(),
  student_id: z.number().int().positive(),
  subject_id: z.number().int().positive(),
  section_id: z.number().int().positive().nullable().optional(),
  school_year: z.string().min(1),
  quarter: z.number().int().min(1).max(4),
  written_work: z.number().nullable().optional(),
  performance_task: z.number().nullable().optional(),
  quarterly_exam: z.number().nullable().optional(),
  computed_grade: z.number().nullable().optional(),
  remarks: z.string().max(500).nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  // Converted fields (added by API)
  letter: z.string().nullable().optional(),
  points: z.number().nullable().optional(),
  proficiency: z.string().nullable().optional(),
  passed: z.boolean().nullable().optional(),
  scale: z.string().optional(),
});

export type Grade = z.infer<typeof GradeSchema>;

// Class grades query
export const ClassGradesQuerySchema = z.object({
  section_id: z.coerce.number().int().positive(),
  subject_id: z.coerce.number().int().positive(),
  school_year: z.string().min(1),
  term: z.coerce.number().int().min(1).max(3),
});

export type ClassGradesQuery = z.infer<typeof ClassGradesQuerySchema>;

// Class grades response
export const ClassGradesResponseSchema = z.object({
  data: z.array(GradeSchema),
  weights: GradeWeightsSchema,
  scale: z.object({
    id: z.number().int().positive(),
    code: z.string(),
    name: z.string(),
    scale_type: zGradeScaleType,
    passing_grade: z.number(),
    weights: GradeWeightsSchema,
  }),
  term: z.string(),
});

export type ClassGradesResponse = z.infer<typeof ClassGradesResponseSchema>;

// Save grades request
export const SaveGradeRowSchema = z.object({
  student_id: z.number().int().positive(),
  written_work: z.number().nullable().optional(),
  performance_task: z.number().nullable().optional(),
  quarterly_exam: z.number().nullable().optional(),
  computed_grade: z.number().nullable().optional(),
  remarks: z.string().max(500).nullable().optional(),
});

export const SaveGradesRequestSchema = z.object({
  section_id: z.number().int().positive(),
  subject_id: z.number().int().positive(),
  school_year: z.string().min(1),
  term: z.coerce.number().int().min(1).max(3),
  rows: z.array(SaveGradeRowSchema).min(1),
});

export type SaveGradesRequest = z.infer<typeof SaveGradesRequestSchema>;

// Save grades response
export const SaveGradesResponseSchema = z.object({
  ok: z.boolean(),
  saved: z.number().int().nonnegative(),
  scale: z.object({
    id: z.number().int().positive(),
    code: z.string(),
    name: z.string(),
    scale_type: zGradeScaleType,
    passing_grade: z.number(),
    weights: GradeWeightsSchema,
  }),
});

export type SaveGradesResponse = z.infer<typeof SaveGradesResponseSchema>;

// Report card query
export const ReportCardQuerySchema = z.object({
  school_year: z.string().min(1),
  term: z.coerce.number().int().min(1).max(3),
});

export type ReportCardQuery = z.infer<typeof ReportCardQuerySchema>;

export const ReportCardResponseSchema = z.object({
  student: z.object({
    id: z.number().int().positive(),
    lrn: z.string(),
    first_name: z.string(),
    middle_name: z.string().nullable().optional(),
    last_name: z.string(),
    grade_level: z.string(),
    track_strand: z.string().nullable().optional(),
  }),
  school_year: z.string(),
  term: z.number().int().min(1).max(3),
  quarter: z.number().int().min(1).max(3),
  subjects: z.array(GradeSchema),
  general_average: z.number().nullable(),
  gpa: z.number().nullable(),
  scale: z.object({
    id: z.number().int().positive(),
    code: z.string(),
    name: z.string(),
    scale_type: zGradeScaleType,
    passing_grade: z.number(),
    weights: GradeWeightsSchema,
  }),
});

export type ReportCardResponse = z.infer<typeof ReportCardResponseSchema>;

// Grade years
export const GradeYearsResponseSchema = z.object({
  data: z.array(z.object({
    school_year: z.string(),
    terms: z.number().int().nonnegative(),
    subjects: z.number().int().nonnegative(),
  })),
});

export type GradeYearsResponse = z.infer<typeof GradeYearsResponseSchema>;

// Grade export
export const GradeExportQuerySchema = z.object({
  section_id: z.coerce.number().int().positive(),
  subject_id: z.coerce.number().int().positive(),
  school_year: z.string().min(1),
  term: z.coerce.number().int().min(1).max(3),
  format: z.enum(['xlsx', 'csv']).default('xlsx').optional(),
});

export type GradeExportQuery = z.infer<typeof GradeExportQuerySchema>;

// Grade scale (grading_scales row, serialized by server/src/grading/scales.js parseScale)
export const GradeBandSchema = z.object({
  min: z.number(),
  max: z.number(),
  letter: z.string(),
  points: z.number().nullable(),
  label: z.string(),
});

export type GradeBand = z.infer<typeof GradeBandSchema>;

export const GradeScaleSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  code: z.string(),
  scale_type: zGradeScaleType,
  description: z.string().optional(),
  passing_grade: z.number(),
  weights: GradeWeightsSchema,
  bands: z.array(GradeBandSchema).optional(),
  credits_pass_only: z.boolean(),
  is_system: z.boolean(),
  is_default: z.boolean(),
  active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type GradeScale = z.infer<typeof GradeScaleSchema>;