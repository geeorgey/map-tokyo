import { Vector3 } from 'three';
export const DEPARTURE_ANGLES = [['above','上から'], ['side','横から'], ['front','前から']];
export function departureOffset(angle, orientation) {
  if (angle === 'above') return new Vector3(-8, 80, -24);
  if (angle === 'side') return new Vector3(-42, 18, -24).applyQuaternion(orientation);
  if (angle === 'front') return new Vector3(-24, 24, 32).applyQuaternion(orientation);
  return null;
}
