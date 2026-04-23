import Phaser from 'phaser';
import { World } from '../world/World';
import { Player } from './Player';
import { TILE_SIZE, COLORS, ZOMBIE_BASE_HP, ZOMBIE_BASE_DAMAGE, ZOMBIE_BASE_SPEED, BRUTE_CHANCE_BY_NIGHT } from '../config';
import { TileType, TILE_SPECS } from '../world/tileTypes';
import { bfsNextStep } from '../systems/Pathfinding';

export type ZombieVariant = 'normal' | 'fast' | 'armored' | 'brute' | 'boss';

export function bruteChanceForNight(night: number): number {
  const arr = BRUTE_CHANCE_BY_NIGHT;
  if (arr.length === 0) return 0;
  const idx = Math.max(0, night - 1);
  return arr[Math.min(idx, arr.length - 1)];
}

export interface ZombieSpec {
  variant: ZombieVariant;
  hp: number;
  damage: number;
  speed: number;
  tint: number;
}

export function specForNight(night: number): ZombieSpec {
  const armoredChance = night >= 8 ? 0.2 : night >= 5 ? 0.1 : 0;
  const fastChance = night >= 5 ? 0.3 : night >= 3 ? 0.15 : 0;
  const bruteChance = bruteChanceForNight(night);

  if (bruteChance > 0 && Math.random() < bruteChance) {
    return {
      variant: 'brute',
      hp: ZOMBIE_BASE_HP * 4.5,
      damage: ZOMBIE_BASE_DAMAGE * 2.2,
      speed: ZOMBIE_BASE_SPEED * 0.75,
      tint: 0xff8080,
    };
  }
  if (armoredChance > 0 && Math.random() < armoredChance) {
    return {
      variant: 'armored',
      hp: ZOMBIE_BASE_HP * 3,
      damage: ZOMBIE_BASE_DAMAGE * 1.6,
      speed: ZOMBIE_BASE_SPEED * 0.85,
      tint: 0x7a4a22,
    };
  }
  if (fastChance > 0 && Math.random() < fastChance) {
    return {
      variant: 'fast',
      hp: ZOMBIE_BASE_HP * 0.8,
      damage: ZOMBIE_BASE_DAMAGE,
      speed: ZOMBIE_BASE_SPEED * 1.6,
      tint: 0xa8d65c,
    };
  }
  const scale = 1 + (night - 1) * 0.1;
  return {
    variant: 'normal',
    hp: ZOMBIE_BASE_HP * scale,
    damage: ZOMBIE_BASE_DAMAGE * scale,
    speed: ZOMBIE_BASE_SPEED,
    tint: COLORS.zombie,
  };
}

/** Big boss zombie. Used once every 5 nights. */
export function specForBoss(night: number): ZombieSpec {
  const tier = Math.floor(night / 5);
  return {
    variant: 'boss',
    hp: ZOMBIE_BASE_HP * (6 + tier * 3),
    damage: ZOMBIE_BASE_DAMAGE * 2.2,
    speed: ZOMBIE_BASE_SPEED * 0.7,
    tint: 0x551010,
  };
}

/**
 * Zombie textures. Each variant has a distinct silhouette and palette
 * so the player can triage threats at a glance. Drawn procedurally with
 * Phaser Graphics at preload time.
 */
export function generateZombieTextures(scene: Phaser.Scene): void {
  drawNormalZombie(scene);
  drawFastZombie(scene);
  drawArmoredZombie(scene);
  drawBruteZombie(scene);
  drawBossZombie(scene);
}

// --- Normal: slumped shambler — mottled rotting green, hanging jaw, one dead eye --------

