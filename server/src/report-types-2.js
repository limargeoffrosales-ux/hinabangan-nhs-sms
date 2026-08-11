// Paperless submissions taxonomy — part 2.
// Line format: group|frequency|code|name|is_deped_form|auto_generate|required
const PART2 = `
DepEd School Forms|periodic|sf1_school_register|SF1 School Register|1|0|1
DepEd School Forms|periodic|sf2_daily_attendance|SF2 Daily Attendance|1|0|1
DepEd School Forms|periodic|sf3_books_issued|SF3 Books Issued|1|0|1
DepEd School Forms|periodic|sf4_monthly_learner_movement|SF4 Monthly Learner Movement|1|0|1
DepEd School Forms|periodic|sf5_report_on_promotion|SF5 Report on Promotion|1|0|1
DepEd School Forms|periodic|sf6_summarized_promotion|SF6 Summarized Promotion Report|1|0|1
DepEd School Forms|periodic|sf7_personnel_assignment|SF7 School Personnel Assignment|1|0|0
DepEd School Forms|periodic|sf8_health_nutrition|SF8 Learner Basic Health and Nutrition Report|1|0|1
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
`;
module.exports = PART2;