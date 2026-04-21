import Phaser from 'phaser';
import { TILE_SIZE, WORLD_HEIGHT, WORLD_WIDTH, COLORS, PLAYER_MAX_HP, PLAYER_REACH_TILES } from '../config';
import { World } from '../world/World';
import { Player } from '../entities/Player';
import { Zombie, specForNight, specForBoss } from '../entities/Zombie';
import { Projectile, ProjectileSpawn } from '../entities/Projectile';
import { TurretInstance, makeTurretBarrel, tickTurrets } from '../entities/Turret';
import { Pickup } from '../entities/Pickup';
import { InputSystem } from '../systems/Input';
import { DayNightCycle } from '../systems/DayNightCycle';
import { SaveStore } from '../systems/SaveStore';
import { sounds } from '../systems/Sound';
import { Effects } from '../gfx/Effects';
import { GameState, makeGameState, addItem, removeItem, hasItem } from '../state/GameState';
import { TileType, TILE_SPECS, MaterialId, isBreakable } from '../world/tileTypes';
import { HOTBAR, hotbarAvailable } from '../ui/hotbarDef';

export class GameScene extends Phaser.Scene {
  state!: GameState;
  world!: World;
  player!: Player;
  cycle!: DayNightCycle;
  effects!: Effects;
  zombies: Zombie[] = [];
  projectiles: Projectile[] = [];
  turrets: TurretInstance[] = [];
  pickups: Pickup[] = [];
  input2!: InputSystem;
  readonly events2 = new Phaser.Events.EventEmitter();
  private nightSpawned = 0;
  private nightTarget = 0;
  private nightSpawnTimerMs = 0;
  private bossSpawned = false;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private hintText!: Phaser.GameObjects.Text;
  private reticle!: Phaser.GameObjects.Rectangle;
  private interactPrompt!: Phaser.GameObjects.Text;

  constructor() {
    super('Game');
  }

