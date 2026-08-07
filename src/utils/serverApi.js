// Используем текущий origin — работает и через туннель, и из офиса
export const SERVER_URL = window.location.origin;

export async function fetchStatus() {
  const res = await fetch(`${SERVER_URL}/api/status`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchAllData() {
  const res = await fetch(`${SERVER_URL}/api/data/all`, { signal: AbortSignal.timeout(180000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
