import Phaser from 'phaser';
import { TILE_SIZE, WORLD_HEIGHT, WORLD_WIDTH } from '../config';
import { TileType, TILE_SPECS, MaterialId, isBreakable } from './tileTypes';
import { generateWorld, Tile, GeneratedWorld } from './generate';
import { TEX } from '../gfx/textures';

export interface TileMineResult {
  ok: boolean;
  reason?: 'weak_tool' | 'not_breakable';
  drop?: { material: MaterialId; count: number };
  broken: boolean;
}

const TEXTURE_FOR: Partial<Record<TileType, string>> = {
  [TileType.Tree]: TEX.tree,
  [TileType.Stone]: TEX.stone,
  [TileType.IronOre]: TEX.iron_ore,
  [TileType.GoldOre]: TEX.gold_ore,
  [TileType.WallWood]: TEX.wall_wood,
  [TileType.WallStone]: TEX.wall_stone,
  [TileType.WallIron]: TEX.wall_iron,
  [TileType.DoorWood]: TEX.door_wood,
  [TileType.DoorIron]: TEX.door_iron,
  [TileType.Torch]: TEX.torch,
  [TileType.CraftingBench]: TEX.crafting_bench,
  [TileType.Chest]: TEX.chest,
  [TileType.TurretBasic]: TEX.turret_basic,
  [TileType.TurretAdvanced]: TEX.turret_advanced,
  [TileType.TurretFlame]: TEX.turret_flame,
  [TileType.WallReinforced]: TEX.wall_reinforced,
  [TileType.Lava]: TEX.lava,
  [TileType.ShopNPC]: TEX.shop_npc,
  [TileType.DeadTree]: TEX.dead_tree,
  [TileType.Campfire]: TEX.campfire,
  [TileType.Cake]: TEX.cake,
  [TileType.Mushroom]: TEX.mushroom,
  [TileType.Pumpkin]: TEX.pumpkin,
  [TileType.Volcano]: TEX.volcano,
  [TileType.Bridge]: TEX.bridge,
};

export class World {
  readonly tiles: Tile[][];
  readonly playerSpawn: { x: number; y: number };
  readonly shopPos: { x: number; y: number };

  private scene: Phaser.Scene;
  private tileObjects: Map<number, Phaser.GameObjects.GameObject> = new Map();
  private hpBars: Map<number, Phaser.GameObjects.Rectangle> = new Map();
  readonly events = new Phaser.Events.EventEmitter();

  constructor(scene: Phaser.Scene, source: number | GeneratedWorld) {
    this.scene = scene;
    const gen: GeneratedWorld = typeof source === 'number' ? generateWorld(source) : source;
    this.tiles = gen.tiles;
    this.playerSpawn = gen.playerSpawn;
    this.shopPos = gen.shopPos;
  }

