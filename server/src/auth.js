// Re-export from middleware/auth.js for backward compatibility.
// All auth middleware now lives in middleware/auth.js.
const auth = require('./middleware/auth');
module.exports = auth;
