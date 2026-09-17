// World x/z projected north-up into the schematic's 200×200 view box.
export function mapPose({ x, z, yaw }) {
  const clamp = value => Math.max(8, Math.min(192, value));
  const px = (x + 250) * .4, py = (z + 250) * .4;
  return { x: clamp(px), y: clamp(py), angle: -yaw * 180 / Math.PI,
    outside: px < 8 || px > 192 || py < 8 || py > 192 };
}
