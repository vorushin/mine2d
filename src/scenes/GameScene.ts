import Phaser from 'phaser';
import { TILE_SIZE, WORLD_HEIGHT, WORLD_WIDTH, COLORS, PLAYER_MAX_HP, PLAYER_REACH_TILES } from '../config';
import { World } from '../world/World';
import { Player } from '../entities/Player';
import { Zombie, specForNight, specForBoss } from '../entities/Zombie';
import { Projectile, ProjectileSpawn } from '../entities/Projectile';
import { TurretInstance, makeTurretBarrel, tickTurrets } from '../entities/Turret';
import { Pickup } from '../entities/Pickup';
import { Dog } from '../entities/Dog';
import { Chicken } from '../entities/Chicken';
import { InputSystem } from '../systems/Input';
import { DayNightCycle } from '../systems/DayNightCycle';
import { SaveStore } from '../systems/SaveStore';
import { SaveLoad, SaveSnapshot } from '../systems/SaveLoad';
import { sounds } from '../systems/Sound';
import { Effects } from '../gfx/Effects';
import { WorldEvents } from '../systems/WorldEvents';
import { GameState, makeGameState, addItem, removeItem, hasItem } from '../state/GameState';
import { TileType, TILE_SPECS, MaterialId, isBreakable } from '../world/tileTypes';
import { HOTBAR, hotbarAvailable } from '../ui/hotbarDef';

export class GameScene extends Phaser.Scene {
  state!: GameState;
  world!: World;
  player!: Player;
  cycle!: DayNightCycle;
  effects!: Effects;
  worldEvents!: WorldEvents;
  zombies: Zombie[] = [];
  projectiles: Projectile[] = [];
  turrets: TurretInstance[] = [];
  pickups: Pickup[] = [];
  dog?: Dog;
  chickens: Chicken[] = [];
  input2!: InputSystem;
  readonly events2 = new Phaser.Events.EventEmitter();
  private nightSpawned = 0;
  private nightTarget = 0;
  private nightSpawnTimerMs = 0;
  private bossSpawned = false;
  private combo = 0;
  private comboTimerMs = 0;
  private lastDayCountdown = -1;
  private bloodMoon = false;
  private bloodOverlay?: Phaser.GameObjects.Rectangle;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private warmOverlay!: Phaser.GameObjects.Rectangle;
  private hintText!: Phaser.GameObjects.Text;
  private reticle!: Phaser.GameObjects.Rectangle;
  private interactPrompt!: Phaser.GameObjects.Text;
  private rainEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private rainActive = false;
  private lightningTimerMs = 0;
  private stars: Phaser.GameObjects.Image[] = [];

  private pendingLoad: SaveSnapshot | null = null;

  constructor() {
    super('Game');
  }

  init(data?: { loadSnapshot?: SaveSnapshot }): void {
    this.pendingLoad = data?.loadSnapshot ?? null;
  }

  create(): void {
    const loaded = this.pendingLoad;
    this.pendingLoad = null;

    if (loaded) {
      this.state = loaded.state;
    } else {
      this.state = makeGameState();
      this.state.playerHp = PLAYER_MAX_HP;
      this.state.playerMaxHp = PLAYER_MAX_HP;
      addItem(this.state.inventory, 'wood', 12);
      addItem(this.state.inventory, 'stone', 4);
    }

    this.cameras.main.setBackgroundColor(0x0e1116);
    this.physics.world.setBounds(0, 0, WORLD_WIDTH * TILE_SIZE, WORLD_HEIGHT * TILE_SIZE);

    const seed = Math.floor(Math.random() * 2 ** 31);
    if (loaded) {
      this.world = new World(this, {
        tiles: loaded.tiles,
        playerSpawn: loaded.playerSpawn,
        shopPos: loaded.shopPos,
      });
    } else {
      this.world = new World(this, seed);
    }
    this.world.drawAll();
    this.drawDecor(seed);

    this.effects = new Effects(this);
    this.worldEvents = new WorldEvents({
      scene: this,
      world: this.world,
      effects: this.effects,
      onPickup: (p) => this.pickups.push(p),
      playerTilePos: () => this.world.worldToTile(this.player.x, this.player.y),
      nightNumber: () => this.state.nightNumber,
    });

    this.player = new Player(this, this.state, this.world);
    // Restore player position from save if present
    if (loaded) {
      this.player.sprite.x = loaded.playerWorldPos.x;
      this.player.sprite.y = loaded.playerWorldPos.y;
    }
    this.dog = new Dog(this, this.world, this.player.x + 18, this.player.y + 6);
    if (loaded?.dog) {
      if (!loaded.dog.alive) {
        this.dog.die();
        this.dog = undefined;
      } else {
        this.dog.sprite.setPosition(loaded.dog.x, loaded.dog.y);
        this.dog.hp = loaded.dog.hp;
        this.dog.level = loaded.dog.level;
        this.dog.kills = loaded.dog.kills;
      }
    }
    this.spawnChickens();
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH * TILE_SIZE, WORLD_HEIGHT * TILE_SIZE);
    this.cameras.main.setZoom(1.4);

    this.input2 = new InputSystem(this);
    this.cycle = new DayNightCycle(this.state);

