#!/usr/bin/env node
// One-shot seeder: wipes the products table and re-inserts DEFAULT_PRODUCTS.
// Usage:
//   API_BASE=https://your-deploy.vercel.app ADMIN_PASSWORD=<admin-panel-password> \
//     node scripts/seed-products.mjs

import { DEFAULT_PRODUCTS } from '../shared/dist/defaults.js';

const API = process.env.API_BASE || 'https://ai-system-builder.vercel.app';
const PW = process.env.ADMIN_PASSWORD;
if (!PW) {
  console.error('Set ADMIN_PASSWORD');
  process.exit(1);
}

async function main() {
  const loginRes = await fetch(`${API}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PW }),
  });
  if (!loginRes.ok) throw new Error(`Login ${loginRes.status}: ${await loginRes.text()}`);
  const { token } = await loginRes.json();
  const auth = { Authorization: `Bearer ${token}` };

  const listRes = await fetch(`${API}/api/products`);
  const existing = await listRes.json();
  console.log(`Existing: ${existing.map((p) => p.id).join(', ') || '(none)'}`);

  for (const p of existing) {
    const r = await fetch(`${API}/api/products/${encodeURIComponent(p.id)}`, {
      method: 'DELETE',
      headers: auth,
    });
    console.log(`DELETE ${p.id} → ${r.status}`);
  }

  for (const p of DEFAULT_PRODUCTS) {
    const body = {
      id: p.id,
      name: p.name,
      description: p.description,
      audience: p.audience,
      url: p.url,
      isParticipating: p.isParticipating,
    };
    const r = await fetch(`${API}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    console.log(`POST ${p.id} → ${r.status}${r.ok ? '' : ` :: ${text.slice(0, 200)}`}`);
  }

  const finalRes = await fetch(`${API}/api/products`);
  const final = await finalRes.json();
  console.log(`\nFinal catalog (${final.length}): ${final.map((p) => p.id).join(', ')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
