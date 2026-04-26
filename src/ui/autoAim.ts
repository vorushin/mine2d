export interface AimTarget {
  x: number;
  y: number;
}

const HALF_ARC_RAD = Math.PI / 4;

/**
 * Returns the nearest target whose direction from (px, py) lies within ±45°
 * of the aim vector (ax, ay), and whose distance is within maxRange.
 *
 * The aim vector does not need to be normalized.
 */
export function selectAutoAimTarget<T extends AimTarget>(
  px: number,
  py: number,
  ax: number,
  ay: number,
  candidates: T[],
  maxRange = Infinity,
): T | null {
  const aimAngle = Math.atan2(ay, ax);
  let best: T | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const dx = c.x - px;
    const dy = c.y - py;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRange || dist === 0) continue;
    const tgtAngle = Math.atan2(dy, dx);
    let diff = tgtAngle - aimAngle;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    if (Math.abs(diff) > HALF_ARC_RAD + 1e-6) continue;
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best;
}
