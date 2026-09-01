// NOTE: pino-pretty is optional. When absent, fall back to plain JSON output.
const pino = require('pino');
let transport = undefined;
if (process.env.NODE_ENV !== 'production') {
  try {
    require.resolve('pino-pretty');
    transport = { target: 'pino-pretty' };
  } catch {
    transport = undefined;
  }
}
const logger = pino({ level: process.env.LOG_LEVEL || 'info', transport });
module.exports = logger;
