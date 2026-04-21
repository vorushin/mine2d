import { WORLD_HEIGHT, WORLD_WIDTH } from '../config';
import { World } from '../world/World';
import { TileType, TILE_SPECS } from '../world/tileTypes';

/**
 * BFS from start tile to goal tile. "Walkable" includes open doors. Blocked tiles
 * are not traversable but the AI can choose to attack them — handled at move-time
 * in Zombie.ts, not here. Returns the first-step tile to move to, or null if no path.
 *
 * For zombies unable to path directly (player fully enclosed), an "attack path" variant
 * treats weak walls as "soft-walkable" — passable at a high traversal cost — so the zombie
 * heads toward the nearest breachable wall.
 */
export type Step = { x: number; y: number };

const DIRS: Step[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export function bfsNextStep(world: World, start: Step, goal: Step, allowBreakWeakWalls: boolean): Step | null {
  if (start.x === goal.x && start.y === goal.y) return null;

  const w = WORLD_WIDTH;
  const h = WORLD_HEIGHT;
  const maxSearch = 400; // cap for perf
  const visited = new Uint8Array(w * h);
  const parent = new Int32Array(w * h).fill(-1);
  const queue: number[] = [];

  const idx = (x: number, y: number) => y * w + x;
  const startIdx = idx(start.x, start.y);
  queue.push(startIdx);
  visited[startIdx] = 1;

  let found = -1;
  let expanded = 0;

  while (queue.length > 0 && expanded < maxSearch) {
    const cur = queue.shift()!;
    expanded++;
    const cx = cur % w;
    const cy = Math.floor(cur / w);
    if (cx === goal.x && cy === goal.y) {
      found = cur;
      break;
    }
    for (const d of DIRS) {
      const nx = cx + d.x;
      const ny = cy + d.y;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = idx(nx, ny);
      if (visited[ni]) continue;
      const t = world.getTileAt(nx, ny);
      if (!t) continue;
      const walkable = world.isWalkable(nx, ny);
      const breakable =
        allowBreakWeakWalls &&
        TILE_SPECS[t.type].baseHp > 0 &&
        TILE_SPECS[t.type].baseHp <= 120 &&
        t.type !== TileType.ShopNPC &&
        t.type !== TileType.Tree &&
        t.type !== TileType.Stone &&
        t.type !== TileType.IronOre &&
        t.type !== TileType.GoldOre;
      // Goal itself is always considered "reachable" in BFS (so zombies can path to player tile)
      if (!walkable && !breakable && !(nx === goal.x && ny === goal.y)) continue;
      visited[ni] = 1;
      parent[ni] = cur;
      queue.push(ni);
    }
  }

  if (found < 0) return null;

  // Walk back to find the first step after start
  let cur = found;
  let prev = -1;
  while (parent[cur] !== -1) {
    prev = cur;
    cur = parent[cur];
    if (cur === startIdx) break;
  }
  if (prev === -1) return null;
  return { x: prev % w, y: Math.floor(prev / w) };
}
