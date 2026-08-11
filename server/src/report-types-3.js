// Paperless submissions taxonomy — part 3.
// Line format: group|frequency|code|name|is_deped_form|auto_generate|required
const PART3 = `
Professional Development|periodic|seminar_certificates|Seminar Certificates|0|0|0
Professional Development|periodic|training_certificates|Training Certificates|0|0|0
Professional Development|periodic|webinar_certificates|Webinar Certificates|0|0|0
Professional Development|periodic|graduate_studies|Graduate Studies|0|0|0
Professional Development|periodic|transcript|Transcript|0|0|0
Professional Development|periodic|diploma|Diploma|0|0|0
Professional Development|periodic|lac_participation|LAC Participation|0|0|1
Professional Development|periodic|inset_attendance|INSET Attendance|0|0|1
Professional Development|periodic|professional_reading_logs|Professional Reading Logs|0|0|0
School Activities|periodic|activity_proposal|Activity Proposal|0|1|1
School Activities|periodic|program_flow|Program Flow|0|0|1
School Activities|periodic|activity_attendance|Activity Attendance|0|0|1
School Activities|periodic|activity_documentation|Activity Documentation|0|0|0
School Activities|periodic|activity_photos|Activity Photos|0|0|0
School Activities|periodic|activity_videos|Activity Videos|0|0|0
School Activities|periodic|activity_financial_report|Activity Financial Report|0|0|0
School Activities|periodic|activity_narrative_report|Activity Narrative Report|0|1|1
School Activities|periodic|activity_liquidation|Activity Liquidation|0|0|0
School Activities|periodic|activity_evaluation|Activity Evaluation|0|0|0
Property and Inventory|periodic|inventory_report|Inventory Report|0|0|1
Property and Inventory|periodic|classroom_inventory|Classroom Inventory|0|0|1
Property and Inventory|periodic|borrowed_equipment|Borrowed Equipment|0|0|0
Property and Inventory|periodic|lost_equipment|Lost Equipment|0|0|0
Property and Inventory|periodic|ict_inventory|ICT Inventory|0|0|1
Property and Inventory|periodic|laboratory_inventory|Laboratory Inventory|0|0|0
Property and Inventory|periodic|furniture_inventory|Furniture Inventory|0|0|0
Guidance and Discipline|periodic|incident_report|Incident Report|0|0|0
Guidance and Discipline|periodic|bullying_report|Bullying Report|0|0|0
Guidance and Discipline|periodic|child_protection_referral|Child Protection Referral|0|0|0
Guidance and Discipline|periodic|guidance_referral|Guidance Referral|0|0|1
Guidance and Discipline|periodic|counseling_notes|Counseling Notes|0|0|0
Guidance and Discipline|periodic|parent_conference_report|Parent Conference Report|0|0|0
Guidance and Discipline|periodic|behavior_monitoring|Behavior Monitoring|0|0|0
Guidance and Discipline|periodic|case_documentation|Case Documentation|0|0|0
Health and Safety|periodic|accident_report|Accident Report|0|0|0
Health and Safety|periodic|injury_report|Injury Report|0|0|0
Health and Safety|periodic|emergency_incident|Emergency Incident|0|0|0
Health and Safety|periodic|fire_drill_attendance|Fire Drill Attendance|0|0|0
Health and Safety|periodic|disaster_drill_attendance|Disaster Drill Attendance|0|0|0
Health and Safety|periodic|safety_inspection|Safety Inspection|0|0|0
Health and Safety|periodic|medical_referral|Medical Referral|0|0|0
Finance|periodic|liquidation|Liquidation|0|0|0
Finance|periodic|purchase_request|Purchase Request|0|1|0
Finance|periodic|reimbursement|Reimbursement|0|0|0
Finance|periodic|cash_advance|Cash Advance|0|0|0
Finance|periodic|budget_proposal|Budget Proposal|0|1|0
Finance|periodic|receipt_upload|Receipt Upload|0|0|0
Human Resource|periodic|leave_application|Leave Application|0|1|0
Human Resource|periodic|hr_dtr|DTR (HR)|0|0|1
Human Resource|periodic|overtime_request|Overtime Request|0|0|0
Human Resource|periodic|official_business|Official Business|0|0|0
Human Resource|periodic|travel_order|Travel Order|0|0|0
Human Resource|periodic|service_record_request|Service Record Request|0|0|0
Human Resource|periodic|clearance|Clearance|0|0|0
AI-Assisted Documents|periodic|ai_lesson_plan_draft|AI Lesson Plan Draft|0|1|0
AI-Assisted Documents|periodic|ai_exam_draft|AI Exam Draft|0|1|0
AI-Assisted Documents|periodic|ai_rubric_draft|AI Rubric Draft|0|1|0
AI-Assisted Documents|periodic|ai_powerpoint_outline|AI PowerPoint Outline|0|1|0
AI-Assisted Documents|periodic|ai_certificate_template|AI Certificate Template|0|1|0
AI-Assisted Documents|periodic|ai_narrative_draft|AI Narrative Report Draft|0|1|0
AI-Assisted Documents|periodic|ai_accomplishment_draft|AI Accomplishment Report Draft|0|1|0
AI-Assisted Documents|periodic|ai_parent_letter|AI Parent Letter|0|1|0
AI-Assisted Documents|periodic|ai_recommendation_letter|AI Recommendation Letter|0|1|0
AI-Assisted Documents|periodic|ai_meeting_minutes|AI Meeting Minutes|0|1|0
AI-Assisted Documents|periodic|ai_reading_report|AI Reading Report Draft|0|1|0
AI-Assisted Documents|periodic|ai_intervention_draft|AI Intervention Plan Draft|0|1|0
AI-Assisted Documents|periodic|ai_progress_report|AI Progress Report Draft|0|1|0
AI-Assisted Documents|periodic|ai_observation_draft|AI Observation Report Draft|0|1|0
AI-Assisted Documents|periodic|ai_observation_response|AI Classroom Observation Response|0|1|0
`;
module.exports = PART3;