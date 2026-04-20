import { Router } from 'express';

import { countryToLang, type GeoResponse } from '@asb/shared';

export const geoRouter = Router();

// ───────────────────────────────────────────
// IP → country → default Lang
// Runs server-side so the client doesn't hit a 3rd-party CORS pit-of-despair.
// Best-effort: any failure returns { country: null, lang: 'en' } with 200 OK.
// Rationale: the client still has navigator.language as the next fallback,
// and we don't want a flaky geo service to block first paint.
// ───────────────────────────────────────────

const GEO_TIMEOUT_MS = 3000;
const GEO_ENDPOINT = 'https://get.geojs.io/v1/ip/country.json';

geoRouter.get('/', async (req, res) => {
  // Prefer the real client IP (X-Forwarded-For from Cloud Run's LB)
  const xff = req.headers['x-forwarded-for'];
  const ipFromHeader = Array.isArray(xff) ? xff[0] : xff?.split(',')[0]?.trim();
  const ip = ipFromHeader || req.ip;

  const url = ip ? `${GEO_ENDPOINT}?ip=${encodeURIComponent(ip)}` : GEO_ENDPOINT;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEO_TIMEOUT_MS);

  try {
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!resp.ok) {
      return res.json({ country: null, lang: 'en' } satisfies GeoResponse);
    }

    const body = (await resp.json()) as { country?: string; country_3?: string };
    const country = body.country ?? null;
    const payload: GeoResponse = { country, lang: countryToLang(country) };
    res.json(payload);
  } catch {
    clearTimeout(timer);
    // geo is best-effort — never propagate failures
    res.json({ country: null, lang: 'en' } satisfies GeoResponse);
  }
});
