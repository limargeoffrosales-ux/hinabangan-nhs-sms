import { z } from 'zod';
import {
  zUserRole,
  zUserStatus,
} from '../enums';

// User from database
export const UserSchema = z.object({
  id: z.number().int().positive(),
  username: z.string().min(3).max(100),
  name: z.string().min(1).max(200),
  role: zUserRole,
  email: z.string().email().nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  status: zUserStatus,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  // MFA fields
  mfa_enabled: z.boolean().optional(),
  mfa_secret: z.string().nullable().optional(),
  // Lockout fields
  failed_attempts: z.number().int().nonnegative().optional(),
  locked_until: z.string().datetime().nullable().optional(),
  // Password change tracking
  password_changed_at: z.string().datetime().nullable().optional(),
  // Password hash (never exposed via API)
  password_hash: z.string().optional(),
});

export type User = z.infer<typeof UserSchema>;

// User for API responses (excludes sensitive fields)
export const PublicUserSchema = UserSchema.omit({
  password_hash: true,
  mfa_secret: true,
});

export type PublicUser = z.infer<typeof PublicUserSchema>;

// Login request
export const LoginRequestSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(128),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

// Login response
export const LoginResponseSchema = z.object({
  token: z.string(),
  refreshToken: z.string(),
  csrfToken: z.string(),
  user: PublicUserSchema,
  requiresMfa: z.boolean().optional(),
  tempToken: z.string().optional(),
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

// Refresh request/response
export const RefreshRequestSchema = z.object({
  refreshToken: z.string(),
});

export const RefreshResponseSchema = z.object({
  token: z.string(),
  refreshToken: z.string(),
  csrfToken: z.string(),
});

// MFA verification
export const MfaVerifyRequestSchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/),
  tempToken: z.string(),
});

export const MfaSetupResponseSchema = z.object({
  secret: z.string(),
  qrCodeUrl: z.string().url(),
  backupCodes: z.array(z.string()),
});

// Change password
export const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(1).max(128),
});

// Forgot password
export const ForgotPasswordRequestSchema = z.object({
  identifier: z.string().min(1).max(200),
});

export const ForgotPasswordResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
});

// Reset password
export const ResetPasswordRequestSchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/),
  newPassword: z.string().min(1).max(128),
});

// Self-registration
export const RegisterRequestSchema = z.object({
  lrn: z.string().regex(/^\d{12}$/),
  last_name: z.string().min(1).max(100),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(1).max(128),
  first_name: z.string().max(100).optional(),
  email: z.string().email().max(200).optional(),
  phone: z.string().max(40).optional(),
});

export const RegisterResponseSchema = z.object({
  ok: z.boolean(),
  status: z.enum(['pending']),
  message: z.string(),
});

// User creation (admin)
export const CreateUserRequestSchema = z.object({
  username: z.string().min(3).max(100).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(1).max(128),
  name: z.string().min(1).max(200),
  role: zUserRole,
  email: z.string().email().max(200).optional(),
  phone: z.string().max(40).optional(),
  status: zUserStatus.default('active'),
});

export const UpdateUserRequestSchema = CreateUserRequestSchema.partial().omit({ username: true }).extend({
  password: z.string().min(1).max(128).optional(),
});

// Pagination
export const PaginationParamsSchema = z.object({
  limit: z.coerce.number().int().positive().max(500).default(50).optional(),
  offset: z.coerce.number().int().nonnegative().default(0).optional(),
  page: z.coerce.number().int().positive().default(1).optional(),
});

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    total: z.number().int().nonnegative().optional(),
    page: z.number().int().positive().optional(),
    limit: z.number().int().positive().optional(),
    totalPages: z.number().int().nonnegative().optional(),
  });

export type PaginationParams = z.infer<typeof PaginationParamsSchema>;