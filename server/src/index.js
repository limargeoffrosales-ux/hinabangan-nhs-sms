const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { PORT, WEB_DIR, JWT_SECRET, isAllowedOrigin } = require('./config');
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
const conductRoutes = require('./routes/conduct.routes');
const dataExchangeRoutes = require('./routes/data-exchange.routes');
const gradingRoutes = require('./routes/grading.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const portalRoutes = require('./routes/portal.routes');
const { immersion, jdvp } = require('./routes/immersion.routes');

(async () => {
  await db.init();
  const { startCleanup } = require('./cleanup');
  startCleanup();
  if (process.env.SEED_ON_BOOT === '1') {
    const { seed } = require('./seed');
    await seed();
    console.log('SEED_ON_BOOT: report types, demo + staff accounts ensured (idempotent)');
  }
  const { purgeDemo } = require('./purge-demo');
  await purgeDemo();
  if (process.env.SUPERADMIN_PASSWORD && process.env.SUPERADMIN_PASSWORD.length >= 8) {
    const bcrypt = require('bcryptjs');
    const rows = await db.q('SELECT id, password_hash FROM users WHERE username = ?', ['superadmin']);
    if (rows && rows.length) {
      const isLegacy = await bcrypt.compare('REDACTED', rows[0].password_hash);
      if (isLegacy) {
        await db.qr(
          'UPDATE users SET password_hash = ? WHERE id = ?',
          [await bcrypt.hash(process.env.SUPERADMIN_PASSWORD, 10), rows[0].id],
        );
        console.log('SUPERADMIN_PASSWORD: superadmin password set from env (legacy default replaced)');
      } else {
        console.log('SUPERADMIN_PASSWORD: superadmin password already customized — env override skipped');
      }
    }
  }
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({
    origin(origin, cb) {
      cb(null, isAllowedOrigin(origin));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }));
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));

  // Brute-force protection for the credential endpoints (IP-based).
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many sign-in attempts. Try again in a few minutes.' },
  });
  app.use('/api/v1/auth/login', authLimiter);
  app.use('/api/v1/auth/refresh', authLimiter);

  // Generous per-IP cap for the rest of the API to blunt abuse/DoS.
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' },
  });
  app.use('/api/', apiLimiter);

  // The AI assistant does heavier work and writes chat logs — keep it tighter.
  const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'AI assistant is busy. Please wait a moment.' },
  });
  app.use('/api/v1/ai/', aiLimiter);

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
  app.use('/api/v1/grading', gradingRoutes);
  app.use('/api/v1/analytics', analyticsRoutes);
  app.use('/api/v1/portal', portalRoutes);
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
  app.use('/api/v1/immersion', immersion);
  app.use('/api/v1/jdvp', jdvp);
  app.use('/api/v1/conduct', conductRoutes);
  app.use('/api/v1/exchange', dataExchangeRoutes);

  app.use(express.static(WEB_DIR, {
    maxAge: '365d',
    immutable: true,
    index: false,
    setHeaders(res, filePath) {
      if (path.basename(filePath) === 'index.html') {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));

  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    const index = path.join(WEB_DIR, 'index.html');
    if (!fs.existsSync(index)) return next();
    res.setHeader('Cache-Control', 'no-cache');
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
    if (!process.env.JWT_SECRET) {
      console.warn('WARNING: JWT_SECRET is not set — using the development default. Set a strong JWT_SECRET in production.');
    }
  });
})();
