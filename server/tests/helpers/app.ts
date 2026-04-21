// Re-import the real Express app so routes exercise production code paths.
// Env is already populated by setup.ts before this module loads.
export { app } from '../../src/app.js';
