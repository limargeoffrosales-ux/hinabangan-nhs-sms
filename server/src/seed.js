const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { q, qa, qi, qr, close } = require('./db');
const { REPORT_TYPES } = require('./report-types');
const logger = require('./logger');

const GROUP_WORKFLOWS = {
  'Daily Attendance': ['registrar,assistant_principal', 'principal'],
  'Teaching Documents': ['assistant_principal', 'principal'],
  'Classroom Monitoring': ['assistant_principal', 'principal'],
  'Weekly': ['assistant_principal', 'principal'],
  'Monthly': ['assistant_principal', 'principal'],
  'Quarterly Academic': ['registrar', 'principal'],
  'Quarterly Administrative': ['assistant_principal,registrar', 'principal'],
  'Annual': ['assistant_principal', 'principal'],
  'DepEd School Forms': ['registrar', 'principal'],
  'Classroom Documents': ['assistant_principal', 'principal'],
  'Assessment Documents': ['assistant_principal', 'principal'],
  'Learner Intervention': ['guidance', 'principal'],
  'Reading and Numeracy': ['assistant_principal', 'principal'],
  'Research': ['assistant_principal', 'principal'],
  'Professional Development': ['assistant_principal,hr', 'principal'],
  'School Activities': ['assistant_principal', 'principal'],
  'Property and Inventory': ['property_custodian', 'principal'],
  'Guidance and Discipline': ['guidance', 'principal'],
  'Health and Safety': ['nurse', 'principal'],
  'Finance': ['cashier', 'principal'],
  'Human Resource': ['hr', 'principal'],
  'AI-Assisted Documents': ['assistant_principal', 'principal'],
};
const DEFAULT_WORKFLOW = ['assistant_principal', 'principal'];

async function seedReportTypes() {
  let idx = 0;
  for (const t of REPORT_TYPES) {
    idx++;
    const exists = await q('SELECT id FROM report_types WHERE code = ?', [t.code]);
    let id;
    if (exists) {
      await qr(
        'UPDATE report_types SET name = ?, group_name = ?, frequency = ?, is_deped_form = ?, auto_generate = ?, required = ?, active = TRUE, sort_order = ? WHERE id = ?',
        [t.name, t.group, t.frequency, t.isDeped, t.autoGen, t.required, idx, exists.id]);
      id = exists.id;
    } else {
      id = await qi(
        'INSERT INTO report_types (code, name, group_name, frequency, is_deped_form, auto_generate, required, active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, ?)',
        [t.code, t.name, t.group, t.frequency, t.isDeped, t.autoGen, t.required, idx]);
    }
    const wf = GROUP_WORKFLOWS[t.group] || DEFAULT_WORKFLOW;
    const hasWf = await q('SELECT id FROM submission_workflows WHERE report_type_id = ?', [id]);
    const review = JSON.stringify(wf[0].split(','));
    const approve = JSON.stringify(wf[1].split(','));
    if (hasWf) {
      await qr('UPDATE submission_workflows SET review_roles = ?, approve_roles = ? WHERE report_type_id = ?', [review, approve, id]);
    } else {
      await qi('INSERT INTO submission_workflows (report_type_id, review_roles, approve_roles) VALUES (?, ?, ?)', [id, review, approve]);
    }
  }
  logger.info({ count: REPORT_TYPES.length }, '+ report taxonomy: types with approval workflows');
}