function drawNormalZombie(scene: Phaser.Scene): void {
  const key = 'zombie_normal';
  if (scene.textures.exists(key)) return;
  const W = 22, H = 28;
  const g = scene.add.graphics();

  // Shadow under feet is drawn at runtime — start with pure transparent.
  const skin = 0x4a8f4a;
  const skinDark = 0x2d5c2d;
  const skinPale = 0x6dbf6d; // patches of lighter decay
  const shirt = 0x5a3820;
  const shirtTear = 0x8a5030;

  // Hair — scruffy dark patch on top
  g.fillStyle(0x1a2a1a, 1);
  g.fillRect(7, 1, 8, 2);
  g.fillRect(6, 2, 2, 1); g.fillRect(14, 2, 2, 1);

  // Head
  g.fillStyle(skin, 1); g.fillRect(6, 3, 10, 9);
  // Head lowlight (bottom edge + right cheek)
  g.fillStyle(skinDark, 1);
  g.fillRect(6, 11, 10, 1); g.fillRect(14, 4, 2, 7);
  // Head highlight (left cheek) + decay patch
  g.fillStyle(skinPale, 1);
  g.fillRect(6, 4, 1, 4); g.fillRect(11, 8, 2, 1);

  // Eyes — one glowing, one hollow socket
  g.fillStyle(0x000000, 1); g.fillRect(8, 6, 2, 2);      // hollow left
  g.fillStyle(0xffdb3d, 1); g.fillRect(12, 6, 2, 2);      // glowing right
  g.fillStyle(0xffffff, 1); g.fillRect(13, 6, 1, 1);      // highlight
  // Stitched scar across cheek
  g.fillStyle(0x1a1a1a, 1);
  g.fillRect(9, 9, 1, 1); g.fillRect(11, 9, 1, 1);

  // Mouth: gaping, drooling
  g.fillStyle(0x1a0505, 1); g.fillRect(9, 10, 4, 2);
  g.fillStyle(0x8a1a1a, 1); g.fillRect(10, 11, 2, 1);
  // Drool drip
  g.fillStyle(0x7ecf7e, 1); g.fillRect(11, 12, 1, 1);

  // Body — torn shirt with vertical rips showing rotten flesh
  g.fillStyle(shirt, 1); g.fillRect(4, 12, 14, 9);
  g.fillStyle(shirtTear, 1); g.fillRect(4, 12, 14, 1); // shirt top seam
  // Rips revealing skin
  g.fillStyle(skinPale, 1);
  g.fillRect(8, 14, 1, 5); g.fillRect(13, 15, 1, 4);
  // Exposed ribs hint (small bones)
  g.fillStyle(0xeeeed8, 1);
  g.fillRect(8, 16, 1, 1); g.fillRect(13, 17, 1, 1);

  // Arms — left hangs slightly lower than right (dead weight)
  g.fillStyle(skin, 1);
  g.fillRect(0, 13, 4, 8);  // left arm, longer/lower
  g.fillRect(18, 13, 4, 7); // right arm
  g.fillStyle(skinDark, 1);
  g.fillRect(0, 20, 4, 1); g.fillRect(18, 19, 4, 1);
  // Fingers (claws) on left
  g.fillStyle(0x2d5c2d, 1);
  g.fillRect(1, 21, 1, 1); g.fillRect(3, 21, 1, 1);

  // Legs — tattered pants
  g.fillStyle(0x3a2010, 1); g.fillRect(6, 21, 4, 5);
  g.fillRect(12, 21, 4, 5);
  // Jagged pant bottoms
  g.fillStyle(skinDark, 1);
  g.fillRect(7, 25, 1, 1); g.fillRect(9, 25, 1, 1);
  g.fillRect(13, 25, 1, 1); g.fillRect(15, 25, 1, 1);
  // Feet (bare, dirty)
  g.fillStyle(skinDark, 1); g.fillRect(6, 26, 4, 2); g.fillRect(12, 26, 4, 2);
  g.fillStyle(0x0a0a0a, 1); g.fillRect(6, 27, 4, 1); g.fillRect(12, 27, 4, 1);

  // Body outline
  outlineRect(g, 6, 3, 10, 9, 0x0a0a0a);
  outlineRect(g, 4, 12, 14, 9, 0x0a0a0a);

  g.generateTexture(key, W, H);
  g.destroy();
}

// --- Fast: feral lean runner, blood-spattered, red eyes, claws ---------------------------

function drawFastZombie(scene: Phaser.Scene): void {
  const key = 'zombie_fast';
  if (scene.textures.exists(key)) return;
  const W = 22, H = 28;
  const g = scene.add.graphics();

  const skin = 0xaad65c;
  const skinDark = 0x6b9830;
  const skinPale = 0xccec88;

  // Wild hair spikes (tuft on top)
  g.fillStyle(0x2a1a0a, 1);
  g.fillRect(7, 0, 2, 2); g.fillRect(11, 0, 2, 2); g.fillRect(9, 1, 2, 1);
  g.fillRect(6, 2, 10, 1);

  // Head (smaller, leaner)
  g.fillStyle(skin, 1); g.fillRect(7, 3, 8, 8);
  g.fillStyle(skinDark, 1); g.fillRect(7, 10, 8, 1); g.fillRect(13, 4, 2, 6);
  g.fillStyle(skinPale, 1); g.fillRect(7, 4, 1, 3);

  // Eyes — both red and crazed
  g.fillStyle(0xff3030, 1); g.fillRect(8, 5, 2, 2); g.fillRect(12, 5, 2, 2);
  g.fillStyle(0xffaa80, 1); g.fillRect(9, 5, 1, 1); g.fillRect(13, 5, 1, 1);

  // Fanged open maw
  g.fillStyle(0x1a0505, 1); g.fillRect(9, 8, 4, 3);
  g.fillStyle(0xf0f0d8, 1);
  // Fangs (vertical slashes)
  g.fillRect(9, 8, 1, 2); g.fillRect(12, 8, 1, 2);
  g.fillRect(10, 10, 1, 1); g.fillRect(11, 10, 1, 1);
  // Blood around mouth
  g.fillStyle(0x8a1a1a, 1);
  g.fillRect(8, 11, 1, 1); g.fillRect(13, 11, 1, 1);

  // Lean torso
  g.fillStyle(skin, 1); g.fillRect(6, 11, 10, 8);
  // Shadow underside
  g.fillStyle(skinDark, 1); g.fillRect(6, 18, 10, 1);
  // Rib hints
  g.fillStyle(skinPale, 1);
  g.fillRect(7, 13, 1, 1); g.fillRect(14, 13, 1, 1);
  g.fillRect(7, 16, 1, 1); g.fillRect(14, 16, 1, 1);
  // Blood splatter on chest
  g.fillStyle(0x8a1a1a, 1);
  g.fillRect(10, 14, 2, 2); g.fillRect(11, 15, 1, 1); g.fillRect(9, 16, 1, 1);

  // Long clawed arms
  g.fillStyle(skin, 1);
  g.fillRect(2, 13, 4, 6); g.fillRect(16, 13, 4, 6);
  g.fillStyle(skinDark, 1);
  g.fillRect(2, 18, 4, 1); g.fillRect(16, 18, 4, 1);
  // Claws
  g.fillStyle(0xe8e8e0, 1);
  g.fillRect(1, 19, 1, 2); g.fillRect(3, 19, 1, 2); g.fillRect(5, 19, 1, 2);
  g.fillRect(16, 19, 1, 2); g.fillRect(18, 19, 1, 2); g.fillRect(20, 19, 1, 2);

  // Legs — lean
  g.fillStyle(0x3a2010, 1);
  g.fillRect(7, 19, 3, 6); g.fillRect(12, 19, 3, 6);
  // Feet — bare clawed
  g.fillStyle(skinDark, 1);
  g.fillRect(6, 25, 4, 2); g.fillRect(12, 25, 4, 2);
  g.fillStyle(0xe8e8e0, 1);
  g.fillRect(6, 27, 1, 1); g.fillRect(9, 27, 1, 1);
  g.fillRect(12, 27, 1, 1); g.fillRect(15, 27, 1, 1);

  outlineRect(g, 7, 3, 8, 8, 0x0a0a0a);
  outlineRect(g, 6, 11, 10, 8, 0x0a0a0a);

  g.generateTexture(key, W, H);
  g.destroy();
}

