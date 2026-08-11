const SCHOOL = 'Hinabangan National High School';
const SCHOOL_ADDR = 'Hinabangan, Samar';
const SCHOOL_LINE = `${SCHOOL}\n${SCHOOL_ADDR}\nSchool Year: {school_year}`;

function fmtDate() {
  return new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}

function fill(tpl, ctx) {
  return tpl.replace(/\{([a-z_]+)\}/g, (m, k) => (ctx[k] != null && ctx[k] !== '' ? ctx[k] : '______________________'));
}

const TEMPLATES = [
  {
    id: 'lesson_plan', group: 'Teaching Documents', name: 'Lesson Plan',
    fields: ['subject', 'grade_level', 'topic', 'quarter'],
    build(ctx) {
      return fill(
        `${SCHOOL_LINE}\n\nLESSON PLAN\nSubject: {subject}    Grade Level: {grade_level}    Quarter: {quarter}\nTopic: {topic}\n\n` +
        `I. OBJECTIVES\n  At the end of the lesson, the learners shall be able to:\n  1. Identify and explain the key concepts of {topic}.\n  2. Apply {topic} in contextualized and real-life situations.\n  3. Demonstrate understanding through a formative task.\n\n` +
        `II. SUBJECT MATTER\n  Topic: {topic}\n  References: {references}\n  Materials: laptop/projector, activity sheets, visual aids\n\n` +
        `III. PROCEDURE\n  A. ELICIT (5 min) - Review and motivation\n  B. ENGAGE (10 min) - Presentation of objectives and pre-assessment\n  C. EXPLORE (20 min) - Guided discovery and discussion\n  D. EXPLAIN (15 min) - Teacher explanation and synthesis\n  E. ELABORATE (15 min) - Application through differentiated activities\n  F. EVALUATE (10 min) - Formative assessment aligned with objectives\n  G. EXTEND (5 min) - Agreement / assignment\n\n` +
        `IV. REMARKS\n\nV. REFLECTION\n  No. of learners who earned 80% in the evaluation: __________\n  No. of learners who require additional activities for remediation: __________\n\nPrepared by:\n{prepared_by}\n\nNoted by:\n{noted_by}`,
        ctx);
    },
  },
  {
    id: 'dll', group: 'Teaching Documents', name: 'Daily Lesson Log (DLL)',
    fields: ['subject', 'grade_level', 'topic', 'quarter'],
    build(ctx) {
      return fill(
        `${SCHOOL_LINE}\n\nDAILY LESSON LOG\nSchool: ${SCHOOL}    Teacher: {prepared_by}    Subject: {subject}\nDate: {date}    Grade & Section: {grade_level}-{section}    Quarter: {quarter}\n\n` +
        `I. OBJECTIVES\n  A. Content Standards: \n  B. Performance Standards: \n  C. Learning Competencies: \n\n` +
        `II. CONTENT\n  Topic: {topic}\n\n` +
        `III. LEARNING RESOURCES\n  References: {references}    Other Learning Resources:\n\n` +
        `IV. PROCEDURES\n  A. Reviewing previous lesson: \n  B. Establishing a purpose for the lesson: \n  C. Presenting examples/instances of the new lesson: \n  D. Discussing new concepts and practicing new skills #1: \n  E. Discussing new concepts and practicing new skills #2: \n  F. Developing mastery (Leads to Formative Assessment 3): \n  G. Finding practical applications of concepts: \n  H. Making generalizations and abstractions: \n  I. Evaluating learning: \n  J. Additional activities for application or remediation: \n\n` +
        `V. REMARKS\n\nVI. REFLECTION\n  Number of learners who earned 80% in the evaluation: ______\n  Number of learners who require additional activities for remediation: ______\n  Did the remedial lessons work? ______\n  What innovation or localized materials did I use? ______\n\nPrepared by:\n{prepared_by}\n\nChecked by:\n{noted_by}`,
        ctx);
    },
  },
  {
    id: 'dlp', group: 'Teaching Documents', name: 'Detailed Lesson Plan (DLP)',
    fields: ['subject', 'grade_level', 'topic', 'quarter'],
    build(ctx) {
      return fill(
        `${SCHOOL_LINE}\n\nDETAILED LESSON PLAN\nSubject: {subject}    Grade Level: {grade_level}    Quarter: {quarter}    Time: {time}\n\n` +
        `I. OBJECTIVES (Learning Competencies and Code)\n  A. Content Standard: \n  B. Performance Standard: \n  C. Learning Competency/Objective: \n\n` +
        `II. CONTENT\n  Topic: {topic}\n\n` +
        `III. LEARNING RESOURCES\n  References: {references}    Other resources:\n\n` +
        `IV. PROCEDURES\n  A. Preparation/Review (5 mins)\n     Teacher's Activity | Student's Activity\n  B. Motivation (5 mins)\n  C. Lesson Proper (30 mins) - activity, analysis, abstraction\n  D. Application (10 mins)\n  E. Evaluation (10 mins)\n  F. Assignment/Agreement (5 mins)\n\n` +
        `V. REMARKS\n\nVI. REFLECTION\n\nPrepared by:\n{prepared_by}\n\nChecked by:\n{noted_by}`,
        ctx);
    },
  },
  {
    id: 'lesson_exemplar', group: 'Teaching Documents', name: 'Lesson Exemplar',
    fields: ['subject', 'grade_level', 'topic', 'quarter'],
    build(ctx) {
      return fill(
        `${SCHOOL_LINE}\n\nLESSON EXEMPLAR\nSubject: {subject}    Grade Level: {grade_level}    Quarter: {quarter}\nTopic: {topic}\n\n` +
        `1. OBJECTIVES\n  A. Content Standard: \n  B. Performance Standard: \n  C. Most Essential Learning Competencies: \n\n` +
        `2. LEARNING RESOURCES\n\n3. PROCEDURES (with teacher and learner activities)\n  A. Introduction: \n  B. Development: \n  C. Engagement: \n  D. Assimilation: \n\n` +
        `4. REMARKS\n\n5. REFLECTION\n\nPrepared by:\n{prepared_by}\n\nReviewed by:\n{noted_by}`,
        ctx);
    },
  },
  {
    id: 'las', group: 'Teaching Documents', name: 'Learning Activity Sheet (LAS)',
    fields: ['subject', 'grade_level', 'topic', 'quarter'],
    build(ctx) {
      return fill(
        `${SCHOOL_LINE}\n\nLEARNING ACTIVITY SHEET\nSubject: {subject}    Quarter: {quarter}    Grade Level: {grade_level}\nName: ______________________    Date: ______________________\n\n` +
        `I. LEARNING COMPETENCY\n  \n\nII. BACKGROUND INFORMATION FOR LEARNERS\n  \n\nIII. ACTIVITIES\n  Activity 1: \n  Activity 2: \n\nIV. ASSESSMENT / REFLECTION\n  \n\nPrepared by:\n{prepared_by}`,
        ctx);
    },
  },
  {
    id: 'weekly_learning_plan', group: 'Teaching Documents', name: 'Weekly Learning Plan',
    fields: ['subject', 'grade_level', 'quarter', 'week'],
    build(ctx) {
      return fill(
        `${SCHOOL_LINE}\n\nWEEKLY LEARNING PLAN\nSchool: ${SCHOOL}    Teacher: {prepared_by}    Subject: {subject}\nGrade & Section: {grade_level}-{section}    Week: {week}    Quarter: {quarter}\n\n` +
        `Day | Objectives | Topic | Classroom-based Activities | Home-based Activities\n----|------------|-------|------------------------------|------------------------\nMonday | | | |\nTuesday | | | |\nWednesday | | | |\nThursday | | | |\nFriday | | | |\n\nPrepared by:\n{prepared_by}\n\nChecked by:\n{noted_by}`,
        ctx);
    },
  },
  {
    id: 'teaching_guide', group: 'Teaching Documents', name: 'Teaching Guide',
    fields: ['subject', 'grade_level', 'topic'],
    build(ctx) {
      return fill(
        `${SCHOOL_LINE}\n\nTEACHING GUIDE\nSubject: {subject}    Grade Level: {grade_level}\nTopic: {topic}\n\n` +
        `A. LESSON OVERVIEW AND LEARNING OBJECTIVES\n  \n\nB. LESSON PLAN DETAILS\n  1. Introduction/Opening Activity\n  2. Core Lesson Delivery\n  3. Formative Checks\n  4. Closure\n\nC. MATERIALS AND RESOURCES\n\nD. SCAFFOLDING AND DIFFERENTIATION\n\nE. ASSESSMENT PLAN\n\nPrepared by:\n{prepared_by}`,
        ctx);
    },
  },
  {
    id: 'exam', group: 'Assessment Documents', name: 'Quarterly Examination',
    fields: ['subject', 'grade_level', 'quarter'],
    build(ctx) {
      return fill(
        `${SCHOOL_LINE}\n\n${ctx.quarter || 'FIRST'} QUARTERLY EXAMINATION\nSubject: {subject}    Grade & Section: {grade_level}-{section}\nName: ______________________    Date: ______________________\n\n` +
        `I. MULTIPLE CHOICE (15 items)\n  Read each item carefully. Choose the letter of the best answer.\n  1. ______________________________________  a. ______  b. ______  c. ______  d. ______\n  2. ______________________________________  a. ______  b. ______  c. ______  d. ______\n  3. ______________________________________  a. ______  b. ______  c. ______  d. ______\n  4. ______________________________________  a. ______  b. ______  c. ______  d. ______\n  5. ______________________________________  a. ______  b. ______  c. ______  d. ______\n  6-15. (continue on the next page)\n\n` +
        `II. IDENTIFICATION (10 items)\n  1. ______________________\n  2. ______________________\n  3-10. (continue)\n\n` +
        `III. ESSAY (2 items)\n  1. \n  2. \n\n` +
        `- END OF EXAMINATION -\n\nPrepared by:\n{prepared_by}\n\nChecked by:\n{noted_by}`,
        ctx);
    },
  },
  {
    id: 'answer_key', group: 'Assessment Documents', name: 'Answer Key',
    fields: ['subject', 'grade_level', 'quarter'],
    build(ctx) {
      return fill(
        `${SCHOOL_LINE}\n\nANSWER KEY\n${ctx.quarter || 'FIRST'} QUARTERLY EXAMINATION — {subject} ({grade_level})\n\n` +
        `PART I — MULTIPLE CHOICE\n1. ______  2. ______  3. ______  4. ______  5. ______\n6. ______  7. ______  8. ______  9. ______  10. ______\n11. ______  12. ______  13. ______  14. ______  15. ______\n\n` +
        `PART II — IDENTIFICATION\n1. ______  2. ______  3. ______  4. ______  5. ______\n6. ______  7. ______  8. ______  9. ______  10. ______\n\n` +
        `PART III — ESSAY (rubric-based)\n\nPrepared by:\n{prepared_by}`,
        ctx);
    },
  },
  {
    id: 'rubric', group: 'Assessment Documents', name: 'Rubric',
    fields: ['task', 'subject'],
    build(ctx) {
      return fill(
        `${SCHOOL_LINE}\n\nRUBRIC\nTask: {task}    Subject: {subject}\n\n` +
        `Criteria | Excellent (4) | Proficient (3) | Developing (2) | Beginning (1) | Score\n---------|--------------|----------------|----------------|----------------|------\nContent / Accuracy | | | | |\nOrganization | | | | |\nCreativity / Originality | | | | |\nGrammar / Conventions | | | | |\nCollaboration (if group) | | | | |\n\nTotal: ______ / 20    Rating: ______\n\nPrepared by:\n{prepared_by}`,
        ctx);
    },
  },
  {
    id: 'performance_task', group: 'Assessment Documents', name: 'Performance Task',
    fields: ['subject', 'grade_level', 'quarter'],
    build(ctx) {
      return fill(
        `${SCHOOL_LINE}\n\nPERFORMANCE TASK\nSubject: {subject}    Grade & Section: {grade_level}-{section}    Quarter: {quarter}\n\n` +
        `A. COMPETENCY/OBJECTIVES\n  \n\nB. TASK DESCRIPTION AND SCENARIO\n  \n\nC. PRODUCT / PERFORMANCE\n  \n\nD. GUIDELINES\n  1. \n  2. \n  3. \n\nE. RUBRIC AND SCORING (see attached rubric)\n\nF. SUBMISSION AND DEADLINE\n  \n\nPrepared by:\n{prepared_by}`,
        ctx);
    },
  },
  {
    id: 'certificate', group: 'School Activities', name: 'Certificate of Recognition',
    fields: ['recipient', 'award', 'occasion'],
    build(ctx) {
      return fill(
        `${SCHOOL}\n${SCHOOL_ADDR}\n\nCERTIFICATE OF RECOGNITION\n\nThis certificate is proudly presented to\n\n{recipient}\n\nfor {award}\n\nin connection with {occasion} held at ${SCHOOL}, ${SCHOOL_ADDR}.\n\nGiven this {date}.\n\n\n{noted_by}                            {prepared_by}\nSchool Principal                    Adviser / Authorized Signatory`,
        ctx);
    },
  },
  {
    id: 'parent_letter', group: 'Classroom Documents', name: 'Letter to Parents',
    fields: ['student', 'guardian', 'purpose', 'meeting_date'],
    build(ctx) {
      return fill(
        `${SCHOOL}\n${SCHOOL_ADDR}\n\n${fmtDate()}\n\nDear {guardian},\n\nGreetings of peace!\n\nThis letter is to inform you regarding the following matter concerning your child, {student}:\n\n{purpose}\n\nWe invite you to a meeting on {meeting_date} at ${SCHOOL} to discuss this further.\n\nShould you have any questions, please do not hesitate to contact the undersigned.\n\nThank you for your continued support of our school programs.\n\nRespectfully yours,\n\n{prepared_by}\nAdviser / School Representative`,
        ctx);
    },
  },
  {
    id: 'recommendation_letter', group: 'Classroom Documents', name: 'Recommendation Letter',
    fields: ['recipient', 'program'],
    build(ctx) {
      return fill(
        `${SCHOOL}\n${SCHOOL_ADDR}\n\n${fmtDate()}\n\nTo Whom It May Concern:\n\nI am pleased to recommend {recipient} for {program}.\n\nDuring our time together, {recipient} has consistently demonstrated competence, integrity, and dedication. I am confident in their ability to succeed in this undertaking.\n\nPlease feel free to contact me should you require further information.\n\nVery truly yours,\n\n{prepared_by}\nPosition: ______________________`,
        ctx);
    },
  },
  {
    id: 'meeting_minutes', group: 'School Activities', name: 'Meeting Minutes',
    fields: ['meeting', 'venue'],
    build(ctx) {
      return fill(
        `${SCHOOL_LINE}\n\nMEETING MINUTES\nMeeting: {meeting}    Venue: {venue}    Date: {date}\n\n` +
        `A. CALL TO ORDER\n  \n\nB. ATTENDANCE\n  Present: \n  Absent: \n\nC. AGENDA\n  1. \n  2. \n  3. \n\nD. DISCUSSION HIGHLIGHTS\n  \n\nE. AGREEMENTS / ACTION ITEMS\n  Action | Person Responsible | Deadline\n  -------|--------------------|----------\n  1. | |\n  2. | |\n\nF. ADJOURNMENT\n\nMinutes taken by:\n{prepared_by}`,
        ctx);
    },
  },
  {
    id: 'narrative_report', group: 'Quarterly Administrative', name: 'Narrative Report',
    fields: ['activity', 'period'],
    build(ctx) {
      return fill(
        `${SCHOOL_LINE}\n\nNARRATIVE REPORT\nActivity: {activity}    Period: {period}\n\n` +
        `I. INTRODUCTION\n  \n\nII. HIGHLIGHTS\n  \n\nIII. PROBLEMS ENCOUNTERED\n  \n\nIV. RECOMMENDATIONS\n  \n\nV. ANNEXES\n  Photos, attendance sheets, and other supporting documents are attached.\n\nPrepared by:\n{prepared_by}\n\nNoted by:\n{noted_by}`,
        ctx);
    },
  },
  {
    id: 'accomplishment_report', group: 'Quarterly Administrative', name: 'Accomplishment Report',
    fields: ['period'],
    build(ctx) {
      return fill(
        `${SCHOOL_LINE}\n\nQUARTERLY ACCOMPLISHMENT REPORT\nPeriod: {period}\nName: {prepared_by}\n\n` +
        `Activity / Program | Date | Remarks\n--------------------|------|--------\n1. | |\n2. | |\n3. | |\n4. | |\n5. | |\n\n` +
        `SUMMARY OF ACCOMPLISHMENTS\n  \n\nPLANS FOR THE NEXT PERIOD\n  \n\nPrepared by:\n{prepared_by}\n\nNoted by:\n{noted_by}`,
        ctx);
    },
  },
  {
    id: 'memorandum', group: 'School Activities', name: 'Memorandum',
    fields: ['subject_memo', 'venue', 'event_date'],
    build(ctx) {
      return fill(
        `${SCHOOL}\n${SCHOOL_ADDR}\n\nMEMORANDUM\n\nTo: All School Personnel\nFrom: The School Principal\nDate: {date}\nSubject: {subject_memo}\n\n1. This is to inform all concerned of the following: {subject_memo}.\n2. Details are as follows:\n   - Date: {event_date}\n   - Venue: {venue}\n3. Attendance is required. Kindly make the necessary arrangements.\n\nFor your information and guidance.\n\n\n{noted_by}\nSchool Principal`,
        ctx);
    },
  },
  {
    id: 'notice', group: 'School Activities', name: 'Notice',
    fields: ['subject_memo', 'venue', 'event_date'],
    build(ctx) {
      return fill(
        `${SCHOOL}\n${SCHOOL_ADDR}\n\nNOTICE\n\n{date}\n\nThis is to inform all concerned that {subject_memo} will be held on {event_date} at {venue}.\n\nAll participants are expected to be present on time.\n\nThank you.\n\n{noted_by}\nSchool Principal`,
        ctx);
    },
  },
  {
    id: 'intervention_plan', group: 'Learner Intervention', name: 'Intervention / Remediation Plan',
    fields: ['student', 'category', 'difficulty'],
    build(ctx) {
      return fill(
        `${SCHOOL_LINE}\n\nINTERVENTION / REMEDIATION PLAN\nLearner: {student}    Category: {category}\nObserved difficulty: {difficulty}\n\n` +
        `A. LEARNING INTERVENTION AREA\n  \n\nB. INTERVENTION STRATEGY\n  Strategy | Frequency | Duration | Person In Charge\n  ---------|-----------|----------|------------------\n  | | |\n  | | |\n\nC. MATERIALS AND RESOURCES\n  \n\nD. MONITORING AND EVALUATION\n  Baseline: \n  Target: \n  Evidence: \n  Review date: \n\nPrepared by:\n{prepared_by}\n\nNoted by:\n{noted_by}`,
        ctx);
    },
  },
  {
    id: 'reading_report', group: 'Reading and Numeracy', name: 'Reading Progress Report',
    fields: ['period', 'grade_level'],
    build(ctx) {
      return fill(
        `${SCHOOL_LINE}\n\nREADING PROGRESS REPORT\nPeriod: {period}    Grade Level: {grade_level}\n\n` +
        `A. ASSESSMENT USED\n  Assessment: ______________________    Date: ______________________\n\nB. RESULTS SUMMARY\n  Reading Level | Pre-Test Count | Post-Test Count\n  --------------|----------------|-----------------\n  Independent | |\n  Instructional | |\n  Frustration | |\n  Non-Reader | |\n\nC. INTERVENTIONS CONDUCTED\n  \n\nD. RECOMMENDATIONS\n  \n\nPrepared by:\n{prepared_by}\n\nNoted by:\n{noted_by}`,
        ctx);
    },
  },
  {
    id: 'class_observation', group: 'Classroom Monitoring', name: 'Classroom Observation Report',
    fields: ['observed_teacher', 'subject', 'grade_level'],
    build(ctx) {
      return fill(
        `${SCHOOL_LINE}\n\nCLASSROOM OBSERVATION REPORT\nTeacher Observed: {observed_teacher}    Subject: {subject}\nGrade & Section: {grade_level}-{section}    Date: {date}\n\n` +
        `Indicator | Notes | Rating (1-5)\n----------|-------|------------\nContent knowledge and pedagogy | |\nLearning environment and diversity | |\nCurriculum and planning | |\nAssessment and reporting | |\nCommunity linkages and professional engagement | |\n\nOBSERVER'S FEEDBACK\n  \n\nCONFERENCE NOTES (Post-observation)\n  \n\nObserved by:\n{prepared_by}`,
        ctx);
    },
  },
  {
    id: 'travel_order', group: 'School Activities', name: 'Travel Order',
    fields: ['traveler', 'destination', 'purpose'],
    build(ctx) {
      return fill(
        `${SCHOOL}\n${SCHOOL_ADDR}\n\nTRAVEL ORDER\n\nDate of Travel: {date}\n\nName: {traveler}\nDestination: {destination}\nPurpose: {purpose}\n\nExpenses: \n\nTravel expenses are authorized per applicable DepEd rules.\n\n\n{noted_by}\nSchool Principal`,
        ctx);
    },
  },
  {
    id: 'purchase_request', group: 'Property and Inventory', name: 'Purchase Request',
    fields: ['purpose'],
    build(ctx) {
      return fill(
        `${SCHOOL_LINE}\n\nPURCHASE REQUEST\nDate: {date}\nPurpose: {purpose}\n\n` +
        `Item | Description | Quantity | Unit Cost | Amount\n-----|-------------|----------|-----------|--------\n1. | | | |\n2. | | | |\n3. | | | |\n\nTOTAL: ______________________\n\nRequested by:            Approved by:\n{prepared_by}            {noted_by}`,
        ctx);
    },
  },
  {
    id: 'event_program', group: 'School Activities', name: 'Event Program / Script',
    fields: ['event_name', 'event_date', 'venue', 'host'],
    build(ctx) {
      return fill(
        `${SCHOOL}\n${SCHOOL_ADDR}\n\nPROGRAM\n\n${ctx.event_name}\nDate: {event_date}    Venue: {venue}\n\n` +
        `1. Invocation\n2. National Anthem\n3. Opening Remarks\n4. Presentation of Participants\n5. Special Number\n6. Message(s)\n7. Highlights of the Program\n8. Closing Remarks\n9. Photographs\n\nMaster of Ceremonies: {host}\n\nProgram prepared by:\n{prepared_by}`,
        ctx);
    },
  },
  {
    id: 'graduation_script', group: 'School Activities', name: 'Graduation / MC Script',
    fields: ['event_name', 'event_date', 'venue', 'host'],
    build(ctx) {
      return fill(
        `${SCHOOL}\n${SCHOOL_ADDR}\n\n${ctx.event_name}\nMaster of Ceremonies: {host}    Date: {event_date}    Venue: {venue}\n\n` +
        `MC SCRIPT\n\n1. INTRODUCTION / CALL TO ORDER\n  "Ladies and gentlemen, we are gathered here today to celebrate the accomplishments of our graduates..."\n\n2. INVOCATION\n\n3. PHILIPPINE NATIONAL ANTHEM\n\n4. WELCOME ADDRESS\n\n5. PRESENTATION OF CANDIDATES FOR GRADUATION\n\n6. CONFERMENT OF CERTIFICATES / DIPLOMAS\n\n7. RECOGNITION OF HONOR STUDENTS\n\n8. MESSAGE OF THE GRADUATES\n\n9. MESSAGE OF THE SCHOOL PRINCIPAL\n\n10. CLASS SONG / SEND-OFF\n\n11. CLOSING REMARKS\n\n12. RECESSIONAL\n\nPrepared by:\n{prepared_by}`,
        ctx);
    },
  },
  {
    id: 'liquidation_report', group: 'Finance', name: 'Liquidation Report',
    fields: ['activity', 'fund_source'],
    build(ctx) {
      return fill(
        `${SCHOOL_LINE}\n\nLIQUIDATION REPORT\nActivity: {activity}    Fund Source: {fund_source}    Date: {date}\n\n` +
        `Particulars | Received | Expenses | Balance\n------------|----------|----------|--------\n1. | | |\n2. | | |\n3. | | |\n\n` +
        `TOTAL | | |\n\nCertified correct:\n{prepared_by}\n\nApproved by:\n{noted_by}`,
        ctx);
    },
  },
  {
    id: 'financial_report', group: 'Finance', name: 'Financial Report',
    fields: ['period', 'fund_source'],
    build(ctx) {
      return fill(
        `${SCHOOL_LINE}\n\nFINANCIAL REPORT\nPeriod: {period}    Fund Source: {fund_source}\n\n` +
        `A. FUNDS RECEIVED\n  \n\nB. EXPENDITURES\n  Item | Amount\n  -----|-------\n  1. | \n  2. | \n\nC. REMAINING BALANCE\n  \n\nPrepared by:\n{prepared_by}\n\nNoted by:\n{noted_by}`,
        ctx);
    },
  },
  {
    id: 'announcement', group: 'School Activities', name: 'School Announcement',
    fields: ['title', 'audience'],
    build(ctx) {
      return fill(
        `${SCHOOL}\n${SCHOOL_ADDR}\n\nANNOUNCEMENT\n\nTitle: {title}\nAudience: {audience}\nDate: {date}\n\nBody:\n\n_______________________________________\n_______________________________________\n\nFor further inquiries, please approach the school office during office hours.\n\n{noted_by}\nSchool Principal`,
        ctx);
    },
  },
  {
    id: 'email', group: 'Classroom Documents', name: 'Official Email Draft',
    fields: ['recipient_name', 'subject_memo'],
    build(ctx) {
      return fill(
        `To: {recipient_name}\nSubject: {subject_memo}\n\nDear {recipient_name},\n\nGreetings! This email is regarding {subject_memo}.\n\n[purpose / details]\n\nShould you have any questions or concerns, please feel free to reach out to us.\n\nThank you for your kind attention and continued support.\n\nBest regards,\n\n{prepared_by}\n${SCHOOL}\n${SCHOOL_ADDR}\nContact: ______________________`,
        ctx);
    },
  },
];

const DEFAULTS = {
  date: fmtDate(),
  school: SCHOOL,
  school_addr: SCHOOL_ADDR,
  school_year: '2025-2026',
  quarter: 'First',
  prepared_by: '______________________',
  noted_by: '______________________',
};

function getTemplate(id) {
  return TEMPLATES.find((t) => t.id === id) || null;
}

function renderTemplate(id, ctx = {}) {
  const t = getTemplate(id);
  if (!t) return null;
  const merged = { ...DEFAULTS, ...ctx };
  return { id: t.id, name: t.name, group: t.group, body: t.build(merged) };
}

module.exports = { TEMPLATES, getTemplate, renderTemplate, DEFAULTS };
