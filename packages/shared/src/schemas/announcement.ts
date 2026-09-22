import { z } from 'zod';
import {
  zAnnouncementAudience,
  zAnnouncementPriority,
} from '../enums';
import { PaginationParamsSchema } from './user';

export const AnnouncementSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  audience: zAnnouncementAudience.default('all'),
  priority: zAnnouncementPriority.default('normal'),
  author_id: z.number().int().positive().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  // Joined fields
  author_name: z.string().nullable().optional(),
});

export type Announcement = z.infer<typeof AnnouncementSchema>;

export const CreateAnnouncementRequestSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  audience: zAnnouncementAudience.default('all'),
  priority: zAnnouncementPriority.default('normal'),
});

export type CreateAnnouncementRequest = z.infer<typeof CreateAnnouncementRequestSchema>;

export const UpdateAnnouncementRequestSchema = CreateAnnouncementRequestSchema.partial();

export type UpdateAnnouncementRequest = z.infer<typeof UpdateAnnouncementRequestSchema>;

export const AnnouncementListQuerySchema = z.object({
  audience: zAnnouncementAudience.optional(),
  priority: zAnnouncementPriority.optional(),
  ...PaginationParamsSchema.shape,
});

export type AnnouncementListQuery = z.infer<typeof AnnouncementListQuerySchema>;