// --- Armored: steel-helmeted rotted knight, hazard cross ---------------------------------

function drawArmoredZombie(scene: Phaser.Scene): void {
  const key = 'zombie_armored';
  if (scene.textures.exists(key)) return;
  const W = 24, H = 28;
  const g = scene.add.graphics();

  const skin = 0x7a9f4a;
  const steel = 0x8a8a90;
  const steelDark = 0x505058;
  const steelLit = 0xaaabb4;
  const rust = 0x7a3a20;

  // Helmet dome
  g.fillStyle(steel, 1); g.fillRect(6, 2, 12, 7);
  g.fillStyle(steelLit, 1); g.fillRect(7, 2, 10, 1);
  g.fillStyle(steelDark, 1); g.fillRect(6, 8, 12, 1);
  // Visor slit — dark band across eye line, two glowing eyes behind
  g.fillStyle(0x1a1a1a, 1); g.fillRect(6, 5, 12, 3);
  g.fillStyle(0xff9030, 1); g.fillRect(9, 6, 2, 2); g.fillRect(13, 6, 2, 2);
  g.fillStyle(0xffdd80, 1); g.fillRect(10, 6, 1, 1); g.fillRect(14, 6, 1, 1);
  // Helmet rivets
  g.fillStyle(0x2a2a2a, 1);
  g.fillRect(7, 3, 1, 1); g.fillRect(16, 3, 1, 1); g.fillRect(7, 8, 1, 1); g.fillRect(16, 8, 1, 1);
  // Rust streaks
  g.fillStyle(rust, 1);
  g.fillRect(8, 8, 1, 1); g.fillRect(15, 4, 1, 2);

  // Exposed jaw below helmet (rotten)
  g.fillStyle(skin, 1); g.fillRect(8, 9, 8, 2);
  g.fillStyle(0x1a0505, 1); g.fillRect(10, 10, 4, 1);

  // Pauldrons (shoulder plates)
  g.fillStyle(steelDark, 1); g.fillRect(1, 11, 5, 4); g.fillRect(18, 11, 5, 4);
  g.fillStyle(steel, 1); g.fillRect(1, 11, 5, 1); g.fillRect(18, 11, 5, 1);
  g.fillStyle(rust, 1); g.fillRect(2, 14, 1, 1); g.fillRect(21, 14, 1, 1);

  // Chestplate with hazard X
  g.fillStyle(steelDark, 1); g.fillRect(5, 11, 14, 10);
  g.fillStyle(steel, 1); g.fillRect(5, 11, 14, 1);
  g.fillStyle(steelLit, 1); g.fillRect(5, 11, 1, 10); g.fillRect(6, 12, 1, 8);
  // Hazard X
  g.fillStyle(0xffcc33, 1);
  for (let i = 0; i < 6; i++) {
    g.fillRect(8 + i, 13 + i, 1, 1);
    g.fillRect(15 - i, 13 + i, 1, 1);
  }

  // Chestplate bottom edge with bolts
  g.fillStyle(0x2a2a2a, 1);
  g.fillRect(6, 20, 1, 1); g.fillRect(11, 20, 1, 1); g.fillRect(17, 20, 1, 1);

  // Arms — rotten skin between pauldron and gauntlet
  g.fillStyle(skin, 1); g.fillRect(2, 15, 4, 3); g.fillRect(18, 15, 4, 3);
  // Gauntlets
  g.fillStyle(steel, 1); g.fillRect(1, 18, 5, 3); g.fillRect(18, 18, 5, 3);
  g.fillStyle(steelDark, 1); g.fillRect(1, 20, 5, 1); g.fillRect(18, 20, 5, 1);

  // Heavy greaves (legs)
  g.fillStyle(steelDark, 1);
  g.fillRect(7, 21, 4, 5); g.fillRect(13, 21, 4, 5);
  g.fillStyle(steelLit, 1);
  g.fillRect(7, 21, 4, 1); g.fillRect(13, 21, 4, 1);
  // Boots
  g.fillStyle(0x1a1a1a, 1);
  g.fillRect(6, 26, 5, 2); g.fillRect(13, 26, 5, 2);

  outlineRect(g, 5, 11, 14, 10, 0x0a0a0a);
  outlineRect(g, 6, 2, 12, 7, 0x0a0a0a);

  g.generateTexture(key, W, H);
  g.destroy();
}

