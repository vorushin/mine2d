import { B, BLOCKS, Ground } from './rules';

/** The island: a ground layer plus one block per tile. Pure data, no rendering. */
export class Grid {
  readonly ground: Uint8Array;
  readonly block: Uint8Array;
  readonly hp: Float32Array;
  /** Bumped whenever blocks change so flow fields/renderers know to refresh. */
  version = 0;

  constructor(readonly size: number) {
    const n = size * size;
    this.ground = new Uint8Array(n);
    this.block = new Uint8Array(n);
    this.hp = new Float32Array(n);
  }

  idx(x: number, y: number): number {
    return y * this.size + x;
  }
  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }
  groundAt(x: number, y: number): Ground {
    return this.inBounds(x, y) ? this.ground[this.idx(x, y)] : Ground.Water;
  }
  blockAt(x: number, y: number): B {
    return this.inBounds(x, y) ? this.block[this.idx(x, y)] : B.None;
  }
  isLand(x: number, y: number): boolean {
    return this.groundAt(x, y) !== Ground.Water;
  }
  /** Can a walker stand here? */
  walkable(x: number, y: number): boolean {
    return this.isLand(x, y) && !BLOCKS[this.blockAt(x, y) as B].solid;
  }
  setBlock(x: number, y: number, b: B): void {
    if (!this.inBounds(x, y)) return;
    const i = this.idx(x, y);
    this.block[i] = b;
    this.hp[i] = BLOCKS[b].hp;
    this.version++;
  }
  /** Damage a block. Returns true if it broke. */
  damage(x: number, y: number, amount: number): boolean {
    const i = this.idx(x, y);
    if (this.block[i] === B.None) return false;
    this.hp[i] -= amount;
    if (this.hp[i] <= 0) {
      this.block[i] = B.None;
      this.hp[i] = 0;
      this.version++;
      return true;
    }
    return false;
  }
  hpFrac(x: number, y: number): number {
    const b = this.blockAt(x, y);
    if (b === B.None) return 0;
    return this.hp[this.idx(x, y)] / BLOCKS[b].hp;
  }
  count(b: B): number {
    let n = 0;
    for (let i = 0; i < this.block.length; i++) if (this.block[i] === b) n++;
    return n;
  }
}
