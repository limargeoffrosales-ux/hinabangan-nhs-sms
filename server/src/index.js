const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const Sentry = require('@sentry/node');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const db = require('./db');
const { PORT, WEB_DIR } = require('./config');

const logger = require('./logger');
const { authenticate, requireCsrf } = require('./auth');
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
const assignmentsRoutes = require('./routes/assignments.routes');
const submissionsRoutes = require('./routes/submissions.routes');
const interventionsRoutes = require('./routes/interventions.routes');
const assessmentRoutes = require('./routes/assessment.routes');
const conductRoutes = require('./routes/conduct.routes');
const gradingRoutes = require('./routes/grading.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const analyticsKpiRoutes = require('./routes/analytics-kpi.routes');
const portalRoutes = require('./routes/portal.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const { immersion, jdvp } = require('./routes/immersion.routes');
const privacyRoutes = require('./routes/privacy.routes');
const mfaRoutes = require('./routes/mfa.routes');
const curriculumRoutes = require('./routes/curriculum.routes');
const roomsRoutes = require('./routes/rooms.routes');
const departmentRoutes = require('./routes/department.routes');
const lessonsRoutes = require('./routes/lessons.routes');
const competencyTrackerRoutes = require('./routes/competency-tracker.routes');
const depedFormsRoutes = require('./routes/deped-forms.routes');
const pushRoutes = require('./routes/push.routes');
const certificationsRoutes = require('./routes/certifications.routes');
const libraryRoutes = require('./routes/library.routes');
const clinicRoutes = require('./routes/clinic.routes');
const guidanceRoutes = require('./routes/guidance.routes');
const uploadsRoutes = require('./routes/uploads.routes');
const aiRoutes = require('./routes/ai.routes');

(async () => {
  if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    logger.fatal('JWT_SECRET must be set in production.');
    process.exit(1);
  }
  await db.init();
  const { ensureDefaults, startNotifySweep } = require('./notify');
  await ensureDefaults();
  if (process.env.SEED_ON_BOOT === '1') {
    const { seed } = require('./seed');
    await seed();
    logger.info('SEED_ON_BOOT: report types, demo + staff accounts ensured (idempotent)');
  }
  const { purgeDemo } = require('./purge-demo');
  await purgeDemo();
  const ENABLE_LEGACY_SUPERADMIN = process.env.ENABLE_LEGACY_SUPERADMIN === 'true';
  const LEGACY_DEFAULT = process.env.LEGACY_SUPERADMIN_PASSWORD || '';
  if (process.env.SUPERADMIN_PASSWORD && process.env.SUPERADMIN_PASSWORD.length >= 8) {
    const bcrypt = require('bcryptjs');
    const row = await db.q('SELECT id, password_hash, password_changed_at FROM users WHERE username = ?', ['superadmin']);
    if (row && !row.password_changed_at && LEGACY_DEFAULT) {
      if (!ENABLE_LEGACY_SUPERADMIN) {
        logger.warn('LEGACY_SUPERADMIN_PASSWORD is set but ENABLE_LEGACY_SUPERADMIN is not true. Legacy password migration skipped. Set ENABLE_LEGACY_SUPERADMIN=true to enable (not recommended for production).');
      } else {
        if (process.env.NODE_ENV === 'production') {
          logger.warn('SECURITY WARNING: ENABLE_LEGACY_SUPERADMIN is enabled in production! This allows legacy superadmin password migration and should be disabled after initial setup.');
        }
        const isLegacy = await bcrypt.compare(LEGACY_DEFAULT, row.password_hash);
        if (isLegacy) {
          await db.qr(
            'UPDATE users SET password_hash = ?, password_changed_at = NOW() WHERE id = ?',
            [await bcrypt.hash(process.env.SUPERADMIN_PASSWORD, 10), row.id],
          );
          await db.qr(
            'INSERT INTO security_incidents (incident_type, severity, source_ip, username, user_id, details) VALUES (?, ?, ?, ?, ?, ?)',
            ['LEGACY_SUPERADMIN_MIGRATION', 'high', 'server-startup', 'system', null, JSON.stringify({ note: 'Legacy superadmin password migrated from default via SUPERADMIN_PASSWORD env' })]
          );
          logger.info('SUPERADMIN_PASSWORD: superadmin password set from env (legacy default replaced)');
        } else {
          logger.info('SUPERADMIN_PASSWORD: superadmin password already customized — env override skipped');
        }
      }
    }
  }
  const app = express();
  app.disable('x-powered-by');

  if (process.env.SENTRY_DSN) {
    Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || 'development', tracesSampleRate: 0.1 });
    app.use(Sentry.Handlers.requestHandler());
  }

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://*.r2.dev", "https://*.cloudflarestorage.com", "https://lh3.googleusercontent.com"],
        connectSrc: ["'self'", "https://*.r2.dev", "wss:"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));
  app.use(cors({
    origin(origin, cb) {
      // Allow all origins — JWT auth + CSRF tokens protect all endpoints.
      // A custom origin allowlist was blocking legitimate Capacitor/Android
      // requests, so it was removed.
      cb(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    credentials: true,
    maxAge: 86400,
  }));

  // Origin check removed — cors middleware above already blocks disallowed
  // browser origins by omitting CORS headers. The custom 403 was rejecting
  // legitimate Capacitor/Android requests. JWT auth + CSRF protect all endpoints.

  // Endpoints that are safe to mutate without an established session (pre-auth flows).
  // CSRF tokens are issued only after authentication (login / refresh / MFA / csrf-token),
  // so these must skip the authenticated-csrf gate. Logout only revokes the caller's own
  // refresh token, so it also remains reachable without a bearer token.
  const PUBLIC_MUTATING_PATHS = [
    '/api/v1/auth/login',
    '/api/v1/auth/refresh',
    '/api/v1/auth/logout',
    '/api/v1/mfa/verify',
  ];

  // CSRF protection for authenticated mutating requests.
  // Authentication must happen first so req.user is populated before CSRF validation.
  app.use((req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    if (PUBLIC_MUTATING_PATHS.some((p) => req.path === p || req.path.startsWith(p + '/'))) return next();
    return authenticate(req, res, (err) => {
      if (err) return next(err);
      return requireCsrf(req, res, next);
    });
  });

  const MAX_BODY_FIELD = 10000;
  const BULK_IMPORT_PATHS = [
    '/api/v1/enrollments/import',
    '/api/v1/assignments',
    '/api/v1/lessons',
  ];
  const MAX_BULK_BODY_FIELD = 100000; // 100KB for bulk imports
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      const isBulkImport = BULK_IMPORT_PATHS.some(p => req.path.startsWith(p));
      const limit = isBulkImport ? MAX_BULK_BODY_FIELD : MAX_BODY_FIELD;
      for (const [k, v] of Object.entries(req.body)) {
        if (typeof v === 'string' && v.length > limit) {
          req.body[k] = v.slice(0, limit);
        }
      }
    }
    next();
  });
  app.use(compression());

  app.use((req, res, next) => {
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  });

  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      logger[level]({ method: req.method, url: req.originalUrl, status: res.statusCode, ms, requestId: req.requestId, userId: req.user?.id }, `${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
    });
    next();
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many sign-in attempts. Try again in a few minutes.' },
  });
  app.use('/api/v1/auth/login', authLimiter);
  app.use('/api/v1/auth/refresh', authLimiter);

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' },
  });
  app.use('/api/', apiLimiter);

  const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many file uploads. Please try again later.' },
  });
  app.use('/api/v1/uploads', uploadLimiter);

  const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'AI request limit reached. Please try again in a minute.' },
  });
  app.use('/api/v1/ai', aiLimiter);

  app.get('/api/v1/health', async (req, res) => {
    const health = { ok: true, service: 'meridianed', uptime: Math.floor(process.uptime()) };
    try {
      if (db.dialect === 'pg') { await db.q('SELECT 1 AS id'); health.db = 'connected'; }
      else { health.db = 'ok'; }
    } catch (e) { health.ok = false; health.db = 'disconnected'; health.error = e.message; res.status(503); }
    res.json(health);
  });

  app.use('/api/', (req, res, next) => {
    if (req.method === 'GET' && (req.headers.accept || '').includes('text/html')) {
      return res.redirect(302, '/');
    }
    next();
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
  app.use('/api/v1/analytics/kpi', analyticsKpiRoutes);
  app.use('/api/v1/portal', portalRoutes);
  app.use('/api/v1/announcements', announcementsRoutes);
  app.use('/api/v1/dashboard', dashboardRoutes);
  app.use('/api/v1/audit', auditRoutes);
  app.use('/api/v1/schedule', scheduleRoutes);
  app.use('/api/v1/assignments', assignmentsRoutes);
  app.use('/api/v1/submissions', submissionsRoutes);
  app.use('/api/v1/interventions', interventionsRoutes);
  app.use('/api/v1/assessment', assessmentRoutes);
  app.use('/api/v1/immersion', immersion);
  app.use('/api/v1/jdvp', jdvp);
  app.use('/api/v1/conduct', conductRoutes);
  app.use('/api/v1/notifications', notificationsRoutes);
  app.use('/api/v1/privacy', privacyRoutes);
  app.use('/api/v1/mfa', mfaRoutes);
  app.use('/api/v1/curriculum', curriculumRoutes);
  app.use('/api/v1/rooms', roomsRoutes);
  app.use('/api/v1/department', departmentRoutes);
  app.use('/api/v1/lessons', lessonsRoutes);
  app.use('/api/v1/competency-tracker', competencyTrackerRoutes);
  app.use('/api/v1/deped-forms', depedFormsRoutes);
  app.use('/api/v1/push', pushRoutes);
  app.use('/api/v1/certifications', certificationsRoutes);
  app.use('/api/v1/library', libraryRoutes);
  app.use('/api/v1/clinic', clinicRoutes);
  app.use('/api/v1/guidance', guidanceRoutes);
  app.use('/api/v1/uploads', uploadsRoutes);
  app.use('/api/v1/ai', aiRoutes);

  app.use(express.static(WEB_DIR, {
    maxAge: '365d',
    immutable: true,
    index: false,
    setHeaders(res, filePath) {
      if (path.basename(filePath) === 'index.html') {
        res.setHeader('Cache-Control', 'no-store');
      }
    },
  }));

  const indexPath = path.join(WEB_DIR, 'index.html');
  const hasIndex = fs.existsSync(indexPath);
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    if (req.path.startsWith('/assets/')) return res.status(404).json({ error: 'Asset not found. Refresh the page (Ctrl+F5) to load the latest version.' });
    if (!hasIndex) return next();
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(indexPath);
  });

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));

  app.use((err, req, res, next) => {
    logger.error({ err, requestId: req.requestId, url: req.originalUrl }, 'Unhandled error');
    if (process.env.SENTRY_DSN) Sentry.captureException(err);
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
    const status = err.status || 500;
    const message = status === 500
      ? 'Internal server error'
      : (err.message || 'Request failed');
    res.status(status).json({ error: message });
  });

  const server = app.listen(PORT, () => {
    logger.info({ port: PORT, dialect: db.dialect }, `MeridianEd API listening on http://localhost:${PORT}`);
    startNotifySweep();
  });

  async function shutdown(signal) {
    logger.info({ signal }, 'Received signal — shutting down gracefully...');
    server.close(() => {
      db.close().then(() => process.exit(0)).catch(() => process.exit(1));
    });
    // Force exit after 10s
    setTimeout(() => process.exit(1), 10000).unref();
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
})();
