import { z } from 'zod';
import {
  zConsentFormType,
  zConsentResponseStatus,
} from '../enums';
import { FlagSchema } from '../utils';
import { PaginationParamsSchema } from './user';

export const ConsentFormSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(200),
  description: z.string().max(500).nullable().optional(),
  content: z.string().min(1),
  form_type: zConsentFormType,
  is_active: FlagSchema,
  require_sign: FlagSchema,
  created_by: z.number().int().positive().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  // Joined/computed
  response_count: z.number().int().nonnegative().optional(),
  signed_by_me: z.number().int().nonnegative().optional(),
  eligible_students: z.array(z.object({
    id: z.number().int().positive(),
    lrn: z.string(),
    first_name: z.string(),
    last_name: z.string(),
  })).optional(),
});

export type ConsentForm = z.infer<typeof ConsentFormSchema>;

export const CreateConsentFormRequestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  form_type: zConsentFormType,
  content: z.string().min(1),
  is_active: z.union([z.boolean(), FlagSchema]).default(1),
  require_sign: z.union([z.boolean(), FlagSchema]).default(1),
});

export type CreateConsentFormRequest = z.infer<typeof CreateConsentFormRequestSchema>;

export const UpdateConsentFormRequestSchema = CreateConsentFormRequestSchema.partial();

export type UpdateConsentFormRequest = z.infer<typeof UpdateConsentFormRequestSchema>;

export const ConsentFormListQuerySchema = z.object({
  is_active: z.union([z.boolean(), FlagSchema]).optional(),
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
  user_id: z.number().int().positive(),
  student_id: z.number().int().positive().nullable().optional(),
  status: zConsentResponseStatus,
  signature_name: z.string().nullable().optional(),
  ip_address: z.string().nullable().optional(),
  signed_at: z.string().datetime(),
  // Joined
  user_name: z.string().optional(),
  username: z.string().optional(),
  form_title: z.string().optional(),
});

export type ConsentResponse = z.infer<typeof ConsentResponseSchema>;