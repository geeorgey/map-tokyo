const ids = ['central', 'north', 'south'];

// Only a named exterior preset and light: never the sender's clock or query.
export function parseStationLink(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const raw = params.get('station');
  if (!raw || raw.length > 80 || params.getAll('station').length !== 1 || params.has('scene') || params.has('departure')) return null;
  const parts = raw.split(',');
  if (parts.length !== 3 || parts[0] !== '1' || !ids.includes(parts[1]) || !parts[2].trim()) return null;
  const light = Number(parts[2]);
  return Number.isFinite(light) && light >= 0 && light < 3 ? { id: parts[1], light } : null;
}

export function makeStationLink(origin, id, light) {
  const hash = `station=1,${id},${light}`;
  if (!parseStationLink(hash)) return null;
  const url = new URL('/', origin);
  url.hash = hash;
  return url.href;
}
