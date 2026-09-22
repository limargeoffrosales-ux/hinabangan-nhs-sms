// Real-time event types
import { z } from 'zod';

export const RealtimeEventType = [
  'announcement',
  'notification',
  'attendance_alert',
  'grade_posted',
] as const;

export type RealtimeEventType = (typeof RealtimeEventType)[number];

export const RealtimeConnectionSchema = z.object({
  type: z.literal('connected'),
});

export const RealtimePingSchema = z.object({
  type: z.literal('ping'),
  timestamp: z.string().datetime(),
});

export const AnnouncementRealtimePayloadSchema = z.object({
  action: z.enum(['created', 'updated', 'deleted']),
  id: z.number().int().positive(),
  title: z.string().optional(),
  audience: z.string().optional(),
});

export type AnnouncementRealtimePayload = z.infer<typeof AnnouncementRealtimePayloadSchema>;

export const NotificationRealtimePayloadSchema = z.object({
  event: z.enum(['attendance_alert', 'grade_posted', 'link_approved', 'link_rejected', 'password_reset', 'account_registered']),
  created: z.string().datetime(),
  user_id: z.number().int().positive().optional(),
  data: z.record(z.unknown()).optional(),
});

export type NotificationRealtimePayload = z.infer<typeof NotificationRealtimePayloadSchema>;

// Union of all realtime payloads
export const RealtimeMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('connected') }),
  z.object({ type: z.literal('ping'), timestamp: z.string().datetime() }),
  z.object({ type: z.literal('announcement'), payload: AnnouncementRealtimePayloadSchema }),
  z.object({ type: z.literal('notification'), payload: NotificationRealtimePayloadSchema }),
]);

export type RealtimeMessage = z.infer<typeof RealtimeMessageSchema>;

// Server-to-server broadcast types
export const BroadcastEventSchema = z.object({
  type: z.enum(RealtimeEventType),
  payload: z.unknown(),
});

export type BroadcastEvent = z.infer<typeof BroadcastEventSchema>;