    this.cycle.events.on('night_started', (_n: number, target: number) => {
      this.nightSpawned = 0;
      this.nightTarget = target;
      this.nightSpawnTimerMs = 0;
      this.bossSpawned = false;
      sounds.nightStart();
      const isBossNight = this.state.nightNumber % 5 === 0;
      this.bloodMoon = isBossNight;
      const sub = isBossNight
        ? `🩸 BLOOD MOON  ·  ${target} zombies + BOSS`
        : `${target} zombies incoming`;
      this.showBanner(`NIGHT ${this.state.nightNumber}`, sub);
      if (isBossNight) this.cameras.main.shake(400, 0.006);
    });
    this.cycle.events.on('dawn', () => {
      for (const z of this.zombies) z.die();
      this.zombies = [];
      this.bloodMoon = false;
      sounds.dawn();
      // +max HP every time you survive
      this.state.playerMaxHp += 15;
      this.state.playerHp = Math.min(this.state.playerMaxHp, this.state.playerHp + 40);
      this.showBanner('☼ DAWN', `you survived! +15 max HP · ${this.state.playerHp}/${this.state.playerMaxHp}`);
      // Heal dog to full at dawn, or revive if he fell
      if (this.dog?.alive) this.dog.heal(this.dog.maxHp);
      else {
        this.dog = new Dog(this, this.world, this.player.x + 18, this.player.y + 6);
        this.showHint('🐶 Rex is back!');
      }
      // Auto-save the run
      this.saveRun('Auto-saved at dawn');
      // Replant a few trees each dawn (nature recovers)
      let planted = 0;
      for (let tries = 0; tries < 40 && planted < 3; tries++) {
        const tx = 4 + Math.floor(Math.random() * (WORLD_WIDTH - 8));
        const ty = 4 + Math.floor(Math.random() * (WORLD_HEIGHT - 8));
        const tile = this.world.getTileAt(tx, ty);
        if (tile && tile.type === TileType.Grass) {
          // Don't plant right next to the player
          if (this.player.tileDistance(tx, ty) > 4) {
            this.world.placeTile(tx, ty, TileType.Tree);
            planted++;
          }
        }
      }

      // Respawn chickens each dawn (keep world lively)
      const target = 6;
      while (this.chickens.length < target) {
        let placed = false;
        for (let tries = 0; tries < 20 && !placed; tries++) {
          const tx = 4 + Math.floor(Math.random() * (WORLD_WIDTH - 8));
          const ty = 4 + Math.floor(Math.random() * (WORLD_HEIGHT - 8));
          if (this.world.isWalkable(tx, ty)) {
            const wc = this.world.tileToWorldCenter(tx, ty);
            this.chickens.push(new Chicken(this, this.world, wc.x, wc.y));
            placed = true;
          }
        }
        if (!placed) break;
      }
      // 20% chance to spawn a golden chicken somewhere in the world
      if (Math.random() < 0.2) {
        for (let tries = 0; tries < 40; tries++) {
          const tx = 4 + Math.floor(Math.random() * (WORLD_WIDTH - 8));
          const ty = 4 + Math.floor(Math.random() * (WORLD_HEIGHT - 8));
          if (this.world.isWalkable(tx, ty)) {
            const wc = this.world.tileToWorldCenter(tx, ty);
            this.chickens.push(new Chicken(this, this.world, wc.x, wc.y, true));
            this.showHint('✨ A golden chicken is somewhere today!');
            break;
          }
        }
      }
      // Stop rain at dawn
      this.stopRain();
      // 30% chance of rain the next day
      if (Math.random() < 0.3) this.startRain();
    });
    this.cycle.events.on('phase_changed', (phase: GameState['phase']) => {
      if (phase === 'day') {
        this.showHint('Day — mine, build, craft');
        this.worldEvents.onDayStart();
      }
    });

    this.events.on('volcano_spawned', (tx: number, ty: number) => {
      this.showBanner('🌋 VOLCANO', 'a volcano erupted nearby!');
      sounds.bossRoar();
      const wc = this.world.tileToWorldCenter(tx, ty);
      this.effects.burst(wc.x, wc.y, 0xff4d1a, 30, 180, 900, 1.8);
    });

