// A URL fragment carries only the diorama pose, never the sender's query or clock.
export function parseSceneLink(hash, canEnter = () => true) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const raw = params.get('scene');
  if (!raw || raw.length > 160) return null;
  const parts = raw.split(',');
  if (parts.length !== 6 || parts[0] !== '1' || parts.slice(1).some(v => !v.trim())) return null;
  const [x, z, yaw, pitch, light] = parts.slice(1).map(Number);
  if (![x,z,yaw,pitch,light].every(Number.isFinite) || x < -725 || x > 705 || z < -835 || z > 845 || Math.abs(yaw) > Math.PI || Math.abs(pitch) > 1.1 || light < 0 || light >= 3 || !canEnter(x,z)) return null;
  return { x, z, yaw, pitch, light };
}

export function makeSceneLink(origin, { x, z, yaw, pitch, light }, canEnter) {
  const angle = Math.atan2(Math.sin(yaw), Math.cos(yaw));
  const scene = [1,x,z,angle,pitch,light].join(',');
  if (!parseSceneLink(`#scene=${scene}`,canEnter)) return null;
  const url = new URL('/',origin);
  url.hash = `scene=${scene}`;
  return url.href;
}
