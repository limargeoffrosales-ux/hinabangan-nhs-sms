// NOTE: pino-pretty must be added as a devDependency: npm i -D pino-pretty
const pino = require('pino');
const logger = process.env.NODE_ENV === 'production'
  ? pino({ level: process.env.LOG_LEVEL || 'info' })
  : pino({ level: process.env.LOG_LEVEL || 'info', transport: { target: 'pino-pretty' } });
module.exports = logger;
