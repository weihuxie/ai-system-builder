// ───────────────────────────────────────────
// Vercel Function entry — wraps the shared Express app.
// Vercel's @vercel/node runtime recognizes the default export as a
// request handler and forwards IncomingMessage/ServerResponse to it.
// Express's `app` instance IS a function with that exact signature,
// so no adapter is needed.
// ───────────────────────────────────────────

import app from '../server/src/app.js';

export default app;

// Function runtime config (Vercel reads this)
// - maxDuration: Gemini 2.5 Pro occasionally runs 8–15s; 60s header gives headroom.
//                Hobby plan supports up to 60s as of 2024 (Fluid Compute).
export const config = {
  maxDuration: 60,
};
