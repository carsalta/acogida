
// src/lib/registry.remote.js

export async function checkRemote({ apiBase, months, dni, email, apiKey }) {
  const url = new URL(apiBase);
  url.searchParams.set('dni', dni || '');
  url.searchParams.set('email', email || '');
  url.searchParams.set('months', months?.toString() || '36');

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: apiKey ? { 'x-api-key': apiKey } : {}
  });
  if (!res.ok) throw new Error('checkRemote failed: ' + res.status);
  return await res.json(); // {found,isValid,monthsElapsed,record}
}

export async function upsertRemote({ apiBase, payload }) {
  const res = await fetch(apiBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('upsertRemote failed: ' + res.status);
  return await res.json(); // {ok,rowUpdated}
