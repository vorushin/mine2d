import * as THREE from 'three';
import { Grid } from '../grid';

/** Move a circle of radius r through the grid, sliding along solid tiles. */
export function moveWithCollision(grid: Grid, pos: THREE.Vector3, dx: number, dz: number, r: number, passable?: (x: number, y: number) => boolean): void {
  const blocked = (x: number, z: number) => {
    const x0 = Math.floor(x - r), x1 = Math.floor(x + r);
    const z0 = Math.floor(z - r), z1 = Math.floor(z + r);
    for (let ty = z0; ty <= z1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        const ok = passable ? passable(tx, ty) : grid.walkable(tx, ty);
        if (!ok) {
          // circle vs tile AABB
          const cx = Math.max(tx, Math.min(x, tx + 1));
          const cz = Math.max(ty, Math.min(z, ty + 1));
          if ((cx - x) ** 2 + (cz - z) ** 2 < r * r) return true;
        }
      }
    return false;
  };
  // If we're already stuck (e.g. a wall was built on us), allow free movement out.
  const stuck = blocked(pos.x, pos.z);
  if (stuck || !blocked(pos.x + dx, pos.z)) pos.x += dx;
  if (stuck || !blocked(pos.x, pos.z + dz)) pos.z += dz;
}

export function tileOf(p: THREE.Vector3): { x: number; y: number } {
  return { x: Math.floor(p.x), y: Math.floor(p.z) };
}

export function angleTo(from: THREE.Vector3, to: THREE.Vector3): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

export function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function dist2d(a: THREE.Vector3, b: THREE.Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
