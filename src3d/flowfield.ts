import { Grid } from './grid';
import { B, BLOCKS } from './rules';

/** Extra cost of walking "through" a solid block (zombies chew it). */
export function passCost(grid: Grid, x: number, y: number): number {
  if (!grid.isLand(x, y)) return Infinity;
  const b = grid.blockAt(x, y);
  if (b === B.None) return 1;
  const def = BLOCKS[b];
  if (!def.solid) return 1;
  if (def.built) return 1 + grid.hp[grid.idx(x, y)] / 8;
  return 30; // trees/rocks: strongly prefer walking around
}

const DIRS: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

/**
 * Dijkstra distance-to-target over the whole island. Solid tiles are expensive
 * but passable, so there is always a route — zombies go around walls when
 * that is cheaper and chew through them when it isn't.
 */
export function computeFlowField(grid: Grid, tx: number, ty: number): Float32Array {
  const n = grid.size * grid.size;
  const dist = new Float32Array(n).fill(Infinity);
  if (!grid.inBounds(tx, ty)) return dist;
  const heap = new MinHeap();
  const start = grid.idx(tx, ty);
  dist[start] = 0;
  heap.push(start, 0);
  while (heap.size) {
    const [i, d] = heap.pop();
    if (d > dist[i]) continue;
    const x = i % grid.size, y = (i / grid.size) | 0;
    const hereSolid = passCost(grid, x, y) > 1;
    for (const [dx, dy, len] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!grid.inBounds(nx, ny)) continue;
      if (dx && dy) {
        // No diagonal squeezing past corners.
        if (hereSolid || passCost(grid, x + dx, y) > 1 || passCost(grid, x, y + dy) > 1) continue;
      }
      const c = passCost(grid, nx, ny);
      if (c === Infinity) continue;
      const nd = d + (c > 1 ? c : len);
      const j = grid.idx(nx, ny);
      if (nd < dist[j]) {
        dist[j] = nd;
        // Push the float32-rounded value so the "stale entry" check below stays exact.
        heap.push(j, dist[j]);
      }
    }
  }
  return dist;
}

/** Best neighbouring tile to step to from (x,y), following the field downhill. */
export function nextStep(grid: Grid, field: Float32Array, x: number, y: number): { x: number; y: number } | null {
  let best = field[grid.idx(x, y)];
  let out: { x: number; y: number } | null = null;
  for (const [dx, dy] of DIRS) {
    const nx = x + dx, ny = y + dy;
    if (!grid.inBounds(nx, ny)) continue;
    if (dx && dy && (!grid.walkable(x + dx, y) || !grid.walkable(x, y + dy))) continue;
    const v = field[grid.idx(nx, ny)];
    if (v < best) {
      best = v;
      out = { x: nx, y: ny };
    }
  }
  return out;
}

class MinHeap {
  private ids: number[] = [];
  private keys: number[] = [];
  get size() {
    return this.ids.length;
  }
  push(id: number, key: number) {
    this.ids.push(id);
    this.keys.push(key);
    let i = this.ids.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= this.keys[i]) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): [number, number] {
    const id = this.ids[0], key = this.keys[0];
    const lastId = this.ids.pop()!, lastKey = this.keys.pop()!;
    if (this.ids.length) {
      this.ids[0] = lastId;
      this.keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < this.ids.length && this.keys[l] < this.keys[m]) m = l;
        if (r < this.ids.length && this.keys[r] < this.keys[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return [id, key];
  }
  private swap(a: number, b: number) {
    [this.ids[a], this.ids[b]] = [this.ids[b], this.ids[a]];
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
  }
}