    // Click-to-interact
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      sounds.ensure();
      if ('ontouchstart' in window && pointer.x < this.scale.width / 2) return;
      this.handleTileInteraction(pointer.worldX, pointer.worldY);
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
      if ('ontouchstart' in window && pointer.x < this.scale.width / 2) return;
      this.handleTileInteraction(pointer.worldX, pointer.worldY);
    });

    this.input2.events.on('hotbar_select', (slot: number) => {
      this.state.hotbarSlot = slot;
      this.scene.get('UI').events.emit('hotbar_changed');
      this.refreshPlayerWeapon();
      sounds.click();
    });
    this.input2.events.on('interact', () => this.handleInteractPressed());
    this.input2.events.on('skip_to_night', () => this.cycle.skipToNight());

    this.input.keyboard?.on('keydown-C', () => {
      sounds.ensure();
      this.scene.get('UI').events.emit('open_modal', 'craft');
    });

    // K — manual save
    this.input.keyboard?.on('keydown-K', () => this.saveRun('Manual save'));

    // P — drink a potion
    this.input.keyboard?.on('keydown-P', () => {
      if (!hasItem(this.state.inventory, 'potion', 1)) {
        this.showHint('No potions — buy at shop');
        return;
      }
      removeItem(this.state.inventory, 'potion', 1);
      const heal = 40;
      this.state.playerHp = Math.min(this.state.playerMaxHp, this.state.playerHp + heal);
      this.popNumber(this.player.x, this.player.y - 20, `+${heal} HP`, '#9effa0');
      sounds.pickup();
      this.effects.burst(this.player.x, this.player.y, 0xff66aa, 10, 90, 400, 1);
    });

    // Shift — dash
    this.input.keyboard?.on('keydown-SHIFT', () => {
      if (this.player.tryDash()) {
        sounds.click();
        this.effects.burst(this.player.x, this.player.y, 0xffffff, 8, 60, 260, 0.8);
      }
    });

    // F — eat food
    this.input.keyboard?.on('keydown-F', () => {
      if (!hasItem(this.state.inventory, 'food', 1)) {
        this.showHint('No food — kill a chicken');
        return;
      }
      removeItem(this.state.inventory, 'food', 1);
      const heal = 20;
      this.state.playerHp = Math.min(this.state.playerMaxHp, this.state.playerHp + heal);
      this.popNumber(this.player.x, this.player.y - 20, `+${heal} HP yum`, '#ffd166');
      sounds.pickup();
    });

    this.input.on('wheel', (_p: any, _obj: any, _dx: number, dy: number) => {
      const dir = dy > 0 ? 1 : -1;
      this.state.hotbarSlot = (this.state.hotbarSlot + dir + HOTBAR.length) % HOTBAR.length;
      this.scene.get('UI').events.emit('hotbar_changed');
      this.refreshPlayerWeapon();
    });

    // Zombie-world events → sounds + particles
    this.events.on('zombie_hit_player', (x: number, y: number) => {
      sounds.playerHurt();
      this.effects.bloodBurst(x, y, 0x8a1a1a);
      this.dog?.reactToPlayerHit();
    });
    this.events.on('dog_bite', (x: number, y: number, dmg: number) => {
      this.effects.bloodBurst(x, y, 0x8a1a1a);
      sounds.zombieHit();
      if (dmg !== undefined) this.popNumber(x, y - 12, `-${dmg}`, '#ffccaa');
    });
    this.events.on('dog_killed_zombie', (x: number, y: number, variant?: string) => {
      this.onZombieKilled(x, y, variant);
    });
    this.events.on('dog_pet', () => {
      sounds.pickup();
      // Temporary small HP regen and a small hint
      this.state.playerHp = Math.min(this.state.playerMaxHp, this.state.playerHp + 3);
      this.popNumber(this.player.x, this.player.y - 22, '+3 ♥', '#ff88aa');
    });
    this.events.on('zombie_hit_wall', (x: number, y: number, tileType: TileType) => {
      sounds.wallHit();
      const color = TILE_SPECS[tileType]?.tintColor ?? 0xaaaaaa;
      this.effects.wallDebris(x, y, color);
    });
    this.events.on('wall_broken', (tx: number, ty: number, tileType: TileType) => {
      const wc = this.world.tileToWorldCenter(tx, ty);
      const color = TILE_SPECS[tileType]?.tintColor ?? 0xaaaaaa;
      this.effects.burst(wc.x, wc.y, color, 14, 140, 500, 1.2);
      sounds.mineBreak();
    });

    this.nightOverlay = this.add
      .rectangle(0, 0, WORLD_WIDTH * TILE_SIZE, WORLD_HEIGHT * TILE_SIZE, COLORS.night_overlay, 0)
      .setOrigin(0, 0);
    this.nightOverlay.setDepth(100);

    this.warmOverlay = this.add
      .rectangle(0, 0, WORLD_WIDTH * TILE_SIZE, WORLD_HEIGHT * TILE_SIZE, 0xff7a33, 0)
      .setOrigin(0, 0);
    this.warmOverlay.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.warmOverlay.setDepth(99);

    this.bloodOverlay = this.add
      .rectangle(0, 0, WORLD_WIDTH * TILE_SIZE, WORLD_HEIGHT * TILE_SIZE, 0xaa0000, 0)
      .setOrigin(0, 0);
    this.bloodOverlay.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.bloodOverlay.setDepth(101);

    this.buildStarfield();

    this.hintText = this.add
      .text(0, 0, '', {
        fontFamily: 'system-ui', fontSize: '22px', color: '#fff', fontStyle: 'bold',
        backgroundColor: '#00000088', padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1500);
    this.hintText.setAlpha(0);

    // Tile reticle that follows the cursor
    this.reticle = this.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE, 0xffffff, 0).setStrokeStyle(2, 0xffffff, 0.7);
    this.reticle.setDepth(14);
    this.reticle.setVisible(false);

    // Interact prompt near player
    this.interactPrompt = this.add.text(0, 0, '', {
      fontFamily: 'system-ui', fontSize: '12px', color: '#fff', fontStyle: 'bold',
      backgroundColor: '#000000cc', padding: { x: 6, y: 3 },
    }).setOrigin(0.5, 1).setDepth(1400);
    this.interactPrompt.setVisible(false);
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const tp = this.world.worldToTile(p.worldX, p.worldY);
      const dist = this.player.tileDistance(tp.x, tp.y);
      const inReach = dist <= PLAYER_REACH_TILES;
      this.reticle.setVisible(true);
      this.reticle.setPosition(tp.x * TILE_SIZE + TILE_SIZE / 2, tp.y * TILE_SIZE + TILE_SIZE / 2);
      this.reticle.setStrokeStyle(2, inReach ? 0xfff184 : 0xff6666, 0.9);
    });

    // Draw world-edge fence so map boundary is visible
    this.drawWorldBorder();

    this.refreshPlayerWeapon();

    this.scene.launch('UI', { gameScene: this });
    this.showHint('Day 1 — mine, build, press H for help');
    // If a volcano was seeded on the map, warn the player
    if (this.worldEvents.volcanoPos) {
      this.time.delayedCall(2500, () => this.showBanner('🌋 VOLCANO NEARBY', 'watch where you build — lava will spread'));
    }
  }

  private drawWorldBorder(): void {
    const g = this.add.graphics().setDepth(0.7);
    // Outer frame of dark dirt/stone-ish color
    g.fillStyle(0x0a0a0a, 1);
    g.fillRect(-4, -4, WORLD_WIDTH * TILE_SIZE + 8, 4);
    g.fillRect(-4, WORLD_HEIGHT * TILE_SIZE, WORLD_WIDTH * TILE_SIZE + 8, 8);
    g.fillRect(-4, 0, 4, WORLD_HEIGHT * TILE_SIZE);
    g.fillRect(WORLD_WIDTH * TILE_SIZE, 0, 4, WORLD_HEIGHT * TILE_SIZE);
    // Spikey posts every 3 tiles
    for (let x = 0; x < WORLD_WIDTH; x += 3) {
      const px = x * TILE_SIZE + TILE_SIZE / 2;
      g.fillStyle(0x3a2410, 1);
      g.fillRect(px - 2, -10, 4, 10);
      g.fillStyle(0x8a5a30, 1);
      g.fillRect(px - 1, -10, 2, 4);
    }
  }

  /**
   * Scatter decorative clutter (flowers, small rocks, bushes) on grass tiles.
   * Painted into a single Graphics object on depth 0.5 (above ground texture, below entities).
   */
  private drawDecor(seed: number): void {
    const g = this.add.graphics().setDepth(0.5);
    let hash = seed >>> 0;
    const rand = () => {
      hash = (Math.imul(hash ^ (hash >>> 15), hash | 1) + 0x6d2b79f5) >>> 0;
      return (hash & 0xffffff) / 0xffffff;
    };
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let x = 0; x < WORLD_WIDTH; x++) {
        const t = this.world.tiles[y][x];
        if (t.type !== TileType.Grass) continue;
        const r = rand();
        const cx = x * TILE_SIZE + TILE_SIZE / 2;
        const cy = y * TILE_SIZE + TILE_SIZE / 2;
        if (r < 0.02) {
          // flower
          const colors = [0xffd166, 0xff4d88, 0x8aa0ff, 0xffffff];
          const c = colors[Math.floor(rand() * colors.length)];
          const px = cx + (rand() - 0.5) * 12;
          const py = cy + (rand() - 0.5) * 12;
          g.fillStyle(0x3a7a3a, 1);
          g.fillRect(px, py, 1, 3);
          g.fillStyle(c, 1);
          g.fillRect(px - 1, py - 2, 3, 3);
          g.fillStyle(0xffee88, 1);
          g.fillRect(px, py - 1, 1, 1);
        } else if (r < 0.028) {
          // small rock
          const px = cx + (rand() - 0.5) * 16;
          const py = cy + (rand() - 0.5) * 16;
          g.fillStyle(0x6a6a6a, 1);
          g.fillRect(px - 2, py - 1, 5, 3);
          g.fillStyle(0x8a8a8a, 1);
          g.fillRect(px - 1, py - 1, 3, 1);
          g.fillStyle(0x3a3a3a, 1);
          g.fillRect(px - 2, py + 1, 5, 1);
        } else if (r < 0.036) {
          // bush
          const px = cx + (rand() - 0.5) * 12;
          const py = cy + (rand() - 0.5) * 10;
          g.fillStyle(0x2e7d32, 1);
          g.fillRect(px - 4, py - 3, 9, 6);
          g.fillStyle(0x3e9736, 1);
          g.fillRect(px - 3, py - 3, 3, 3);
          g.fillStyle(0x1d5820, 1);
          g.fillRect(px - 4, py + 2, 9, 1);
        } else if (r < 0.04) {
          // mushroom
          const px = cx + (rand() - 0.5) * 14;
          const py = cy + (rand() - 0.5) * 14;
          g.fillStyle(0xffffff, 1);
          g.fillRect(px, py, 1, 2);
          g.fillStyle(0xd04040, 1);
          g.fillRect(px - 1, py - 1, 3, 2);
          g.fillStyle(0xffffff, 1);
          g.fillRect(px, py - 1, 1, 1);
        }
      }
    }
  }

  handleInteractPressed(): void {
    const p = this.world.worldToTile(this.player.x, this.player.y);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = p.x + dx;
        const ty = p.y + dy;
        const t = this.world.getTileAt(tx, ty);
        if (!t) continue;
        if (t.type === TileType.ShopNPC) {
          this.openModal('shop');
          return;
        }
        if (t.type === TileType.CraftingBench) {
          this.openModal('craft');
          return;
        }
        if (t.type === TileType.DoorWood || t.type === TileType.DoorIron) {
          this.world.toggleDoor(tx, ty);
          sounds.click();
          return;
        }
      }
    }
  }

  openModal(mode: 'shop' | 'craft'): void {
    this.scene.get('UI').events.emit('open_modal', mode);
  }

  benchAvailable(): boolean {
    return true; // No bench required in simplified mode.
  }

  popNumber(x: number, y: number, text: string, color: string): void {
    const t = this.add.text(x, y, text, {
      fontFamily: 'system-ui', fontSize: '14px', color, fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(25);
    this.tweens.add({
      targets: t,
      y: y - 24,
      alpha: 0,
      duration: 600,
      onComplete: () => t.destroy(),
    });
  }

  handleTileInteraction(worldX: number, worldY: number): void {
    const tp = this.world.worldToTile(worldX, worldY);
    if (!this.state.running) return;
    const dist = this.player.tileDistance(tp.x, tp.y);
    const act = HOTBAR[this.state.hotbarSlot];
    if (!act) return;

    if (act.kind === 'mine') {
      if (dist > PLAYER_REACH_TILES) return;
      const t = this.world.getTileAt(tp.x, tp.y);
      if (!t || !isBreakable(t.type)) return;
      // Birthday cake — full heal + confetti celebration
      if (t.type === TileType.Cake) {
        this.world.damageTile(tp.x, tp.y, 999);
        this.state.playerHp = this.state.playerMaxHp;
        sounds.cake();
        const wc = this.world.tileToWorldCenter(tp.x, tp.y);
        // Confetti
        const colors = [0xff4d88, 0xffd166, 0x8aa0ff, 0x7fce7f, 0xff66aa, 0xffffff];
        for (const c of colors) this.effects.burst(wc.x, wc.y - 6, c, 12, 160, 900, 1.2);
        this.popNumber(this.player.x, this.player.y - 20, '+HP full!', '#ffccee');
        this.showBanner('🎂  HAPPY BIRTHDAY', 'Robert — full heal!');
        return;
      }
      const res = this.world.mineTile(tp.x, tp.y, this.state.pickaxeTier, 4);
      if (res.ok) {
        sounds.mine();
        const wc = this.world.tileToWorldCenter(tp.x, tp.y);
        this.effects.miningDust(wc.x, wc.y, TILE_SPECS[t.type].tintColor);
        if (res.broken) {
          sounds.mineBreak();
          this.state.stats.tilesMined += 1;
          if (res.drop && res.drop.count > 0) {
            this.pickups.push(new Pickup(this, wc.x, wc.y, res.drop.material, res.drop.count));
          }
          // Chests spill a generous loot pile
          if (t.type === TileType.Chest) {
            const loot: { m: MaterialId; c: number }[] = [
              { m: 'wood', c: 4 }, { m: 'stone', c: 3 }, { m: 'gold', c: 2 }, { m: 'arrow', c: 6 },
            ];
            for (const l of loot) {
              this.pickups.push(new Pickup(this, wc.x + (Math.random() - 0.5) * 16, wc.y + (Math.random() - 0.5) * 16, l.m, l.c));
            }
            this.effects.burst(wc.x, wc.y, 0xffd700, 20, 180, 700, 1.4);
            sounds.cake();
            this.showHint('Chest unlocked! 🎁');
          }
        }
      } else if (res.reason === 'weak_tool') this.showHint('Need better pickaxe — craft one with C');
      return;
    }

    if (act.kind === 'melee') {
      if (dist > PLAYER_REACH_TILES) return;
      if (this.player.attackCooldown() > 0) return;
      this.player.triggerAttackCooldown(300);
      const dmg = this.player.meleeAttackDamage();
      let hitSomething = false;
      for (const z of this.zombies) {
        if (!z.alive) continue;
        const d = Math.hypot(z.sprite.x - worldX, z.sprite.y - worldY);
        const zt = this.world.worldToTile(z.sprite.x, z.sprite.y);
        const hitR = Math.max(TILE_SIZE * 1.3, z.sprite.displayWidth * 0.8);
        if (d < hitR && this.player.tileDistance(zt.x, zt.y) <= 1.8) {
          hitSomething = true;
          this.effects.bloodBurst(z.sprite.x, z.sprite.y, 0x8a1a1a);
          this.popNumber(z.sprite.x, z.sprite.y - 18, `-${dmg}`, '#ffdd66');
          sounds.zombieHit();
          if (z.takeDamage(dmg)) this.onZombieKilled(z.sprite.x, z.sprite.y, z.variant);
        }
      }
      // Hit any nearby chickens too (for food)
      for (const c of this.chickens) {
        if (!c.alive) continue;
        const d = Math.hypot(c.x - worldX, c.y - worldY);
        if (d < 20 && this.player.tileDistance(this.world.worldToTile(c.x, c.y).x, this.world.worldToTile(c.x, c.y).y) <= 1.5) {
          hitSomething = true;
          this.effects.burst(c.x, c.y, c.golden ? 0xffd700 : 0xffffff, 6, 60, 300, 0.6);
          if (c.takeDamage(dmg)) {
            if (c.golden) {
              // Golden chicken rewards: lots of gold + food
              this.pickups.push(new Pickup(this, c.x, c.y, 'gold', 8));
              this.pickups.push(new Pickup(this, c.x + 8, c.y, 'food', 3));
              this.effects.burst(c.x, c.y, 0xffd700, 24, 160, 800, 1.6);
              this.showBanner('✨ GOLDEN CHICKEN', '+8 gold · +3 food');
              sounds.cake();
            } else {
              this.pickups.push(new Pickup(this, c.x, c.y, 'food', 1));
              sounds.zombieHit();
            }
          }
        }
      }
      const t = this.world.getTileAt(tp.x, tp.y);
      if (t && isBreakable(t.type) && TILE_SPECS[t.type].pickaxeTier === 0) {
        this.world.damageTile(tp.x, tp.y, Math.ceil(dmg / 2));
      }
      if (!hitSomething) sounds.click();
      return;
    }

    if (act.kind === 'ranged') {
      if (act.weapon === 'bow' && !this.state.hasBow) return this.showHint('Craft a bow first (press C)');
      if (act.weapon === 'pistol' && !this.state.hasPistol) return this.showHint('Buy a pistol from the shop');
      if (!hasItem(this.state.inventory, act.ammo, 1)) return this.showHint(`Out of ${act.ammo}s`);
      if (this.player.attackCooldown() > 0) return;
      this.player.triggerAttackCooldown(act.weapon === 'pistol' ? 220 : 450);
      removeItem(this.state.inventory, act.ammo, 1);
      const aim = Projectile.aimVector({ x: this.player.x, y: this.player.y }, { x: worldX, y: worldY });
      const spawn: ProjectileSpawn = {
        x: this.player.x + aim.dx * TILE_SIZE * 0.4,
        y: this.player.y + aim.dy * TILE_SIZE * 0.4,
        dx: aim.dx,
        dy: aim.dy,
        damage: act.weapon === 'bow' ? 14 : 30,
        owner: 'player',
        kind: act.weapon === 'bow' ? 'arrow' : 'bullet',
      };
      this.projectiles.push(new Projectile(this, this.world, spawn));
      if (act.weapon === 'bow') sounds.arrowShoot();
      else {
        sounds.pistolShoot();
        this.effects.shotMuzzle(this.player.x, this.player.y, aim.dx, aim.dy);
      }
      return;
    }

    if (act.kind === 'place') {
      if (dist > PLAYER_REACH_TILES) return;
      const t = this.world.getTileAt(tp.x, tp.y);
      if (!t) return;
      const wantsWater = act.onto === 'water';
      const validSurface = wantsWater
        ? t.type === TileType.Water
        : (t.type === TileType.Grass || t.type === TileType.Dirt);
      if (!validSurface) {
        if (wantsWater) this.showHint('Bridges go on water');
        return;
      }
      if (!hotbarAvailable(this.state.hotbarSlot, this.state)) {
        this.showHint('Missing materials');
        return;
      }
      for (const c of act.cost) removeItem(this.state.inventory, c.material, c.count);
      this.world.placeTile(tp.x, tp.y, act.tile);
      sounds.place();
      this.state.stats.tilesPlaced += 1;
      if (act.tile === TileType.TurretBasic || act.tile === TileType.TurretAdvanced) {
        const kind = act.tile === TileType.TurretAdvanced ? 'advanced' : 'basic';
        const barrel = makeTurretBarrel(this, tp.x, tp.y, kind);
        this.turrets.push({ tileX: tp.x, tileY: tp.y, kind, cooldownMs: 0, barrel });
      }
    }
  }

  private regenAccumMs = 0;
  private torchAccumMs = 0;

  private applyTorchAuraDamage(): void {
    const radius = 80; // px
    const damage = 2;
    const torches: { x: number; y: number }[] = [];
    this.world.forEachTileOfType(TileType.Torch, (tx, ty) => {
      const wc = this.world.tileToWorldCenter(tx, ty);
      torches.push(wc);
    });
    this.world.forEachTileOfType(TileType.Campfire, (tx, ty) => {
      const wc = this.world.tileToWorldCenter(tx, ty);
      torches.push(wc);
    });
    if (torches.length === 0) return;
    for (const z of this.zombies) {
      if (!z.alive) continue;
      for (const t of torches) {
        const d = Math.hypot(z.sprite.x - t.x, z.sprite.y - t.y);
        if (d < radius) {
          if (z.takeDamage(damage)) {
            this.onZombieKilled(z.sprite.x, z.sprite.y, z.variant);
          }
          this.effects.burst(z.sprite.x, z.sprite.y, 0xffa040, 2, 40, 250, 0.6);
          break;
        }
      }
    }
  }

  update(_time: number, delta: number): void {
    if (!this.state.running) return;
    const mv = this.input2.getMoveVector();
    this.player.update(delta, mv.x, mv.y);

    this.cycle.tick(delta);
    this.worldEvents.update(delta);

    // Slow HP regen during day (faster near campfire)
    if (this.state.phase === 'day' && this.state.playerHp < this.state.playerMaxHp) {
      this.regenAccumMs += delta;
      const nearCampfire = this.player.adjacentToTileType(TileType.Campfire);
      const interval = nearCampfire ? 900 : 2500;
      if (this.regenAccumMs >= interval) {
        this.regenAccumMs = 0;
        const amount = nearCampfire ? 4 : 2;
        this.state.playerHp = Math.min(this.state.playerMaxHp, this.state.playerHp + amount);
        this.popNumber(this.player.x, this.player.y - 18, `+${amount}`, '#9effa0');
      }
    }

    // Torches burn nearby zombies at night
    if (this.state.phase === 'night' || this.state.phase === 'dusk') {
      this.torchAccumMs -= delta;
      if (this.torchAccumMs <= 0) {
        this.torchAccumMs = 600;
        this.applyTorchAuraDamage();
      }
    }

    // Zombie spawn pacing — staggered, not a burst.
    if (this.state.phase === 'night' && this.nightSpawned < this.nightTarget) {
      this.nightSpawnTimerMs -= delta;
      if (this.nightSpawnTimerMs <= 0) {
        // Mini-wave: spawn a small group occasionally
        const wave = Math.random() < 0.35 ? 2 + Math.floor(Math.random() * 2) : 1;
        const n = Math.min(wave, this.nightTarget - this.nightSpawned);
        for (let i = 0; i < n; i++) this.spawnZombie();
        // Pacing: faster on later nights so the target actually spawns in time
        this.nightSpawnTimerMs = Math.max(450, 2600 - Math.min(2200, this.state.nightNumber * 140));
      }
    }

    // Boss spawns at the midpoint of boss-nights (every 5th)
    if (this.state.phase === 'night' && !this.bossSpawned && this.state.nightNumber % 5 === 0 && this.state.phaseElapsedMs > 15000) {
      this.bossSpawned = true;
      this.spawnBoss();
    }

    // Combo countdown
    if (this.combo > 0) {
      this.comboTimerMs -= delta;
      if (this.comboTimerMs <= 0) this.combo = 0;
    }

    // Lightning strikes during rain
    if (this.rainActive) {
      this.lightningTimerMs -= delta;
      if (this.lightningTimerMs <= 0) {
        this.lightningTimerMs = 8000 + Math.random() * 8000;
        this.strikeLightning();
      }
    }

    // Night approaching countdown during day (last 10 seconds)
    if (this.state.phase === 'day') {
      const remaining = this.cycle.phaseDuration(this.state.phase) - this.state.phaseElapsedMs;
      const seconds = Math.ceil(remaining / 1000);
      if (seconds <= 10 && seconds > 0 && seconds !== this.lastDayCountdown) {
        this.lastDayCountdown = seconds;
        this.showHint(`Night in ${seconds}…`);
      }
      if (seconds > 10) this.lastDayCountdown = -1;
    }

    // Early dawn: if all zombies for tonight are spawned and none alive, skip remaining night
    if (this.state.phase === 'night' && this.nightSpawned >= this.nightTarget && this.zombies.length === 0) {
      const remaining = this.cycle.phaseDuration(this.state.phase) - this.state.phaseElapsedMs;
      if (remaining > 500) this.state.phaseElapsedMs = this.cycle.phaseDuration(this.state.phase) - 400;
    }

    for (const z of this.zombies) z.update(delta, this.player, this.zombies);
    // Zombies bite the dog if they're adjacent to it
    if (this.dog?.alive) {
      for (const z of this.zombies) {
        if (!z.alive) continue;
        const d = Math.hypot(z.sprite.x - this.dog.x, z.sprite.y - this.dog.y);
        if (d < 22 && Math.random() < delta / 1200) {
          this.dog.hurt(z.damage / 2);
          this.effects.bloodBurst(this.dog.x, this.dog.y, 0x8a1a1a);
        }
      }
    }
    this.zombies = this.zombies.filter((z) => z.alive);

    if (this.dog?.alive) {
      this.dog.update(delta, this.player, this.zombies);
    }

    // Chickens wander around
    for (const c of this.chickens) c.update(delta, this.player.x, this.player.y);
    this.chickens = this.chickens.filter((c) => c.alive);

    // Turrets
    const spawns = tickTurrets(this.turrets, this.zombies, this.world, delta);
    for (const s of spawns) {
      this.projectiles.push(new Projectile(this, this.world, s));
      sounds.turretShoot();
    }
    this.turrets = this.turrets.filter((t) => {
      const tile = this.world.getTileAt(t.tileX, t.tileY);
      if (!tile || (tile.type !== TileType.TurretBasic && tile.type !== TileType.TurretAdvanced)) {
        t.barrel.destroy();
        return false;
      }
      return true;
    });

    // Projectiles
    for (const pr of this.projectiles) {
      pr.update(delta);
      if (!pr.alive) continue;
      for (const z of this.zombies) {
        if (!z.alive) continue;
        const d = Math.hypot(z.sprite.x - pr.sprite.x, z.sprite.y - pr.sprite.y);
        // Hit radius scales with zombie visual size (armored zombies are bigger)
        const hitR = Math.max(12, z.sprite.displayWidth * 0.45);
        if (d < hitR) {
          this.effects.bloodBurst(z.sprite.x, z.sprite.y, 0x8a1a1a);
          this.popNumber(z.sprite.x, z.sprite.y - 18, `-${pr.damage}`, pr.kind === 'bullet' ? '#ffaa33' : '#ddddff');
          sounds.zombieHit();
          if (z.takeDamage(pr.damage)) this.onZombieKilled(z.sprite.x, z.sprite.y, z.variant);
          pr.destroy();
          break;
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.alive);

    // Pickups
    for (const p of this.pickups) {
      const res = p.update(delta, this.player.x, this.player.y);
      if (res.collect) {
        addItem(this.state.inventory, p.material, p.count);
        this.popNumber(this.player.x, this.player.y - 20, `+${p.count} ${p.material}`, '#a0ffa0');
        sounds.pickup();
      }
    }
    this.pickups = this.pickups.filter((p) => p.alive);

    // Night overlay alpha
    let alpha = 0;
    switch (this.state.phase) {
      case 'day': alpha = 0; break;
      case 'dusk': alpha = 0.35 * this.cycle.phaseProgress(); break;
      case 'night': alpha = 0.58; break;
      case 'dawn': alpha = 0.58 * (1 - this.cycle.phaseProgress()); break;
    }
    this.nightOverlay.setFillStyle(COLORS.night_overlay, alpha);

    // Warm sunset/sunrise overlay: peaks during dusk & dawn, fades to 0 at pure day/night
    let warm = 0;
    if (this.state.phase === 'dusk') warm = 0.25 * (1 - Math.abs(0.5 - this.cycle.phaseProgress()) * 2);
    else if (this.state.phase === 'dawn') warm = 0.25 * (1 - Math.abs(0.5 - this.cycle.phaseProgress()) * 2);
    this.warmOverlay.setFillStyle(0xff7a33, warm);

    // Blood moon tint — only during night phase of boss nights
    if (this.bloodOverlay) {
      const bloodAlpha = (this.bloodMoon && (this.state.phase === 'night' || this.state.phase === 'dusk')) ? 0.35 : 0;
      this.bloodOverlay.setFillStyle(0xaa0000, bloodAlpha);
    }

    // Stars visible roughly proportional to overlay darkness
    const starAlpha = Math.min(1, alpha * 1.4);
    for (const s of this.stars) {
      if (s.alpha !== starAlpha) s.setAlpha(starAlpha * (0.7 + 0.3 * Math.sin((this.time.now + s.x) / 500)));
    }

    // Interact prompt: show when near shop/bench/door
    this.updateInteractPrompt();

    // Player death
    if (this.state.playerHp <= 0 && this.state.running) {
      this.state.running = false;
      sounds.playerHurt();
      this.time.delayedCall(600, () => {
        SaveStore.updateBestScore(this.state.score);
        // Death ends the run — clear the save so "Continue" doesn't offer it
        SaveLoad.clear();
        this.scene.stop('UI');
        this.scene.start('GameOver', { score: this.state.score, stats: this.state.stats, state: this.state });
      });
    }
  }

  private spawnChickens(): void {
    for (let i = 0; i < 8; i++) {
      for (let tries = 0; tries < 20; tries++) {
        const tx = 4 + Math.floor(Math.random() * (WORLD_WIDTH - 8));
        const ty = 4 + Math.floor(Math.random() * (WORLD_HEIGHT - 8));
        if (this.world.isWalkable(tx, ty)) {
          const wc = this.world.tileToWorldCenter(tx, ty);
          this.chickens.push(new Chicken(this, this.world, wc.x, wc.y));
          break;
        }
      }
    }
  }

  private spawnZombie(): void {
    this.nightSpawned += 1;
    const edge = Math.floor(Math.random() * 4);
    let tx = 1;
    let ty = 1;
    if (edge === 0) { tx = Math.floor(Math.random() * WORLD_WIDTH); ty = 1; }
    if (edge === 1) { tx = Math.floor(Math.random() * WORLD_WIDTH); ty = WORLD_HEIGHT - 2; }
    if (edge === 2) { tx = 1; ty = Math.floor(Math.random() * WORLD_HEIGHT); }
    if (edge === 3) { tx = WORLD_WIDTH - 2; ty = Math.floor(Math.random() * WORLD_HEIGHT); }
    const wc = this.world.tileToWorldCenter(tx, ty);
    this.zombies.push(new Zombie(this, this.world, wc.x, wc.y, specForNight(this.state.nightNumber)));
    this.effects.burst(wc.x, wc.y, 0x884488, 6, 60, 300, 0.8);
  }

  private spawnBoss(): void {
    const edge = Math.floor(Math.random() * 4);
    let tx = 1;
    let ty = 1;
    if (edge === 0) { tx = Math.floor(Math.random() * WORLD_WIDTH); ty = 1; }
    if (edge === 1) { tx = Math.floor(Math.random() * WORLD_WIDTH); ty = WORLD_HEIGHT - 2; }
    if (edge === 2) { tx = 1; ty = Math.floor(Math.random() * WORLD_HEIGHT); }
    if (edge === 3) { tx = WORLD_WIDTH - 2; ty = Math.floor(Math.random() * WORLD_HEIGHT); }
    const wc = this.world.tileToWorldCenter(tx, ty);
    const boss = new Zombie(this, this.world, wc.x, wc.y, specForBoss(this.state.nightNumber));
    this.zombies.push(boss);
    this.effects.burst(wc.x, wc.y, 0xff2020, 24, 140, 500, 1.6);
    this.cameras.main.shake(200, 0.005);
    // Brief zoom-out for dramatic effect
    this.tweens.add({
      targets: this.cameras.main,
      zoom: 1.1,
      duration: 300,
      yoyo: true,
      hold: 400,
      onComplete: () => this.cameras.main.setZoom(1.4),
    });
    sounds.bossRoar();
    this.showBanner('⚠ BOSS', 'a huge zombie approaches');
  }

  private onZombieKilled(x: number, y: number, variant?: string): void {
    this.scene.get('UI').events.emit('zombie_killed');
    sounds.zombieDie();
    this.effects.bloodExplode(x, y);
    this.cameras.main.shake(60, 0.002);
    this.state.stats.zombiesKilled += 1;

    // Combo: consecutive kills within 2 seconds of each other
    this.combo += 1;
    this.comboTimerMs = 2000;
    if (this.combo >= 3) {
      this.popNumber(x, y - 44, `COMBO x${this.combo}!`, this.combo >= 10 ? '#ff66aa' : this.combo >= 5 ? '#ffd166' : '#a0ffff');
    }

    const kills = this.state.stats.zombiesKilled;
    if (kills === 1) this.showHint('First blood! Keep it up');
    else if (kills === 10) this.showHint('10 down — nice!');
    else if (kills === 25) this.showHint('Quarter-century!');
    else if (kills === 50) this.showHint('50 kills — zombie slayer');

    // Boss loot — big payoff with fireworks
    if (variant === 'boss') {
      this.showBanner('🏆 BOSS DOWN', 'massive loot!');
      sounds.cake();
      this.effects.burst(x, y, 0xffd700, 40, 220, 1000, 2);
      this.launchFireworks();
      const bossLoot: { m: MaterialId; c: number }[] = [
        { m: 'gold', c: 6 }, { m: 'iron', c: 4 }, { m: 'stone', c: 3 },
        { m: 'potion', c: 1 }, { m: 'bullet', c: 5 }, { m: 'lava', c: 1 },
      ];
      for (const l of bossLoot) {
        this.pickups.push(new Pickup(this, x + (Math.random() - 0.5) * 28, y + (Math.random() - 0.5) * 28, l.m, l.c));
      }
      return;
    }

    // Drops — generous to reward kills. Combo boost + blood moon boost.
    const comboGoldBonus = Math.min(3, Math.floor(this.combo / 5));
    const moonMult = this.bloodMoon ? 1.5 : 1;
    const drops: { m: MaterialId; c: number }[] = [];
    if (Math.random() < 0.75 * moonMult) drops.push({ m: 'gold', c: 1 + comboGoldBonus });
    if (Math.random() < 0.32 * moonMult) drops.push({ m: 'wood', c: 1 });
    if (Math.random() < 0.16 * moonMult) drops.push({ m: 'stone', c: 1 });
    if (Math.random() < 0.08 * moonMult) drops.push({ m: 'iron', c: 1 });
    if (Math.random() < 0.02 * moonMult) drops.push({ m: 'potion', c: 1 });
    for (const d of drops) {
      this.pickups.push(new Pickup(this, x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10, d.m, d.c));
      if (d.m === 'gold') this.state.stats.goldEarned += d.c;
    }
    this.popNumber(x, y - 30, '+' + (drops.length ? drops.map((d) => d.m[0].toUpperCase()).join('') : 'kill'), '#a0ffa0');
  }

  refreshPlayerWeapon(): void {
    const act = HOTBAR[this.state.hotbarSlot];
    if (!act) { this.player.setEquippedWeaponTexture(null); return; }
    switch (act.kind) {
      case 'mine': this.player.setEquippedWeaponTexture('weapon_pickaxe'); break;
      case 'melee': this.player.setEquippedWeaponTexture('weapon_sword'); break;
      case 'ranged':
        this.player.setEquippedWeaponTexture(act.weapon === 'bow' ? 'weapon_bow' : 'weapon_pistol');
        break;
      default: this.player.setEquippedWeaponTexture(null);
    }
  }

  private updateInteractPrompt(): void {
    const p = this.world.worldToTile(this.player.x, this.player.y);
    let prompt = '';
    outer: for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const t = this.world.getTileAt(p.x + dx, p.y + dy);
        if (!t) continue;
        if (t.type === TileType.ShopNPC) { prompt = 'E — open Shop'; break outer; }
        if (t.type === TileType.CraftingBench) { prompt = 'E — Crafting'; break outer; }
        if (t.type === TileType.DoorWood || t.type === TileType.DoorIron) { prompt = 'E — open/close door'; break outer; }
      }
    }
    if (prompt) {
      this.interactPrompt.setText(prompt);
      this.interactPrompt.setPosition(this.player.x, this.player.y - 26);
      this.interactPrompt.setVisible(true);
    } else {
      this.interactPrompt.setVisible(false);
    }
  }

  private buildStarfield(): void {
    // Create ~60 stars scattered across the world at depth 99 (below overlay)
    // Stars are invisible during day and fade in at dusk/night.
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * WORLD_WIDTH * TILE_SIZE;
      const y = Math.random() * WORLD_HEIGHT * TILE_SIZE;
      const s = this.add.image(x, y, 'star');
      s.setDepth(99);
      s.setAlpha(0);
      s.setScale(0.7 + Math.random() * 0.6);
      // Gentle twinkle tween
      this.tweens.add({
        targets: s,
        scale: s.scale * 1.3,
        duration: 800 + Math.random() * 1600,
        yoyo: true,
        repeat: -1,
      });
      this.stars.push(s);
    }
  }

  startRain(): void {
    if (this.rainActive) return;
    this.rainActive = true;
    this.showHint('🌧 It\'s raining today');
    // Camera-locked emitter covering a band above the visible screen
    this.rainEmitter = this.add.particles(0, 0, 'raindrop', {
      x: { min: -20, max: this.scale.width + 100 },
      y: -20,
      lifespan: 1200,
      speedY: { min: 600, max: 900 },
      speedX: { min: -120, max: -60 },
      quantity: 3,
      frequency: 35,
      scale: { start: 1, end: 1 },
      alpha: { start: 0.55, end: 0.25 },
      blendMode: 'NORMAL',
    });
    this.rainEmitter.setScrollFactor(0);
    this.rainEmitter.setDepth(200);
  }

  stopRain(): void {
    if (!this.rainActive) return;
    this.rainActive = false;
    this.rainEmitter?.stop();
    // Let existing drops fade out
    this.time.delayedCall(1500, () => {
      this.rainEmitter?.destroy();
      this.rainEmitter = undefined;
    });
  }

  private strikeLightning(): void {
    // Pick a random tile in the camera view to strike
    const cam = this.cameras.main;
    const wx = cam.worldView.x + Math.random() * cam.worldView.width;
    const wy = cam.worldView.y + Math.random() * cam.worldView.height;
    const tp = this.world.worldToTile(wx, wy);
    // Big bright flash overlay
    const flash = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0xffffff, 0.85)
      .setScrollFactor(0).setOrigin(0, 0).setDepth(250);
    this.tweens.add({ targets: flash, alpha: 0, duration: 180, onComplete: () => flash.destroy() });
    // Bolt graphics
    const bolt = this.add.rectangle(wx, wy - 200, 4, 400, 0xf8f8ff, 0.9).setDepth(60);
    this.tweens.add({ targets: bolt, alpha: 0, duration: 260, onComplete: () => bolt.destroy() });
    this.cameras.main.shake(240, 0.006);
    sounds.bossRoar();
    this.effects.burst(wx, wy, 0xffffaa, 20, 160, 700, 1.4);
    // Damage any zombie in radius
    const radius = 48;
    for (const z of this.zombies) {
      if (!z.alive) continue;
      if (Math.hypot(z.sprite.x - wx, z.sprite.y - wy) < radius) {
        if (z.takeDamage(40)) this.onZombieKilled(z.sprite.x, z.sprite.y, z.variant);
      }
    }
    // Set a tile on fire — damage breakable tile at impact
    const tile = this.world.getTileAt(tp.x, tp.y);
    if (tile && isBreakable(tile.type)) this.world.damageTile(tp.x, tp.y, 50);
  }

  private launchFireworks(): void {
    const colors = [0xff4d88, 0xffd166, 0x8aa0ff, 0x7fce7f, 0xff66aa, 0xffffff, 0xa0ffff];
    const cam = this.cameras.main;
    // Fire 6 bursts with small delays at random points in the visible camera view
    for (let i = 0; i < 6; i++) {
      this.time.delayedCall(i * 180, () => {
        const x = cam.worldView.x + Math.random() * cam.worldView.width;
        const y = cam.worldView.y + Math.random() * cam.worldView.height * 0.6;
        const c = colors[Math.floor(Math.random() * colors.length)];
        this.effects.burst(x, y, c, 24, 200, 900, 1.4);
        sounds.click();
      });
    }
  }

  saveRun(hintText = 'Game saved'): void {
    const ok = SaveLoad.save({
      state: this.state,
      tiles: this.world.tiles,
      playerSpawn: this.world.playerSpawn,
      shopPos: this.world.shopPos,
      playerWorldPos: { x: this.player.x, y: this.player.y },
      dog: this.dog
        ? { alive: this.dog.alive, hp: this.dog.hp, level: this.dog.level, kills: this.dog.kills, x: this.dog.x, y: this.dog.y }
        : null,
    });
    if (ok) this.showHint(`💾 ${hintText}`);
  }

  showBanner(title: string, subtitle: string): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const main = this.add.text(w / 2, h / 2 - 20, title, {
      fontFamily: 'system-ui', fontSize: '46px', color: '#ffd166', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2200).setAlpha(0);
    const sub = this.add.text(w / 2, h / 2 + 26, subtitle, {
      fontFamily: 'system-ui', fontSize: '16px', color: '#fff',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2200).setAlpha(0);
    this.tweens.add({
      targets: [main, sub],
      alpha: 1,
      duration: 200,
      yoyo: true,
      hold: 1200,
      onComplete: () => { main.destroy(); sub.destroy(); },
    });
  }

  showHint(text: string): void {
    this.hintText.setText(text);
    this.hintText.setPosition(this.scale.width / 2, 76);
    this.hintText.setAlpha(1);
    this.tweens.killTweensOf(this.hintText);
    this.tweens.add({
      targets: this.hintText,
      alpha: 0,
      duration: 1600,
      delay: 1200,
    });
  }
}
