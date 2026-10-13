// Local environment-file loader (replaces Node's `--env-file-if-exists=.env`).
//
// This repo lives under OneDrive, which continuously syncs plaintext secrets
// from `server/.env` to the cloud. To keep secrets off the synced folder, set
// the ENV_FILE environment variable to a path outside OneDrive, e.g.:
//
//   setx ENV_FILE "%USERPROFILE%\.config\hinhsms\server.env"
//
// Load order:
//   1. ENV_FILE, if set
//   2. server/.env (legacy location), if present
//
// Existing environment variables always win, so Render/CI dashboard values are
// never shadowed. In production neither path normally exists and this loader is
// a no-op. Required-variable validation still happens in config.js.
const fs = require('node:fs');
const path = require('node:path');

const candidates = [];
if (process.env.ENV_FILE) candidates.push(process.env.ENV_FILE);
candidates.push(path.join(__dirname, '..', '.env'));

for (const file of candidates) {
  try {
    if (fs.existsSync(file)) {
      process.loadEnvFile(file);
      break;
    }
  } catch {
    // Malformed or unreadable file: let config.js surface the real error.
  }
}