  create(): void {
    this.state = makeGameState();
    this.state.playerHp = PLAYER_MAX_HP;
    this.state.playerMaxHp = PLAYER_MAX_HP;
    // Starter kit — enough resources to try the game right away.
    addItem(this.state.inventory, 'wood', 12);
    addItem(this.state.inventory, 'stone', 4);

    this.cameras.main.setBackgroundColor(0x0e1116);
    this.physics.world.setBounds(0, 0, WORLD_WIDTH * TILE_SIZE, WORLD_HEIGHT * TILE_SIZE);

    const seed = Math.floor(Math.random() * 2 ** 31);
    this.world = new World(this, seed);
    this.world.drawAll();
    this.drawDecor(seed);

    this.effects = new Effects(this);

    this.player = new Player(this, this.state, this.world);
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
      const sub = isBossNight ? `${target} zombies + BOSS incoming` : `${target} zombies incoming`;
      this.showBanner(`NIGHT ${this.state.nightNumber}`, sub);
    });
    this.cycle.events.on('dawn', () => {
      for (const z of this.zombies) z.die();
      this.zombies = [];
      sounds.dawn();
      this.showBanner('☼ DAWN', 'you survived! nice work');
    });
    this.cycle.events.on('phase_changed', (phase: GameState['phase']) => {
      if (phase === 'day') this.showHint('Day — mine, build, craft');
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
      sounds.click();
    });
    this.input2.events.on('interact', () => this.handleInteractPressed());
    this.input2.events.on('skip_to_night', () => this.cycle.skipToNight());

    this.input.keyboard?.on('keydown-C', () => {
      sounds.ensure();
      this.scene.get('UI').events.emit('open_modal', 'craft');
    });

    this.input.on('wheel', (_p: any, _obj: any, _dx: number, dy: number) => {
      const dir = dy > 0 ? 1 : -1;
      this.state.hotbarSlot = (this.state.hotbarSlot + dir + HOTBAR.length) % HOTBAR.length;
      this.scene.get('UI').events.emit('hotbar_changed');
    });

    // Zombie-world events → sounds + particles
    this.events.on('zombie_hit_player', (x: number, y: number) => {
      sounds.playerHurt();
      this.effects.bloodBurst(x, y, 0x8a1a1a);
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

    this.scene.launch('UI', { gameScene: this });
    this.showHint('Day 1 — mine, build, press H for help');
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
          if (z.takeDamage(dmg)) this.onZombieKilled(z.sprite.x, z.sprite.y);
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
      if (!t || (t.type !== TileType.Grass && t.type !== TileType.Dirt)) return;
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

  update(_time: number, delta: number): void {
    if (!this.state.running) return;
    const mv = this.input2.getMoveVector();
    this.player.update(delta, mv.x, mv.y);

    this.cycle.tick(delta);

    // Slow HP regen during day (not dusk/night/dawn)
    if (this.state.phase === 'day' && this.state.playerHp < this.state.playerMaxHp) {
      this.regenAccumMs += delta;
      if (this.regenAccumMs >= 2500) {
        this.regenAccumMs = 0;
        this.state.playerHp = Math.min(this.state.playerMaxHp, this.state.playerHp + 2);
        this.popNumber(this.player.x, this.player.y - 18, '+2', '#9effa0');
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

    // Early dawn: if all zombies for tonight are spawned and none alive, skip remaining night
    if (this.state.phase === 'night' && this.nightSpawned >= this.nightTarget && this.zombies.length === 0) {
      const remaining = this.cycle.phaseDuration(this.state.phase) - this.state.phaseElapsedMs;
      if (remaining > 500) this.state.phaseElapsedMs = this.cycle.phaseDuration(this.state.phase) - 400;
    }

    for (const z of this.zombies) z.update(delta, this.player, this.zombies);
    this.zombies = this.zombies.filter((z) => z.alive);

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
          if (z.takeDamage(pr.damage)) this.onZombieKilled(z.sprite.x, z.sprite.y);
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

    // Interact prompt: show when near shop/bench/door
    this.updateInteractPrompt();

    // Player death
    if (this.state.playerHp <= 0 && this.state.running) {
      this.state.running = false;
      sounds.playerHurt();
      this.time.delayedCall(600, () => {
        SaveStore.updateBestScore(this.state.score);
        this.scene.stop('UI');
        this.scene.start('GameOver', { score: this.state.score, stats: this.state.stats });
      });
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
    sounds.bossRoar();
    this.showBanner('⚠ BOSS', 'a huge zombie approaches');
  }

  private onZombieKilled(x: number, y: number): void {
    this.scene.get('UI').events.emit('zombie_killed');
    sounds.zombieDie();
    this.effects.bloodExplode(x, y);
    this.cameras.main.shake(60, 0.002);
    this.state.stats.zombiesKilled += 1;

    const kills = this.state.stats.zombiesKilled;
    if (kills === 1) this.showHint('First blood! Keep it up');
    else if (kills === 10) this.showHint('10 down — nice!');
    else if (kills === 25) this.showHint('Quarter-century!');
    else if (kills === 50) this.showHint('50 kills — zombie slayer');

    // Drops — generous to reward kills
    const drops: { m: MaterialId; c: number }[] = [];
    if (Math.random() < 0.75) drops.push({ m: 'gold', c: 1 });
    if (Math.random() < 0.32) drops.push({ m: 'wood', c: 1 });
    if (Math.random() < 0.16) drops.push({ m: 'stone', c: 1 });
    if (Math.random() < 0.08) drops.push({ m: 'iron', c: 1 });
    if (Math.random() < 0.02) drops.push({ m: 'potion', c: 1 });
    for (const d of drops) {
      this.pickups.push(new Pickup(this, x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10, d.m, d.c));
      if (d.m === 'gold') this.state.stats.goldEarned += d.c;
    }
    this.popNumber(x, y - 30, '+' + (drops.length ? drops.map((d) => d.m[0].toUpperCase()).join('') : 'kill'), '#a0ffa0');
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
