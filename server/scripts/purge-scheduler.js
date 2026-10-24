/**
 * Automatic Data Retention Purge Scheduler
 * Runs nightly to purge data based on retention policies
 * 
 * Usage: node scripts/purge-scheduler.js [--scheduler]
 */

const db = require('./src/db');
const { init } = db;
const schedule = require('node-cron');
const path = require('path');
const fs = require('fs');

const RETENTION_POLICIES_FILE = path.join(__dirname, '..', '..', 'database', 'migrations', 'retention-policies.json');

async function main() {
  console.log('--- Data Retention Purge Scheduler ---');

  // Ensure policies exist; if not, create defaults
  if (fs.existsSync(RETENTION_POLICIES_FILE)) {
    const policies = JSON.parse(fs.readFileSync(RETENTION_POLICIES_FILE, 'utf8'));
    console.log(`Found ${policies.length} retention policies`);
  } else {
    // Default policies if none exist
    const defaultPolicies = [
      { entity: 'students', retention_days: 2555, enabled: true },   // 7 years
      { entity: 'employees', retention_days: 1825, enabled: true }, // 5 years
      { entity: 'audit_logs', retention_days: 365, enabled: true }, // 1 year
      { entity: 'data_access_logs', retention_days: 365, enabled: true }, // 1 year
      { entity: 'ai_chat_logs', retention_days: 90, enabled: true }, // 90 days
      { entity: 'consent_responses', retention_days: 365, enabled: true }, // 1 year
      { entity: 'notifications', retention_days: 365, enabled: true }, // 1 year
    ];

    fs.writeFileSync(RETENTION_POLICIES_FILE, JSON.stringify(defaultPolicies, null, 2));
    console.log(`Created ${defaultPolicies.length} default retention policies`);
  }

  // Initialize database
  await init();
  console.log('Database initialized');

  // Run one purge cycle
  await runPurgeCycle();

  // Schedule daily at 2 AM
  schedule.schedule('0 2 * * *', () => {
    console.log('Running scheduled data retention purge...');
    runPurgeCycle().catch(err => {
      console.error('Scheduled purge error:', err.message);
    });
  });

  console.log('Scheduler activated: daily purge at 2:00 AM');
  process.exit(0);
}

async function runPurgeCycle() {
  console.log('\n--- Running Purge Cycle ---');

  const pool = await db.init();

  // Read policies from file
  const policies = JSON.parse(fs.readFileSync(RETENTION_POLICIES_FILE, 'utf8'));

  for (const policy of policies) {
    if (!policy.enabled) continue;

    const days = Math.max(1, Math.floor(policy.retention_days));
    const table = policy.entity;
    const isPG = db.usePg;

    let deletedCount = 0;

    try {
      if (isPG) {
        const { result } = await db.qr(
          `DELETE FROM ${table} WHERE created_at < (now() - ($1 || ' days')::interval)`,
          [String(days)]
        );
        deletedCount = result.changes || 0;
      } else {
        const { result } = await db.qr(
          `DELETE FROM ${table} WHERE created_at < datetime('now', '-' || ? || ' days')`,
          [String(days)]
        );
        deletedCount = result.changes || 0;
      }

      // Update policy with last purged date
      await db.qr(
        'UPDATE data_retention_policies SET last_purged_at = NOW(), updated_at = NOW() WHERE entity = ?',
        [policy.entity]
      );

      console.log(`Purged ${table}: ${deletedCount} rows older than ${days} days`);
    } catch (err) {
      console.error(`Error purging ${table}:`, err.message);
    }
  }

  await db.close();
  console.log('--- Purge Cycle Complete ---');
}

// Mode: --scheduler for one-run, otherwise init + schedule
if (process.argv.includes('--scheduler')) {
  main().then(() => process.exit(0)).catch(err => {
    console.error('Scheduler error:', err);
    process.exit(1);
  });
} else {
  main().then(() => {
    console.log('\nScheduler running. To force a run with --scheduler flag, pass it as argument.');
  }).catch(err => {
    console.error('Initialization error:', err);
    process.exit(1);
  });
}