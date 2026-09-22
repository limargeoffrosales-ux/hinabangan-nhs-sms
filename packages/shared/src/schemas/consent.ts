import { z } from 'zod';
import {
  zConsentFormType,
  zConsentFormStatus,
  zConsentResponseStatus,
} from '../enums';
import { PaginationParamsSchema } from './user';

export const ConsentFormSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(200),
  description: z.string().max(500).nullable().optional(),
  form_type: zConsentFormType,
  content: z.string().min(1),
  require_signature: z.boolean().default(true),
  status: zConsentFormStatus.default('active'),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  // Joined/computed
  responses_count: z.number().int().nonnegative().optional(),
  total_users: z.number().int().nonnegative().optional(),
  user_signed: z.boolean().optional(),
  user_signature: z.string().nullable().optional(),
  user_signed_at: z.string().datetime().nullable().optional(),
});

export type ConsentForm = z.infer<typeof ConsentFormSchema>;

export const CreateConsentFormRequestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  form_type: zConsentFormType,
  content: z.string().min(1),
  require_signature: z.boolean().default(true),
  status: zConsentFormStatus.default('active'),
});

export type CreateConsentFormRequest = z.infer<typeof CreateConsentFormRequestSchema>;

export const UpdateConsentFormRequestSchema = CreateConsentFormRequestSchema.partial();

export type UpdateConsentFormRequest = z.infer<typeof UpdateConsentFormRequestSchema>;

export const ConsentFormListQuerySchema = z.object({
  status: zConsentFormStatus.optional(),
  form_type: zConsentFormType.optional(),
  ...PaginationParamsSchema.shape,
});

export type ConsentFormListQuery = z.infer<typeof ConsentFormListQuerySchema>;

export const SignConsentRequestSchema = z.object({
  student_id: z.number().int().positive(),
  full_name: z.string().min(1).max(200),
});

export type SignConsentRequest = z.infer<typeof SignConsentRequestSchema>;

export const ConsentResponseSchema = z.object({
  id: z.number().int().positive(),
  form_id: z.number().int().positive(),
  student_id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  signed: z.boolean(),
  signature: z.string().nullable().optional(),
  signed_at: z.string().datetime().nullable().optional(),
  // Joined
  student_name: z.string().optional(),
  student_lrn: z.string().optional(),
  user_name: z.string().optional(),
});

export type ConsentResponse = z.infer<typeof ConsentResponseSchema>;