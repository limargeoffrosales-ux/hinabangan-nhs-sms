import { z } from 'zod';
import { zAttendanceStatus } from '../enums';
import { PaginationParamsSchema } from './user';

// Attendance record from database
export const AttendanceSchema = z.object({
  id: z.number().int().positive(),
  student_id: z.number().int().positive(),
  section_id: z.number().int().positive().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: zAttendanceStatus.default('present'),
  session: z.string().max(20).nullable().optional(), // e.g., 'AM', 'PM'
  time_in: z.string().datetime().nullable().optional(),
  time_out: z.string().datetime().nullable().optional(),
  remarks: z.string().max(500).nullable().optional(),
  recorded_by: z.number().int().positive().nullable().optional(),
  created_at: z.string().datetime(),
  // Joined fields
  lrn: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  section_name: z.string().nullable().optional(),
  recorded_by_name: z.string().nullable().optional(),
});

export type Attendance = z.infer<typeof AttendanceSchema>;

// Attendance list query
export const AttendanceListQuerySchema = z.object({
  section_id: z.coerce.number().int().positive().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ...PaginationParamsSchema.shape,
});

export type AttendanceListQuery = z.infer<typeof AttendanceListQuerySchema>;

// Attendance bulk save
export const AttendanceBulkRecordSchema = z.object({
  student_id: z.number().int().positive(),
  status: zAttendanceStatus,
  session: z.string().max(20).optional(),
  remarks: z.string().max(500).optional(),
});

export const AttendanceBulkRequestSchema = z.object({
  section_id: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  records: z.array(AttendanceBulkRecordSchema).min(1),
});

export type AttendanceBulkRequest = z.infer<typeof AttendanceBulkRequestSchema>;

// Attendance check (single student)
export const AttendanceCheckRequestSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: zAttendanceStatus.default('present'),
  session: z.string().max(20).optional(),
  section_id: z.number().int().positive().optional(),
  remarks: z.string().max(500).optional(),
});

export type AttendanceCheckRequest = z.infer<typeof AttendanceCheckRequestSchema>;

// Student attendance history
export const StudentAttendanceQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  year: z.string().regex(/^\d{4}$/).optional(),
  summary: z.enum(['0', '1']).optional(),
});

export type StudentAttendanceQuery = z.infer<typeof StudentAttendanceQuerySchema>;

export const StudentAttendanceResponseSchema = z.object({
  student: z.object({
    id: z.number().int().positive(),
    first_name: z.string(),
    last_name: z.string(),
    lrn: z.string(),
  }),
  data: z.array(AttendanceSchema),
  summary: z.object({
    counts: z.object({
      present: z.number().int().nonnegative(),
      absent: z.number().int().nonnegative(),
      late: z.number().int().nonnegative(),
      excused: z.number().int().nonnegative(),
    }),
    total: z.number().int().nonnegative(),
    rate: z.number().nullable(),
  }).optional(),
});

// Export
export const AttendanceExportQuerySchema = z.object({
  section_id: z.coerce.number().int().positive().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  format: z.enum(['xlsx', 'csv']).default('xlsx').optional(),
});

export type AttendanceExportQuery = z.infer<typeof AttendanceExportQuerySchema>;

export type StudentAttendanceResponse = z.infer<typeof StudentAttendanceResponseSchema>;

// Attendance summary
export const AttendanceSummarySchema = z.object({
  counts: z.object({
    present: z.number().int().nonnegative(),
    absent: z.number().int().nonnegative(),
    late: z.number().int().nonnegative(),
    excused: z.number().int().nonnegative(),
  }),
  total: z.number().int().nonnegative(),
  rate: z.number().nullable(),
});

export type AttendanceSummary = z.infer<typeof AttendanceSummarySchema>;