// --- Brute: hulking muscled abomination with chains, stitches, horns --------------------

function drawBruteZombie(scene: Phaser.Scene): void {
  const key = 'zombie_brute';
  if (scene.textures.exists(key)) return;
  const W = 28, H = 32;
  const g = scene.add.graphics();

  const flesh = 0x9a2830;
  const fleshDark = 0x5a1018;
  const fleshLit = 0xc04050;
  const muscle = 0x702020;
  const stitch = 0xf0c060;

  // Horns protruding from top of head
  g.fillStyle(0x1a1a1a, 1);
  g.fillRect(7, 0, 2, 3); g.fillRect(19, 0, 2, 3);
  g.fillRect(8, 2, 1, 1); g.fillRect(19, 2, 1, 1);
  g.fillStyle(0x3a3a3a, 1);
  g.fillRect(7, 0, 1, 1); g.fillRect(20, 0, 1, 1);

  // Head — larger, angular, with mask straps
  g.fillStyle(flesh, 1); g.fillRect(7, 3, 14, 9);
  g.fillStyle(fleshDark, 1); g.fillRect(7, 11, 14, 1); g.fillRect(19, 4, 2, 8);
  g.fillStyle(fleshLit, 1); g.fillRect(7, 4, 1, 5); g.fillRect(14, 5, 1, 1);

  // Leather mask strap across eyes
  g.fillStyle(0x2a1a0a, 1); g.fillRect(7, 6, 14, 2);
  // Glowing yellow eye slits
  g.fillStyle(0xffdd40, 1); g.fillRect(9, 6, 2, 2); g.fillRect(17, 6, 2, 2);
  g.fillStyle(0xffffff, 1); g.fillRect(10, 6, 1, 1); g.fillRect(18, 6, 1, 1);
  // Strap buckles
  g.fillStyle(0x8a6030, 1); g.fillRect(7, 7, 1, 1); g.fillRect(20, 7, 1, 1);

  // Stitched mouth — row of X's across mouth
  g.fillStyle(0x1a0505, 1); g.fillRect(10, 9, 8, 2);
  g.fillStyle(stitch, 1);
  g.fillRect(11, 9, 1, 1); g.fillRect(13, 9, 1, 1); g.fillRect(15, 9, 1, 1); g.fillRect(17, 9, 1, 1);
  g.fillRect(10, 10, 1, 1); g.fillRect(12, 10, 1, 1); g.fillRect(14, 10, 1, 1); g.fillRect(16, 10, 1, 1); g.fillRect(18, 10, 1, 1);

  // Massive shoulders & chest
  g.fillStyle(flesh, 1); g.fillRect(3, 12, 22, 13);
  g.fillStyle(fleshDark, 1);
  // Shadow under chest
  g.fillRect(3, 24, 22, 1);
  // Pectoral / abs definition
  g.fillStyle(muscle, 1);
  g.fillRect(13, 13, 2, 11);  // central sternum line
  g.fillRect(6, 17, 16, 1);   // pectoral underline
  g.fillRect(6, 21, 16, 1);   // ab line
  // Muscle highlights
  g.fillStyle(fleshLit, 1);
  g.fillRect(5, 13, 1, 3); g.fillRect(22, 13, 1, 3);
  g.fillRect(8, 14, 2, 1); g.fillRect(18, 14, 2, 1);

  // Chain across chest — dark pixelated links
  g.fillStyle(0x2a2a2a, 1);
  for (let cx = 5; cx < 23; cx += 3) g.fillRect(cx, 12, 2, 1);
  g.fillStyle(0x5a5a5a, 1);
  for (let cx = 5; cx < 23; cx += 3) g.fillRect(cx, 12, 1, 1);

  // Stitches running down chest
  g.fillStyle(stitch, 1);
  g.fillRect(14, 15, 1, 1); g.fillRect(13, 18, 1, 1); g.fillRect(14, 20, 1, 1);

  // Oversized arms with bulging biceps
  g.fillStyle(flesh, 1);
  g.fillRect(0, 14, 4, 9); g.fillRect(24, 14, 4, 9);
  g.fillStyle(fleshDark, 1);
  g.fillRect(0, 22, 4, 1); g.fillRect(24, 22, 4, 1);
  g.fillStyle(fleshLit, 1);
  g.fillRect(1, 15, 1, 3); g.fillRect(26, 15, 1, 3);
  // Broken shackles at wrists
  g.fillStyle(0x2a2a2a, 1);
  g.fillRect(0, 20, 4, 2); g.fillRect(24, 20, 4, 2);
  g.fillStyle(0x6a6a6a, 1);
  g.fillRect(0, 20, 4, 1); g.fillRect(24, 20, 4, 1);
  // Dangling chain links
  g.fillStyle(0x2a2a2a, 1);
  g.fillRect(2, 22, 1, 2); g.fillRect(25, 22, 1, 2);
  // Knuckles
  g.fillStyle(fleshDark, 1);
  g.fillRect(0, 23, 4, 1); g.fillRect(24, 23, 4, 1);

  // Legs — blood-stained pants
  g.fillStyle(0x2a1010, 1); g.fillRect(6, 25, 6, 6); g.fillRect(16, 25, 6, 6);
  g.fillStyle(0x4a1a1a, 1); g.fillRect(6, 25, 6, 1); g.fillRect(16, 25, 6, 1);
  // Tattered bottoms
  g.fillStyle(fleshDark, 1);
  g.fillRect(7, 30, 1, 1); g.fillRect(10, 30, 1, 1);
  g.fillRect(17, 30, 1, 1); g.fillRect(20, 30, 1, 1);
  // Heavy boots
  g.fillStyle(0x0a0a0a, 1); g.fillRect(5, 30, 8, 2); g.fillRect(15, 30, 8, 2);

  outlineRect(g, 7, 3, 14, 9, 0x0a0a0a);
  outlineRect(g, 3, 12, 22, 13, 0x0a0a0a);

  g.generateTexture(key, W, H);
  g.destroy();
}

