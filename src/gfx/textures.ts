import Phaser from 'phaser';

/**
 * Generates all pixel-art textures used by the game at preload time.
 * Each helper paints onto a temporary Graphics object, generates a texture with
 * a stable key, then destroys the Graphics. pixelArt: true in the game config
 * guarantees crisp nearest-neighbor scaling.
 */
export const TEX = {
  player: 'player',
  grass_tuft: 'grass_tuft',
  dirt: 'dirt',
  tree: 'tree',
  stone: 'stone',
  iron_ore: 'iron_ore',
  gold_ore: 'gold_ore',
  wall_wood: 'wall_wood',
  wall_stone: 'wall_stone',
  wall_iron: 'wall_iron',
  door_wood: 'door_wood',
  door_wood_open: 'door_wood_open',
  door_iron: 'door_iron',
  door_iron_open: 'door_iron_open',
  torch: 'torch',
  turret_basic: 'turret_basic',
  turret_advanced: 'turret_advanced',
  crafting_bench: 'crafting_bench',
  chest: 'chest',
  lava: 'lava',
  shop_npc: 'shop_npc',
  arrow: 'arrow',
  bullet: 'bullet',
  particle: 'particle',
  water: 'water',
  sand: 'sand',
  dead_tree: 'dead_tree',
  campfire: 'campfire',
  cake: 'cake',
  flower_field: 'flower_field',
  mushroom: 'mushroom',
  pumpkin: 'pumpkin',
  dog: 'dog',
  weapon_pickaxe: 'weapon_pickaxe',
  weapon_sword: 'weapon_sword',
  weapon_bow: 'weapon_bow',
  weapon_pistol: 'weapon_pistol',
  rain_drop: 'rain_drop',
  raindrop: 'raindrop',
  trophy: 'trophy',
  chicken: 'chicken',
  food: 'food',
  star: 'star',
  volcano: 'volcano',
  crater: 'crater',
  meteor: 'meteor',
} as const;

