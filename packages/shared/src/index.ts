// Main exports for @meridianed/shared

// Enums & Zod enum schemas
export * from './enums';

// Constants
export * from './constants';

// Schemas
export * from './schemas/user';
export * from './schemas/student';
export * from './schemas/attendance';
export * from './schemas/grades';
export * from './schemas/section';
export * from './schemas/subject';
export * from './schemas/teacher';
export * from './schemas/announcement';
export * from './schemas/discipline';
export * from './schemas/certification';
export * from './schemas/consent';
export * from './schemas/compliance';
export * from './schemas/assignment';
export { type Question, type QuestionListQuery, type CreateQuestionRequest, type UpdateQuestionRequest, type Rubric as AssessmentRubric, type CreateRubricRequest, type Tos, type CreateTosRequest, type ItemAnalysis, type ItemAnalysisResult, type ComputeItemAnalysisRequest, type SaveItemAnalysisRequest } from './schemas/assessment';
export * from './schemas/realtime';

// Utility types
export type { z } from 'zod';