// Self-service password reset constants + code generator. Pured so the reset
// logic in auth.routes and its tests share one source of truth.
const crypto = require('crypto');

const RESET_CODE_TTL_MS = 15 * 60 * 1000;
const RESET_MAX_ATTEMPTS = 5;
// 8 digits, not 6. The per-account attempt counter cannot protect a wrong guess
// (a wrong code matches no row by code_hash, so nothing is incremented), which
// left the per-IP rate limiter as the only real barrier. Raising the space from
// 10^6 to 10^8 makes guessing infeasible within the 15-minute TTL even when an
// attacker rotates source IPs.
const RESET_CODE_LENGTH = 8;

function genResetCode() {
  return String(crypto.randomInt(0, 10 ** RESET_CODE_LENGTH)).padStart(RESET_CODE_LENGTH, '0');
}

module.exports = { RESET_CODE_TTL_MS, RESET_MAX_ATTEMPTS, RESET_CODE_LENGTH, genResetCode };