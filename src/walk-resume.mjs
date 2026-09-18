import { parseSceneLink } from './scene-link.mjs';

export const RESUME_KEY = 'tokyo-railway-walk-resume-v1';

export function readWalkResume(storage, canEnter) {
  try {
    const hash = storage.getItem(RESUME_KEY);
    return typeof hash === 'string' && parseSceneLink(hash, canEnter) ? hash : null;
  } catch { return null; }
}

export function saveWalkResume(storage, hash, canEnter) {
  if (typeof hash !== 'string' || !parseSceneLink(hash, canEnter)) return false;
  try { storage.setItem(RESUME_KEY, hash); return true; }
  catch { return false; }
}