  drawAll(): void {
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let x = 0; x < WORLD_WIDTH; x++) {
        const t = this.tiles[y][x];
        const texKey =
          t.type === TileType.Dirt ? TEX.dirt :
          t.type === TileType.Water ? TEX.water :
          t.type === TileType.Sand ? TEX.sand :
          t.type === TileType.FlowerField ? TEX.flower_field :
          t.type === TileType.Crater ? TEX.crater :
          TEX.grass_tuft;
        const ground = this.scene.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          texKey,
        );
        ground.setDepth(0);
        if (t.type === TileType.Water) {
          this.scene.tweens.add({
            targets: ground,
            alpha: 0.85,
            yoyo: true,
            repeat: -1,
            duration: 1000 + Math.random() * 800,
          });
        }
        if (this.needsObject(t.type)) this.spawnObject(x, y);
      }
    }
  }

  private needsObject(type: TileType): boolean {
    return (
      type !== TileType.Grass &&
      type !== TileType.Dirt &&
      type !== TileType.Water &&
      type !== TileType.Sand &&
      type !== TileType.FlowerField &&
      type !== TileType.Crater
    );
  }

  private key(x: number, y: number): number {
    return y * WORLD_WIDTH + x;
  }

  private spawnObject(x: number, y: number): void {
    const t = this.tiles[y][x];
    const texKey = TEXTURE_FOR[t.type];
    if (!texKey) return;

    const cx = x * TILE_SIZE + TILE_SIZE / 2;
    const cy = y * TILE_SIZE + TILE_SIZE / 2;

    const img = this.scene.add.image(cx, cy, texKey);
    img.setDepth(depthFor(t.type));

    if (t.type === TileType.Tree) {
      // Tree taller than 32 — anchor bottom at tile bottom
      img.setOrigin(0.5, 1);
      img.y = y * TILE_SIZE + TILE_SIZE;
    } else if (t.type === TileType.Torch) {
      img.setOrigin(0.5, 1);
      img.y = y * TILE_SIZE + TILE_SIZE - 2;
      // Flicker anim
      const glow = this.scene.add.circle(cx, y * TILE_SIZE + TILE_SIZE / 2 - 2, TILE_SIZE * 1.2, 0xffd27a, 0.12);
      glow.setDepth(1);
      img.setData('glow', glow);
      this.scene.tweens.add({
        targets: glow,
        fillAlpha: 0.22,
        scale: 1.15,
        yoyo: true,
        repeat: -1,
        duration: 220 + Math.random() * 160,
      });
      this.scene.tweens.add({
        targets: img,
        y: img.y - 1,
        yoyo: true,
        repeat: -1,
        duration: 220 + Math.random() * 160,
      });
    } else if (t.type === TileType.Lava) {
      this.scene.tweens.add({
        targets: img,
        alpha: 0.75,
        yoyo: true,
        repeat: -1,
        duration: 400 + Math.random() * 300,
      });
    } else if (t.type === TileType.TurretBasic || t.type === TileType.TurretAdvanced || t.type === TileType.TurretFlame) {
      img.setOrigin(0.5, 1);
      img.y = y * TILE_SIZE + TILE_SIZE - 1;
    } else if (t.type === TileType.CraftingBench) {
      img.setOrigin(0.5, 1);
      img.y = y * TILE_SIZE + TILE_SIZE - 2;
    } else if (t.type === TileType.Chest) {
      img.setOrigin(0.5, 1);
      img.y = y * TILE_SIZE + TILE_SIZE - 2;
    } else if (t.type === TileType.ShopNPC) {
      img.setOrigin(0.5, 1);
      img.y = y * TILE_SIZE + TILE_SIZE - 2;
      this.scene.tweens.add({
        targets: img,
        y: img.y - 2,
        yoyo: true,
        repeat: -1,
        duration: 900,
      });
    } else if (t.type === TileType.Campfire) {
      img.setOrigin(0.5, 1);
      img.y = y * TILE_SIZE + TILE_SIZE - 1;
      const glow = this.scene.add.circle(cx, cy, TILE_SIZE * 1.4, 0xffa040, 0.18);
      glow.setDepth(1);
      img.setData('glow', glow);
      this.scene.tweens.add({
        targets: glow,
        fillAlpha: 0.28,
        scale: 1.1,
        yoyo: true,
        repeat: -1,
        duration: 180 + Math.random() * 120,
      });
      this.scene.tweens.add({
        targets: img,
        scaleY: 1.05,
        yoyo: true,
        repeat: -1,
        duration: 220 + Math.random() * 140,
      });
    } else if (t.type === TileType.Cake) {
      img.setOrigin(0.5, 1);
      img.y = y * TILE_SIZE + TILE_SIZE - 2;
      this.scene.tweens.add({
        targets: img,
        y: img.y - 3,
        yoyo: true,
        repeat: -1,
        duration: 700,
      });
      // Sparkle aura
      const spark = this.scene.add.circle(cx, cy - 4, TILE_SIZE * 0.9, 0xffd166, 0.12);
      spark.setDepth(1);
      img.setData('glow', spark);
      this.scene.tweens.add({
        targets: spark,
        fillAlpha: 0.25,
        scale: 1.2,
        yoyo: true,
        repeat: -1,
        duration: 600,
      });
    } else if (t.type === TileType.Mushroom) {
      img.setOrigin(0.5, 1);
      img.y = y * TILE_SIZE + TILE_SIZE - 4;
      img.setScale(0.85);
    } else if (t.type === TileType.Pumpkin) {
      img.setOrigin(0.5, 1);
      img.y = y * TILE_SIZE + TILE_SIZE - 2;
    } else if (t.type === TileType.DeadTree) {
      img.setOrigin(0.5, 1);
      img.y = y * TILE_SIZE + TILE_SIZE;
    } else if (t.type === TileType.Volcano) {
      img.setOrigin(0.5, 1);
      img.y = y * TILE_SIZE + TILE_SIZE;
      // Pulsing red glow
      const glow = this.scene.add.circle(cx, cy, TILE_SIZE * 1.8, 0xff4d1a, 0.2);
      glow.setDepth(1);
      img.setData('glow', glow);
      this.scene.tweens.add({
        targets: glow,
        fillAlpha: 0.35,
        scale: 1.2,
        yoyo: true,
        repeat: -1,
        duration: 600 + Math.random() * 200,
      });
      // Smoke puffs
      const smoke = this.scene.add.particles(cx, y * TILE_SIZE + 4, 'particle', {
        speed: { min: -20, max: 20 },
        angle: { min: 260, max: 280 },
        lifespan: 900,
        alpha: { start: 0.5, end: 0 },
        scale: { start: 1.5, end: 4 },
        tint: [0x555555, 0x888888],
        frequency: 200,
      });
      smoke.setDepth(6);
      img.setData('smoke', smoke);
    }

    this.tileObjects.set(this.key(x, y), img);
  }

  getTileAt(x: number, y: number): Tile | null {
    if (x < 0 || y < 0 || x >= WORLD_WIDTH || y >= WORLD_HEIGHT) return null;
    return this.tiles[y][x];
  }

  isWalkable(x: number, y: number): boolean {
    const t = this.getTileAt(x, y);
    if (!t) return false;
    if (t.type === TileType.DoorWood || t.type === TileType.DoorIron) {
      const obj = this.tileObjects.get(this.key(x, y));
      return obj?.getData('open') === true;
    }
    return TILE_SPECS[t.type].walkable;
  }

  /** Can a projectile pass over this tile? */
  blocksProjectile(x: number, y: number): boolean {
    const t = this.getTileAt(x, y);
    if (!t) return true;
    if (t.type === TileType.Torch || t.type === TileType.Lava) return false;
    return TILE_SPECS[t.type].opaque;
  }

  damageTile(x: number, y: number, amount: number, opts?: { onDamage?: () => void }): boolean {
    const t = this.getTileAt(x, y);
    if (!t || !isBreakable(t.type)) return false;
    t.hp -= amount;
    this.updateHpBar(x, y, t);
    this.flashTile(x, y);
    opts?.onDamage?.();
    if (t.hp <= 0) {
      this.breakTile(x, y);
      return true;
    }
    return false;
  }

  mineTile(x: number, y: number, pickaxeTier: number, damage: number): TileMineResult {
    const t = this.getTileAt(x, y);
    if (!t) return { ok: false, reason: 'not_breakable', broken: false };
    if (!isBreakable(t.type)) return { ok: false, reason: 'not_breakable', broken: false };
    const spec = TILE_SPECS[t.type];
    if (pickaxeTier < spec.pickaxeTier) return { ok: false, reason: 'weak_tool', broken: false };
    const broken = this.damageTile(x, y, damage);
    if (broken && spec.dropMaterial && spec.dropCount && spec.dropCount > 0) {
      return { ok: true, broken: true, drop: { material: spec.dropMaterial, count: spec.dropCount } };
    }
    return { ok: true, broken };
  }

  private flashTile(x: number, y: number): void {
    const obj = this.tileObjects.get(this.key(x, y)) as Phaser.GameObjects.Image | undefined;
    if (!obj || !('setTint' in obj)) return;
    obj.setTint(0xffffff);
    this.scene.time.delayedCall(70, () => obj && (obj as Phaser.GameObjects.Image).clearTint?.());
    // Tiny shake
    const originalX = obj.x;
    const originalY = obj.y;
    obj.x = originalX + (Math.random() - 0.5) * 3;
    obj.y = originalY + (Math.random() - 0.5) * 3;
    this.scene.time.delayedCall(60, () => {
      if (obj && obj.active) { obj.x = originalX; obj.y = originalY; }
    });
  }

  private updateHpBar(x: number, y: number, t: Tile): void {
    const key = this.key(x, y);
    const spec = TILE_SPECS[t.type];
    const maxHp = spec.baseHp;
    if (maxHp <= 0) return;
    const pct = Math.max(0, t.hp) / maxHp;
    let bar = this.hpBars.get(key);
    if (!bar) {
      bar = this.scene.add.rectangle(
        x * TILE_SIZE + TILE_SIZE / 2,
        y * TILE_SIZE - 2,
        TILE_SIZE - 6,
        3,
        0x66ff66,
      );
      bar.setDepth(20);
      this.hpBars.set(key, bar);
    }
    bar.width = (TILE_SIZE - 6) * pct;
    bar.fillColor = pct > 0.5 ? 0x66ff66 : pct > 0.2 ? 0xffcc33 : 0xff4444;
    if (pct >= 1) {
      bar.destroy();
      this.hpBars.delete(key);
    }
  }

  placeTile(x: number, y: number, type: TileType): boolean {
    const t = this.getTileAt(x, y);
    if (!t) return false;
    const onGround = t.type === TileType.Grass || t.type === TileType.Dirt;
    // Bridges specifically go onto Water
    if (type === TileType.Bridge) {
      if (t.type !== TileType.Water) return false;
    } else if (!onGround) {
      return false;
    }
    t.type = type;
    t.hp = TILE_SPECS[type].baseHp;
    this.spawnObject(x, y);
    this.events.emit('tile_placed', x, y, type);
    return true;
  }

  private breakTile(x: number, y: number): void {
    const key = this.key(x, y);
    const obj = this.tileObjects.get(key);
    if (obj) {
      const glow = obj.getData('glow') as Phaser.GameObjects.Arc | undefined;
      if (glow) glow.destroy();
      obj.destroy();
      this.tileObjects.delete(key);
    }
    const bar = this.hpBars.get(key);
    if (bar) {
      bar.destroy();
      this.hpBars.delete(key);
    }
    const t = this.tiles[y][x];
    this.events.emit('tile_broken', x, y, t.type);
    // Bridges revert to water (the water ground image is still there beneath them)
    t.type = t.type === TileType.Bridge ? TileType.Water : TileType.Grass;
    t.hp = 0;
  }

  toggleDoor(x: number, y: number): boolean {
    const t = this.getTileAt(x, y);
    if (!t) return false;
    if (t.type !== TileType.DoorWood && t.type !== TileType.DoorIron) return false;
    const obj = this.tileObjects.get(this.key(x, y)) as Phaser.GameObjects.Image | undefined;
    if (!obj) return false;
    const isOpen = obj.getData('open') === true;
    const nextOpen = !isOpen;
    obj.setData('open', nextOpen);
    // Swap texture
    const closedKey = t.type === TileType.DoorWood ? TEX.door_wood : TEX.door_iron;
    const openKey = t.type === TileType.DoorWood ? TEX.door_wood_open : TEX.door_iron_open;
    obj.setTexture(nextOpen ? openKey : closedKey);
    return nextOpen;
  }

  worldToTile(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: Math.floor(worldX / TILE_SIZE),
      y: Math.floor(worldY / TILE_SIZE),
    };
  }

  tileToWorldCenter(x: number, y: number): { x: number; y: number } {
    return { x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2 };
  }

  /**
   * Refresh the floating HP bar for a tile after its hp changed outside of
   * {@link damageTile} (e.g., after being repaired). Despawns the bar if
   * the tile is back to full HP.
   */
  refreshHpBar(x: number, y: number): void {
    const t = this.getTileAt(x, y);
    if (!t) return;
    this.updateHpBar(x, y, t);
  }

  /** Redraw a single tile's ground image (e.g., after converting it to crater/lava). */
  forceRedrawGround(x: number, y: number): void {
    const t = this.getTileAt(x, y);
    if (!t) return;
    const texKey =
      t.type === TileType.Dirt ? TEX.dirt :
      t.type === TileType.Water ? TEX.water :
      t.type === TileType.Sand ? TEX.sand :
      t.type === TileType.FlowerField ? TEX.flower_field :
      t.type === TileType.Crater ? TEX.crater :
      t.type === TileType.Lava ? TEX.lava :
      TEX.grass_tuft;
    const ground = this.scene.add.image(
      x * TILE_SIZE + TILE_SIZE / 2,
      y * TILE_SIZE + TILE_SIZE / 2,
      texKey,
    );
    ground.setDepth(0.4);
  }

  /** Spawn the object layer for a tile from outside (used by world events). */
  forceSpawnObject(x: number, y: number): void {
    this.spawnObject(x, y);
  }

  forEachTileOfType(type: TileType, visitor: (x: number, y: number) => void): void {
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let x = 0; x < WORLD_WIDTH; x++) {
        if (this.tiles[y][x].type === type) visitor(x, y);
      }
    }
  }
}

function depthFor(type: TileType): number {
  switch (type) {
    case TileType.Tree:
      return 6;
    case TileType.Torch:
      return 5;
    case TileType.TurretBasic:
    case TileType.TurretAdvanced:
    case TileType.TurretFlame:
    case TileType.CraftingBench:
    case TileType.Chest:
    case TileType.ShopNPC:
      return 5;
    case TileType.Lava:
      return 1;
    default:
      return 3;
  }
}
