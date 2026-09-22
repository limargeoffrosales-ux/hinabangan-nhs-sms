import { z } from 'zod';
import {
  zIncidentType,
  zIncidentSeverity,
  zIncidentStatus,
  zActionType,
} from '../enums';
import { PaginationParamsSchema } from './user';

// Forward declaration for recursive reference
const DisciplineActionSchema: z.ZodObject<any> = z.object({
  id: z.number().int().positive(),
  record_id: z.number().int().positive(),
  action_type: zActionType,
  action_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(5000).nullable().optional(),
  done_by: z.number().int().positive().nullable().optional(),
  created_at: z.string().datetime(),
  done_by_name: z.string().nullable().optional(),
});

export const DisciplineIncidentSchema = z.object({
  id: z.number().int().positive(),
  student_id: z.number().int().positive(),
  incident_type: zIncidentType,
  severity: zIncidentSeverity,
  incident_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(5000).nullable().optional(),
  status: zIncidentStatus.default('open'),
  reported_by: z.number().int().positive().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  // Joined fields
  student_name: z.string().optional(),
  lrn: z.string().optional(),
  grade_level: z.string().optional(),
  section_name: z.string().nullable().optional(),
  reported_by_name: z.string().nullable().optional(),
  action_count: z.number().int().nonnegative().optional(),
  days_open: z.number().int().nonnegative().optional(),
  actions: z.array(DisciplineActionSchema).optional(),
});

export type DisciplineIncident = z.infer<typeof DisciplineIncidentSchema>;

export type DisciplineAction = z.infer<typeof DisciplineActionSchema>;

export const CreateIncidentRequestSchema = z.object({
  student_id: z.number().int().positive(),
  incident_type: zIncidentType,
  severity: zIncidentSeverity.optional(),
  incident_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(5000).optional(),
  status: zIncidentStatus.optional(),
});

export type CreateIncidentRequest = z.infer<typeof CreateIncidentRequestSchema>;

export const UpdateIncidentRequestSchema = z.object({
  incident_type: zIncidentType.optional(),
  severity: zIncidentSeverity.optional(),
  incident_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string().max(5000).optional(),
  status: zIncidentStatus.optional(),
});

export type UpdateIncidentRequest = z.infer<typeof UpdateIncidentRequestSchema>;

export const AddActionRequestSchema = z.object({
  action_type: zActionType,
  action_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(5000).optional(),
});

export type AddActionRequest = z.infer<typeof AddActionRequestSchema>;

export const DisciplineListQuerySchema = z.object({
  q: z.string().optional(),
  status: zIncidentStatus.optional(),
  type: zIncidentType.optional(),
  severity: zIncidentSeverity.optional(),
  student_id: z.coerce.number().int().positive().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ...PaginationParamsSchema.shape,
});

export type DisciplineListQuery = z.infer<typeof DisciplineListQuerySchema>;

// Discipline summary response (/summary)
export const DisciplineKpiSchema = z.object({
  by_status: z.object({
    open: z.number().int().nonnegative(),
    under_review: z.number().int().nonnegative(),
    resolved: z.number().int().nonnegative(),
  }),
  by_type: z.record(z.number().int().nonnegative()),
  by_severity: z.object({
    minor: z.number().int().nonnegative(),
    moderate: z.number().int().nonnegative(),
    major: z.number().int().nonnegative(),
  }),
  cases_this_month: z.number().int().nonnegative(),
  recent: z.array(DisciplineIncidentSchema),
});

export type DisciplineKpi = z.infer<typeof DisciplineKpiSchema>;

// Chart data (derived from /summary)
export const DisciplineChartSchema = z.object({
  by_type: z.array(z.object({
    type: zIncidentType,
    count: z.number().int().nonnegative(),
  })),
  by_severity: z.array(z.object({
    severity: zIncidentSeverity,
    count: z.number().int().nonnegative(),
  })),
});

export type DisciplineChart = z.infer<typeof DisciplineChartSchema>;

// Export
export const DisciplineExportQuerySchema = z.object({
  section_id: z.coerce.number().int().positive().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  format: z.enum(['xlsx', 'csv']).default('xlsx').optional(),
});

export type DisciplineExportQuery = z.infer<typeof DisciplineExportQuerySchema>;