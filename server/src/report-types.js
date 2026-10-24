// Paperless submissions taxonomy.
// Line format: group|frequency|code|name|is_deped_form|auto_generate|required
const RAW = `
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
DepEd School Forms|periodic|sf1_school_register|SF1 School Register|1|0|1
DepEd School Forms|periodic|sf2_daily_attendance|SF2 Daily Attendance|1|0|1
DepEd School Forms|periodic|sf3_books_issued|SF3 Books Issued|1|0|1
DepEd School Forms|periodic|sf4_monthly_learner_movement|SF4 Monthly Learner Movement|1|0|1
DepEd School Forms|periodic|sf5_report_on_promotion|SF5 Report on Promotion|1|0|1
DepEd School Forms|periodic|sf6_summarized_promotion|SF6 Summarized Promotion Report|1|0|1
DepEd School Forms|periodic|sf7_personnel_assignment|SF7 School Personnel Assignment|1|0|0
DepEd School Forms|periodic|sf9_report_card|SF9 Report Card|1|1|1
DepEd School Forms|periodic|sf10_permanent_record|SF10 Permanent Record|1|0|1
Classroom Documents|periodic|seating_plan|Seating Plan|0|0|1
Classroom Documents|periodic|class_program|Class Program|0|0|1
Classroom Documents|periodic|advisory_information|Advisory Information|0|0|1
Classroom Documents|periodic|parent_contact_list|Parent Contact List|0|0|1
Classroom Documents|periodic|emergency_contacts|Emergency Contacts|0|0|1
Classroom Documents|periodic|learner_profiles|Learner Profiles|0|0|1
Classroom Documents|periodic|classroom_rules|Classroom Rules|0|0|0
Classroom Documents|periodic|classroom_management_plan|Classroom Management Plan|0|1|1
Classroom Documents|periodic|homeroom_activities|Homeroom Activities|0|0|0
Classroom Documents|periodic|classroom_photos|Classroom Photos|0|0|0
Assessment Documents|periodic|table_of_specifications|Table of Specifications|0|0|1
Assessment Documents|periodic|test_questions|Test Questions|0|1|1
Assessment Documents|periodic|answer_keys|Answer Keys|0|0|1
Assessment Documents|periodic|rubrics|Rubrics|0|1|1
Assessment Documents|periodic|performance_tasks|Performance Tasks|0|0|1
Assessment Documents|periodic|project_guidelines|Project Guidelines|0|0|0
Assessment Documents|periodic|practical_test|Practical Test|0|0|0
Assessment Documents|periodic|oral_examination|Oral Examination|0|0|0
Assessment Documents|periodic|portfolio_assessment|Portfolio Assessment|0|0|0
Assessment Documents|periodic|test_blueprint|Test Blueprint|0|0|0
Assessment Documents|periodic|difficulty_index|Difficulty Index|0|0|0
Assessment Documents|periodic|discrimination_index|Discrimination Index|0|0|0
Learner Intervention|periodic|intervention_plans|Intervention Plans|0|1|1
Learner Intervention|periodic|individual_learning_plan|Individual Learning Plan|0|0|1
Learner Intervention|periodic|remediation_plan|Remediation Plan|0|0|1
Learner Intervention|periodic|enrichment_activities|Enrichment Activities|0|0|0
Learner Intervention|periodic|home_visitation_report|Home Visitation Report|0|0|1
Learner Intervention|periodic|parent_conference_documentation|Parent Conference Documentation|0|1|0
Learner Intervention|periodic|counseling_referral|Counseling Referral|0|0|0
Learner Intervention|periodic|child_protection_report|Child Protection Report|0|0|0
Learner Intervention|periodic|learners_at_risk|Learners At Risk Report|0|0|1
Reading and Numeracy|periodic|phil_iri|PHIL-IRI|0|0|1
Reading and Numeracy|periodic|egra_results|EGRA Results|0|0|0
Reading and Numeracy|periodic|reading_inventory|Reading Inventory|0|0|1
Reading and Numeracy|periodic|numeracy_assessment|Numeracy Assessment|0|0|1
Reading and Numeracy|periodic|reading_intervention|Reading Intervention|0|0|1
Reading and Numeracy|periodic|reading_recovery_plan|Reading Recovery Plan|0|0|1
Reading and Numeracy|periodic|reading_monitoring|Reading Monitoring|0|0|1
Research|periodic|action_research|Action Research|0|0|1
Research|periodic|berf_proposal|BERF Proposal|0|0|0
Research|periodic|innovation_proposal|Innovation Proposal|0|0|1
Research|periodic|research_ethics_documents|Research Ethics Documents|0|0|0
Research|periodic|research_instruments|Research Instruments|0|0|0
Research|periodic|research_results|Research Results|0|0|0
Research|periodic|research_presentation|Research Presentation|0|0|0
Research|periodic|published_papers|Published Papers|0|0|0
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

function parse(raw) {
  return raw.trim().split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [group, frequency, code, name, isDeped, autoGen, required] = line.split('|');
    return { group, frequency, code, name, isDeped: !!Number(isDeped), autoGen: !!Number(autoGen), required: !!Number(required) };
  });
}

const REPORT_TYPES = parse(RAW);

module.exports = { REPORT_TYPES };

if (require.main === module) {
  console.log(`taxonomy: ${REPORT_TYPES.length} report types`);
  const byGroup = {};
  for (const t of REPORT_TYPES) byGroup[t.group] = (byGroup[t.group] || 0) + 1;
  for (const g of Object.keys(byGroup)) console.log(`  ${g}: ${byGroup[g]}`);
}
