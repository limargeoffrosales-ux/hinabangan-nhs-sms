-- Migration 086: Prune high-churn log tables
-- Keeps the Neon project under its storage cap. Once the branch exceeds the
-- project size limit, Postgres writes fail with error 53100
-- ("could not extend file because project size limit has been exceeded").
-- Deletes shrink the branch, so they are tolerated even at the cap. This runs
-- before 087-sports-news so the sports_posts table can extend the file.

DELETE FROM data_access_logs WHERE created_at < now() - interval '90 days';
DELETE FROM audit_logs       WHERE created_at < now() - interval '180 days';
DELETE FROM notifications    WHERE created_at < now() - interval '90 days';
DELETE FROM ai_chat_logs     WHERE created_at < now() - interval '90 days';
DELETE FROM password_resets  WHERE created_at < now() - interval '30 days' OR used_at IS NOT NULL;
DELETE FROM refresh_tokens   WHERE revoked = TRUE OR expires_at < now();
DELETE FROM device_tokens    WHERE updated_at < now() - interval '180 days';

DO $$
BEGIN
  IF to_regclass('notifications_sim_table') IS NOT NULL THEN
    DELETE FROM notifications_sim_table;
  END IF;
END $$;