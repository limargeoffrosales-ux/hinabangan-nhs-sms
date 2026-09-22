import { z } from 'zod';
import { PaginationParamsSchema } from './user';

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
  weights: z.object({
    written_work: z.number(),
    performance_task: z.number(),
    quarterly_exam: z.number(),
  }),
  scale: z.object({
    id: z.number().int().positive(),
    code: z.string(),
    name: z.string(),
    scale_type: z.string(),
    passing_grade: z.number(),
    weights: z.object({
      written_work: z.number(),
      performance_task: z.number(),
      quarterly_exam: z.number(),
    }),
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
    scale_type: z.string(),
    passing_grade: z.number(),
    weights: z.object({
      written_work: z.number(),
      performance_task: z.number(),
      quarterly_exam: z.number(),
    }),
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
    scale_type: z.string(),
    passing_grade: z.number(),
    weights: z.object({
      written_work: z.number(),
      performance_task: z.number(),
      quarterly_exam: z.number(),
    }),
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

// Grade scale
export const GradeScaleSchema = z.object({
  id: z.number().int().positive(),
  code: z.string(),
  name: z.string(),
  scale_type: z.enum(['percentage', 'points', 'letter', 'proficiency']),
  passing_grade: z.number(),
  weights: z.object({
    written_work: z.number(),
    performance_task: z.number(),
    quarterly_exam: z.number(),
  }),
  // Scale-specific fields
  percentage_min: z.number().nullable().optional(),
  percentage_max: z.number().nullable().optional(),
  points_min: z.number().nullable().optional(),
  points_max: z.number().nullable().optional(),
  letter_grades: z.array(z.object({
    min: z.number(),
    max: z.number(),
    letter: z.string(),
    points: z.number().optional(),
  })).optional(),
  proficiency_levels: z.array(z.object({
    name: z.string(),
    min: z.number(),
    max: z.number(),
    description: z.string().optional(),
  })).optional(),
  active: z.boolean(),
});

export type GradeScale = z.infer<typeof GradeScaleSchema>;