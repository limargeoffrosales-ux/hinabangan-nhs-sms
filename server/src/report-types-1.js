// Paperless submissions taxonomy — part 1.
// Line format: group|frequency|code|name|is_deped_form|auto_generate|required
const PART1 = `
Daily Attendance|daily|daily_student_attendance|Daily Student Attendance|0|0|1
Daily Attendance|daily|teacher_dtr|Teacher Attendance (DTR)|0|0|1
Daily Attendance|daily|learner_absentees|Learner Absentees|0|0|1
Daily Attendance|daily|late_students|Late Students|0|0|1
Daily Attendance|daily|early_dismissals|Early Dismissals|0|0|1
Daily Attendance|daily|excused_absences|Excused Absences|0|0|1
Daily Attendance|daily|attendance_summary|Attendance Summary|0|0|1
Teaching Documents|daily|dll|Daily Lesson Log (DLL)|0|1|1
Teaching Documents|daily|dlp|Detailed Lesson Plan (DLP)|0|1|1
Teaching Documents|daily|lesson_exemplar|Lesson Exemplar|0|1|1
Teaching Documents|daily|learning_activity_sheets|Learning Activity Sheets (LAS)|0|1|1
Teaching Documents|weekly|weekly_learning_plan|Weekly Learning Plan|0|1|1
Teaching Documents|periodic|teaching_guide|Teaching Guide|0|0|1
Teaching Documents|periodic|powerpoint|PowerPoint Presentation|0|1|0
Teaching Documents|periodic|supplementary_materials|Supplementary Materials|0|0|0
Teaching Documents|periodic|ai_lesson_materials|AI-Generated Lesson Materials|0|1|0
Classroom Monitoring|daily|daily_accomplishment|Daily Accomplishment|0|0|1
Classroom Monitoring|periodic|classroom_observation_notes|Classroom Observation Notes|0|1|0
Classroom Monitoring|daily|learner_participation|Learner Participation|0|0|1
Classroom Monitoring|daily|behavior_incidents|Behavior Incidents|0|0|0
Classroom Monitoring|daily|parent_communication_log|Parent Communication Log|0|1|0
Weekly|weekly|weekly_accomplishment_report|Weekly Accomplishment Report|0|1|1
Weekly|weekly|weekly_home_visitation|Weekly Home Visitation Report|0|0|0
Weekly|weekly|weekly_intervention_report|Weekly Intervention Report|0|0|1
Weekly|weekly|reading_progress|Reading Progress|0|0|1
Weekly|weekly|numeracy_progress|Numeracy Progress|0|0|1
Weekly|weekly|weekly_assessment_results|Weekly Assessment Results|0|0|1
Weekly|weekly|weekly_learner_monitoring|Weekly Learner Monitoring|0|0|1
Weekly|weekly|weekly_attendance_summary|Weekly Attendance Summary|0|0|1
Weekly|weekly|weekly_remediation|Weekly Remediation Report|0|0|0
Weekly|weekly|weekly_guidance_referral|Weekly Guidance Referral|0|0|0
Weekly|weekly|weekly_classroom_inventory|Weekly Classroom Inventory|0|0|0
Weekly|weekly|weekly_club_activities|Weekly Club Activities|0|0|0
Monthly|monthly|monthly_accomplishment_report|Monthly Accomplishment Report|0|1|1
Monthly|monthly|monthly_attendance_report|Monthly Attendance Report|0|0|1
Monthly|monthly|monthly_grade_report|Monthly Grade Report|0|0|1
Monthly|monthly|monthly_reading_report|Monthly Reading Report|0|1|1
Monthly|monthly|monthly_numeracy_report|Monthly Numeracy Report|0|1|1
Monthly|monthly|monthly_intervention_report|Monthly Intervention Report|0|0|1
Monthly|monthly|monthly_school_activities|Monthly School Activities|0|0|1
Monthly|monthly|monthly_narrative_report|Monthly Narrative Report|0|1|1
Monthly|monthly|monthly_research_progress|Monthly Research Progress|0|0|0
Monthly|monthly|monthly_club_report|Monthly Club Report|0|0|0
Monthly|monthly|monthly_property_report|Monthly Property Report|0|0|0
Monthly|monthly|monthly_financial_liquidation|Monthly Financial Liquidation|0|0|0
Monthly|monthly|monthly_homeroom_report|Monthly Homeroom Report|0|0|1
Monthly|monthly|monthly_classroom_condition|Monthly Classroom Condition Report|0|0|1
Quarterly Academic|quarterly|quarterly_grades|Quarterly Grades|0|0|1
Quarterly Academic|quarterly|class_record|Class Record|0|0|1
Quarterly Academic|quarterly|report_cards|Report Cards|0|0|1
Quarterly Academic|quarterly|mps_report|MPS Report|0|0|1
Quarterly Academic|quarterly|item_analysis|Item Analysis|0|0|1
Quarterly Academic|quarterly|quarterly_exam_results|Quarterly Examination Results|0|0|1
Quarterly Academic|quarterly|quarterly_competency_tracking|Quarterly Competency Tracking|0|0|1
Quarterly Academic|quarterly|quarterly_attendance|Quarterly Attendance|0|0|1
Quarterly Academic|quarterly|learner_progress_report|Learner Progress Report|0|1|1
Quarterly Academic|quarterly|learners_at_risk_report|Learners At Risk Report|0|0|1
Quarterly Administrative|quarterly|quarterly_accomplishment_report|Quarterly Accomplishment Report|0|1|1
Quarterly Administrative|quarterly|quarterly_narrative_report|Quarterly Narrative Report|0|1|1
Quarterly Administrative|quarterly|school_form_validation|School Form Validation|0|0|1
Quarterly Administrative|quarterly|homeroom_pta_report|Homeroom PTA Report|0|0|0
Quarterly Administrative|quarterly|learner_intervention_report|Learner Intervention Report|0|0|1
Annual|annual|ipcrf|IPCRF|0|0|1
Annual|annual|rpms_portfolio|RPMS Portfolio|0|0|1
Annual|annual|movs|MOVs|0|0|1
Annual|annual|annual_accomplishment_report|Accomplishment Report (Annual)|0|1|1
Annual|annual|annual_narrative_report|Narrative Report (Annual)|0|1|1
Annual|annual|year_end_report|Year-End Report|0|1|1
Annual|annual|graduation_requirements|Graduation Requirements|0|0|0
Annual|annual|annual_research_outputs|Research Outputs|0|0|0
Annual|annual|innovation_projects|Innovation Projects|0|0|0
Annual|annual|school_improvement_contributions|School Improvement Contributions|0|0|0
Annual|annual|awards|Awards|0|0|0
Annual|annual|certificates|Certificates|0|0|0
Annual|annual|training_portfolio|Training Portfolio|0|0|0
Annual|annual|professional_development_records|Professional Development Records|0|0|0
Annual|annual|classroom_inventory_turnover|Classroom Inventory Turn-over|0|0|1
`;
module.exports = PART1;