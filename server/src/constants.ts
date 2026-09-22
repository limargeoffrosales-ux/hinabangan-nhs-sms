// Server constants matching @meridianed/shared constants
export const PARENT_ROLES = ['parent', 'guardian'] as const;
export const WRITE_ROLES = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'] as const;
export const ACCOUNT_ROLES = ['super_admin', 'school_admin'] as const;
export const LINK_APPROVE_ROLES = ['super_admin'] as const;
export const STAFF_ROLES = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar', 'teacher', 'guidance', 'security'] as const;
export const PORTAL_ROLES = ['student', 'parent'] as const;
export const WRITE = WRITE_ROLES;