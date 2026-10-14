const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const Sentry = require('@sentry/node');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { getCurrentSchoolYear } = require('./schoolYear');
const { PORT, HOST, WEB_DIR } = require('./config');

const logger = require('./logger');
const { authenticate, requireCsrf } = require('./auth');
const { streamHandler } = require('./realtime');
const { gate: operatingHoursGate } = require('./operating-hours');

// Global unhandled error handlers — log to Sentry + logger, then let supervisor restart
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ err: reason?.message, stack: reason?.stack, promise }, 'UNHANDLED REJECTION');
  if (process.env.SENTRY_DSN) Sentry.captureException(reason);
});
process.on('uncaughtException', (err) => {
  logger.error({ err: err?.message, stack: err?.stack }, 'UNCAUGHT EXCEPTION');
  if (process.env.SENTRY_DSN) Sentry.captureException(err);
  // Exit so process manager (Render, Docker, systemd) can restart cleanly
  process.exit(1);
});

// Core routes
const studentsRoutes = require('./routes/students.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const gradesRoutes = require('./routes/grades.routes');
const announcementsRoutes = require('./routes/announcements.routes');
const sportsRoutes = require('./routes/sports.routes');

// Legacy routes (to be migrated)
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const teachersRoutes = require('./routes/teachers.routes');
const subjectsRoutes = require('./routes/subjects.routes');
const sectionsRoutes = require('./routes/sections.routes');
const enrollmentsRoutes = require('./routes/enrollments.routes');
const gradingRoutes = require('./routes/grading.routes');
const exchangeRoutes = require('./routes/exchange.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const analyticsKpiRoutes = require('./routes/analytics-kpi.routes');
const portalRoutes = require('./routes/portal.routes');
const { router: dashboardRoutes } = require('./routes/dashboard.routes');
const auditRoutes = require('./routes/audit.routes');
const scheduleRoutes = require('./routes/schedule.routes');
const assignmentsRoutes = require('./routes/assignments.routes');
const submissionsRoutes = require('./routes/submissions.routes');
const interventionsRoutes = require('./routes/interventions.routes');
const assessmentRoutes = require('./routes/assessment.routes');
const { immersion, jdvp } = require('./routes/immersion.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const privacyRoutes = require('./routes/privacy.routes');
const mfaRoutes = require('./routes/mfa.routes');
const curriculumRoutes = require('./routes/curriculum.routes');
const roomsRoutes = require('./routes/rooms.routes');
const departmentsRoutes = require('./routes/department.routes');
const lessonsRoutes = require('./routes/lessons.routes');
const competencyTrackerRoutes = require('./routes/competency-tracker.routes');
const depedFormsRoutes = require('./routes/deped-forms.routes');
const pushRoutes = require('./routes/push.routes');
const certificationsRoutes = require('./routes/certifications.routes');
const guidanceRoutes = require('./routes/guidance.routes');
const uploadsRoutes = require('./routes/uploads.routes');
const lmsRoutes = require('./routes/lms.routes');
const aiRoutes = require('./routes/ai.routes');
const achievementsRoutes = require('./routes/achievements.routes');
const consentsRoutes = require('./routes/consents.routes');
const parentRoutes = require('./routes/parent.routes');

(async () => {
  await db.init();
  const { ensureDefaults, ensureSmtp, startNotifySweep } = require('./notify');
  const { startStorageCleanup } = require('./storage-cleanup');
  const { startBackupSweep } = require('./backup-sweep');
  await ensureDefaults();
  if (process.env.SEED_ON_BOOT === '1') {
    const { seed } = require('./seed');
    await seed();
    logger.info('SEED_ON_BOOT: report types, demo + staff accounts ensured (idempotent)');
  }
  const { purgeDemo } = require('./purge-demo');
  await purgeDemo();
  // SUPERADMIN_PASSWORD: on first boot (superadmin password never customized,
  // i.e. password_changed_at is NULL) set the admin password from the env var so
  // a deploy can control the initial admin credential. Once applied, the guard
  // prevents this block from re-running on later boots.
  if (process.env.SUPERADMIN_PASSWORD && process.env.SUPERADMIN_PASSWORD.length >= 8) {
    const bcrypt = require('bcryptjs');
    const row = await db.q('SELECT id, password_changed_at FROM users WHERE username = ?', ['superadmin']);
    if (row && !row.password_changed_at) {
      await db.qr(
        'UPDATE users SET password_hash = ?, password_changed_at = CURRENT_TIMESTAMP WHERE id = ?',
        [await bcrypt.hash(process.env.SUPERADMIN_PASSWORD, 12), row.id],
      );
      await db.qr(
        'INSERT INTO security_incidents (incident_type, severity, source_ip, username, user_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        ['SUPERADMIN_PASSWORD_SET', 'info', 'server-startup', 'system', row.id, JSON.stringify({ note: 'Superadmin password initialised from SUPERADMIN_PASSWORD env' })]
      );
      logger.info('SUPERADMIN_PASSWORD: superadmin password set from env (first boot)');
    } else {
      logger.info('SUPERADMIN_PASSWORD: superadmin password already customized — env override skipped (remove SUPERADMIN_PASSWORD from env to silence)');
    }
  }
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  if (process.env.SENTRY_DSN) {
    const pkg = require('./package.json');
    let release = pkg.version;
    try {
      release += '-' + require('child_process').execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    } catch {}
    Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || 'development', release, tracesSampleRate: 0.1 });
    app.use(Sentry.Handlers.requestHandler());
  }

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://*.r2.dev", "https://*.cloudflarestorage.com", "https://lh3.googleusercontent.com", "https://tile.openstreetmap.org", "https://*.tile.openstreetmap.org", "https://server.arcgisonline.com"],
        mediaSrc: ["'self'", "blob:", "https://*.r2.dev", "https://*.cloudflarestorage.com"],
        connectSrc: ["'self'", "https://*.r2.dev", "wss:", "https://nominatim.openstreetmap.org"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));
  const ALLOWED_ORIGINS = [
    process.env.APP_URL,           // e.g. https://hinabangan-nhs.onrender.com
    'http://localhost:5173',       // Vite dev server
    'http://localhost:3000',       // Common dev port
  ].filter(Boolean);
  app.use(cors({
    origin(origin, cb) {
      // Allow server-to-server (no Origin header), app origin, and localhost dev.
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        cb(null, true);
      } else {
        cb(null, false);
      }
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
    '/api/v1/auth/forgot-password',
    '/api/v1/auth/reset-password',
    '/api/v1/auth/register',
    '/api/v1/mfa/verify',
  ];

  const MAX_BODY_FIELD = 10000;
  const BULK_IMPORT_PATHS = [
    '/api/v1/enrollments/import',   // exact POST path
    '/api/v1/assignments',          // bulk assignment creation
    '/api/v1/lessons',              // bulk lesson creation
  ];
  // Exact match or match with trailing slash + segment (prevents path traversal like /import-evil)
  function isBulkPath(requestPath) {
    return BULK_IMPORT_PATHS.some(p => requestPath === p || requestPath.startsWith(p + '/'));
  }
  const MAX_BULK_BODY_FIELD = 100000; // 100KB for bulk imports
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      const isBulkImport = isBulkPath(req.path);
      const limit = isBulkImport ? MAX_BULK_BODY_FIELD : MAX_BODY_FIELD;
      for (const [k, v] of Object.entries(req.body)) {
        if (typeof v === 'string' && v.length > limit) {
          return res.status(413).json({ error: `Field "${k}" exceeds the ${limit.toLocaleString()}-character limit` });
        }
      }
    }
    next();
  });

  // CSRF protection for authenticated mutating requests. Body parsing happens
  // before the gate so requireCsrf can validate a body-supplied csrf_token.
  // Authentication must happen first so req.user is populated before CSRF validation.
  app.use((req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    if (PUBLIC_MUTATING_PATHS.some((p) => req.path === p || req.path.startsWith(p + '/'))) return next();
    return authenticate(req, res, (err) => {
      if (err) return next(err);
      return requireCsrf(req, res, next);
    });
  });
  app.use(compression());

  app.use((req, res, next) => {
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  });

  // SSE clients cannot set an Authorization header, so the access token arrives
  // as ?token=. Logging req.originalUrl verbatim wrote a valid 15-minute bearer
  // token into the log stream on every connect. Strip sensitive query params
  // before anything is logged.
  const redactUrl = (url) => {
    const s = String(url || '');
    if (!s.includes('?')) return s;
    return s.replace(/([?&])(token|access_token|code|password|resetToken)=[^&#]*/gi, '$1$2=[redacted]');
  };

  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      const url = redactUrl(req.originalUrl);
      logger[level]({ method: req.method, url, status: res.statusCode, ms, requestId: req.requestId, userId: req.user?.id }, `${req.method} ${url} ${res.statusCode} ${ms}ms`);
    });
    next();
  });

  const { createDbStore } = require('./rate-limit-store');

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many sign-in attempts. Try again in a few minutes.' },
    store: createDbStore(15 * 60 * 1000),
  });
  app.use('/api/v1/auth/login', authLimiter);
  app.use('/api/v1/auth/refresh', authLimiter);

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' },
    store: createDbStore(15 * 60 * 1000),
  });
  app.use('/api/', apiLimiter);

  const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many file uploads. Please try again later.' },
    store: createDbStore(60 * 60 * 1000),
  });
  app.use('/api/v1/uploads', uploadLimiter);

  const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'AI request limit reached. Please try again in a minute.' },
    store: createDbStore(60 * 1000),
  });
  app.use('/api/v1/ai', aiLimiter);

  // Operating hours gate — blocks API requests outside school hours (423).
  // Health stays exempt so Render health checks + pinger monitors keep working.
  app.use('/api/', operatingHoursGate());

  // Prevent caching of API responses (private data, authenticated endpoints)
  app.use('/api/', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, private, must-revalidate');
    res.setHeader('Vary', 'Authorization');
    next();
  });

  app.get('/api/v1/school-year', async (req, res) => {
    try {
      res.json({ school_year: await getCurrentSchoolYear() });
    } catch (e) { res.status(500).json({ error: 'Could not load the current school year' }); }
  });

  app.get('/api/v1/health', async (req, res) => {
    const health = { ok: true, service: 'meridianed', uptime: Math.floor(process.uptime()) };
    try {
      if (db.dialect === 'pg') { await db.q('SELECT 1 AS id'); health.db = 'connected'; }
      else { health.db = 'ok'; }
    } catch (e) { health.ok = false; health.db = 'disconnected'; health.error = 'Database unavailable'; res.status(503); }
    res.json(health);
  });

  app.use('/api/', (req, res, next) => {
    if (req.method === 'GET' && (req.headers.accept || '').includes('text/html')) {
      return res.redirect(302, '/');
    }
    next();
  });

  // Core routes
  app.use('/api/v1/students', studentsRoutes);
  app.use('/api/v1/attendance', attendanceRoutes);
  app.use('/api/v1/grades', gradesRoutes);
  app.use('/api/v1/announcements', announcementsRoutes);
  app.use('/api/v1/sports-news', sportsRoutes);

  // Legacy routes (to be migrated)
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', usersRoutes);
  app.use('/api/v1/teachers', teachersRoutes);
  app.use('/api/v1/subjects', subjectsRoutes);
  app.use('/api/v1/sections', sectionsRoutes);
  app.use('/api/v1/enrollments', enrollmentsRoutes);
  app.use('/api/v1/grading', gradingRoutes);
  app.use('/api/v1/exchange', exchangeRoutes);
  app.use('/api/v1/analytics', analyticsRoutes);
  app.use('/api/v1/analytics/kpi', analyticsKpiRoutes);
  app.use('/api/v1/portal', portalRoutes);
  app.use('/api/v1/dashboard', dashboardRoutes);
  app.use('/api/v1/audit', auditRoutes);
  app.use('/api/v1/schedule', scheduleRoutes);
  app.use('/api/v1/assignments', assignmentsRoutes);
  app.use('/api/v1/submissions', submissionsRoutes);
  app.use('/api/v1/interventions', interventionsRoutes);
  app.use('/api/v1/assessment', assessmentRoutes);
  app.use('/api/v1/immersion', immersion);
  app.use('/api/v1/jdvp', jdvp);
  app.use('/api/v1/notifications', notificationsRoutes);
  app.use('/api/v1/privacy', privacyRoutes);
  app.use('/api/v1/mfa', mfaRoutes);
  app.use('/api/v1/curriculum', curriculumRoutes);
  app.use('/api/v1/rooms', roomsRoutes);
  app.use('/api/v1/department', departmentsRoutes);
  app.use('/api/v1/lessons', lessonsRoutes);
  app.use('/api/v1/competency-tracker', competencyTrackerRoutes);
  app.use('/api/v1/deped-forms', depedFormsRoutes);
  app.use('/api/v1/push', pushRoutes);
  app.use('/api/v1/certifications', certificationsRoutes);
  app.use('/api/v1/guidance', guidanceRoutes);
  app.use('/api/v1/uploads', uploadsRoutes);
  app.use('/api/v1/ai', aiRoutes);
  app.use('/api/v1/achievements', achievementsRoutes);
  app.use('/api/v1/consents', consentsRoutes);
  app.use('/api/v1/parent', parentRoutes);
  app.use('/api/v1/lms', lmsRoutes);

  app.get('/api/v1/realtime/stream', streamHandler);

  app.use(express.static(WEB_DIR, {
    maxAge: '365d',
    immutable: true,
    index: false,
    setHeaders(res, filePath) {
      const base = path.basename(filePath);
      if (base === 'index.html') {
        res.setHeader('Cache-Control', 'no-store');
      }
      // PWA files: no long-term caching so updates propagate
      if (base === 'sw.js' || base === 'manifest.webmanifest' || base === 'registerSW.js') {
        res.setHeader('Cache-Control', 'no-cache');
      }
      // Workbox runtime files are content-hashed, safe to cache long-term
      if (base.startsWith('workbox-') && base.endsWith('.js')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
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

  app.use((err, req, res, _next) => {
    logger.error({ err: err?.message, stack: err?.stack, requestId: req.requestId, url: redactUrl(req.originalUrl) }, 'Unhandled error');
    if (process.env.SENTRY_DSN) Sentry.captureException(err);
    if (res.headersSent) {
      // Response already streaming/sent (e.g. a spreadsheet export failed mid-write);
      // destroy the socket instead of crashing-logging on a second send.
      return req.socket.destroy();
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
    const status = err.status || 500;
    const message = status === 500
      ? 'Internal server error'
      : (err.message || 'Request failed');
    res.status(status).json({ error: message });
  });

  const server = app.listen(PORT, HOST, () => {
    logger.info({ port: PORT, host: HOST, dialect: db.dialect }, `MeridianEd API listening on http://${HOST}:${PORT}`);
    ensureSmtp()
      .then(() => startNotifySweep())
      .catch((err) => logger.error({ err: err?.message, stack: err?.stack }, 'notify sweep startup failed:'));
    startStorageCleanup();
    startBackupSweep();
    const { startOutboxPoller } = require('./realtime');
    startOutboxPoller();
    // Prune shared rate-limit windows so the table stays small.
    const rateStore = createDbStore(15 * 60 * 1000);
    const pruneTimer = setInterval(() => { rateStore.prune().catch(() => {}); }, 15 * 60 * 1000);
    if (typeof pruneTimer.unref === 'function') pruneTimer.unref();
  });

  async function shutdown(signal) {
    logger.info({ signal }, 'Received signal — shutting down gracefully...');
    server.close(() => {
      Promise.resolve(db.close()).then(() => process.exit(0)).catch(() => process.exit(1));
    });
    // Force exit after 10s
    setTimeout(() => process.exit(1), 10000).unref();
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
})().catch((err) => {
  logger.error({ err: err?.message, stack: err?.stack }, 'Fatal boot error — shutting down');
  try { db.close(); } catch (_) {}
  process.exit(1);
});