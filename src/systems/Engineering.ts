import { World } from '../world/World';
import { TileType, TILE_SPECS, MaterialId, isBreakable } from '../world/tileTypes';
import { GameState, hasItem, removeItem } from '../state/GameState';

/**
 * Tile types the repair hammer can operate on — player-placed structures
 * that cost materials to build. Natural terrain (stone, ore, trees) is
 * excluded: re-growing those would break mining progression.
 */
const REPAIRABLE: ReadonlySet<TileType> = new Set([
  TileType.WallWood,
  TileType.WallStone,
  TileType.WallIron,
  TileType.WallReinforced,
  TileType.DoorWood,
  TileType.DoorIron,
  TileType.TurretBasic,
  TileType.TurretAdvanced,
  TileType.TurretFlame,
  TileType.CraftingBench,
  TileType.Chest,
  TileType.Torch,
  TileType.Bridge,
]);

export type HammerResult =
  | { ok: true; material: MaterialId }
  | { ok: false; reason: 'not_damaged' | 'no_material' | 'invalid_tile' };

/**
 * Repair the tile at (tx, ty): if damaged and the player has 1 unit of its
 * drop material, consume it and restore tile HP to full.
 */
export function useHammer(world: World, tx: number, ty: number, state: GameState): HammerResult {
  const tile = world.getTileAt(tx, ty);
  if (!tile) return { ok: false, reason: 'invalid_tile' };
  if (!REPAIRABLE.has(tile.type)) return { ok: false, reason: 'invalid_tile' };
  const spec = TILE_SPECS[tile.type];
  if (tile.hp >= spec.baseHp) return { ok: false, reason: 'not_damaged' };
  const mat = spec.dropMaterial;
  if (!mat) return { ok: false, reason: 'invalid_tile' };
  if (!hasItem(state.inventory, mat, 1)) return { ok: false, reason: 'no_material' };
  removeItem(state.inventory, mat, 1);
  tile.hp = spec.baseHp;
  return { ok: true, material: mat };
}

export interface BombVictim {
  takeDamage(amount: number): boolean; // true iff died
  alive: boolean;
  x: number;
  y: number;
}

/**
 * Resolve a bomb explosion at tile (tx, ty).
 * Damages every breakable tile in radius (Chebyshev distance, skipping the
 * shop tile), plus any victim whose world-space position lies within the
 * radius in tile units. Returns killed victims for caller bookkeeping.
 */
export function bombExplosion(
  world: World,
  tx: number,
  ty: number,
  radius: number,
  damage: number,
  victims: BombVictim[],
): BombVictim[] {
  const killed: BombVictim[] = [];
  // Tile damage
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (Math.hypot(dx, dy) > radius + 0.3) continue;
      const nx = tx + dx;
      const ny = ty + dy;
      const t = world.getTileAt(nx, ny);
      if (!t) continue;
      if (t.type === TileType.ShopNPC) continue;
      if (!isBreakable(t.type)) continue;
      world.damageTile(nx, ny, damage);
    }
  }
  // Victim damage (linear falloff — full damage at centre, ~half at edge)
  const c = world.tileToWorldCenter(tx, ty);
  const radiusPx = (radius + 0.5) * 32;
  for (const v of victims) {
    if (!v.alive) continue;
    const d = Math.hypot(v.x - c.x, v.y - c.y);
    if (d > radiusPx) continue;
    const falloff = Math.max(0.5, 1 - d / radiusPx);
    const dealt = Math.ceil(damage * falloff);
    if (v.takeDamage(dealt)) killed.push(v);
  }
  return killed;
}
