// Enums matching the database and application logic
import { z } from 'zod';

export const UserRole = [
  'super_admin',
  'school_admin',
  'principal',
  'assistant_principal',
  'registrar',
  'teacher',
  'guidance',
  'security',
  'student',
  'parent',
] as const;

export type UserRole = (typeof UserRole)[number];

export const UserStatus = ['active', 'inactive', 'suspended'] as const;
export type UserStatus = (typeof UserStatus)[number];

export const StudentStatus = ['enrolled', 'transferred', 'dropped', 'graduated'] as const;
export type StudentStatus = (typeof StudentStatus)[number];

export const Sex = ['Male', 'Female'] as const;
export type Sex = (typeof Sex)[number];

export const AttendanceStatus = ['present', 'absent', 'late', 'excused', 'half_day'] as const;
export type AttendanceStatus = (typeof AttendanceStatus)[number];

export const GradeQuarter = [1, 2, 3, 4] as const;
export type GradeQuarter = (typeof GradeQuarter)[number];

export const IncidentType = [
  'call_slip',
  'bullying',
  'inappropriate_behavior',
  'fighting',
  'vandalism',
  'tardiness',
  'disrespect',
  'other',
] as const;
export type IncidentType = (typeof IncidentType)[number];

export const IncidentSeverity = ['minor', 'moderate', 'major'] as const;
export type IncidentSeverity = (typeof IncidentSeverity)[number];

export const IncidentStatus = ['open', 'under_review', 'resolved'] as const;
export type IncidentStatus = (typeof IncidentStatus)[number];

export const ActionType = [
  'warning',
  'counseling',
  'parent_conference',
  'detention',
  'community_service',
  'suspension',
  'referral',
  'other',
] as const;
export type ActionType = (typeof ActionType)[number];

export const CertificationType = ['NCII', 'TESDA', 'OTHER'] as const;
export type CertificationType = (typeof CertificationType)[number];

export const CertificationStatus = ['active', 'expired', 'pending'] as const;
export type CertificationStatus = (typeof CertificationStatus)[number];

export const ConsentFormType = ['custom', 'data_privacy', 'photo_video', 'ai_usage'] as const;
export type ConsentFormType = (typeof ConsentFormType)[number];

export const ConsentFormStatus = ['active', 'inactive'] as const;
export type ConsentFormStatus = (typeof ConsentFormStatus)[number];

export const ConsentResponseStatus = ['signed', 'pending'] as const;
export type ConsentResponseStatus = (typeof ConsentResponseStatus)[number];

export const ComplianceStatus = ['complied', 'not_complied', 'overdue', 'draft', 'submitted', 'reviewed', 'approved', 'returned'] as const;
export type ComplianceStatus = (typeof ComplianceStatus)[number];

export const AssignmentKind = ['homework', 'quiz', 'performance_task', 'project'] as const;
export type AssignmentKind = (typeof AssignmentKind)[number];

export const SubmissionStatus = ['not_submitted', 'submitted', 'graded', 'returned'] as const;
export type SubmissionStatus = (typeof SubmissionStatus)[number];

export const NotificationKind = [
  'announcement',
  'attendance_alert',
  'grade_posted',
  'link_approved',
  'link_rejected',
  'password_reset',
  'account_registered',
] as const;
export type NotificationKind = (typeof NotificationKind)[number];

export const AnnouncementAudience = ['all', 'staff', 'students', 'parents', 'teachers'] as const;
export type AnnouncementAudience = (typeof AnnouncementAudience)[number];

export const AnnouncementPriority = ['low', 'normal', 'high', 'urgent'] as const;
export type AnnouncementPriority = (typeof AnnouncementPriority)[number];

export const ReportTypeCode = [
  'SF1', 'SF2', 'SF3', 'SF4', 'SF5', 'SF6', 'SF7', 'SF8', 'SF9', 'SF10',
  'summary_of_grades',
  'form137',
  'form138',
] as const;
export type ReportTypeCode = (typeof ReportTypeCode)[number];

export const ReportSubmissionStatus = ['draft', 'submitted', 'reviewed', 'approved', 'returned'] as const;
export type ReportSubmissionStatus = (typeof ReportSubmissionStatus)[number];

export const ImmersionStatus = ['pending', 'ongoing', 'completed', 'served', 'withdrawn'] as const;
export type ImmersionStatus = (typeof ImmersionStatus)[number];

export const ImmersionGender = ['Male', 'Female'] as const;
export type ImmersionGender = (typeof ImmersionGender)[number];

export const ConductValue = ['Maka-Diyos', 'Maka-Tao', 'Makakalikasan', 'Makabansa'] as const;
export type ConductValue = (typeof ConductValue)[number];

export const TermOption = [1, 2, 3, 4] as const;
export type TermOption = (typeof TermOption)[number];

export const GradeLevel = [
  '7', '8', '9', '10', '11', '12',
] as const;
export type GradeLevel = (typeof GradeLevel)[number];

export const GradeScaleType = [
  'percentage', 'points', 'letter', 'proficiency',
] as const;
export type GradeScaleType = (typeof GradeScaleType)[number];

// Zod enum helpers
export const zUserRole = z.enum(UserRole);
export const zUserStatus = z.enum(UserStatus);
export const zStudentStatus = z.enum(StudentStatus);
export const zSex = z.enum(Sex);
export const zAttendanceStatus = z.enum(AttendanceStatus);
export const zGradeQuarter = z.enum(GradeQuarter.map(String) as [string, ...string[]]);
export const zIncidentType = z.enum(IncidentType);
export const zIncidentSeverity = z.enum(IncidentSeverity);
export const zIncidentStatus = z.enum(IncidentStatus);
export const zActionType = z.enum(ActionType);
export const zCertificationType = z.enum(CertificationType);
export const zCertificationStatus = z.enum(CertificationStatus);
export const zConsentFormType = z.enum(ConsentFormType);
export const zConsentFormStatus = z.enum(ConsentFormStatus);
export const zConsentResponseStatus = z.enum(ConsentResponseStatus);
export const zComplianceStatus = z.enum(ComplianceStatus);
export const zAssignmentKind = z.enum(AssignmentKind);
export const zSubmissionStatus = z.enum(SubmissionStatus);
export const zNotificationKind = z.enum(NotificationKind);
export const zAnnouncementAudience = z.enum(AnnouncementAudience);
export const zAnnouncementPriority = z.enum(AnnouncementPriority);
export const zReportTypeCode = z.enum(ReportTypeCode);
export const zReportSubmissionStatus = z.enum(ReportSubmissionStatus);
export const zImmersionStatus = z.enum(ImmersionStatus);
export const zImmersionGender = z.enum(ImmersionGender);
export const zConductValue = z.enum(ConductValue);
export const zTermOption = z.enum(TermOption.map(String) as [string, ...string[]]);
export const zGradeLevel = z.enum(GradeLevel);
export const zGradeScaleType = z.enum(GradeScaleType);