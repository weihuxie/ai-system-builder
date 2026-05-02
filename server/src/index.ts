// Local Express runner — used for `npm run dev:server` and Cloud Run.
// Vercel does NOT use this file; it loads api/index.ts directly.

import 'dotenv/config';
import app from './app.js';

const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, () => {
   
  console.log(`[asb/server] listening on :${PORT}`);
});