export function generateAllTextures(scene: Phaser.Scene): void {
  make(scene, TEX.particle, 4, 4, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 4, 4);
  });

  make(scene, TEX.player, 18, 24, (g) => {
    // body
    g.fillStyle(0x2f6fd6, 1); g.fillRect(4, 9, 10, 10);
    // head
    g.fillStyle(0xfcd7a1, 1); g.fillRect(5, 2, 8, 8);
    // hair
    g.fillStyle(0x4a2a10, 1); g.fillRect(5, 2, 8, 2);
    // eyes
    g.fillStyle(0x000000, 1); g.fillRect(7, 5, 1, 1); g.fillRect(10, 5, 1, 1);
    // arms
    g.fillStyle(0xfcd7a1, 1); g.fillRect(2, 11, 2, 6); g.fillRect(14, 11, 2, 6);
    // belt
    g.fillStyle(0x4a2a10, 1); g.fillRect(4, 18, 10, 1);
    // legs
    g.fillStyle(0x333333, 1); g.fillRect(5, 19, 3, 4); g.fillRect(10, 19, 3, 4);
    // boots
    g.fillStyle(0x1a1a1a, 1); g.fillRect(4, 22, 4, 2); g.fillRect(10, 22, 4, 2);
    outline(g, 4, 9, 10, 10, 0x1a1a1a);
    outline(g, 5, 2, 8, 8, 0x1a1a1a);
  });

  make(scene, TEX.grass_tuft, 32, 32, (g) => {
    g.fillStyle(0x5bbd5b, 1); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x4ca64a, 1);
    g.fillRect(4, 6, 2, 3); g.fillRect(18, 22, 2, 3); g.fillRect(26, 10, 2, 3);
    g.fillRect(12, 18, 2, 2); g.fillRect(8, 26, 2, 2);
    g.fillStyle(0x7bdd7b, 1);
    g.fillRect(3, 5, 1, 1); g.fillRect(19, 21, 1, 1); g.fillRect(27, 9, 1, 1);
  });

  make(scene, TEX.dirt, 32, 32, (g) => {
    g.fillStyle(0x7a4a2b, 1); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x644020, 1);
    g.fillRect(4, 4, 2, 2); g.fillRect(20, 8, 2, 2); g.fillRect(10, 22, 2, 2); g.fillRect(24, 24, 2, 2);
    g.fillStyle(0x8d5d3e, 1);
    g.fillRect(14, 10, 1, 1); g.fillRect(6, 18, 1, 1); g.fillRect(26, 14, 1, 1);
  });

  make(scene, TEX.tree, 32, 38, (g) => {
    // trunk
    g.fillStyle(0x5a3a1b, 1); g.fillRect(14, 22, 4, 12);
    g.fillStyle(0x3d2410, 1); g.fillRect(14, 22, 1, 12);
    // canopy
    g.fillStyle(0x2e7d32, 1); g.fillRect(6, 4, 20, 18);
    g.fillStyle(0x3e9736, 1);
    g.fillRect(8, 6, 4, 4); g.fillRect(18, 10, 3, 4); g.fillRect(22, 6, 2, 3); g.fillRect(12, 14, 3, 3);
    g.fillStyle(0x1d5820, 1);
    g.fillRect(6, 18, 20, 2); g.fillRect(6, 4, 2, 18); g.fillRect(24, 4, 2, 18);
    outline(g, 6, 4, 20, 18, 0x111111);
    // roots
    g.fillStyle(0x3d2410, 1); g.fillRect(12, 33, 8, 2);
  });

  make(scene, TEX.stone, 32, 32, (g) => {
    g.fillStyle(0x8a8a8a, 1); g.fillRect(2, 2, 28, 28);
    g.fillStyle(0x6f6f6f, 1); g.fillRect(2, 24, 28, 6); g.fillRect(2, 2, 2, 28);
    g.fillStyle(0xa8a8a8, 1); g.fillRect(4, 4, 26, 2);
    g.fillStyle(0x5c5c5c, 1);
    g.fillRect(10, 10, 2, 2); g.fillRect(20, 14, 3, 2); g.fillRect(6, 20, 2, 2); g.fillRect(22, 22, 2, 2);
    outline(g, 2, 2, 28, 28, 0x2a2a2a);
  });

  make(scene, TEX.iron_ore, 32, 32, (g) => {
    // stone base
    g.fillStyle(0x8a8a8a, 1); g.fillRect(2, 2, 28, 28);
    g.fillStyle(0x6f6f6f, 1); g.fillRect(2, 24, 28, 6);
    outline(g, 2, 2, 28, 28, 0x2a2a2a);
    // iron nodules
    g.fillStyle(0xc9b037, 1);
    g.fillRect(7, 8, 4, 3); g.fillRect(18, 6, 5, 4); g.fillRect(10, 18, 6, 3); g.fillRect(20, 20, 4, 3);
    g.fillStyle(0xe7cf52, 1);
    g.fillRect(7, 8, 2, 1); g.fillRect(18, 6, 3, 1); g.fillRect(10, 18, 2, 1);
    g.fillStyle(0x8e7920, 1);
    g.fillRect(7, 10, 4, 1); g.fillRect(18, 9, 5, 1); g.fillRect(10, 20, 6, 1);
  });

  make(scene, TEX.gold_ore, 32, 32, (g) => {
    g.fillStyle(0x8a8a8a, 1); g.fillRect(2, 2, 28, 28);
    g.fillStyle(0x6f6f6f, 1); g.fillRect(2, 24, 28, 6);
    outline(g, 2, 2, 28, 28, 0x2a2a2a);
    g.fillStyle(0xffd700, 1);
    g.fillRect(7, 7, 5, 4); g.fillRect(18, 8, 4, 3); g.fillRect(8, 18, 4, 3); g.fillRect(18, 18, 6, 4);
    g.fillStyle(0xfff0a0, 1);
    g.fillRect(7, 7, 3, 1); g.fillRect(18, 8, 2, 1); g.fillRect(18, 18, 3, 1);
    g.fillStyle(0xa17700, 1);
    g.fillRect(7, 10, 5, 1); g.fillRect(18, 10, 4, 1); g.fillRect(18, 21, 6, 1);
  });

  make(scene, TEX.wall_wood, 32, 32, (g) => {
    g.fillStyle(0x9c6a3f, 1); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x7a4e2b, 1);
    g.fillRect(0, 0, 32, 2); g.fillRect(0, 15, 32, 2); g.fillRect(0, 30, 32, 2);
    g.fillRect(0, 0, 2, 32); g.fillRect(16, 0, 2, 32);
    g.fillStyle(0x6a3e20, 1);
    g.fillRect(4, 4, 1, 10); g.fillRect(20, 4, 1, 10); g.fillRect(4, 19, 1, 10); g.fillRect(20, 19, 1, 10);
    g.fillStyle(0xb98460, 1);
    g.fillRect(6, 6, 8, 1); g.fillRect(22, 6, 8, 1);
    outline(g, 0, 0, 32, 32, 0x1a1a1a);
  });

  make(scene, TEX.wall_stone, 32, 32, (g) => {
    g.fillStyle(0x707070, 1); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x5a5a5a, 1);
    // brick pattern
    g.fillRect(0, 0, 32, 1); g.fillRect(0, 10, 32, 1); g.fillRect(0, 21, 32, 1); g.fillRect(0, 31, 32, 1);
    g.fillRect(0, 0, 1, 10); g.fillRect(16, 0, 1, 10);
    g.fillRect(0, 11, 1, 10); g.fillRect(8, 11, 1, 10); g.fillRect(24, 11, 1, 10);
    g.fillRect(0, 22, 1, 10); g.fillRect(16, 22, 1, 10);
    g.fillStyle(0x858585, 1);
    g.fillRect(2, 2, 12, 1); g.fillRect(18, 2, 12, 1); g.fillRect(10, 13, 12, 1);
    outline(g, 0, 0, 32, 32, 0x2a2a2a);
  });

  make(scene, TEX.wall_iron, 32, 32, (g) => {
    g.fillStyle(0xb0b0c0, 1); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x8e8ea2, 1);
    g.fillRect(0, 0, 32, 2); g.fillRect(0, 30, 32, 2);
    g.fillRect(0, 0, 2, 32); g.fillRect(30, 0, 2, 32);
    g.fillRect(14, 4, 4, 24); g.fillRect(4, 14, 24, 4);
    g.fillStyle(0xcacadd, 1);
    g.fillRect(6, 6, 6, 6); g.fillRect(20, 6, 6, 6); g.fillRect(6, 20, 6, 6); g.fillRect(20, 20, 6, 6);
    // rivets
    g.fillStyle(0x3a3a4a, 1);
    g.fillRect(5, 5, 1, 1); g.fillRect(26, 5, 1, 1); g.fillRect(5, 26, 1, 1); g.fillRect(26, 26, 1, 1);
    outline(g, 0, 0, 32, 32, 0x1a1a2a);
  });

  make(scene, TEX.door_wood, 32, 32, (g) => {
    g.fillStyle(0x7a4e2b, 1); g.fillRect(4, 2, 24, 28);
    g.fillStyle(0x9c6a3f, 1); g.fillRect(6, 4, 20, 24);
    g.fillStyle(0x5a3a1b, 1); g.fillRect(6, 14, 20, 2);
    g.fillStyle(0xffd700, 1); g.fillRect(22, 15, 2, 2); // knob
    outline(g, 4, 2, 24, 28, 0x1a1a1a);
  });

  make(scene, TEX.door_wood_open, 32, 32, (g) => {
    g.fillStyle(0x4a2e1b, 0.5); g.fillRect(4, 2, 4, 28);
    g.fillStyle(0x4a2e1b, 0.5); g.fillRect(24, 2, 4, 28);
  });

  make(scene, TEX.door_iron, 32, 32, (g) => {
    g.fillStyle(0x8e8ea2, 1); g.fillRect(4, 2, 24, 28);
    g.fillStyle(0xb0b0c0, 1); g.fillRect(6, 4, 20, 24);
    g.fillStyle(0x3a3a4a, 1);
    g.fillRect(7, 6, 1, 1); g.fillRect(24, 6, 1, 1); g.fillRect(7, 25, 1, 1); g.fillRect(24, 25, 1, 1);
    g.fillRect(6, 14, 20, 1); g.fillRect(6, 16, 20, 1);
    g.fillStyle(0xffd700, 1); g.fillRect(22, 15, 2, 2);
    outline(g, 4, 2, 24, 28, 0x1a1a2a);
  });

  make(scene, TEX.door_iron_open, 32, 32, (g) => {
    g.fillStyle(0x4a4a5a, 0.5); g.fillRect(4, 2, 4, 28);
    g.fillStyle(0x4a4a5a, 0.5); g.fillRect(24, 2, 4, 28);
  });

  make(scene, TEX.torch, 16, 26, (g) => {
    // handle
    g.fillStyle(0x5a3a1b, 1); g.fillRect(6, 10, 4, 14);
    g.fillStyle(0x3d2410, 1); g.fillRect(6, 22, 4, 2);
    // flame body
    g.fillStyle(0xff9030, 1); g.fillRect(5, 2, 6, 8);
    g.fillStyle(0xffd27a, 1); g.fillRect(6, 4, 4, 5);
    g.fillStyle(0xfff5c0, 1); g.fillRect(7, 6, 2, 2);
    // base tip
    g.fillStyle(0x2a1a0a, 1); g.fillRect(7, 9, 2, 2);
  });

  make(scene, TEX.turret_basic, 32, 32, (g) => {
    // base
    g.fillStyle(0x6a6a7a, 1); g.fillRect(6, 20, 20, 10);
    g.fillStyle(0x4a4a5a, 1); g.fillRect(6, 28, 20, 2);
    // dome
    g.fillStyle(0x4d7fff, 1); g.fillRect(10, 12, 12, 10);
    g.fillStyle(0x7099ff, 1); g.fillRect(11, 13, 10, 3);
    g.fillStyle(0x2f54b2, 1); g.fillRect(10, 20, 12, 2);
    // bolts
    g.fillStyle(0x2a2a3a, 1);
    g.fillRect(8, 22, 1, 1); g.fillRect(23, 22, 1, 1); g.fillRect(8, 27, 1, 1); g.fillRect(23, 27, 1, 1);
    outline(g, 6, 12, 20, 18, 0x1a1a2a);
  });

  make(scene, TEX.turret_advanced, 32, 32, (g) => {
    g.fillStyle(0x5a4a6a, 1); g.fillRect(6, 20, 20, 10);
    g.fillStyle(0x3a2a4a, 1); g.fillRect(6, 28, 20, 2);
    g.fillStyle(0x8040ff, 1); g.fillRect(10, 10, 12, 12);
    g.fillStyle(0xa270ff, 1); g.fillRect(11, 11, 10, 4);
    g.fillStyle(0x5a20b2, 1); g.fillRect(10, 20, 12, 2);
    g.fillStyle(0xffd700, 1); g.fillRect(13, 14, 6, 2);
    outline(g, 6, 10, 20, 20, 0x1a0a2a);
  });

  make(scene, TEX.crafting_bench, 32, 26, (g) => {
    g.fillStyle(0xb5651d, 1); g.fillRect(2, 6, 28, 14);
    g.fillStyle(0x8b4513, 1); g.fillRect(2, 18, 28, 2);
    g.fillStyle(0x8b4513, 1); g.fillRect(4, 20, 3, 6); g.fillRect(25, 20, 3, 6);
    // tools on top
    g.fillStyle(0x8a8a8a, 1); g.fillRect(8, 3, 2, 4); g.fillRect(7, 2, 4, 2); // hammer head
    g.fillStyle(0x5a3a1b, 1); g.fillRect(9, 5, 1, 6); // hammer handle
    g.fillStyle(0xc9b037, 1); g.fillRect(18, 3, 6, 3); // saw
    g.fillStyle(0x5a3a1b, 1); g.fillRect(24, 4, 3, 1);
    outline(g, 2, 6, 28, 14, 0x3d2410);
  });

  make(scene, TEX.chest, 32, 26, (g) => {
    g.fillStyle(0x6b4423, 1); g.fillRect(4, 6, 24, 18);
    g.fillStyle(0x8a5a30, 1); g.fillRect(4, 6, 24, 2);
    g.fillStyle(0x4a2a10, 1); g.fillRect(4, 22, 24, 2);
    // metal bands
    g.fillStyle(0x3a3a4a, 1); g.fillRect(4, 12, 24, 2); g.fillRect(6, 6, 2, 18); g.fillRect(24, 6, 2, 18);
    // lock
    g.fillStyle(0xffd700, 1); g.fillRect(14, 14, 4, 4);
    g.fillStyle(0x5a4000, 1); g.fillRect(15, 15, 2, 2);
    outline(g, 4, 6, 24, 18, 0x1a1a1a);
  });

  make(scene, TEX.lava, 32, 32, (g) => {
    g.fillStyle(0xb01a00, 1); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0xff4d1a, 1); g.fillRect(2, 2, 28, 28);
    g.fillStyle(0xff8030, 1);
    g.fillRect(4, 6, 8, 4); g.fillRect(18, 4, 8, 6); g.fillRect(6, 20, 10, 4); g.fillRect(20, 22, 6, 4);
    g.fillStyle(0xffdd60, 1);
    g.fillRect(6, 7, 4, 1); g.fillRect(20, 5, 4, 1); g.fillRect(8, 21, 4, 1); g.fillRect(22, 23, 2, 1);
    g.fillStyle(0x800a00, 1);
    g.fillRect(10, 16, 2, 2); g.fillRect(24, 14, 2, 2);
  });

  make(scene, TEX.shop_npc, 20, 26, (g) => {
    // body
    g.fillStyle(0x6a4a8a, 1); g.fillRect(4, 10, 12, 12);
    // gold trim
    g.fillStyle(0xffd700, 1); g.fillRect(4, 10, 12, 1); g.fillRect(4, 20, 12, 2);
    // head
    g.fillStyle(0xf5cc97, 1); g.fillRect(5, 2, 10, 8);
    g.fillStyle(0x000000, 1); g.fillRect(7, 5, 1, 1); g.fillRect(12, 5, 1, 1);
    // smiling mouth
    g.fillStyle(0x7a2a2a, 1); g.fillRect(9, 8, 2, 1);
    // hat (merchant)
    g.fillStyle(0x4a2a10, 1); g.fillRect(4, 0, 12, 3); g.fillRect(2, 2, 16, 1);
    g.fillStyle(0xffd700, 1); g.fillRect(9, 0, 2, 3);
    // arms
    g.fillStyle(0xf5cc97, 1); g.fillRect(2, 12, 2, 5); g.fillRect(16, 12, 2, 5);
    // coin in hand
    g.fillStyle(0xffd700, 1); g.fillRect(17, 17, 3, 3);
    g.fillStyle(0xa17700, 1); g.fillRect(17, 19, 3, 1);
    // feet
    g.fillStyle(0x1a1a1a, 1); g.fillRect(5, 22, 4, 3); g.fillRect(11, 22, 4, 3);
    outline(g, 4, 10, 12, 12, 0x1a1a1a);
    outline(g, 5, 2, 10, 8, 0x1a1a1a);
  });

  make(scene, TEX.arrow, 16, 4, (g) => {
    g.fillStyle(0x8c6a3f, 1); g.fillRect(1, 1, 10, 2);
    g.fillStyle(0xdddddd, 1); g.fillRect(11, 0, 3, 4);
    g.fillStyle(0xffffff, 1); g.fillRect(13, 1, 1, 2);
    g.fillStyle(0xcc3333, 1); g.fillRect(0, 0, 2, 4);
  });

  make(scene, TEX.bullet, 8, 4, (g) => {
    g.fillStyle(0xffaa00, 1); g.fillRect(1, 1, 6, 2);
    g.fillStyle(0xffdd80, 1); g.fillRect(2, 1, 4, 1);
    g.fillStyle(0xff6600, 1); g.fillRect(0, 1, 1, 2);
  });

  make(scene, TEX.water, 32, 32, (g) => {
    g.fillStyle(0x3e6db0, 1); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x5388c5, 1);
    g.fillRect(2, 4, 6, 2); g.fillRect(14, 10, 8, 2); g.fillRect(24, 4, 4, 2);
    g.fillRect(4, 20, 8, 2); g.fillRect(18, 24, 6, 2); g.fillRect(2, 28, 4, 2);
    g.fillStyle(0xb9d5f2, 1);
    g.fillRect(4, 4, 2, 1); g.fillRect(16, 10, 2, 1); g.fillRect(6, 20, 2, 1); g.fillRect(22, 24, 2, 1);
    g.fillStyle(0x2f5892, 1);
    g.fillRect(0, 0, 32, 1); g.fillRect(0, 31, 32, 1);
  });

  make(scene, TEX.sand, 32, 32, (g) => {
    g.fillStyle(0xe0cf8a, 1); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0xc9b867, 1);
    g.fillRect(5, 7, 2, 1); g.fillRect(18, 3, 1, 2); g.fillRect(23, 14, 2, 1);
    g.fillRect(9, 21, 1, 2); g.fillRect(26, 25, 2, 1); g.fillRect(13, 28, 1, 1);
    g.fillStyle(0xf0e0a8, 1);
    g.fillRect(12, 12, 1, 1); g.fillRect(22, 18, 1, 1); g.fillRect(6, 26, 1, 1);
  });

  make(scene, TEX.dead_tree, 32, 38, (g) => {
    g.fillStyle(0x4a3010, 1); g.fillRect(14, 14, 4, 20);
    g.fillStyle(0x6b4423, 1); g.fillRect(14, 14, 1, 20);
    // gnarled branches
    g.fillStyle(0x4a3010, 1);
    g.fillRect(6, 10, 8, 2); g.fillRect(6, 10, 2, 6);
    g.fillRect(18, 6, 8, 2); g.fillRect(24, 6, 2, 7);
    g.fillRect(12, 4, 2, 6); g.fillRect(10, 4, 6, 2);
    outline(g, 14, 14, 4, 20, 0x1a1a1a);
    g.fillStyle(0x3d2410, 1); g.fillRect(12, 33, 8, 2);
  });

  make(scene, TEX.campfire, 32, 28, (g) => {
    // Stones ring
    g.fillStyle(0x8a8a8a, 1);
    g.fillRect(4, 20, 6, 4); g.fillRect(22, 20, 6, 4); g.fillRect(12, 22, 8, 3);
    g.fillStyle(0x5a5a5a, 1); g.fillRect(4, 23, 6, 1); g.fillRect(22, 23, 6, 1);
    // Logs (crossed)
    g.fillStyle(0x5a3a1b, 1);
    g.fillRect(10, 18, 12, 2); g.fillRect(10, 15, 12, 2);
    g.fillStyle(0x8a5a30, 1); g.fillRect(10, 15, 12, 1);
    // Flame
    g.fillStyle(0xff6020, 1); g.fillRect(11, 6, 10, 10);
    g.fillStyle(0xffaa33, 1); g.fillRect(13, 8, 6, 7);
    g.fillStyle(0xffee88, 1); g.fillRect(14, 11, 4, 3);
    g.fillStyle(0xffffff, 1); g.fillRect(15, 12, 2, 1);
  });

  make(scene, TEX.cake, 28, 26, (g) => {
    // plate
    g.fillStyle(0xe6e6e6, 1); g.fillRect(2, 22, 24, 3);
    g.fillStyle(0xaaaaaa, 1); g.fillRect(2, 24, 24, 1);
    // bottom layer
    g.fillStyle(0x8b4513, 1); g.fillRect(4, 16, 20, 7);
    // frosting drip
    g.fillStyle(0xffb6c1, 1); g.fillRect(4, 15, 20, 2);
    g.fillRect(6, 17, 1, 1); g.fillRect(12, 17, 1, 2); g.fillRect(18, 17, 1, 1);
    // top layer
    g.fillStyle(0xffc0cb, 1); g.fillRect(8, 8, 12, 8);
    g.fillStyle(0xffffff, 1); g.fillRect(8, 8, 12, 1);
    // candles
    g.fillStyle(0xff9aa2, 1); g.fillRect(10, 4, 2, 4);
    g.fillStyle(0x8aa0ff, 1); g.fillRect(14, 4, 2, 4);
    g.fillStyle(0xffd166, 1); g.fillRect(18, 4, 2, 4);
    // flames
    g.fillStyle(0xffaa33, 1); g.fillRect(10, 2, 2, 2); g.fillRect(14, 2, 2, 2); g.fillRect(18, 2, 2, 2);
    g.fillStyle(0xffee88, 1); g.fillRect(10, 3, 2, 1); g.fillRect(14, 3, 2, 1); g.fillRect(18, 3, 2, 1);
    // sprinkles on top
    g.fillStyle(0xff4d88, 1); g.fillRect(9, 10, 1, 1); g.fillRect(13, 12, 1, 1); g.fillRect(17, 10, 1, 1);
    g.fillStyle(0x7fce7f, 1); g.fillRect(11, 11, 1, 1); g.fillRect(15, 13, 1, 1); g.fillRect(19, 11, 1, 1);
  });

  make(scene, TEX.flower_field, 32, 32, (g) => {
    g.fillStyle(0x5bbd5b, 1); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x4ca64a, 1);
    g.fillRect(5, 5, 1, 1); g.fillRect(27, 9, 1, 1); g.fillRect(11, 27, 1, 1);
    // Flowers
    const spots: [number, number, number][] = [
      [4, 10, 0xff4d88], [10, 5, 0xffd166], [17, 10, 0xffffff],
      [25, 6, 0xff66aa], [8, 20, 0xffc0cb], [20, 18, 0xff4d88],
      [26, 22, 0x8aa0ff], [14, 26, 0xffd166], [4, 25, 0xffffff],
    ];
    for (const [x, y, c] of spots) {
      g.fillStyle(0x3a7a3a, 1); g.fillRect(x, y, 1, 2);
      g.fillStyle(c, 1); g.fillRect(x - 1, y - 2, 3, 3);
      g.fillStyle(0xffee88, 1); g.fillRect(x, y - 1, 1, 1);
    }
  });

  make(scene, TEX.mushroom, 24, 24, (g) => {
    // stem
    g.fillStyle(0xf0e0c0, 1); g.fillRect(10, 14, 4, 8);
    g.fillStyle(0xc4b090, 1); g.fillRect(10, 14, 1, 8);
    // cap
    g.fillStyle(0xd04040, 1); g.fillRect(6, 6, 12, 10);
    g.fillStyle(0xa82828, 1); g.fillRect(6, 14, 12, 2);
    // cap spots
    g.fillStyle(0xffffff, 1);
    g.fillRect(8, 8, 2, 2); g.fillRect(13, 10, 2, 2); g.fillRect(10, 12, 2, 1);
    outline(g, 6, 6, 12, 10, 0x1a1a1a);
  });

  make(scene, TEX.pumpkin, 28, 24, (g) => {
    g.fillStyle(0xff8c00, 1); g.fillRect(4, 8, 20, 14);
    g.fillStyle(0xdd6a00, 1); g.fillRect(4, 8, 2, 14); g.fillRect(11, 8, 2, 14); g.fillRect(18, 8, 2, 14);
    g.fillStyle(0xffaa40, 1); g.fillRect(6, 9, 5, 1); g.fillRect(13, 9, 5, 1); g.fillRect(20, 9, 3, 1);
    // stem
    g.fillStyle(0x3a7a3a, 1); g.fillRect(12, 5, 4, 3);
    g.fillStyle(0x4a9a4a, 1); g.fillRect(12, 5, 1, 3);
    // leaf
    g.fillStyle(0x5bbd5b, 1); g.fillRect(16, 5, 4, 2);
    outline(g, 4, 8, 20, 14, 0x1a1a1a);
  });

  // Companion dog — small brown pup with floppy ears and wagging tail
  make(scene, TEX.dog, 22, 16, (g) => {
    // body
    g.fillStyle(0xb07a3c, 1); g.fillRect(4, 6, 14, 7);
    // chest + belly highlight
    g.fillStyle(0xc89560, 1); g.fillRect(5, 8, 12, 2);
    // head
    g.fillStyle(0xb07a3c, 1); g.fillRect(14, 3, 7, 7);
    // snout
    g.fillStyle(0xa0682b, 1); g.fillRect(18, 7, 4, 3);
    // nose
    g.fillStyle(0x1a1a1a, 1); g.fillRect(20, 7, 2, 1);
    // eye
    g.fillStyle(0x1a1a1a, 1); g.fillRect(17, 5, 1, 1);
    // ear
    g.fillStyle(0x8a5a28, 1); g.fillRect(14, 2, 3, 4);
    // tail up/wagging
    g.fillStyle(0xb07a3c, 1); g.fillRect(2, 4, 3, 4);
    g.fillRect(0, 3, 3, 2);
    // legs
    g.fillStyle(0x8a5a28, 1); g.fillRect(5, 13, 2, 3); g.fillRect(9, 13, 2, 3); g.fillRect(13, 13, 2, 3); g.fillRect(16, 13, 2, 3);
    // collar
    g.fillStyle(0xcc3333, 1); g.fillRect(13, 7, 2, 2);
    g.fillStyle(0xffd700, 1); g.fillRect(13, 8, 1, 1);
    outline(g, 4, 6, 14, 7, 0x1a1a1a);
    outline(g, 14, 3, 7, 7, 0x1a1a1a);
  });

  // Weapons shown in the player's hand
  make(scene, TEX.weapon_pickaxe, 12, 12, (g) => {
    g.fillStyle(0x5a3a1b, 1); g.fillRect(2, 6, 7, 1); // handle
    g.fillStyle(0x8a8a8a, 1); g.fillRect(0, 4, 3, 5); // head
    g.fillStyle(0xbababa, 1); g.fillRect(0, 4, 3, 1);
    g.fillStyle(0x5a5a5a, 1); g.fillRect(0, 7, 3, 2);
  });

  make(scene, TEX.weapon_sword, 14, 14, (g) => {
    g.fillStyle(0x5a3a1b, 1); g.fillRect(1, 9, 3, 3); // grip
    g.fillStyle(0xffd700, 1); g.fillRect(0, 8, 5, 1); // guard
    g.fillStyle(0xd0d0d8, 1); g.fillRect(2, 0, 1, 9); g.fillRect(1, 1, 3, 7);
    g.fillStyle(0xffffff, 1); g.fillRect(2, 1, 1, 6);
  });

  make(scene, TEX.weapon_bow, 14, 12, (g) => {
    g.fillStyle(0x8b5a2b, 1);
    g.fillRect(10, 1, 2, 10);
    g.fillRect(9, 0, 2, 2); g.fillRect(9, 10, 2, 2);
    g.fillStyle(0xe6e6e6, 1); g.fillRect(0, 5, 12, 1); // bow string + arrow
    g.fillStyle(0xf0b070, 1); g.fillRect(2, 5, 5, 1);
    g.fillStyle(0xdddddd, 1); g.fillRect(0, 4, 3, 3);
  });

  make(scene, TEX.weapon_pistol, 12, 8, (g) => {
    g.fillStyle(0x333342, 1); g.fillRect(3, 1, 7, 3); // barrel
    g.fillStyle(0x55556a, 1); g.fillRect(3, 1, 7, 1);
    g.fillStyle(0x1a1a1a, 1); g.fillRect(2, 3, 4, 4); // grip
    g.fillStyle(0x333333, 1); g.fillRect(2, 3, 4, 1);
    g.fillStyle(0xffd700, 1); g.fillRect(9, 2, 1, 1); // muzzle hint
  });

  // A tall thin raindrop streak
  make(scene, TEX.raindrop, 2, 8, (g) => {
    g.fillStyle(0x88aaff, 1); g.fillRect(0, 0, 2, 8);
    g.fillStyle(0xc8d8ff, 1); g.fillRect(0, 0, 1, 8);
  });

  // Chicken — cute white fluff with orange beak and red comb
  make(scene, TEX.chicken, 16, 14, (g) => {
    // body
    g.fillStyle(0xffffff, 1); g.fillRect(3, 5, 10, 7);
    g.fillStyle(0xe0e0e0, 1); g.fillRect(3, 10, 10, 2);
    // head
    g.fillStyle(0xffffff, 1); g.fillRect(10, 2, 5, 5);
    // comb (red on head)
    g.fillStyle(0xcc3333, 1); g.fillRect(11, 0, 3, 2);
    g.fillRect(10, 1, 1, 1); g.fillRect(13, 1, 1, 1);
    // eye
    g.fillStyle(0x1a1a1a, 1); g.fillRect(12, 3, 1, 1);
    // beak
    g.fillStyle(0xffaa00, 1); g.fillRect(14, 4, 2, 1);
    // legs
    g.fillStyle(0xffaa00, 1); g.fillRect(5, 12, 1, 2); g.fillRect(9, 12, 1, 2);
    // tail
    g.fillStyle(0xf0f0f0, 1); g.fillRect(1, 4, 3, 4);
    g.fillStyle(0xd0d0d0, 1); g.fillRect(0, 5, 2, 2);
    outline(g, 3, 5, 10, 7, 0x1a1a1a);
    outline(g, 10, 2, 5, 5, 0x1a1a1a);
  });

  // Food (drumstick-like)
  make(scene, TEX.food, 14, 14, (g) => {
    g.fillStyle(0xd58a4a, 1); g.fillRect(4, 4, 8, 6);
    g.fillStyle(0xe6a870, 1); g.fillRect(4, 4, 8, 2);
    g.fillStyle(0xfefefe, 1); g.fillRect(2, 2, 4, 4); // bone
    g.fillStyle(0xdddddd, 1); g.fillRect(2, 6, 4, 2);
    outline(g, 4, 4, 8, 6, 0x1a1a1a);
    outline(g, 2, 2, 4, 4, 0x1a1a1a);
  });

  // Volcano — big pile of blackened rock with molten glow
  make(scene, TEX.volcano, 42, 38, (g) => {
    // base
    g.fillStyle(0x2a1a0a, 1);
    g.fillRect(0, 20, 42, 18);
    g.fillStyle(0x3a2414, 1);
    g.fillRect(2, 16, 38, 4);
    g.fillStyle(0x4a3020, 1);
    g.fillRect(4, 12, 34, 4);
    g.fillStyle(0x5a3a28, 1);
    g.fillRect(8, 8, 26, 4);
    g.fillStyle(0x6a4a38, 1);
    g.fillRect(12, 4, 18, 4);
    // Crater rim
    g.fillStyle(0x2a1a0a, 1); g.fillRect(14, 2, 14, 3);
    // Molten lava in crater
    g.fillStyle(0xff4d1a, 1); g.fillRect(16, 0, 10, 3);
    g.fillStyle(0xffaa33, 1); g.fillRect(18, 0, 6, 1);
    // Glow on sides
    g.fillStyle(0xff6020, 1);
    g.fillRect(8, 12, 3, 2); g.fillRect(30, 14, 4, 3);
    g.fillRect(12, 20, 3, 2); g.fillRect(28, 22, 3, 2);
    // Smoke puffs above (visual baked in)
    g.fillStyle(0x555555, 0.5); g.fillRect(16, 0, 2, 2); g.fillRect(24, 0, 2, 1);
    outline(g, 0, 20, 42, 18, 0x000000);
  });

  // Crater (charred ground where meteor landed)
  make(scene, TEX.crater, 32, 32, (g) => {
    g.fillStyle(0x3a2410, 1); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x2a1a0a, 1);
    g.fillRect(4, 4, 24, 24);
    g.fillStyle(0x1a0a04, 1);
    g.fillRect(8, 8, 16, 16);
    g.fillStyle(0x4a3020, 1);
    g.fillRect(5, 5, 3, 2); g.fillRect(24, 5, 3, 2); g.fillRect(5, 25, 3, 2); g.fillRect(24, 25, 3, 2);
    g.fillStyle(0x2a1a0a, 1);
    g.fillRect(10, 12, 2, 2); g.fillRect(20, 18, 2, 2);
  });

  // Meteor (the falling rock)
  make(scene, TEX.meteor, 24, 24, (g) => {
    // fiery head
    g.fillStyle(0xff4d1a, 1); g.fillRect(4, 4, 16, 16);
    g.fillStyle(0xff8030, 1); g.fillRect(5, 5, 14, 6);
    g.fillStyle(0xffee88, 1); g.fillRect(7, 6, 10, 4);
    // dark rock core
    g.fillStyle(0x3a2410, 1); g.fillRect(6, 12, 12, 8);
    g.fillStyle(0x2a1a0a, 1); g.fillRect(8, 14, 8, 4);
    // fire trail
    g.fillStyle(0xffaa33, 1); g.fillRect(4, 20, 16, 3);
    g.fillStyle(0xffee88, 1); g.fillRect(6, 21, 12, 1);
    outline(g, 4, 4, 16, 16, 0x1a0a00);
  });

  // Star (for night background)
  make(scene, TEX.star, 6, 6, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRect(2, 0, 2, 6); g.fillRect(0, 2, 6, 2);
    g.fillStyle(0xffffcc, 1);
    g.fillRect(2, 2, 2, 2);
  });

  // Trophy
  make(scene, TEX.trophy, 20, 22, (g) => {
    g.fillStyle(0xffd700, 1); g.fillRect(4, 2, 12, 10); // cup
    g.fillStyle(0xfff0a0, 1); g.fillRect(5, 3, 10, 2);
    g.fillStyle(0xaa7700, 1); g.fillRect(4, 10, 12, 2);
    g.fillStyle(0xffd700, 1); g.fillRect(0, 4, 4, 2); g.fillRect(16, 4, 4, 2); // handles
    g.fillRect(0, 4, 2, 6); g.fillRect(18, 4, 2, 6);
    g.fillStyle(0xaa7700, 1); g.fillRect(7, 12, 6, 2); // stem
    g.fillStyle(0x8b4513, 1); g.fillRect(3, 14, 14, 5); // base
    g.fillStyle(0x5a3a1b, 1); g.fillRect(3, 17, 14, 2);
    outline(g, 4, 2, 12, 10, 0x1a1a1a);
    outline(g, 3, 14, 14, 5, 0x1a1a1a);
  });
}

function make(scene: Phaser.Scene, key: string, w: number, h: number, paint: (g: Phaser.GameObjects.Graphics) => void) {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  paint(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

function outline(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number) {
  g.fillStyle(color, 1);
  g.fillRect(x, y, w, 1);
  g.fillRect(x, y + h - 1, w, 1);
  g.fillRect(x, y, 1, h);
  g.fillRect(x + w - 1, y, 1, h);
}
