const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { PORT, WEB_DIR } = require('./config');
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const studentsRoutes = require('./routes/students.routes');
const teachersRoutes = require('./routes/teachers.routes');
const subjectsRoutes = require('./routes/subjects.routes');
const sectionsRoutes = require('./routes/sections.routes');
const enrollmentsRoutes = require('./routes/enrollments.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const gradesRoutes = require('./routes/grades.routes');
const announcementsRoutes = require('./routes/announcements.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const auditRoutes = require('./routes/audit.routes');
const scheduleRoutes = require('./routes/schedule.routes');
const submissionsRoutes = require('./routes/submissions.routes');
const aiRoutes = require('./routes/ai.routes');
const researchRoutes = require('./routes/research.routes');
const learnerProgressRoutes = require('./routes/learner-progress.routes');
const interventionsRoutes = require('./routes/interventions.routes');
const assessmentRoutes = require('./routes/assessment.routes');

(async () => {
  await db.init();
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/v1/health', (req, res) => {
    res.json({ ok: true, service: 'meridianed', dialect: db.dialect, time: new Date().toISOString() });
  });

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', usersRoutes);
  app.use('/api/v1/students', studentsRoutes);
  app.use('/api/v1/teachers', teachersRoutes);
  app.use('/api/v1/subjects', subjectsRoutes);
  app.use('/api/v1/sections', sectionsRoutes);
  app.use('/api/v1/enrollments', enrollmentsRoutes);
  app.use('/api/v1/attendance', attendanceRoutes);
  app.use('/api/v1/grades', gradesRoutes);
  app.use('/api/v1/announcements', announcementsRoutes);
  app.use('/api/v1/dashboard', dashboardRoutes);
  app.use('/api/v1/audit', auditRoutes);
  app.use('/api/v1/schedule', scheduleRoutes);
  app.use('/api/v1/submissions', submissionsRoutes);
  app.use('/api/v1/ai', aiRoutes);
  app.use('/api/v1/research', researchRoutes);
  app.use('/api/v1/learner-progress', learnerProgressRoutes);
  app.use('/api/v1/interventions', interventionsRoutes);
  app.use('/api/v1/assessment', assessmentRoutes);

  app.use(express.static(WEB_DIR));

  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    const index = path.join(WEB_DIR, 'index.html');
    if (!fs.existsSync(index)) return next();
    res.sendFile(index);
  });

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));

  app.use((err, req, res, next) => {
    console.error(err);
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  });

  app.listen(PORT, () => {
    console.log(`MeridianEd API listening on http://localhost:${PORT} (dialect: ${db.dialect})`);
  });
})();