async function seed() {
  await seedReportTypes();
  const users = [
    ['superadmin', 'Super Admin', 'super_admin', 'admin@school.edu.ph'],
    ['admin', 'School Administrator', 'school_admin', 'principal@school.edu.ph'],
  ];
  const staff = [
    ['asantos', 'Amelia Santos', 'teacher'],
    ['breyes', 'Bryan Reyes', 'teacher'],
    ['cmendoza', 'Carla Mendoza', 'teacher'],
    ['dvillanueva', 'Dennis Villanueva', 'teacher'],
    ['egarcia', 'Elena Garcia', 'teacher'],
    ['faquino', 'Francis Aquino', 'teacher'],
    ['gdomingo', 'Grace Domingo', 'teacher'],
    ['hocampo', 'Henry Ocampo', 'teacher'],
    ['iramos', 'Ivy Ramos', 'teacher'],
    ['jcruz', 'Jerome Cruz', 'teacher'],
    ['kbautista', 'Katrina Bautista', 'teacher'],
    ['ltorres', 'Leonardo Torres', 'teacher'],
    ['mnavarro', 'Marites Navarro', 'teacher'],
    ['nfernandez', 'Nestor Fernandez', 'teacher'],
    ['opadilla', 'Olivia Padilla', 'teacher'],
    ['pjavier', 'Paolo Javier', 'teacher'],
    ['qdizon', 'Queenie Dizon', 'teacher'],
    ['respino', 'Ramon Espino', 'teacher'],
    ['shernandez', 'Sofia Hernandez', 'teacher'],
    ['tlopez', 'Tomas Lopez', 'teacher'],
  ];
  const accounts = [];
  for (const [username, name, role, email] of users) {
    const exists = await q('SELECT id FROM users WHERE username = ?', [username]);
    if (exists) {
      logger.info({ user: username }, '= user already exists (keeping existing password)');
      continue;
    }
    const pw = crypto.randomBytes(12).toString('base64url');
    await qi('INSERT INTO users (username, password_hash, name, role, email, status) VALUES (?, ?, ?, ?, ?, ?)',
      [username, await bcrypt.hash(pw, 10), name, role, email || null, 'active']);
    logger.info({ user: username, role }, '+ user created');
    accounts.push(`${username} | ${pw} | ${role} | ${name}`);
  }
  for (const [username, name, role] of staff) {
    const exists = await q('SELECT id FROM users WHERE username = ?', [username]);
    if (exists) {
      logger.info({ user: username }, '= user already exists (keeping existing password)');
      continue;
    }
    const pw = crypto.randomBytes(12).toString('base64url');
    await qi('INSERT INTO users (username, password_hash, name, role, email, status) VALUES (?, ?, ?, ?, ?, ?)',
      [username, await bcrypt.hash(pw, 10), name, role, `${username}@hinabangan-nhs.edu.ph`, 'active']);
    logger.info({ user: username, role }, '+ user created');
    accounts.push(`${username} | ${pw} | ${role} | ${name}`);
  }
  if (accounts.length) {
    if (process.env.DEMO_SEED === '1') {
      // Local demo only — write credentials to a plaintext file at the repo root.
      require('fs').writeFileSync(
        require('path').join(__dirname, '..', '..', 'accounts.txt'),
        'Hinabangan National High School - Generated Account Credentials\n' +
        'username | password | role | name\n' + accounts.join('\n') + '\n', 'utf8');
      logger.info({ count: accounts.length }, '+ new demo accounts written to accounts.txt (local demo only)');
    } else {
      // Production/boot seeding — surface the one-time credentials in the boot
      // log instead of persisting them in a plaintext file.
      for (const line of accounts) logger.info('+ new account: ' + line);
    }
  } else {
    logger.info('= all accounts already exist — nothing new to write.');
  }

  const hasStudents = await qa('SELECT COUNT(*) AS n FROM students');
  if (process.env.DEMO_SEED !== '1') {
    logger.info('= DEMO_SEED not set — demo data skipped (report types, users and staff accounts are still ensured).');
    if (require.main === module) await close();
    return;
  }
  if (Number(hasStudents[0].n) > 0) {
    logger.info('= Demo data already present — kept as-is (no reset; user data preserved).');
    if (require.main === module) await close();
    return;
  }
  await qr('DELETE FROM refresh_tokens');

  const teachers = [
    ['T-0001', 'Maria', 'C.', 'Dela Cruz', 'Teacher III'],
    ['T-0002', 'Juan', 'R.', 'Reyes', 'Teacher II'],
    ['T-0003', 'Ana', 'L.', 'Mendoza', 'Teacher I'],
    ['T-0004', 'Carlos', 'P.', 'Villanueva', 'Master Teacher I'],
    ['T-0005', 'Rosa', 'S.', 'Garcia', 'Teacher III'],
    ['T-0006', 'Elena', 'B.', 'Aquino', 'Teacher III'],
    ['T-0007', 'Ramon', 'V.', 'Domingo', 'Master Teacher II'],
    ['T-0008', 'Cristina', 'M.', 'Ocampo', 'Teacher II'],
  ];
  const teacherIds = [];
  for (const t of teachers) {
    const id = await qi(
      'INSERT INTO teachers (employee_no, first_name, middle_name, last_name, position, status) VALUES (?, ?, ?, ?, ?, ?)',
      [t[0], t[1], t[2], t[3], t[4], 'active']);
    teacherIds.push(id);
  }

  const jhsAreas = ['Filipino', 'English', 'Mathematics', 'Science', 'Araling Panlipunan',
    'Music', 'Arts', 'Physical Education', 'Health', 'Edukasyon sa Pagpapakatao', 'Technology and Livelihood Education'];
  const subjects = [];
  for (let g = 7; g <= 10; g++) {
    for (const a of jhsAreas) {
      subjects.push([`G${g}-${a.split(' ').map((w) => w.slice(0, 3).toUpperCase()).join('')}`, a, `Grade ${g}`, 'general', 1.0, null]);
    }
  }
  const sshsCores = [
    ['SSHS-COMM', 'Effective Communication / Mabisang Komunikasyon', 'Grade 11', 'academic', 1.0, 'all'],
    ['SSHS-LIFESKILLS', 'Life and Career Skills', 'Grade 11', 'academic', 1.0, 'all'],
    ['SSHS-GENMATH', 'General Mathematics', 'Grade 11', 'academic', 1.0, 'all'],
    ['SSHS-GENSCI', 'General Science', 'Grade 11', 'academic', 1.0, 'all'],
    ['SSHS-PHILHIST', 'Pag-aaral ng Kasaysayan at Lipunang Pilipino', 'Grade 11', 'academic', 1.0, 'all'],
  ];
  const sshsAcademicElectives = [
    ['AAC-CONTLIT1', 'Contemporary Literature 1', 'Grade 11', 'academic', 0.5, 'first'],
    ['AAC-CRECOMP1', 'Creative Composition 1 / Malikhaing Pagsulat', 'Grade 11', 'academic', 0.5, 'first'],
    ['AAC-ARTS1', 'Arts 1 (Creative Industries 1)', 'Grade 11', 'academic', 0.5, 'second'],
    ['AAC-PE1', 'Physical Education 1 (Fitness & Recreation)', 'Grade 11', 'academic', 0.5, 'second'],
    ['AAC-HUMMOV1', 'Human Movement 1 (Basic Anatomy in Sports & Exercise)', 'Grade 11', 'academic', 0.5, 'third'],
    ['AAC-BIO1', 'Biology 1', 'Grade 11', 'academic', 0.5, 'first'],
    ['AAC-CHEM1', 'Chemistry 1', 'Grade 11', 'academic', 0.5, 'second'],
    ['AAC-EARTH1', 'Earth and Space Science 1', 'Grade 11', 'academic', 0.5, 'third'],
    ['AAC-PHYS1', 'Physics 1', 'Grade 11', 'academic', 0.5, 'third'],
  ];
  const sshsTechProElectives = [
    ['STP-CSS', 'Computer Systems Servicing', 'Grade 11', 'tvl', 0.5, 'first'],
    ['STP-ANIM', 'Animation', 'Grade 11', 'tvl', 0.5, 'first'],
    ['STP-PROG', 'Programming', 'Grade 11', 'tvl', 0.5, 'second'],
    ['STP-COOK', 'Cookery', 'Grade 11', 'tvl', 0.5, 'first'],
    ['STP-BPP', 'Bread and Pastry Production', 'Grade 11', 'tvl', 0.5, 'second'],
    ['STP-FBS', 'Food and Beverage Services', 'Grade 11', 'tvl', 0.5, 'second'],
    ['STP-AGRI', 'Agricultural Crops Production', 'Grade 11', 'tvl', 0.5, 'third'],
    ['STP-ANIPROD', 'Animal Production', 'Grade 11', 'tvl', 0.5, 'third'],
    ['STP-AUTO', 'Automotive Servicing', 'Grade 11', 'tvl', 0.5, 'third'],
    ['STP-SMAW', 'Shielded Metal Arc Welding', 'Grade 11', 'tvl', 0.5, 'second'],
    ['STP-EIM', 'Electrical Installation and Maintenance', 'Grade 11', 'tvl', 0.5, 'third'],
    ['STP-DRESS', 'Dressmaking', 'Grade 11', 'tvl', 0.5, 'first'],
    ['STP-BEAUTY', 'Beauty Care (Nail Care)', 'Grade 11', 'tvl', 0.5, 'third'],
    ['STP-TOURISM', 'Tourism Promotion Services', 'Grade 11', 'tvl', 0.5, 'first'],
  ];
  const grade12Existing = [
    ['CORE-MIL', 'Media and Information Literacy', 'Grade 12', 'academic', 0.5, null],
    ['CORE-PR2', 'Practical Research 2', 'Grade 12', 'academic', 0.5, null],
    ['HUMSS-TRENDS', 'Trends, Networks and Critical Thinking', 'Grade 12', 'academic', 0.5, null],
    ['HUMSS-DISS', 'Disciplines and Ideas in the Social Sciences', 'Grade 12', 'academic', 0.5, null],
    ['STEM-PHYSCI', 'Physical Science', 'Grade 12', 'academic', 0.5, null],
    ['TVL-EMPOWER', 'Empowerment Technologies', 'Grade 12', 'tvl', 1.0, null],
    ['CORE-ENTREP', 'Entrepreneurship', 'Grade 12', 'academic', 0.5, null],
  ];
  subjects.push(...sshsCores, ...sshsAcademicElectives, ...sshsTechProElectives, ...grade12Existing);
  const subjectIds = [];
  for (const s of subjects) {
    const existing = await q('SELECT id FROM subjects WHERE code = ?', [s[0]]);
    if (existing) { subjectIds.push(existing.id); continue; }
    const id = await qi('INSERT INTO subjects (code, title, grade_level, track, units, term) VALUES (?, ?, ?, ?, ?, ?)',
      [s[0], s[1], s[2], s[3], s[4], s[5]]);
    subjectIds.push(id);
  }

  const sections = [
    ['ACAD 11-A', 'Grade 11', 'Academic', teacherIds[0], 'Rm 201'],
    ['ACAD 11-B', 'Grade 11', 'Academic', teacherIds[3], 'Rm 202'],
    ['TECHPRO 11-A', 'Grade 11', 'TechPro', teacherIds[1], 'ICT Lab 1'],
    ['HUMSS 12-A', 'Grade 12', 'HUMSS', teacherIds[5], 'Rm 301'],
    ['STEM 12-A', 'Grade 12', 'STEM', teacherIds[6], 'Rm 302'],
    ['TVL-ICT 12-A', 'Grade 12', 'TVL-ICT', teacherIds[7], 'ICT Lab 2'],
  ];
  const sectionIds = [];
  for (const s of sections) {
    const id = await qi(
      'INSERT INTO sections (name, grade_level, strand, adviser_teacher_id, room, capacity, school_year, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [s[0], s[1], s[2], s[3], s[4], 40, '2026-2027', 'active']);
    sectionIds.push(id);
  }

  const subjectPools = [
    [44, 45, 46, 47, 48, 49],
    [44, 46, 47, 48, 54, 55],
    [58, 59, 60, 61],
    [72, 73, 74, 75],
    [72, 73, 76, 77],
    [77, 78],
  ];
  for (let s = 0; s < sectionIds.length; s++) {
    const pool = subjectPools[s];
    for (let i = 0; i < pool.length; i++) {
      const sidx = pool[i];
      const durations = [60, 90, 120];
      const meetings = [1, 2, 3];
      await qi(
        `INSERT INTO class_assignments (school_year, section_id, subject_id, teacher_id, duration_minutes, meetings_per_week, room)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['2026-2027', sectionIds[s], subjectIds[sidx], teacherIds[(s * 3 + i) % teacherIds.length],
          durations[(s + i) % 3], meetings[(s + i) % 3], sections[s][4]]);
    }
  }

  const firstNames = ['Joshua', 'Angela', 'Miguel', 'Sofia', 'Nathan', 'Bianca', 'Christian', 'Ella', 'Mark', 'Liza',
    'Daniel', 'Kate', 'Rafael', 'Joy', 'Paolo', 'Nicole', 'Adrian', 'Camille', 'Vincent', 'Patricia'];
  const lastNames = ['Abad', 'Bautista', 'Cruz', 'Dizon', 'Espino', 'Fernandez', 'Garcia', 'Hernandez', 'Ignacio', 'Javier',
    'Lopez', 'Marcos', 'Navarro', 'Ocampo', 'Padilla', 'Quinto', 'Ramos', 'Santos', 'Torres', 'Uy'];
  const strands = ['Academic', 'Academic', 'Academic', 'Academic', 'Academic',
    'Academic', 'Academic', 'Academic', 'Academic', 'Academic',
    'TechPro', 'TechPro', 'TechPro', 'TechPro', 'TechPro',
    'Academic', 'Academic', 'Academic', 'Academic', 'Academic'];
  const sectionFor = [sectionIds[0], sectionIds[0], sectionIds[0], sectionIds[0], sectionIds[0],
    sectionIds[1], sectionIds[1], sectionIds[1], sectionIds[1], sectionIds[1],
    sectionIds[2], sectionIds[2], sectionIds[2], sectionIds[2], sectionIds[2],
    sectionIds[0], sectionIds[0], sectionIds[0], sectionIds[0], sectionIds[0]];
  const sexFor = ['Male', 'Female', 'Male', 'Female', 'Male', 'Female', 'Male', 'Female', 'Male', 'Female',
    'Male', 'Female', 'Male', 'Female', 'Male', 'Female', 'Male', 'Female', 'Male', 'Female'];

  const studentIds = [];
  for (let i = 0; i < 20; i++) {
    const lrn = '136' + String(900000000 + i * 137 + 421).padStart(9, '0');
    const id = await qi(
      `INSERT INTO students (lrn, first_name, middle_name, last_name, suffix, sex, birth_date, religion, address, contact, guardian_name, guardian_contact, guardian_relation, grade_level, track_strand, status)
       VALUES (?, ?, ?, ?, NULL, ?, ?, 'Roman Catholic', 'Brgy. San Isidro, Testville', ?, ?, ?, 'Parent', 'Grade 11', ?, 'enrolled')`,
      [lrn, firstNames[i], 'D.', lastNames[i], sexFor[i],
        `200${8 + (i % 2)}-0${(i % 9) + 1}-1${i % 10}`, `09${String(100000000 + i * 1234567).slice(0, 9)}`,
        `${firstNames[(i + 1) % 20]} ${lastNames[i]}`, `09${String(900000000 + i * 987654).slice(0, 9)}`, strands[i]]);
    studentIds.push(id);
    const secId = sectionFor[i];
    const enrId = await qi(
      'INSERT INTO enrollments (student_id, section_id, school_year, grade_level, strand, status, term, enrolled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, secId, '2026-2027', 'Grade 11', strands[i], 'enrolled', 'all', '2025-06-02']);
    const sidx = secId === sectionIds[0] ? 0 : (secId === sectionIds[1] ? 1 : 2);
    const subjectPool = subjectPools[sidx].map((i) => subjectIds[i]);
    for (const subjId of subjectPool) {
      await qi('INSERT INTO enrollment_subjects (enrollment_id, subject_id) VALUES (?, ?)', [enrId, subjId]);
      for (const t of [1, 2, 3]) {
        const ww = 60 + (i * 7 + subjId + t * 11) % 40;
        const pt = 65 + (i * 5 + subjId * 2 + t * 7) % 33;
        const qe = 62 + (i * 3 + subjId * 5 + t * 3) % 36;
        const grade = Math.round((ww * 0.25 + pt * 0.45 + qe * 0.30) * 10) / 10;
        await qi(
          'INSERT INTO grades (student_id, subject_id, section_id, school_year, quarter, written_work, performance_task, quarterly_exam, computed_grade, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, subjId, secId, '2026-2027', t, ww, pt, qe, grade, grade >= 75 ? 'PASSED' : 'FAILED']);
      }
    }
  }

  const grade12First = ['Aileen', 'Bryan', 'Carla', 'Derrick', 'Erica', 'Francis', 'Grace', 'Hector', 'Ivy', 'Jerome'];
  const grade12Last = ['Valdez', 'Wong', 'Xavier', 'Yap', 'Zamora', 'Aldana', 'Bondoc', 'Cunanan', 'Dimaano', 'Estrella'];
  const grade12SecFor = [sectionIds[3], sectionIds[3], sectionIds[3], sectionIds[3], sectionIds[3],
    sectionIds[4], sectionIds[4], sectionIds[4], sectionIds[5], sectionIds[5]];
  const grade12StrandFor = ['HUMSS', 'HUMSS', 'HUMSS', 'HUMSS', 'HUMSS',
    'STEM', 'STEM', 'STEM', 'TVL-ICT', 'TVL-ICT'];
  const grade12Sex = ['Female', 'Male', 'Female', 'Male', 'Female', 'Male', 'Female', 'Male', 'Female', 'Male'];
  for (let i = 0; i < 10; i++) {
    const k = 20 + i;
    const lrn = '1362' + String(8000000000 + k * 137 + 421).padStart(8, '0');
    const id = await qi(
      `INSERT INTO students (lrn, first_name, middle_name, last_name, suffix, sex, birth_date, religion, address, contact, guardian_name, guardian_contact, guardian_relation, grade_level, track_strand, status)
       VALUES (?, ?, ?, ?, NULL, ?, ?, 'Roman Catholic', 'Brgy. San Isidro, Testville', ?, ?, ?, 'Parent', 'Grade 12', ?, 'enrolled')`,
      [lrn, grade12First[i], 'D.', grade12Last[i], grade12Sex[i],
        `200${8 + (i % 2)}-0${(i % 9) + 1}-1${i % 10}`, `09${String(100000000 + k * 1234567).slice(0, 9)}`,
        `${firstNames[(k + 1) % 20]} ${lastNames[i]}`, `09${String(900000000 + k * 987654).slice(0, 9)}`,
        grade12StrandFor[i]]);
    studentIds.push(id);
    const enrId = await qi(
      'INSERT INTO enrollments (student_id, section_id, school_year, grade_level, strand, status, enrolled_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, grade12SecFor[i], '2026-2027', 'Grade 12', grade12StrandFor[i], 'enrolled', '2025-06-02']);
    const sidx = grade12SecFor[i] === sectionIds[3] ? 0 : (grade12SecFor[i] === sectionIds[4] ? 1 : 2);
    const pool = subjectPools[3 + sidx];
    for (const subjId of pool) {
      await qi('INSERT INTO enrollment_subjects (enrollment_id, subject_id) VALUES (?, ?)', [enrId, subjectIds[subjId]]);
      for (const t of [1, 2, 3]) {
        const ww = 60 + (k * 7 + subjId + t * 11) % 40;
        const pt = 65 + (k * 5 + subjId * 2 + t * 7) % 33;
        const qe = 62 + (k * 3 + subjId * 5 + t * 3) % 36;
        const grade = Math.round((ww * 0.25 + pt * 0.45 + qe * 0.30) * 10) / 10;
        await qi(
          'INSERT INTO grades (student_id, subject_id, section_id, school_year, quarter, written_work, performance_task, quarterly_exam, computed_grade, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, subjectIds[subjId], grade12SecFor[i], '2026-2027', t, ww, pt, qe, grade, grade >= 75 ? 'PASSED' : 'FAILED']);
      }
    }
  }

  const today = new Date();
  const studentSection = {};
  const enrRows = await qa(
    'SELECT student_id, section_id FROM enrollments WHERE school_year = ? AND status = ?',
    ['2026-2027', 'enrolled']);
  for (const e of enrRows) studentSection[e.student_id] = e.section_id;
  for (let d = 6; d >= 1; d--) {
    const date = new Date(today);
    date.setDate(today.getDate() - d);
    const ds = date.toISOString().slice(0, 10);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue;
    for (const sid of studentIds) {
      const miss = (sid * 7 + d) % 11 === 0;
      const late = (sid * 5 + d) % 13 === 0;
      const status = miss ? 'absent' : (late ? 'late' : 'present');
      await qi(
        'INSERT INTO attendance (student_id, section_id, date, status, session, remarks, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [sid, studentSection[sid] || null, ds, status, 'AM', status !== 'present' ? 'seed data' : null, 1]);
    }
  }

  await qi('INSERT INTO announcements (title, body, audience, priority, author_id) VALUES (?, ?, ?, ?, ?)',
    ['Welcome to School Year 2026-2027', 'Classes officially begin on June 2. All learners must report to their assigned rooms by 6:45 AM.', 'all', 'high', 2]);
  await qi('INSERT INTO announcements (title, body, audience, priority, author_id) VALUES (?, ?, ?, ?, ?)',
    ['First Quarter Examinations', 'The First Quarter Exams will be held on October 8-12. Review schedule will be posted by advisers.', 'students', 'high', 2]);
  await qi('INSERT INTO announcements (title, body, audience, priority, author_id) VALUES (?, ?, ?, ?, ?)',
    ['Teachers: DLL submission reminder', 'Daily Lesson Logs for the current week must be submitted to the principal office every Friday before 5 PM.', 'teachers', 'normal', 1]);

  logger.info('Seed complete: 22 accounts, 8 teachers, 79 subjects, 6 sections, 30 students, grades, attendance, assignments.');
  await seedAiModules();
  if (require.main === module) await close();
}

async function seedAiModules() {
  const existing = await q('SELECT COUNT(*) AS n FROM learner_assessments');
  if (Number(existing.n) > 0) {
    logger.info('= AI module seed data already present (kept).');
    return;
  }
  const students = await qa('SELECT id, first_name, last_name FROM students ORDER BY id');
  const ids = students.map((s) => s.id);
  const teachers = await qa('SELECT id FROM users WHERE role = ? LIMIT 4', ['teacher']);

  const levelPool = ['Independent', 'Independent', 'Instructional', 'Instructional', 'Frustration', 'Frustration', 'Non-Reader'];
  const fluPool = ['Fluent', 'Fluent', 'Fairly Fluent', 'Slow', 'Slow', 'Non-Fluent', 'Non-Fluent'];
  for (let i = 0; i < ids.slice(0, 14).length; i++) {
    const sid = ids.slice(0, 14)[i];
    const lev = levelPool[i % levelPool.length];
    const score = { Independent: 17, Instructional: 14, Frustration: 9, 'Non-Reader': 4 }[lev];
    await qi(
      `INSERT INTO learner_assessments (student_id, kind, assessment_type, date, score, max_score, level, fluency, comprehension, remarks, recorded_by)
       VALUES (?, 'reading', 'PHIL-IRI', ?, ?, 20, ?, ?, ?, 'Seeded PHIL-IRI record', ?)`,
      [sid, '2025-07-15', score, lev, fluPool[i % fluPool.length], lev === 'Frustration' ? 'Literal comprehension only' : (lev === 'Non-Reader' ? 'Letter-sound skills need development' : 'Age-appropriate comprehension'), teachers[0].id]);
  }

  for (let i = 0; i < ids.slice(7, 12).length; i++) {
    const sid = ids.slice(7, 12)[i];
    const lev = i % 2 ? 'Independent' : 'Developing';
    await qi(
      `INSERT INTO learner_assessments (student_id, kind, assessment_type, date, score, max_score, level, remarks, recorded_by)
       VALUES (?, 'numeracy', 'Numeracy Assessment', ?, ?, 50, ?, 'Seeded numeracy record', ?)`,
      [sid, '2025-08-01', lev === 'Independent' ? 41 : 28, lev, teachers[1].id]);
  }

  // ---- ARAL Program demo: tag learners, baseline+post assessments, sessions ----
  const aralRows = await qa(
    `SELECT e.student_id, e.section_id FROM enrollments e
     JOIN students s ON s.id = e.student_id
     WHERE e.school_year = '2026-2027' AND s.grade_level = 'Grade 11' AND e.status = 'enrolled'
     ORDER BY e.student_id`);
  const aralLearners = aralRows.filter((r, i) => i % 3 === 0);
  if (aralLearners.length) {
    const aralIds = aralLearners.map((r) => r.student_id);
    const placeholders = aralIds.map(() => '?').join(',');
    await qr(`UPDATE enrollments SET is_aral = TRUE WHERE school_year = '2026-2027' AND student_id IN (${placeholders})`, aralIds);
    const baseLevels = ['Frustration', 'Frustration', 'Non-Reader', 'Frustration', 'Frustration', 'Non-Reader'];
    const postLevels = ['Instructional', 'Independent', 'Instructional', 'Frustration', 'Independent', 'Instructional'];
    const baseScore = { Frustration: 9, 'Non-Reader': 4 };
    const postScore = { Instructional: 14, Independent: 17, Frustration: 9 };
    for (let i = 0; i < aralLearners.length; i++) {
      const lr = aralLearners[i];
      const bLevel = baseLevels[i % baseLevels.length];
      const pLevel = postLevels[i % postLevels.length];
      await qi(
        `INSERT INTO learner_assessments (student_id, kind, assessment_type, date, score, max_score, level, fluency, comprehension, remarks, recorded_by)
         VALUES (?, 'reading', 'PHIL-IRI', '2026-07-10', ?, 20, ?, 'Slow', 'Literal comprehension only', 'ARAL baseline (pre-test)', ?)`,
        [lr.student_id, baseScore[bLevel], bLevel, teachers[0].id]);
      await qi(
        `INSERT INTO learner_assessments (student_id, kind, assessment_type, date, score, max_score, level, fluency, comprehension, remarks, recorded_by)
         VALUES (?, 'reading', 'PHIL-IRI', '2026-11-18', ?, 20, ?, ?, 'Improved comprehension with guidance', 'ARAL post-test', ?)`,
        [lr.student_id, postScore[pLevel], pLevel, pLevel === 'Independent' ? 'Fluent' : 'Fairly Fluent', teachers[0].id]);
      if (i % 2 === 0) {
        await qi(
          `INSERT INTO learner_assessments (student_id, kind, assessment_type, date, score, max_score, level, remarks, recorded_by)
           VALUES (?, 'numeracy', 'Numeracy Assessment', '2026-07-12', 25, 50, 'Frustration', 'ARAL numeracy baseline', ?)`,
          [lr.student_id, teachers[1].id]);
        const pLevel2 = i % 4 === 0 ? 'Independent' : 'Developing';
        const pScore = i % 4 === 0 ? 41 : 38;
        await qi(
          `INSERT INTO learner_assessments (student_id, kind, assessment_type, date, score, max_score, level, remarks, recorded_by)
           VALUES (?, 'numeracy', 'Numeracy Assessment', '2026-11-18', ?, 50, ?, 'ARAL numeracy post-test', ?)`,
          [lr.student_id, pScore, pLevel2, teachers[1].id]);
      }
    }
    const numeracyIds = new Set(aralLearners.filter((_, i) => i % 2 === 0).map((r) => r.student_id));
    const bySection = {};
    for (const lr of aralLearners) (bySection[lr.section_id] = bySection[lr.section_id] || []).push(lr.student_id);
    for (const [secId, members] of Object.entries(bySection)) {
      let seq = 0;
      for (const [sDate, area] of [['2026-11-02', 'reading'], ['2026-11-09', 'reading'], ['2026-11-12', 'numeracy']]) {
        seq++;
        const targets = area === 'numeracy' ? members.filter((id) => numeracyIds.has(id)) : members;
        if (!targets.length) continue;
        const sesId = await qi(
          `INSERT INTO aral_sessions (school_year, section_id, subject_area, session_date, session_no, tutor, remarks, recorded_by)
           VALUES ('2026-2027', ?, ?, ?, ?, ?, 'Seeded ARAL remediation session', ?)`,
          [Number(secId), area, sDate, seq, `Tutor ${seq}`, teachers[0].id]);
        for (let pos = 0; pos < targets.length; pos++) {
          const sid = targets[pos];
          const roll = (pos + seq) % 5;
          const status = roll === 0 ? 'absent' : roll === 1 ? 'excused' : 'present';
          await qi(
            'INSERT INTO aral_session_attendance (session_id, student_id, status, remarks) VALUES (?, ?, ?, ?)',
            [sesId, sid, status, status === 'present' ? null : 'seeded']);
        }
      }
    }
  }

  const ip1 = await qi(
    `INSERT INTO intervention_plans (student_id, title, category, strategy, frequency, start_date, end_date, status, progress_notes, recorded_by)
     VALUES (?, ?, 'reading', 'Daily 20-minute guided reading with leveled texts; weekly fluency checks.', 'Daily (20 min)', '2025-09-01', '2025-12-15', 'active', 'Showing steady improvement in word recognition.', ?)`,
    [ids[5], 'Reading Recovery Plan', teachers[0].id]);
  await qi('INSERT INTO intervention_contacts (plan_id, mode, summary, contact_date, recorded_by) VALUES (?, ?, ?, ?, ?)',
    [ip1, 'conference', 'Met with the guardian to agree on at-home reading practice schedule.', '2025-09-12', teachers[0].id]);

  await qi(
    `INSERT INTO intervention_plans (student_id, title, category, strategy, frequency, start_date, end_date, status, progress_notes, recorded_by)
     VALUES (?, ?, 'academic_recovery', 'After-class remedial sessions focused on General Mathematics fundamentals.', '3x per week', '2025-10-01', NULL, 'active', 'Average improved from 69 to 74.', ?)`,
    [ids[9], 'Math Remediation Program', teachers[1].id]);

  await qi(
    `INSERT INTO intervention_plans (student_id, title, category, strategy, frequency, start_date, end_date, status, progress_notes, recorded_by)
     VALUES (?, ?, 'enrichment', 'Peer tutoring under the guidance of the subject teacher.', '1x per week', '2025-11-01', '2026-01-31', 'completed', 'Learner reached instructional independence in peer-led tasks.', ?)`,
    [ids[2], 'Enrichment: Peer Tutoring', teachers[2].id]);

  const subj = await qa('SELECT id FROM subjects ORDER BY id LIMIT 1');
  const subjId = subj[0].id;
  const qs = [
    ['English', 'Identify the correct definition of an oral communication message.', ['A. The sender\u2019s verbal output', 'B. The transmission of thoughts between persons (correct)', 'C. The receiver only', 'D. Written notes'], 'B'],
    ['English', 'Which scenario best shows active listening?', ['A. Interrupting to answer quickly', 'B. Taking notes and asking clarifying questions (correct)', 'C. Looking away and replying late', 'D. Memorizing every word'], 'B'],
    ['Math', 'Evaluate: 3 + 4 × 2 − 1', ['14', '10 (correct)', '13', '9'], 'B'],
    ['Math', 'Which equation is linear?', ['y = x²', 'y = 2x + 1 (correct)', 'xy = 4', 'y = 1/x'], 'B'],
    ['English', 'What is the purpose of a thesis statement?', ['To entertain the reader', 'To state the main argument of the essay (correct)', 'To list sources', 'To add decoration'], 'B'],
    ['Math', 'The mean of 5 numbers is 12. The sum of the numbers is', ['60 (correct)', '48', '72', '36'], 'A'],
  ];
  for (const [comp, question, options, answer] of qs) {
    await qi(
      `INSERT INTO question_bank (user_id, subject_id, grade_level, competency, qtype, question, options, answer, difficulty)
       VALUES (?, ?, 'Grade 11', ?, 'mcq', ?, ?, ?, ?)`,
      [teachers[0].id, subjId, comp, question, JSON.stringify(options), answer, 2]);
  }

  await qi('INSERT INTO rubrics (user_id, title, subject_id, task, criteria) VALUES (?, ?, ?, ?, ?)',
    [teachers[0].id, 'Oral Presentation Rubric', subjId, 'Individual oral presentation',
      JSON.stringify([
        { name: 'Content and Accuracy', weight: 4 },
        { name: 'Organization', weight: 3 },
        { name: 'Delivery and Eye Contact', weight: 2 },
        { name: 'Use of Visual Aids', weight: 1 },
      ])]);

  await qi('INSERT INTO tos_records (user_id, title, subject_id, quarter, data) VALUES (?, ?, ?, 1, ?)',
    [teachers[0].id, 'First Quarter TOS — Oral Communication', subjId,
      JSON.stringify([
        { competency: 'Nature and elements of communication', items: 5, type: 'mcq', weight: 25 },
        { competency: 'Models of communication', items: 3, type: 'mcq', weight: 15 },
        { competency: 'Functions of communication', items: 2, type: 'mcq', weight: 10 },
      ])]);

  await qi('INSERT INTO item_analyses (user_id, title, school_year, subject_id, total_items, learners, data, computed) VALUES (?, ?, ?, ?, 10, 30, ?, ?)',
    [teachers[1].id, 'Q1 General Mathematics Item Analysis', '2026-2027', subjId,
      JSON.stringify({ note: 'Sample: enter per-item correct counts for upper/lower 27% groups.\n' }),
      JSON.stringify({ average_difficulty: 0.52, interpretation: 'Overall: test difficulty is appropriate.', poor_items: 1,
        results: [{ item_no: 1, difficulty: 0.55, discrimination: 0.30, difficulty_level: 'Average', discrimination_level: 'Good' }] })]);

  logger.info('+ AI modules seeded: PHIL-IRI/numeracy records, interventions, question bank, rubrics, TOS, item analysis.');
}

module.exports = { seed };

if (require.main === module) {
  seed().catch(async (err) => {
    logger.error({ err }, 'Seed failed:');
    await close();
    process.exit(1);
  });
}
