import { z } from 'zod';
import { PaginationParamsSchema } from './user';

export const QuestionSchema = z.object({
  id: z.number().int().positive(),
  question: z.string().min(1).max(5000),
  competency: z.string().max(500).nullable().optional(),
  type: z.string().max(50),
  answer: z.string().max(5000).nullable().optional(),
  difficulty: z.number().int().min(1).max(3).nullable().optional(),
  used: z.boolean().default(false),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Question = z.infer<typeof QuestionSchema>;

export const CreateQuestionRequestSchema = z.object({
  question: z.string().min(1).max(5000),
  competency: z.string().max(500).optional(),
  type: z.string().max(50),
  answer: z.string().max(5000).optional(),
  difficulty: z.number().int().min(1).max(3).optional(),
});

export type CreateQuestionRequest = z.infer<typeof CreateQuestionRequestSchema>;

export const UpdateQuestionRequestSchema = CreateQuestionRequestSchema.partial();

export type UpdateQuestionRequest = z.infer<typeof UpdateQuestionRequestSchema>;

export const QuestionListQuerySchema = z.object({
  q: z.string().optional(),
  competency: z.string().optional(),
  type: z.string().optional(),
  ...PaginationParamsSchema.shape,
});

export type QuestionListQuery = z.infer<typeof QuestionListQuerySchema>;

// Rubric
export const RubricSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(200),
  criteria: z.array(z.object({
    criterion: z.string().min(1).max(200),
    points: z.number().int().positive(),
    description: z.string().max(500).optional(),
  })),
  total_points: z.number().int().positive(),
  is_general: z.boolean().default(false),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Rubric = z.infer<typeof RubricSchema>;

export const CreateRubricRequestSchema = z.object({
  title: z.string().min(1).max(200),
  criteria: z.array(z.object({
    criterion: z.string().min(1).max(200),
    points: z.number().int().positive(),
    description: z.string().max(500).optional(),
  })).min(1),
  is_general: z.boolean().default(false),
});

export type CreateRubricRequest = z.infer<typeof CreateRubricRequestSchema>;

// TOS (Table of Specifications)
export const TosSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(200),
  term: z.number().int().min(1).max(4),
  subject_id: z.number().int().positive(),
  items: z.array(z.object({
    competency: z.string().min(1).max(500),
    item_type: z.enum(['knowledge', 'process', 'understanding', 'performance']),
    items: z.number().int().positive(),
  })),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Tos = z.infer<typeof TosSchema>;

export const CreateTosRequestSchema = z.object({
  title: z.string().min(1).max(200),
  term: z.number().int().min(1).max(4),
  subject_id: z.number().int().positive(),
  items: z.array(z.object({
    competency: z.string().min(1).max(500),
    item_type: z.enum(['knowledge', 'process', 'understanding', 'performance']),
    items: z.number().int().positive(),
  })).min(1),
});

export type CreateTosRequest = z.infer<typeof CreateTosRequestSchema>;

// Item Analysis
export const ItemAnalysisSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(200),
  school_year: z.string().min(1),
  learners: z.number().int().positive(),
  created_at: z.string().datetime(),
});

export type ItemAnalysis = z.infer<typeof ItemAnalysisSchema>;

export const ItemAnalysisResultSchema = z.object({
  item: z.number().int().positive(),
  upper_correct: z.number().int().nonnegative(),
  lower_correct: z.number().int().nonnegative(),
  difficulty: z.number(),
  discrimination: z.number(),
  level: z.string(),
  quality: z.string(),
});

export type ItemAnalysisResult = z.infer<typeof ItemAnalysisResultSchema>;

export const ComputeItemAnalysisRequestSchema = z.object({
  title: z.string().min(1).max(200),
  school_year: z.string().min(1),
  learners: z.number().int().positive(),
  items: z.array(z.object({
    upper_correct: z.number().int().nonnegative(),
    lower_correct: z.number().int().nonnegative(),
  })).min(1),
});

export type ComputeItemAnalysisRequest = z.infer<typeof ComputeItemAnalysisRequestSchema>;

export const SaveItemAnalysisRequestSchema = z.object({
  title: z.string().min(1).max(200),
  school_year: z.string().min(1),
  learners: z.number().int().positive(),
  items: z.array(z.object({
    upper_correct: z.number().int().nonnegative(),
    lower_correct: z.number().int().nonnegative(),
    difficulty: z.number(),
    discrimination: z.number(),
    level: z.string(),
    quality: z.string(),
  })).min(1),
});

export type SaveItemAnalysisRequest = z.infer<typeof SaveItemAnalysisRequestSchema>;