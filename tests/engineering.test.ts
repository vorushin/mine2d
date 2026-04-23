import { describe, it, expect } from 'vitest';
import { useHammer, bombExplosion, BombVictim } from '../src/systems/Engineering';
import { makeGameState, addItem, hasItem } from '../src/state/GameState';
import { TileType, TILE_SPECS } from '../src/world/tileTypes';

/**
 * Tests run framework-free: we stub a tiny World-like object that exposes
 * just what Engineering's pure functions need. The real World class is a
 * Phaser GameObject and can't be constructed in Vitest.
 */
function makeStubWorld() {
  const tiles: { type: TileType; hp: number }[][] = [];
  for (let y = 0; y < 5; y++) {
    const row: { type: TileType; hp: number }[] = [];
    for (let x = 0; x < 5; x++) row.push({ type: TileType.Grass, hp: 0 });
    tiles.push(row);
  }
  return {
    tiles,
    getTileAt(x: number, y: number) {
      if (x < 0 || y < 0 || y >= tiles.length || x >= tiles[0].length) return null;
      return tiles[y][x];
    },
    damageTile(x: number, y: number, amount: number): boolean {
      const t = tiles[y]?.[x];
      if (!t) return false;
      const spec = TILE_SPECS[t.type];
      if (!spec.baseHp) return false;
      t.hp -= amount;
      if (t.hp <= 0) {
        t.type = TileType.Grass;
        t.hp = 0;
        return true;
      }
      return false;
    },
    tileToWorldCenter(x: number, y: number) {
      return { x: x * 32 + 16, y: y * 32 + 16 };
    },
    isRevealed: () => true,
  };
}

type StubWorld = ReturnType<typeof makeStubWorld>;

function setTile(world: StubWorld, x: number, y: number, type: TileType, hp?: number) {
  world.tiles[y][x] = { type, hp: hp ?? TILE_SPECS[type].baseHp };
}

describe('useHammer', () => {
  it('repairs a damaged wall when material is available', () => {
    const world = makeStubWorld();
    setTile(world, 2, 2, TileType.WallWood, 10);
    const state = makeGameState();
    addItem(state.inventory, 'wood', 5);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = useHammer(world as any, 2, 2, state);
    expect(r).toEqual({ ok: true, material: 'wood' });
    expect(world.tiles[2][2].hp).toBe(TILE_SPECS[TileType.WallWood].baseHp);
    expect(hasItem(state.inventory, 'wood', 4)).toBe(true);
    expect(hasItem(state.inventory, 'wood', 5)).toBe(false);
  });

  it('refuses to repair at full HP', () => {
    const world = makeStubWorld();
    setTile(world, 2, 2, TileType.WallWood);
    const state = makeGameState();
    addItem(state.inventory, 'wood', 5);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = useHammer(world as any, 2, 2, state);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_damaged');
  });

  it('refuses without material', () => {
    const world = makeStubWorld();
    setTile(world, 2, 2, TileType.WallWood, 5);
    const state = makeGameState();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = useHammer(world as any, 2, 2, state);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('no_material');
    expect(world.tiles[2][2].hp).toBe(5); // HP unchanged
  });

  it('refuses on non-placed tiles (e.g. grass, stone ore)', () => {
    const world = makeStubWorld();
    setTile(world, 2, 2, TileType.Stone, 3);
    const state = makeGameState();
    addItem(state.inventory, 'stone', 5);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = useHammer(world as any, 2, 2, state);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('invalid_tile');
  });

  it('repairs a reinforced wall using iron', () => {
    const world = makeStubWorld();
    setTile(world, 1, 1, TileType.WallReinforced, 50);
    const state = makeGameState();
    addItem(state.inventory, 'iron', 3);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = useHammer(world as any, 1, 1, state);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.material).toBe('iron');
    expect(world.tiles[1][1].hp).toBe(TILE_SPECS[TileType.WallReinforced].baseHp);
  });
});

describe('bombExplosion', () => {
  it('damages breakable tiles within radius', () => {
    const world = makeStubWorld();
    setTile(world, 2, 2, TileType.WallWood);
    setTile(world, 3, 2, TileType.WallWood);
    setTile(world, 0, 0, TileType.WallWood); // outside radius 2
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bombExplosion(world as any, 2, 2, 2, 20, []);
    // Note: tiles is indexed [y][x]
    expect(world.tiles[2][2].hp).toBe(TILE_SPECS[TileType.WallWood].baseHp - 20);
    expect(world.tiles[2][3].hp).toBe(TILE_SPECS[TileType.WallWood].baseHp - 20);
    expect(world.tiles[0][0].hp).toBe(TILE_SPECS[TileType.WallWood].baseHp); // untouched
  });

  it('does not damage grass (not breakable)', () => {
    const world = makeStubWorld();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bombExplosion(world as any, 2, 2, 2, 20, []);
    expect(world.tiles[2][2].type).toBe(TileType.Grass);
    expect(world.tiles[2][2].hp).toBe(0);
  });

  it('damages victims within radius and reports kills', () => {
    const world = makeStubWorld();
    const v: BombVictim & { hp: number } = {
      hp: 10,
      alive: true,
      x: 2 * 32 + 16,
      y: 2 * 32 + 16,
      takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) { this.alive = false; return true; }
        return false;
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const killed = bombExplosion(world as any, 2, 2, 2, 60, [v]);
    expect(v.hp).toBeLessThan(10);
    expect(killed).toContain(v);
  });
});
