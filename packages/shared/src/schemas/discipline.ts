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
  incident_id: z.number().int().positive(),
  action_type: zActionType,
  action_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(5000).nullable().optional(),
  done_by: z.number().int().positive(),
  created_at: z.string().datetime(),
  done_by_name: z.string().nullable().optional(),
});

export const DisciplineIncidentSchema = z.object({
  id: z.number().int().positive(),
  student_id: z.number().int().positive(),
  type: zIncidentType,
  severity: zIncidentSeverity,
  incident_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(5000),
  status: zIncidentStatus.default('open'),
  reported_by: z.number().int().positive(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  student_lrn: z.string().optional(),
  student_name: z.string().optional(),
  reported_by_name: z.string().optional(),
  days_open: z.number().int().nonnegative().optional(),
  actions: z.array(DisciplineActionSchema).optional(),
});

export type DisciplineIncident = z.infer<typeof DisciplineIncidentSchema>;

export type DisciplineAction = z.infer<typeof DisciplineActionSchema>;

export const CreateIncidentRequestSchema = z.object({
  student_id: z.number().int().positive(),
  type: zIncidentType,
  severity: zIncidentSeverity,
  incident_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1).max(5000),
});

export type CreateIncidentRequest = z.infer<typeof CreateIncidentRequestSchema>;

export const UpdateIncidentRequestSchema = z.object({
  type: zIncidentType.optional(),
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
  section_id: z.coerce.number().int().positive().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ...PaginationParamsSchema.shape,
});

export type DisciplineListQuery = z.infer<typeof DisciplineListQuerySchema>;

// KPI stats
export const DisciplineKpiSchema = z.object({
  open_cases: z.number().int().nonnegative(),
  under_review: z.number().int().nonnegative(),
  resolved: z.number().int().nonnegative(),
  this_month: z.number().int().nonnegative(),
  major_incidents: z.number().int().nonnegative(),
});

export type DisciplineKpi = z.infer<typeof DisciplineKpiSchema>;

// Chart data
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