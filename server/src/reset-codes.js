// Self-service password reset constants + code generator. Pured so the reset
// logic in auth.routes and its tests share one source of truth.
const crypto = require('crypto');

const RESET_CODE_TTL_MS = 15 * 60 * 1000;
const RESET_MAX_ATTEMPTS = 5;
const RESET_CODE_LENGTH = 6;

function genResetCode() {
  return String(crypto.randomInt(0, 10 ** RESET_CODE_LENGTH)).padStart(RESET_CODE_LENGTH, '0');
}

module.exports = { RESET_CODE_TTL_MS, RESET_MAX_ATTEMPTS, RESET_CODE_LENGTH, genResetCode };