// --- Boss: towering armored abomination with horns, runes, cape -------------------------

function drawBossZombie(scene: Phaser.Scene): void {
  const key = 'zombie_boss';
  if (scene.textures.exists(key)) return;
  const W = 40, H = 44;
  const g = scene.add.graphics();

  const flesh = 0x8a1a1a;
  const fleshLit = 0xbf2a2a;
  const cape = 0x1a0808;
  const capeDark = 0x0a0404;
  const steel = 0x3a3a3a;
  const steelLit = 0x7a7a7a;
  const glow = 0xff4020;
  const glowHot = 0xffcc40;

  // Cape — tattered strip behind the body
  g.fillStyle(cape, 1);
  g.fillRect(4, 18, 32, 22);
  // Tattered bottom
  g.fillStyle(capeDark, 1);
  g.fillRect(4, 38, 2, 3); g.fillRect(8, 38, 3, 4); g.fillRect(14, 38, 2, 3);
  g.fillRect(22, 38, 2, 3); g.fillRect(27, 38, 3, 4); g.fillRect(33, 38, 3, 3);
  // Cape folds — vertical stripes
  g.fillStyle(capeDark, 1);
  g.fillRect(10, 18, 1, 20); g.fillRect(18, 18, 1, 20); g.fillRect(26, 18, 1, 20);

  // Horns — tall curved
  g.fillStyle(0x1a1a1a, 1);
  g.fillRect(9, 0, 3, 5); g.fillRect(28, 0, 3, 5);
  g.fillRect(11, 3, 1, 2); g.fillRect(28, 3, 1, 2);
  g.fillStyle(steelLit, 1);
  g.fillRect(9, 0, 1, 2); g.fillRect(30, 0, 1, 2);

  // Head / helmet
  g.fillStyle(steel, 1); g.fillRect(11, 3, 18, 12);
  g.fillStyle(steelLit, 1); g.fillRect(12, 3, 16, 1);
  g.fillStyle(0x1a1a1a, 1); g.fillRect(11, 13, 18, 2);
  // Horn bases
  g.fillStyle(steel, 1); g.fillRect(10, 4, 2, 2); g.fillRect(28, 4, 2, 2);

  // Rune-etched visor with glowing eyes
  g.fillStyle(0x1a0505, 1); g.fillRect(11, 6, 18, 4);
  g.fillStyle(glow, 1); g.fillRect(14, 7, 3, 3); g.fillRect(23, 7, 3, 3);
  g.fillStyle(glowHot, 1); g.fillRect(15, 7, 1, 1); g.fillRect(24, 7, 1, 1);
  g.fillStyle(0xffffff, 1); g.fillRect(15, 8, 1, 1); g.fillRect(24, 8, 1, 1);
  // Runes etched on helm
  g.fillStyle(glow, 1);
  g.fillRect(13, 5, 1, 1); g.fillRect(17, 5, 1, 1); g.fillRect(22, 5, 1, 1); g.fillRect(26, 5, 1, 1);

  // Jawline — bloody maw below helmet
  g.fillStyle(flesh, 1); g.fillRect(13, 11, 14, 4);
  g.fillStyle(0x1a0505, 1); g.fillRect(15, 12, 10, 2);
  // Fangs
  g.fillStyle(0xe8e0d0, 1);
  g.fillRect(15, 12, 1, 2); g.fillRect(18, 12, 1, 2); g.fillRect(21, 12, 1, 2); g.fillRect(24, 12, 1, 2);

  // Shoulder spikes
  g.fillStyle(0x1a1a1a, 1);
  g.fillRect(3, 14, 4, 3); g.fillRect(6, 11, 3, 3);
  g.fillRect(33, 14, 4, 3); g.fillRect(31, 11, 3, 3);
  g.fillStyle(steelLit, 1);
  g.fillRect(3, 14, 1, 1); g.fillRect(36, 14, 1, 1);

  // Armored chestplate
  g.fillStyle(steel, 1); g.fillRect(9, 15, 22, 14);
  g.fillStyle(steelLit, 1);
  g.fillRect(9, 15, 22, 1); g.fillRect(9, 15, 1, 14);
  g.fillStyle(0x1a1a1a, 1);
  g.fillRect(9, 28, 22, 1);
  // Rivets
  g.fillStyle(0x1a1a1a, 1);
  g.fillRect(11, 17, 1, 1); g.fillRect(28, 17, 1, 1);
  g.fillRect(11, 26, 1, 1); g.fillRect(28, 26, 1, 1);
  // Central glowing crack down chestplate
  g.fillStyle(glow, 1);
  g.fillRect(19, 16, 2, 2); g.fillRect(20, 18, 1, 4); g.fillRect(19, 22, 2, 2); g.fillRect(20, 24, 1, 4);
  g.fillStyle(glowHot, 1);
  g.fillRect(20, 17, 1, 1); g.fillRect(20, 23, 1, 1);
  // Cross-chain / belt
  g.fillStyle(0x1a1a1a, 1);
  g.fillRect(9, 22, 22, 1);
  g.fillStyle(0x5a5a5a, 1);
  for (let cx = 10; cx < 30; cx += 3) g.fillRect(cx, 22, 1, 1);

  // Arms — big armored + flesh
  g.fillStyle(steel, 1); g.fillRect(1, 18, 6, 8); g.fillRect(33, 18, 6, 8);
  g.fillStyle(steelLit, 1); g.fillRect(1, 18, 6, 1); g.fillRect(33, 18, 6, 1);
  g.fillStyle(flesh, 1); g.fillRect(2, 26, 5, 4); g.fillRect(33, 26, 5, 4);
  g.fillStyle(fleshLit, 1); g.fillRect(2, 26, 1, 2); g.fillRect(37, 26, 1, 2);
  // Clawed fists
  g.fillStyle(0x1a1a1a, 1);
  g.fillRect(1, 30, 1, 2); g.fillRect(3, 30, 1, 2); g.fillRect(5, 30, 1, 2);
  g.fillRect(34, 30, 1, 2); g.fillRect(36, 30, 1, 2); g.fillRect(38, 30, 1, 2);

  // Legs — heavy greaves
  g.fillStyle(steel, 1); g.fillRect(11, 29, 7, 10); g.fillRect(22, 29, 7, 10);
  g.fillStyle(steelLit, 1); g.fillRect(11, 29, 7, 1); g.fillRect(22, 29, 7, 1);
  g.fillStyle(0x1a1a1a, 1); g.fillRect(11, 38, 7, 1); g.fillRect(22, 38, 7, 1);
  // Rune lines on legs
  g.fillStyle(glow, 1);
  g.fillRect(14, 32, 1, 3); g.fillRect(25, 32, 1, 3);
  // Boots
  g.fillStyle(0x0a0a0a, 1);
  g.fillRect(10, 39, 9, 4); g.fillRect(21, 39, 9, 4);
  g.fillStyle(steel, 1);
  g.fillRect(10, 39, 9, 1); g.fillRect(21, 39, 9, 1);

  outlineRect(g, 11, 3, 18, 12, 0x000000);
  outlineRect(g, 9, 15, 22, 14, 0x000000);

  g.generateTexture(key, W, H);
  g.destroy();
}

