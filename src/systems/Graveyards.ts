import { Tile } from '../world/generate';
import { TileType } from '../world/tileTypes';

/**
 * Graveyards: cursed surface structures that feed the night sieges. Each
 * intact crypt adds +25% zombies to every night until the player raids it
 * by day (it's guarded) and smashes the crypt.
 */

export const GRAVEYARD_NIGHT_BONUS_PCT = 0.25;
export const GUARDIANS_PER_CRYPT = 2;

export function findCrypts(tiles: Tile[][]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < tiles[y].length; x++) {
      if (tiles[y][x].type === TileType.Crypt) out.push({ x, y });
    }
  }
  return out;
}

/** Extra zombies the intact graveyards add to a night's target. */
export function graveyardNightBonus(intactCrypts: number, baseTarget: number): number {
  if (intactCrypts <= 0) return 0;
  return Math.ceil(baseTarget * GRAVEYARD_NIGHT_BONUS_PCT) * intactCrypts;
}
