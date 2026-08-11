const KB = [
  {
    topic: 'Classroom Assessment', order: 'DepEd Order No. 8, s. 2015',
    q: 'Policy Guidelines on Classroom Assessment for the K to 12 Basic Education Program',
    keywords: ['assessment', 'grading', 'written work', 'performance task', 'quarterly exam', 'grade', 'transmutation', '80%', '60%', 'weight'],
    a: 'Classroom assessment follows DO 8, s. 2015. Grades are based on Written Work (WW), Performance Tasks (PT), and Quarterly Assessment (QA). In the Senior High School, the weights are: WW 25%, PT 45%, QA 30%. The Quarterly Grade is the transmuted grade from the raw weighted score. A learner must earn at least 75 to Pass a subject. Remediation is encouraged for learners who do not meet expectations.',
  },
  {
    topic: 'School Calendar', order: 'DepEd Order No. 34, s. 2022 (and succeeding)', 
    q: 'School Calendar and Activities for School Year 2022-2023 and beyond',
    keywords: ['calendar', 'school year', 'quarter', 'classes', 'break', 'semester', 'holiday'],
    a: 'The school calendar is issued annually by DepEd. In general, SY is divided into two semesters for SHS and four quarters for basic education. Quarter ends are marked by quarterly examinations. Specific dates are released via an annual School Calendar and Activities memorandum; the school implements it as issued by the Schools Division Office.',
  },
  {
    topic: 'LRN', order: 'Learner Reference Number (LRN) Policy',
    q: 'Learner Reference Number',
    keywords: ['lrn', 'learner reference number', '12 digits', 'enrollment', 'lis'],
    a: 'Every learner has a permanent, unique 12-digit Learner Reference Number (LRN) issued by DepEd. The LRN is the permanent identifier across all grade levels, schools, and school years, and is the basis of records in the Learner Information System (LIS). Schools must keep the LRN with the document as proof of identity.',
  },
  {
    topic: 'Attendance', order: 'DepEd Order No. 88, s. 2009 (attendance monitoring) and SHS implementing guidance',
    q: 'Learner attendance policy',
    keywords: ['attendance', 'absent', 'late', 'excused', 'tardiness', 'dtr', 'tardiness'],
    a: 'Learners are required to attend classes daily. School records should track daily attendance per learner. Frequent absences and tardiness must be reported to parents/guardians and appropriate interventions applied. Teachers also comply with DTR (Daily Time Record) requirements per Civil Service rules.',
  },
  {
    topic: 'Learner Intervention', order: 'DO 13, s. 2023 (Learning Recovery Program)',
    q: 'Learning Recovery Program',
    keywords: ['recovery', 'intervention', 'remediation', 'learning loss', 'catch up', 'catch-up', 'tutoring'],
    a: 'DO 13, s. 2023 outlines the Learning Recovery Program (LRP) to address learning loss: remedial classes, reading and numeracy interventions, and catch-up plans. Schools should implement strategies such as PDLM (Project DREAM, Project READ) style programs and monitor learner progress with post-assessments.',
  },
  {
    topic: 'Reading', order: 'PHIL-IRI and Reading Programs',
    q: 'Philippine Informal Reading Inventory (PHIL-IRI)',
    keywords: ['phil-iri', 'reading', 'egra', 'comprehension', 'frustration', 'instructional', 'independent', 'non-reader'],
    a: 'PHIL-IRI (Philippine Informal Reading Inventory) classifies learners into Independent, Instructional, Frustration, and Non-Reader levels. EGRA (Early Grade Reading Assessment) measures early literacy skills. Results drive the school reading program and interventions; pre- and post-tests measure progress within the school year.',
  },
  {
    topic: 'Research', order: 'Basic Education Research Agenda and BERF',
    q: 'Basic Education Research Fund (BERF) and research in schools',
    keywords: ['berf', 'research', 'action research', 'proposal', 'innovation', 'imrad', 'apa'],
    a: 'School-based research (action research, innovations) may be funded through the Basic Education Research Fund (BERF). Proposals follow the DepEd research proposal template (context, review of related literature, research questions, methodology). Completed research should be presented and archived at the school/division level.',
  },
  {
    topic: 'Parent Engagement', order: 'RA 9155 and school-community engagement',
    q: 'Parent involvement and school-home partnership',
    keywords: ['parent', 'guardian', 'pta', 'home visitation', 'conference', 'homeroom'],
    a: 'Schools are mandated to engage parents and the community (RA 9155). The Parent-Teacher Association (PTA) supports school programs. Teachers conduct home visitations and parent conferences, with documentation filed in the learner record, especially for learners at risk.',
  },
  {
    topic: 'SHS Program', order: 'DO 21, s. 2019 (SHS policy enhancements)',
    q: 'Senior High School program implementation',
    keywords: ['senior high', 'shs', 'track', 'strand', 'humss', 'stem', 'tvl', 'academic', 'core subjects', 'semester'],
    a: 'Senior High School follows the tracks: Academic (ABM, HUMSS, STEM, GAS), Technical-Vocational-Livelihood (TVL), Sports, and Arts & Design. Curricula include Core, Applied, and Specialized subjects. Grades are computed per semester with the 25/45/30 weights. SHS learners must take on-the-job training where required in TVL tracks.',
  },
  {
    topic: 'Report Card', order: 'SF9 and learner progress reports',
    q: 'Report card (SF9) and grading periods',
    keywords: ['sf9', 'report card', 'grade card', 'progress report', 'reporting', 'card'],
    a: 'SF9 (Learner Progress Report Card) is issued every grading period. It reflects quarterly grades per subject, the general average, and remarks. Parents receive and sign SF9; a copy is retained in the learner\u2019s records. Report periods in SHS: 2 per semester (4 per school year).',
  },
  {
    topic: 'Discipline', order: 'DO 40, s. 2012 (DepEd Child Protection Policy)',
    q: 'Discipline and child protection',
    keywords: ['discipline', 'child protection', 'bullying', 'guidance', 'referral', 'counselor', 'abuse'],
    a: 'DO 40, s. 2012 prohibits corporal punishment and promotes positive discipline. Cases of bullying, abuse, and violence must be reported to the Child Protection Committee (CPC). Guidance counselors and teachers document interventions; referrals follow due process within the school.',
  },
  {
    topic: 'Curriculum', order: 'K to 12 curriculum and MELCs',
    q: 'Most Essential Learning Competencies (MELCs)',
    keywords: ['melc', 'curriculum', 'competency', 'learning competencies', 'most essential'],
    a: 'MELCs (Most Essential Learning Competencies) are the pared-down competencies in each learning area used for focused instruction, especially during learning recovery. Daily lesson logs (DLL) and weekly learning plans are anchored on MELCs.',
  },
  {
    topic: 'Enrollment', order: 'Enrollment policies and LIS',
    q: 'Enrollment process and Learner Information System (LIS)',
    keywords: ['enrollment', 'lis', 'enrollee', 'register', 'basic education enrollment'],
    a: 'Enrollment follows the annual basic education enrollment guidelines. Learners are registered in the Learner Information System (LIS) with their LRN. Schools must maintain enrollment data, class lists (SF1), and movement records (SF4).',
  },
  {
    topic: 'School Forms', order: 'SF1-SF10 series',
    q: 'School forms SF1 to SF10',
    keywords: ['sf1', 'sf2', 'sf3', 'sf4', 'sf5', 'sf6', 'sf7', 'sf8', 'sf9', 'sf10', 'school form', 'register', 'promotion'],
    a: 'School Forms record learner data: SF1 (School Register), SF2 (Daily Attendance), SF3 (Books Issued and Returned), SF4 (Monthly Learner Movement and Attendance), SF5 (Report on Promotion and Level of Proficiency), SF6 (Summarized Report on Promotion), SF7 (School Personnel Assignment), SF8 (Learner Health and Nutrition Report), SF9 (Learner Progress Report Card), SF10 (Learner Permanent Record). Forms feed the LIS and promotion reports.',
  },
  {
    topic: 'Promotion', order: 'DO 8, s. 2015 (promotion and retention)',
    q: 'Promotion and retention of learners',
    keywords: ['promotion', 'retention', 'failed', '75', 'general average', 'retained'],
    a: 'A learner receives a Passing grade (75 or higher) per subject to be promoted. Learners who fail may take remedial classes; junior high learners who do not meet requirements may be retained. Senior high learners must pass the required number of units per semester to progress.',
  },
  {
    topic: 'ICT and Data Privacy', order: 'RA 10173 (Data Privacy Act)',
    q: 'Data privacy in schools',
    keywords: ['privacy', 'data', 'dp act', '10173', 'pii', 'npc', 'consent'],
    a: 'Schools are personal information controllers under RA 10173. Learner and personnel records (PII) must be safeguarded, access-controlled, and used only for legitimate educational purposes. Breaches must be reported to the National Privacy Commission.',
  },
];

function score(text) {
  const words = String(text || '').toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  return KB.map((entry) => {
    let s = 0;
    for (const k of entry.keywords) {
      if (text.toLowerCase().includes(k)) s += 2;
    }
    for (const w of words) {
      if (entry.keywords.includes(w)) s += 1;
    }
    return { ...entry, score: s };
  }).filter((e) => e.score > 0).sort((a, b) => b.score - a.score);
}

function ask(query) {
  const hits = score(query);
  if (!hits.length) return null;
  const best = hits[0];
  const more = hits.slice(1, 3).map((h) => h.topic);
  return {
    topic: best.topic, order: best.order, answer: best.a,
    related: more, confidence: Math.min(100, 40 + best.score * 12),
  };
}

const SUGGESTED_QUESTIONS = [
  'What are the grade weights for Senior High School?',
  'How are learners classified under PHIL-IRI?',
  'What is DO 13, s. 2023 about?',
  'What is the LRN and why is it important?',
  'What are SF1 to SF10 school forms?',
  'How should I handle a child protection concern?',
];

module.exports = { KB, ask, SUGGESTED_QUESTIONS };