/** Helper — stroke a rectangle with 1-px pixel-art outline. */
function outlineRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number): void {
  g.fillStyle(color, 1);
  g.fillRect(x, y, w, 1);
  g.fillRect(x, y + h - 1, w, 1);
  g.fillRect(x, y, 1, h);
  g.fillRect(x + w - 1, y, 1, h);
}

interface Target {
  kind: 'path' | 'wall';
  tx: number;
  ty: number;
  committedMs: number;
}

export class Zombie {
  readonly sprite: Phaser.GameObjects.Image;
  hp: number;
  readonly maxHp: number;
  readonly damage: number;
  readonly speed: number;
  readonly variant: ZombieVariant;
  alive = true;
  private scene: Phaser.Scene;
  private world: World;
  private attackCooldownMs = 0;
  private walkPhase = Math.random() * Math.PI * 2;
  private repathCooldownMs = 0;
  private target: Target | null = null;
  private hpBarBg?: Phaser.GameObjects.Rectangle;
  private hpBarFg?: Phaser.GameObjects.Rectangle;
  private lavaBurnMs = 0;

  private shadow: Phaser.GameObjects.Ellipse;
  private shadowOffY = 0;

  constructor(scene: Phaser.Scene, world: World, worldX: number, worldY: number, spec: ZombieSpec) {
    this.scene = scene;
    this.world = world;
    const key =
      spec.variant === 'boss' ? 'zombie_boss' :
      spec.variant === 'fast' ? 'zombie_fast' :
      spec.variant === 'armored' ? 'zombie_armored' :
      spec.variant === 'brute' ? 'zombie_brute' :
      'zombie_normal';
    // Shadow dims are tuned to match (sprite height / 2) * scale for each variant
    // so the ellipse hugs the feet after the texture resize.
    const shadowW =
      spec.variant === 'boss' ? 60 :
      spec.variant === 'brute' ? 44 :
      spec.variant === 'armored' ? 32 :
      spec.variant === 'fast' ? 22 : 26;
    const shadowOffY =
      spec.variant === 'boss' ? 34 :
      spec.variant === 'brute' ? 26 :
      spec.variant === 'armored' ? 20 :
      spec.variant === 'fast' ? 16 : 18;
    const shadowH = spec.variant === 'boss' ? 10 : spec.variant === 'brute' ? 8 : 6;
    const shadowA = spec.variant === 'boss' ? 0.45 : spec.variant === 'brute' ? 0.4 : 0.35;
    this.shadow = scene.add.ellipse(worldX, worldY + shadowOffY, shadowW, shadowH, 0x000000, shadowA);
    this.shadow.setDepth(8);
    this.shadowOffY = shadowOffY;
    this.sprite = scene.add.image(worldX, worldY, key);
    const scale =
      spec.variant === 'boss' ? 1.8 :
      spec.variant === 'brute' ? 1.9 :
      spec.variant === 'armored' ? 1.6 :
      spec.variant === 'fast' ? 1.25 : 1.4;
    this.sprite.setScale(scale);
    this.sprite.setDepth(9);
    this.hp = spec.hp;
    this.maxHp = spec.hp;
    this.damage = spec.damage;
    this.speed = spec.speed;
    this.variant = spec.variant;
  }

