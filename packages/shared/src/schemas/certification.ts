import { z } from 'zod';
import { zCertificationType, zCertificationStatus } from '../enums';
import { PaginationParamsSchema } from './user';

export const CertificationSchema = z.object({
  id: z.number().int().positive(),
  student_id: z.number().int().positive(),
  certification_name: z.string().min(1).max(200),
  type: zCertificationType,
  specialization: z.string().max(200).nullable().optional(),
  date_acquired: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status: zCertificationStatus.default('active'),
  issuing_body: z.string().max(200).nullable().optional(),
  certificate_no: z.string().max(100).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  // Joined fields
  student_lrn: z.string().optional(),
  student_name: z.string().optional(),
});

export type Certification = z.infer<typeof CertificationSchema>;

export const CreateCertificationRequestSchema = z.object({
  student_id: z.number().int().positive(),
  certification_name: z.string().min(1).max(200),
  type: zCertificationType,
  specialization: z.string().max(200).optional(),
  date_acquired: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: zCertificationStatus.default('active'),
  issuing_body: z.string().max(200).optional(),
  certificate_no: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

export type CreateCertificationRequest = z.infer<typeof CreateCertificationRequestSchema>;

export const UpdateCertificationRequestSchema = CreateCertificationRequestSchema.partial();

export type UpdateCertificationRequest = z.infer<typeof UpdateCertificationRequestSchema>;

export const CertificationListQuerySchema = z.object({
  q: z.string().optional(),
  type: zCertificationType.optional(),
  status: zCertificationStatus.optional(),
  ...PaginationParamsSchema.shape,
});

export type CertificationListQuery = z.infer<typeof CertificationListQuerySchema>;

export const CertificationKpiSchema = z.object({
  total: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  expiring: z.number().int().nonnegative(),
});

export type CertificationKpi = z.infer<typeof CertificationKpiSchema>;