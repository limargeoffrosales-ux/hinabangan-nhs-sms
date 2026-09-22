import { z } from 'zod';
import { PaginationParamsSchema } from './user';

// question_bank row (`qb.*` + subject_title join)
export const QuestionSchema = z.object({
  id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  subject_id: z.number().int().positive().nullable().optional(),
  grade_level: z.string().nullable().optional(),
  competency: z.string().max(500).nullable().optional(),
  qtype: z.string().max(50),
  question: z.string().min(1).max(5000),
  options: z.array(z.string()).nullable().optional(),
  answer: z.string().max(5000).nullable().optional(),
  difficulty: z.number().int().min(1).max(3).default(2),
  used_count: z.number().int().nonnegative().default(0),
  competency_id: z.number().int().positive().nullable().optional(),
  created_at: z.string().datetime(),
  // Joined
  subject_title: z.string().nullable().optional(),
});

export type Question = z.infer<typeof QuestionSchema>;

export const CreateQuestionRequestSchema = z.object({
  subject_id: z.number().int().positive().optional(),
  grade_level: z.string().optional(),
  competency: z.string().max(500).optional(),
  qtype: z.string().max(50).default('mcq'),
  question: z.string().min(1).max(5000),
  options: z.array(z.string()).optional(),
  answer: z.string().max(5000).optional(),
  difficulty: z.number().int().min(1).max(3).default(2),
  competency_id: z.number().int().positive().optional(),
});

export type CreateQuestionRequest = z.infer<typeof CreateQuestionRequestSchema>;

export const UpdateQuestionRequestSchema = CreateQuestionRequestSchema.partial();

export type UpdateQuestionRequest = z.infer<typeof UpdateQuestionRequestSchema>;

export const QuestionListQuerySchema = z.object({
  q: z.string().optional(),
  subject_id: z.coerce.number().int().positive().optional(),
  qtype: z.string().optional(),
  competency: z.string().optional(),
  ...PaginationParamsSchema.shape,
});

export type QuestionListQuery = z.infer<typeof QuestionListQuerySchema>;

// rubrics row (`rb.*` + subject_title/user_name join); criteria is JSON parsed
export const RubricSchema = z.object({
  id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  title: z.string().min(1).max(200),
  subject_id: z.number().int().positive().nullable().optional(),
  task: z.string().nullable().optional(),
  criteria: z.array(z.object({
    criterion: z.string(),
    points: z.number(),
    description: z.string().optional(),
  })),
  created_at: z.string().datetime(),
  // Joined
  subject_title: z.string().nullable().optional(),
  user_name: z.string().nullable().optional(),
});

export type Rubric = z.infer<typeof RubricSchema>;

export const CreateRubricRequestSchema = z.object({
  title: z.string().min(1).max(200),
  subject_id: z.number().int().positive().optional(),
  task: z.string().optional(),
  criteria: z.array(z.object({
    criterion: z.string().min(1),
    points: z.number(),
    description: z.string().optional(),
  })).min(1),
});

export type CreateRubricRequest = z.infer<typeof CreateRubricRequestSchema>;

// tos_records row (`t.*` + subject_title/user_name join); data is JSON parsed
export const TosSchema = z.object({
  id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  title: z.string().min(1).max(200),
  subject_id: z.number().int().positive().nullable().optional(),
  quarter: z.number().int().min(1).max(4),
  data: z.array(z.object({
    competency: z.string(),
    item_type: z.enum(['knowledge', 'process', 'understanding', 'performance']),
    items: z.number(),
  })).nullable().optional(),
  created_at: z.string().datetime(),
  // Joined
  subject_title: z.string().nullable().optional(),
  user_name: z.string().nullable().optional(),
});

export type Tos = z.infer<typeof TosSchema>;

export const CreateTosRequestSchema = z.object({
  title: z.string().min(1).max(200),
  subject_id: z.number().int().positive().optional(),
  quarter: z.coerce.number().int().min(1).max(4).default(1),
  data: z.array(z.object({
    competency: z.string().min(1),
    item_type: z.enum(['knowledge', 'process', 'understanding', 'performance']),
    items: z.number().int().positive(),
  })).min(1),
});

export type CreateTosRequest = z.infer<typeof CreateTosRequestSchema>;

// item_analyses row (`a.*` + subject_title/user_name join)
export const ItemAnalysisSchema = z.object({
  id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  title: z.string().min(1).max(200),
  school_year: z.string().min(1),
  subject_id: z.number().int().positive().nullable().optional(),
  total_items: z.number().int().nonnegative().default(0),
  learners: z.number().int().positive(),
  data: z.unknown().nullable().optional(),
  computed: z.unknown().nullable().optional(),
  created_at: z.string().datetime(),
  // Joined
  subject_title: z.string().nullable().optional(),
  user_name: z.string().nullable().optional(),
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
  items: z.array(z.object({
    upper_correct: z.number().int().nonnegative(),
    lower_correct: z.number().int().nonnegative(),
  })).min(1),
  learners: z.number().int().positive(),
  title: z.string().max(200).optional(),
  school_year: z.string().min(1).optional(),
  subject_id: z.number().int().positive().optional(),
});

export type ComputeItemAnalysisRequest = z.infer<typeof ComputeItemAnalysisRequestSchema>;

export const SaveItemAnalysisRequestSchema = z.object({
  title: z.string().min(1).max(200),
  school_year: z.string().min(1),
  subject_id: z.number().int().positive().optional(),
  learners: z.number().int().positive(),
  total_items: z.number().int().nonnegative().optional(),
  data: z.object({
    items: z.array(z.object({
      upper_correct: z.number().int().nonnegative(),
      lower_correct: z.number().int().nonnegative(),
      difficulty: z.number(),
      discrimination: z.number(),
      level: z.string(),
      quality: z.string(),
    })).min(1),
  }).optional(),
  computed: z.unknown().optional(),
});

export type SaveItemAnalysisRequest = z.infer<typeof SaveItemAnalysisRequestSchema>;