  update(deltaMs: number, player: Player, neighbors: Zombie[]): void {
    if (!this.alive) return;
    if (this.attackCooldownMs > 0) this.attackCooldownMs -= deltaMs;
    if (this.repathCooldownMs > 0) this.repathCooldownMs -= deltaMs;
    if (this.target) this.target.committedMs -= deltaMs;

    // Lava damage to zombies (the zombie's tile type)
    const myTile = this.world.worldToTile(this.sprite.x, this.sprite.y);
    const myT = this.world.getTileAt(myTile.x, myTile.y);
    if (myT?.type === TileType.Lava) {
      this.lavaBurnMs -= deltaMs;
      if (this.lavaBurnMs <= 0) {
        this.takeDamage(5);
        this.lavaBurnMs = 200;
      }
    }

    const selfTile = this.world.worldToTile(this.sprite.x, this.sprite.y);
    const playerTile = this.world.worldToTile(player.x, player.y);

    // In-range melee on player
    const dxP = player.x - this.sprite.x;
    const dyP = player.y - this.sprite.y;
    const distPx = Math.hypot(dxP, dyP);
    if (distPx <= TILE_SIZE * 0.7) {
      if (this.attackCooldownMs <= 0) {
        player.hurt(this.damage);
        this.attackCooldownMs = 700;
        this.scene.tweens.add({ targets: this.sprite, scaleX: this.sprite.scaleX * 1.15, duration: 80, yoyo: true });
        this.scene.events.emit('zombie_hit_player', this.sprite.x, this.sprite.y);
      }
      return;
    }

    // Pathfind periodically
    if (!this.target || this.target.committedMs <= 0 || this.repathCooldownMs <= 0) {
      const next = bfsNextStep(this.world, selfTile, playerTile, true);
      if (next) {
        const nextTile = this.world.getTileAt(next.x, next.y);
        if (nextTile && !this.world.isWalkable(next.x, next.y)) {
          // Next step is a wall — commit to breaking it
          this.target = { kind: 'wall', tx: next.x, ty: next.y, committedMs: 1400 };
        } else {
          this.target = { kind: 'path', tx: next.x, ty: next.y, committedMs: 400 };
        }
      } else {
        this.target = null;
      }
      this.repathCooldownMs = 350 + Math.random() * 150;
    }

    if (!this.target) {
      // No path. Drift toward player directly.
      this.moveContinuous(dxP, dyP, 1, deltaMs, neighbors);
      return;
    }

    if (this.target.kind === 'wall') {
      const t = this.world.getTileAt(this.target.tx, this.target.ty);
      if (!t || this.world.isWalkable(this.target.tx, this.target.ty)) {
        this.target = null;
        return;
      }
      const target = this.world.tileToWorldCenter(this.target.tx, this.target.ty);
      const dx = target.x - this.sprite.x;
      const dy = target.y - this.sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= TILE_SIZE * 0.85) {
        // Within striking range — attack the wall
        if (this.attackCooldownMs <= 0) {
          const broke = this.world.damageTile(this.target.tx, this.target.ty, Math.ceil(this.damage / 1.6));
          this.attackCooldownMs = 550;
          this.scene.events.emit('zombie_hit_wall', target.x, target.y, t.type);
          if (broke) {
            this.scene.events.emit('wall_broken', this.target.tx, this.target.ty, t.type);
            this.target = null;
          }
        }
        // Slight bob in place
        this.walkPhase += deltaMs / 140;
        this.sprite.setRotation(Math.sin(this.walkPhase) * 0.12);
      } else {
        this.moveContinuous(dx, dy, 1, deltaMs, neighbors);
      }
    } else {
      const target = this.world.tileToWorldCenter(this.target.tx, this.target.ty);
      const dx = target.x - this.sprite.x;
      const dy = target.y - this.sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 4) {
        this.target.committedMs = 0;
      } else {
        this.moveContinuous(dx, dy, 1, deltaMs, neighbors);
      }
    }
  }

  /**
   * Move with steering toward (dx, dy) + repulsion from neighbors so zombies don't clump.
   */
  private moveContinuous(dx: number, dy: number, desire: number, deltaMs: number, neighbors: Zombie[]): void {
    const mag = Math.hypot(dx, dy) || 1;
    let vx = (dx / mag) * desire;
    let vy = (dy / mag) * desire;

    // Separation: push away from neighbors that are too close
    const sepRadius = TILE_SIZE * 0.6;
    for (const other of neighbors) {
      if (other === this || !other.alive) continue;
      const odx = this.sprite.x - other.sprite.x;
      const ody = this.sprite.y - other.sprite.y;
      const od = Math.hypot(odx, ody);
      if (od > 0 && od < sepRadius) {
        const push = (sepRadius - od) / sepRadius;
        vx += (odx / od) * push * 0.75;
        vy += (ody / od) * push * 0.75;
      }
    }

    const m2 = Math.hypot(vx, vy) || 1;
    vx /= m2;
    vy /= m2;
    const step = (this.speed * deltaMs) / 1000;
    const nextX = this.sprite.x + vx * step;
    const nextY = this.sprite.y + vy * step;

    if (this.canStand(nextX, nextY)) {
      this.sprite.x = nextX;
      this.sprite.y = nextY;
    } else if (this.canStand(nextX, this.sprite.y)) {
      this.sprite.x = nextX;
    } else if (this.canStand(this.sprite.x, nextY)) {
      this.sprite.y = nextY;
    } else {
      // Totally blocked — try to damage the tile ahead (fallback)
      const probe = Math.abs(vx) > Math.abs(vy)
        ? this.world.worldToTile(nextX, this.sprite.y)
        : this.world.worldToTile(this.sprite.x, nextY);
      const t = this.world.getTileAt(probe.x, probe.y);
      if (t && !this.world.isWalkable(probe.x, probe.y) && t.type !== TileType.ShopNPC && this.attackCooldownMs <= 0) {
        this.world.damageTile(probe.x, probe.y, Math.ceil(this.damage / 1.6));
        this.attackCooldownMs = 550;
        this.scene.events.emit('zombie_hit_wall', probe.x * TILE_SIZE + TILE_SIZE / 2, probe.y * TILE_SIZE + TILE_SIZE / 2, t.type);
      }
    }

    this.sprite.setFlipX(vx < 0);
    this.walkPhase += (deltaMs / 1000) * (6 + this.speed / 40);
    const bob = Math.sin(this.walkPhase) * 1.5;
    this.sprite.setRotation(Math.sin(this.walkPhase) * 0.08);
    this.sprite.y += bob - (this.sprite.getData('lastBob') ?? 0);
    this.sprite.setData('lastBob', bob);
    this.shadow.setPosition(this.sprite.x, this.sprite.y + this.shadowOffY);
  }

  private canStand(wx: number, wy: number): boolean {
    const half = 7;
    const corners: [number, number][] = [
      [wx - half, wy - half],
      [wx + half, wy - half],
      [wx - half, wy + half],
      [wx + half, wy + half],
    ];
    for (const [cx, cy] of corners) {
      const tp = this.world.worldToTile(cx, cy);
      if (!this.world.isWalkable(tp.x, tp.y)) {
        // Lava is walkable — zombies that step on it will take damage (we apply below in take-effect)
        const tt = this.world.getTileAt(tp.x, tp.y);
        if (!tt || TILE_SPECS[tt.type].walkable === false) return false;
      }
    }
    return true;
  }

  distanceToPlayer(player: Player): number {
    return Math.hypot(player.x - this.sprite.x, player.y - this.sprite.y);
  }

  takeDamage(amount: number): boolean {
    this.hp -= amount;
    this.sprite.setTint(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (this.alive) this.sprite.clearTint();
    });
    this.showHpBar();
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  private showHpBar(): void {
    if (!this.hpBarBg) {
      this.hpBarBg = this.scene.add.rectangle(this.sprite.x, this.sprite.y - 22, 24, 4, 0x000000, 0.7).setDepth(20);
      this.hpBarFg = this.scene.add.rectangle(this.sprite.x, this.sprite.y - 22, 22, 2, 0xff4444, 1).setDepth(21);
    }
    const pct = Math.max(0, this.hp) / this.maxHp;
    this.hpBarBg!.setPosition(this.sprite.x, this.sprite.y - 22);
    this.hpBarFg!.setPosition(this.sprite.x - 11 + (22 * pct) / 2, this.sprite.y - 22);
    this.hpBarFg!.width = 22 * pct;
    this.hpBarFg!.fillColor = pct > 0.5 ? 0x44dd44 : pct > 0.2 ? 0xddcc33 : 0xff4444;
  }

  die(): void {
    this.alive = false;
    if (this.hpBarBg) this.hpBarBg.destroy();
    if (this.hpBarFg) this.hpBarFg.destroy();
    this.shadow.destroy();
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 0.1,
      scaleY: 0.1,
      alpha: 0,
      angle: 180,
      duration: 240,
      onComplete: () => this.sprite.destroy(),
    });
  }
}
