import { MaterialId } from '../world/tileTypes';
import { ZombieVariant } from '../entities/Zombie';

/**
 * Central loot rules — pure functions, injectable randomness, no Phaser.
 * Every "what falls out of X" decision lives here.
 */

export interface LootStack {
  m: MaterialId;
  c: number;
}

export interface KillDropOpts {
  variant: ZombieVariant | undefined;
  night: number;
  combo: number;
  bloodMoon: boolean;
  lootMultiplier: number;
  rand?: () => number;
}

export function rollKillDrops(opts: KillDropOpts): LootStack[] {
  const rand = opts.rand ?? Math.random;
  const moonMult = (opts.bloodMoon ? 1.5 : 1) * opts.lootMultiplier;
  const comboGoldBonus = Math.min(3, Math.floor(opts.combo / 5));
  const drops: LootStack[] = [];
  if (opts.variant === 'goblin') {
    drops.push({ m: 'gold', c: 2 + Math.floor(opts.night / 4) });
    if (rand() < 0.35) drops.push({ m: 'bomb', c: 1 });
    if (rand() < 0.5) drops.push({ m: 'arrow', c: 4 });
  }
  if (rand() < 0.75 * moonMult) drops.push({ m: 'gold', c: 1 + comboGoldBonus });
  if (rand() < 0.32 * moonMult) drops.push({ m: 'wood', c: 1 });
  if (rand() < 0.16 * moonMult) drops.push({ m: 'stone', c: 1 });
  if (rand() < 0.08 * moonMult) drops.push({ m: 'iron', c: 1 });
  return drops;
}

export function bossLoot(): LootStack[] {
  return [
    { m: 'gold', c: 6 },
    { m: 'iron', c: 4 },
    { m: 'stone', c: 3 },
    { m: 'bullet', c: 5 },
    { m: 'lava', c: 1 },
  ];
}

export function crateLoot(): LootStack[] {
  return [
    { m: 'wood', c: 4 },
    { m: 'stone', c: 3 },
    { m: 'gold', c: 2 },
    { m: 'arrow', c: 6 },
  ];
}

export function meteorLoot(): LootStack[] {
  return [
    { m: 'iron', c: 3 },
    { m: 'stone', c: 4 },
    { m: 'gold', c: 1 },
  ];
}

/** Underground treasure vault chests — richer the deeper you go. */
export function vaultLoot(floor: number, rand: () => number = Math.random): LootStack[] {
  const loot: LootStack[] = [
    { m: 'gold', c: 3 + floor },
    { m: 'arrow', c: 6 },
  ];
  if (floor >= 2) loot.push({ m: 'crystal', c: 1 + (rand() < 0.4 ? 1 : 0) });
  if (rand() < 0.4) loot.push({ m: 'bomb', c: 1 });
  if (rand() < 0.5) loot.push({ m: 'iron', c: 2 + floor });
  return loot;
}

/** Cleansing a graveyard crypt pays out well. */
export function cryptLoot(): LootStack[] {
  return [
    { m: 'gold', c: 6 },
    { m: 'iron', c: 4 },
    { m: 'arrow', c: 10 },
    { m: 'stone', c: 4 },
  ];
}

/** Buried treasure (cat sniffs / goblin maps). */
export function treasureDigLoot(rand: () => number = Math.random): LootStack[] {
  const loot: LootStack[] = [{ m: 'gold', c: 3 + Math.floor(rand() * 3) }];
  if (rand() < 0.5) loot.push({ m: 'iron', c: 2 });
  if (rand() < 0.25) loot.push({ m: 'crystal', c: 1 });
  if (rand() < 0.35) loot.push({ m: 'bomb', c: 1 });
  return loot;
}
