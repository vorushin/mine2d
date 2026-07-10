import Phaser from 'phaser';
import { TILE_SIZE, WORLD_HEIGHT, WORLD_WIDTH, PLAYER_MAX_HP, PLAYER_REACH_TILES } from '../config';
import { World } from '../world/World';
import { Player } from '../entities/Player';
import { Zombie, ZombieSpec, ZombieVariant, specForNight, specForGoblin, specForCave } from '../entities/Zombie';
import { GeneratedCave, generateCave } from '../world/generateCave';
import { Tile } from '../world/generate';
import {
  BOSS_INTROS, FallenRecord, GATE_HINT, KING_PHASES, NECRO_CHANNEL_DURATION_MS,
  NECRO_CHANNEL_EVERY_MS, NECRO_RAISE_COUNT, NECRO_RAISED_HP_FACTOR,
  QUEEN_SPAWN_EVERY_MS, QUEEN_SPIDERLING_COUNT, bossKindForNight, kingPhase,
  kingSpec, pickFallenToRaise, specForBossKind,
} from '../systems/Bosses';
import { specForSpiderling } from '../entities/Zombie';
import { GUARDIANS_PER_CRYPT, findCrypts, graveyardNightBonus } from '../systems/Graveyards';
import { cryptLoot } from '../systems/LootTables';
import { Projectile, ProjectileSpawn } from '../entities/Projectile';
import { TurretInstance, makeTurretBarrel, tickTurrets } from '../entities/Turret';
import { Pickup } from '../entities/Pickup';
import { PowerOrb } from '../entities/PowerOrb';
import { Companion } from '../entities/Companion';
import { ClassId, CompanionId, MetaStore, ModifierId, starCoinsForRun } from '../systems/MetaStore';
import { applyClassStart, classBowBonus, classMineMult } from '../systems/Classes';
import { generateWorld } from '../world/generate';
import { CHICKEN_ARMY_MAX, Chicken } from '../entities/Chicken';
import { InputSystem } from '../systems/Input';
import { DayNightCycle } from '../systems/DayNightCycle';
import { SaveStore } from '../systems/SaveStore';
import { SaveLoad, SaveSnapshot } from '../systems/SaveLoad';
import { sounds } from '../systems/Sound';
import { music } from '../systems/Music';
import { Effects } from '../gfx/Effects';
import { WorldEvents } from '../systems/WorldEvents';
import { LightingSystem } from '../systems/Lighting';
import { useHammer, bombExplosion, BombVictim } from '../systems/Engineering';
import { DailyQuestKind, GameState, PowerUpKind, makeGameState, addItem, removeItem, hasItem } from '../state/GameState';
import { ensureDailyQuest, questRewardLabel, recordQuestProgress } from '../systems/DailyQuests';
import { applyPowerUp, damageMultiplierForState, randomPowerUpKind, tickPowerUps } from '../systems/PowerUps';
import { NIGHT_TWISTS, NightTwist, chooseNightTwist } from '../systems/NightTwists';
import { SpawnDirector } from '../systems/SpawnDirector';
import { bossLoot, crateLoot, rollKillDrops, treasureDigLoot, vaultLoot } from '../systems/LootTables';
import { HERO_BLAST_DAMAGE, HERO_BLAST_MAX_CHARGE, HERO_BLAST_RADIUS_PX, addHeroCharge, canUseHeroBlast as canUseHeroBlastState, consumeHeroBlast, heroChargeForKill } from '../systems/HeroBlast';
import { TileType, TILE_SPECS, MaterialId, isBreakable, isPlaceableGround } from '../world/tileTypes';
import { TEX } from '../gfx/textures';
import { HOTBAR, cyclePrimaryHotbarSlot, hotbarAvailable } from '../ui/hotbarDef';
import { BOMB_DAMAGE, BOMB_RADIUS } from '../config';

const SPIKE_TRAP_DAMAGE = 7;
const SPIKE_TRAP_TICK_MS = 650;
const SPIKE_TRAP_TRIGGER_RADIUS = 18;

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
  powerOrbs: PowerOrb[] = [];
  dog?: Companion;
  buddy?: Companion;
  chickens: Chicken[] = [];
  input2!: InputSystem;
  readonly events2 = new Phaser.Events.EventEmitter();
  nightTwist: NightTwist = NIGHT_TWISTS.normal;
  readonly director = new SpawnDirector();
  runSeed = 0;
  caves: (GeneratedCave | null)[] = [null, null, null];
  private surfaceTiles: Tile[][] = [];
  private lastEntrance: { x: number; y: number } | null = null;
  private surfaceOnly: Phaser.GameObjects.GameObject[] = [];
  private webTiles: { x: number; y: number; ttlMs: number }[] = [];
  // Boss fight state
  private fallenThisNight: FallenRecord[] = [];
  private necroTimerMs = NECRO_CHANNEL_EVERY_MS;
  private necroChannelMs = 0;
  private necroChannelStartHp = 0;
  private necroBeam?: Phaser.GameObjects.Arc;
  private queenTimerMs = QUEEN_SPAWN_EVERY_MS;
  private kingSummonMs = 0;
  private kingPhaseNow: 1 | 2 | 3 = 1;
  private combo = 0;
  private comboTimerMs = 0;
  private lastDayCountdown = -1;
  private bloodMoon = false;
  private bloodOverlay?: Phaser.GameObjects.Rectangle;
  lighting!: LightingSystem;
  private warmOverlay!: Phaser.GameObjects.Rectangle;
  private hintText!: Phaser.GameObjects.Text;
  private reticle!: Phaser.GameObjects.Rectangle;
  private interactPrompt!: Phaser.GameObjects.Text;
  private rainEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private rainActive = false;
  private lightningTimerMs = 0;
  private stars: Phaser.GameObjects.Image[] = [];

  private pendingLoad: SaveSnapshot | null = null;
  private pendingRunConfig: { classId: ClassId; buddyId: CompanionId | null; modifierId: ModifierId | null } | null = null;

  constructor() {
    super('Game');
  }

  init(data?: {
    loadSnapshot?: SaveSnapshot;
    runConfig?: { classId: ClassId; buddyId: CompanionId | null; modifierId: ModifierId | null };
  }): void {
    this.pendingLoad = data?.loadSnapshot ?? null;
    this.pendingRunConfig = data?.runConfig ?? null;
  }

  create(): void {
    const loaded = this.pendingLoad;
    this.pendingLoad = null;

    const runConfig = this.pendingRunConfig;
    this.pendingRunConfig = null;

    if (loaded) {
      this.state = loaded.state;
    } else {
      this.state = makeGameState();
      this.state.playerHp = PLAYER_MAX_HP;
      this.state.playerMaxHp = PLAYER_MAX_HP;
      addItem(this.state.inventory, 'wood', 12);
      addItem(this.state.inventory, 'stone', 4);
      if (runConfig) {
        applyClassStart(this.state, runConfig.classId);
        this.state.buddyId = runConfig.buddyId;
        this.state.modifierId = runConfig.modifierId;
      }
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
      this.world = new World(this, generateWorld(seed, this.state.modifierId));
    }
    this.world.drawAll();
    this.runSeed = loaded?.runSeed ?? seed;
    this.surfaceTiles = this.world.tiles;
    this.caves = loaded?.caves ?? [null, null, null];
    this.drawDecor(this.runSeed);

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
    this.dog = new Companion(this, this.world, 'rex', this.player.x + 18, this.player.y + 6);
    if (loaded?.dog) {
      if (!loaded.dog.alive) {
        this.dog.die();
        this.dog = undefined;
      } else {
        this.dog.setPosition(loaded.dog.x, loaded.dog.y);
        this.dog.hp = loaded.dog.hp;
        this.dog.level = loaded.dog.level;
        this.dog.kills = loaded.dog.kills;
      }
    }
    // The chosen buddy joins Rex
    if (this.state.buddyId) {
      this.buddy = new Companion(this, this.world, this.state.buddyId, this.player.x - 18, this.player.y + 6);
      if (loaded?.buddy) {
        if (!loaded.buddy.alive) {
          this.buddy.die();
          this.buddy = undefined;
        } else {
          this.buddy.setPosition(loaded.buddy.x, loaded.buddy.y);
          this.buddy.hp = loaded.buddy.hp;
          this.buddy.level = loaded.buddy.level;
          this.buddy.kills = loaded.buddy.kills;
        }
      }
    }
    this.spawnChickens();
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH * TILE_SIZE, WORLD_HEIGHT * TILE_SIZE);
    this.cameras.main.setZoom(1.4);

    this.input2 = new InputSystem(this);
    this.cycle = new DayNightCycle(this.state);

    this.cycle.events.on('night_started', (_n: number, baseTarget: number) => {
      this.nightTwist = chooseNightTwist(this.state.nightNumber);
      // Endless+ (after beating the King): bigger sieges
      const adjustedBase = this.state.endlessPlus ? Math.ceil(baseTarget * 1.5) : baseTarget;
      // Intact graveyards feed the horde
      const intactCrypts = findCrypts(this.surfaceTiles).length;
      const graveBonus = graveyardNightBonus(intactCrypts, adjustedBase);
      const target = this.director.beginNight(adjustedBase, this.nightTwist, graveBonus);
      this.fallenThisNight = [];
      sounds.nightStart();
      const isBossNight = this.state.nightNumber % 5 === 0;
      this.bloodMoon = isBossNight;
      music.setTheme(isBossNight ? 'boss' : 'night');
      const graveNote = graveBonus > 0 ? `  ·  +${graveBonus} from graveyards ⚰` : '';
      const sub = isBossNight
        ? `🩸 BLOOD MOON  ·  ${target} zombies + BOSS${graveNote}`
        : this.nightTwist.kind !== 'normal'
          ? `${this.nightTwist.label}  ·  ${target} zombies  ·  ${this.nightTwist.subtitle}${graveNote}`
          : `${target} zombies incoming${graveNote}`;
      this.showBanner(`NIGHT ${this.state.nightNumber}`, sub);
      if (isBossNight) this.cameras.main.shake(400, 0.006);
    });
    this.cycle.events.on('dawn', () => {
      // Graveyard guardians survive the dawn; the siege does not
      for (const z of this.zombies) {
        if (!z.persistent) z.die();
      }
      this.zombies = this.zombies.filter((z) => z.alive);
      this.bloodMoon = false;
      this.nightTwist = NIGHT_TWISTS.normal;
      sounds.dawn();
      // +max HP every time you survive
      this.state.playerMaxHp += 15;
      this.state.playerHp = Math.min(this.state.playerMaxHp, this.state.playerHp + 40);
      this.showBanner('☼ DAWN', `you survived! +15 max HP · ${this.state.playerHp}/${this.state.playerMaxHp}`);
      // Heal companions to full at dawn, or revive the fallen
      if (this.dog?.alive) this.dog.heal(this.dog.maxHp);
      else {
        this.dog = new Companion(this, this.world, 'rex', this.player.x + 18, this.player.y + 6);
        this.showHint('🐶 Rex is back!');
      }
      if (this.state.buddyId) {
        if (this.buddy?.alive) this.buddy.heal(this.buddy.maxHp);
        else {
          this.buddy = new Companion(this, this.world, this.state.buddyId, this.player.x - 18, this.player.y + 6);
          this.showHint(`✨ ${this.buddy.spec.name} is back!`);
        }
      }
      // Auto-save the run
      this.saveRun('Auto-saved at dawn');
      // Nature recovers on the surface (skipped while you're underground)
      if (this.state.depth === 0) {
        let planted = 0;
        for (let tries = 0; tries < 40 && planted < 3; tries++) {
          const tx = 4 + Math.floor(Math.random() * (this.world.w - 8));
          const ty = 4 + Math.floor(Math.random() * (this.world.h - 8));
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
            const tx = 4 + Math.floor(Math.random() * (this.world.w - 8));
            const ty = 4 + Math.floor(Math.random() * (this.world.h - 8));
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
            const tx = 4 + Math.floor(Math.random() * (this.world.w - 8));
            const ty = 4 + Math.floor(Math.random() * (this.world.h - 8));
            if (this.world.isWalkable(tx, ty)) {
              const wc = this.world.tileToWorldCenter(tx, ty);
              this.chickens.push(new Chicken(this, this.world, wc.x, wc.y, true));
              this.showHint('✨ Golden chicken: touch it for 12 gold!');
              break;
            }
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
        if (this.state.depth === 0) this.worldEvents.onDayStart();
        this.startDailyQuest(true);
        music.setTheme(this.state.depth > 0 ? 'caves' : 'day');
        this.spawnGraveyardGuardians();
      }
    });
    music.setTheme('day');

    // Spider webs decay after a few seconds
    this.world.events.on('tile_placed', (x: number, y: number, type: TileType) => {
      if (type === TileType.Web) this.webTiles.push({ x, y, ttlMs: 6000 });
    });

    // Smashing a crypt cleanses its graveyard — nights get easier
    this.world.events.on('tile_broken', (x: number, y: number, type: TileType) => {
      if (type !== TileType.Crypt) return;
      const wc = this.world.tileToWorldCenter(x, y);
      this.state.runMeta.graveyardsCleared += 1;
      this.effects.burst(wc.x, wc.y, 0x9fff6a, 30, 200, 900, 1.8);
      this.effects.burst(wc.x, wc.y, 0xffd700, 20, 160, 800, 1.4);
      sounds.cake();
      this.cameras.main.shake(220, 0.006);
      for (const l of cryptLoot()) {
        this.pickups.push(new Pickup(this, wc.x + (Math.random() - 0.5) * 20, wc.y + (Math.random() - 0.5) * 20, l.m, l.c));
      }
      this.gainHeroCharge(25);
      const remaining = findCrypts(this.surfaceTiles).length;
      this.showBanner('⚰ GRAVEYARD CLEANSED', remaining > 0 ? `nights get easier · ${remaining} graveyard${remaining === 1 ? '' : 's'} left` : 'the land is at peace — nights get easier');
      // Its guardians lose their post (and despawn at the next dawn)
      const key = `${x},${y}`;
      for (const z of this.zombies) {
        if (z.anchorKey === key) {
          z.anchor = undefined;
          z.anchorKey = undefined;
          z.persistent = false;
        }
      }
    });

    // Skeleton miners (and other ranged enemies) throw bones
    this.events.on('enemy_shoot', (x: number, y: number, dx: number, dy: number, damage: number) => {
      this.projectiles.push(new Projectile(this, this.world, {
        x, y, dx, dy,
        damage: Math.max(1, Math.round(damage)),
        owner: 'enemy',
        kind: 'bone',
      }));
      sounds.arrowShoot();
    });

    this.events.on('volcano_spawned', (tx: number, ty: number) => {
      this.showBanner('🌋 VOLCANO', 'a volcano erupted nearby!');
      sounds.bossRoar();
      const wc = this.world.tileToWorldCenter(tx, ty);
      this.effects.burst(wc.x, wc.y, 0xff4d1a, 30, 180, 900, 1.8);
    });

    // Click-to-interact. On touch, the UI scene knows whether the pointer
    // hits a button / pad / modal — skip those so taps inside the joystick
    // or on the in-hand bar don't fire a phantom mining action.
    const isTouchClick = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    type UIWithProbes = Phaser.Scene & {
      isPointerOnUI?: (p: Phaser.Input.Pointer) => boolean;
      hasOpenModal?: () => boolean;
    };
    const passesUIFilter = (pointer: Phaser.Input.Pointer): boolean => {
      if (!isTouchClick) return true;
      const ui = this.scene.get('UI') as UIWithProbes;
      if (ui.hasOpenModal?.()) return false;
      if (ui.isPointerOnUI?.(pointer)) return false;
      return true;
    };
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      sounds.ensure();
      music.poke();
      if (!passesUIFilter(pointer)) return;
      this.handleTileInteraction(pointer.worldX, pointer.worldY);
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
      if (!passesUIFilter(pointer)) return;
      this.handleTileInteraction(pointer.worldX, pointer.worldY);
    });

    const selectToolHotbar = (slot: number) => {
      const ui = this.scene.get('UI') as Phaser.Scene & { events: Phaser.Events.EventEmitter };
      if (ui?.events) ui.events.emit('select_tool_hotbar', slot);
      else {
        this.state.hotbarSlot = slot;
        this.refreshPlayerWeapon();
      }
      sounds.click();
    };
    this.input2.events.on('hotbar_select', (slot: number) => selectToolHotbar(slot));
    this.input2.events.on('interact', () => this.handleInteractPressed());
    this.input2.events.on('skip_to_night', () => this.cycle.skipToNight());

    this.input.keyboard?.on('keydown-C', () => {
      sounds.ensure();
      this.scene.get('UI').events.emit('open_modal', 'craft');
    });
    this.input.keyboard?.on('keydown-R', () => this.useHeroBlast());
    this.input.keyboard?.on('keydown-M', () => {
      const muted = music.toggleMuted();
      this.showHint(muted ? '🔇 Sound off' : '🔊 Sound on');
    });

    // Shift — dash
    this.input.keyboard?.on('keydown-SHIFT', () => {
      if (this.player.tryDash()) {
        sounds.click();
        this.effects.burst(this.player.x, this.player.y, 0xffffff, 8, 60, 260, 0.8);
      }
    });


    this.input.on('wheel', (_p: any, _obj: any, _dx: number, dy: number) => {
      const dir = dy > 0 ? 1 : -1;
      selectToolHotbar(cyclePrimaryHotbarSlot(this.state.hotbarSlot, dir));
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
    this.events.on('dog_killed_zombie', (x: number, y: number, variant?: ZombieVariant) => {
      this.onZombieKilled(x, y, variant);
    });
    this.events.on('dog_pet', () => {
      sounds.pickup();
      // Temporary small HP regen and a small hint
      this.state.playerHp = Math.min(this.state.playerMaxHp, this.state.playerHp + 3);
      this.popNumber(this.player.x, this.player.y - 22, '+3 ♥', '#ff88aa');
    });
    // Ember spits fireballs
    this.events.on('companion_firespit', (x: number, y: number, dx: number, dy: number, damage: number) => {
      this.projectiles.push(new Projectile(this, this.world, {
        x, y, dx, dy,
        damage: Math.max(1, Math.round(damage)),
        owner: 'turret',
        kind: 'flame',
        rangePx: TILE_SIZE * 5,
      }));
      sounds.turretShoot();
    });
    // Whiskers sniffs out buried treasure nearby
    this.events.on('companion_sniff', (x: number, y: number) => {
      const from = this.world.worldToTile(x, y);
      for (let tries = 0; tries < 30; tries++) {
        const tx = from.x + Math.floor((Math.random() - 0.5) * 12);
        const ty = from.y + Math.floor((Math.random() - 0.5) * 12);
        if (!this.world.isWalkable(tx, ty)) continue;
        const wc = this.world.tileToWorldCenter(tx, ty);
        this.effects.burst(wc.x, wc.y, 0xffd166, 12, 90, 600, 1);
        this.showHint('🐱 Whiskers found buried treasure!');
        sounds.pickup();
        this.time.delayedCall(900, () => {
          this.effects.burst(wc.x, wc.y, 0xffd700, 18, 140, 700, 1.3);
          for (const l of treasureDigLoot()) {
            this.pickups.push(new Pickup(this, wc.x + (Math.random() - 0.5) * 14, wc.y + (Math.random() - 0.5) * 14, l.m, l.c));
          }
        });
        return;
      }
    });
    // Bolt patches structures
    this.events.on('companion_repair', (tx: number, ty: number) => {
      const wc = this.world.tileToWorldCenter(tx, ty);
      this.effects.burst(wc.x, wc.y, 0x7fe7ff, 8, 70, 350, 0.8);
    });
    // Tap a chicken to recruit it into the chicken army
    this.events.on('chicken_tapped', (chicken: Chicken) => {
      if (chicken.recruited) return;
      const recruited = this.chickens.filter((c) => c.alive && c.recruited).length;
      if (recruited >= CHICKEN_ARMY_MAX) {
        this.showHint(`Your chicken army is full (${CHICKEN_ARMY_MAX})`);
        return;
      }
      chicken.recruit();
      sounds.pickup();
      this.effects.burst(chicken.x, chicken.y, 0xffffff, 10, 80, 400, 0.9);
      this.showHint(`🐔 Chicken recruited! (${recruited + 1}/${CHICKEN_ARMY_MAX}) They fight for you now`);
    });
    // Army chickens peck zombies
    this.events.on('chicken_peck', (target: Zombie, damage: number, _x: number, _y: number) => {
      if (!target.alive) return;
      const dmg = target.projectileResistant ? 1 : damage;
      this.popNumber(target.sprite.x, target.sprite.y - 16, `-${dmg} 🐔`, '#ffe8a0');
      sounds.click();
      if (target.takeDamage(dmg)) this.onZombieKilled(target.sprite.x, target.sprite.y, target.variant);
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

    this.lighting = new LightingSystem(this, this.world);

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
    this.rebuildTurrets();
    this.spawnGraveyardGuardians();

    // Loading a save made underground: swap straight to that cave layer
    if (loaded && loaded.depth > 0 && this.caves[loaded.depth - 1]) {
      this.applyLayer(loaded.depth, { x: loaded.playerWorldPos.x, y: loaded.playerWorldPos.y });
    }

    this.scene.launch('UI', { gameScene: this });
    this.showHint('Day 1 — mine, build, press H for help');
    this.startDailyQuest(false);
    // If a volcano was seeded on the map, warn the player
    if (this.worldEvents.volcanoPos) {
      this.time.delayedCall(2500, () => this.showBanner('🌋 VOLCANO NEARBY', 'watch where you build — lava will spread'));
    }
  }

  private drawWorldBorder(): void {
    const g = this.add.graphics().setDepth(0.7);
    this.surfaceOnly.push(g);
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
    this.surfaceOnly.push(g);
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

  /** Lazily generate (and cache) a cave floor for this run. */
  private caveFor(floor: 1 | 2 | 3): GeneratedCave {
    let cave = this.caves[floor - 1];
    if (!cave) {
      cave = generateCave(this.runSeed, floor);
      this.caves[floor - 1] = cave;
    }
    return cave;
  }

  /** Rebuild turret instances (barrels + cooldowns) from the active layer's tiles. */
  private rebuildTurrets(): void {
    for (const t of this.turrets) t.barrel.destroy();
    this.turrets = [];
    for (const [tileType, kind] of [[TileType.TurretBasic, 'basic'], [TileType.TurretFlame, 'flame']] as const) {
      this.world.forEachTileOfType(tileType, (tx, ty) => {
        this.turrets.push({ tileX: tx, tileY: ty, kind, cooldownMs: 0, barrel: makeTurretBarrel(this, tx, ty, kind) });
      });
    }
  }

  /**
   * Swap the rendered world to another depth layer. Clears layer-bound
   * entities, repositions the player (at `playerPos` if given, otherwise at
   * the connecting ladder), and re-tunes camera/physics/lighting/music.
   */
  private applyLayer(depth: 0 | 1 | 2 | 3, playerPos?: { x: number; y: number }): void {
    const goingDown = depth > this.state.depth;
    this.state.depth = depth;

    // Layer-bound entities don't cross with you
    for (const z of this.zombies) z.die();
    this.zombies = [];
    for (const pr of this.projectiles) pr.destroy();
    this.projectiles = [];
    for (const p of this.pickups) p.destroy();
    this.pickups = [];
    for (const o of this.powerOrbs) o.container.destroy();
    this.powerOrbs = [];
    this.webTiles = [];

    // Swap tiles
    if (depth === 0) {
      this.world.swapTiles(this.surfaceTiles, 'surface');
    } else {
      this.world.swapTiles(this.caveFor(depth).tiles, 'cave');
    }

    // Bounds
    const wpx = this.world.w * TILE_SIZE;
    const hpx = this.world.h * TILE_SIZE;
    this.physics.world.setBounds(0, 0, wpx, hpx);
    this.cameras.main.setBounds(0, 0, wpx, hpx);

    // Player position
    let pos = playerPos;
    if (!pos) {
      let tile: { x: number; y: number };
      if (depth === 0) {
        tile = this.lastEntrance ?? this.world.shopPos;
      } else if (goingDown) {
        tile = this.caveFor(depth).entry;
      } else {
        // Climbing up into a deeper-visited floor: arrive at its ladder down
        tile = this.caveFor(depth as 1 | 2).ladderDown ?? this.caveFor(depth as 1 | 2).entry;
      }
      const wc = this.world.tileToWorldCenter(tile.x, tile.y);
      pos = wc;
    }
    this.player.sprite.setPosition(pos.x, pos.y);
    this.cameras.main.centerOn(pos.x, pos.y);
    if (this.dog?.alive) this.dog.setPosition(pos.x + 16, pos.y + 8);
    if (this.buddy?.alive) this.buddy.setPosition(pos.x - 16, pos.y + 8);

    // Chickens are surface creatures
    for (const c of this.chickens) c.setHidden(depth > 0);

    // Surface-only decorations
    for (const g of this.surfaceOnly) (g as Phaser.GameObjects.Graphics).setVisible(depth === 0);

    this.rebuildTurrets();
    this.lighting.invalidate();
    music.setTheme(depth > 0 ? 'caves' : this.state.phase === 'night' || this.state.phase === 'dusk' ? 'night' : 'day');
  }

  changeDepth(depth: 0 | 1 | 2 | 3): void {
    if (depth === this.state.depth || !this.state.running) return;
    const goingDown = depth > this.state.depth;
    sounds.mineBreak();
    this.cameras.main.flash(240, 0, 0, 0);
    this.applyLayer(depth);
    this.state.runMeta.maxDepth = Math.max(this.state.runMeta.maxDepth, depth);
    if (depth === 0) {
      this.showBanner('☀ THE SURFACE', 'fresh air at last');
    } else {
      this.showBanner(
        goingDown ? `⛏ THE DEEP DARK — FLOOR ${depth}` : `⬆ FLOOR ${depth}`,
        depth === 3 ? 'the Zombie King stirs below…' : goingDown ? 'stay near the light' : 'the way up is close',
      );
    }
  }

  /** Keep each intact graveyard staffed with a couple of watchful guardians. */
  private spawnGraveyardGuardians(): void {
    if (this.state.depth !== 0) return;
    for (const c of findCrypts(this.surfaceTiles)) {
      const key = `${c.x},${c.y}`;
      const posted = this.zombies.filter((z) => z.alive && z.anchorKey === key).length;
      for (let i = posted; i < GUARDIANS_PER_CRYPT; i++) {
        for (let tries = 0; tries < 20; tries++) {
          const tx = c.x + Math.floor((Math.random() - 0.5) * 6);
          const ty = c.y + Math.floor((Math.random() - 0.5) * 6);
          if (!this.world.isWalkable(tx, ty)) continue;
          const wc = this.world.tileToWorldCenter(tx, ty);
          const spec = specForNight(this.state.nightNumber);
          spec.hp *= 1.4;
          const guard = new Zombie(this, this.world, wc.x, wc.y, spec);
          guard.persistent = true;
          guard.anchorKey = key;
          const anchorWc = this.world.tileToWorldCenter(c.x, c.y);
          guard.anchor = { x: anchorWc.x, y: anchorWc.y, radiusPx: TILE_SIZE * 9 };
          this.zombies.push(guard);
          break;
        }
      }
    }
  }

  private spawnCaveMonster(): void {
    if (this.state.depth === 0) return;
    const pt = this.world.worldToTile(this.player.x, this.player.y);
    for (let tries = 0; tries < 40; tries++) {
      const tx = 2 + Math.floor(Math.random() * (this.world.w - 4));
      const ty = 2 + Math.floor(Math.random() * (this.world.h - 4));
      const d = Math.hypot(tx - pt.x, ty - pt.y);
      if (d < 7 || d > 22) continue;
      if (!this.world.isWalkable(tx, ty)) continue;
      const wc = this.world.tileToWorldCenter(tx, ty);
      const spec = specForCave(this.state.depth, this.state.nightNumber);
      this.zombies.push(new Zombie(this, this.world, wc.x, wc.y, spec));
      this.effects.burst(wc.x, wc.y, 0x6a4a8a, 6, 60, 300, 0.8);
      return;
    }
  }

  handleInteractPressed(): void {
    const p = this.world.worldToTile(this.player.x, this.player.y);
    // Standing on a ladder / entrance?
    const standing = this.world.getTileAt(p.x, p.y);
    if (standing) {
      if (standing.type === TileType.CaveEntrance && this.state.depth === 0) {
        this.lastEntrance = { x: p.x, y: p.y };
        this.changeDepth(1);
        return;
      }
      if (standing.type === TileType.LadderDown && this.state.depth < 3) {
        this.changeDepth((this.state.depth + 1) as 1 | 2 | 3);
        return;
      }
      if (standing.type === TileType.LadderUp && this.state.depth > 0) {
        this.changeDepth((this.state.depth - 1) as 0 | 1 | 2);
        return;
      }
    }
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
        if (t.type === TileType.DoorWood) {
          this.world.toggleDoor(tx, ty);
          sounds.click();
          return;
        }
        if (t.type === TileType.ThroneGate) {
          this.openThroneRoom();
          return;
        }
      }
    }
  }

  openModal(mode: 'shop' | 'craft'): void {
    this.scene.get('UI').events.emit('open_modal', mode);
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
      const res = this.world.mineTile(tp.x, tp.y, this.state.pickaxeTier, 4 * classMineMult(this.state));
      if (res.ok) {
        sounds.mine();
        const wc = this.world.tileToWorldCenter(tp.x, tp.y);
        this.effects.miningDust(wc.x, wc.y, TILE_SPECS[t.type].tintColor);
        if (res.broken) {
          sounds.mineBreak();
          this.state.stats.tilesMined += 1;
          this.recordDailyQuestProgress('mine');
          if (res.drop && res.drop.count > 0) {
            this.pickups.push(new Pickup(this, wc.x, wc.y, res.drop.material, res.drop.count));
          }
          // Supply crates spill a generous loot pile
          if (t.type === TileType.SupplyCrate) {
            for (const l of crateLoot()) {
              this.pickups.push(new Pickup(this, wc.x + (Math.random() - 0.5) * 16, wc.y + (Math.random() - 0.5) * 16, l.m, l.c));
            }
            this.effects.burst(wc.x, wc.y, 0xffd700, 20, 180, 700, 1.4);
            sounds.cake();
            this.showHint('Supply crate opened! 🎁');
          }
          // Underground treasure vaults pay out even better
          if (t.type === TileType.VaultChest) {
            for (const l of vaultLoot(Math.max(1, this.state.depth))) {
              this.pickups.push(new Pickup(this, wc.x + (Math.random() - 0.5) * 16, wc.y + (Math.random() - 0.5) * 16, l.m, l.c));
            }
            this.effects.burst(wc.x, wc.y, 0xffd700, 26, 190, 800, 1.6);
            sounds.cake();
            this.showBanner('💎 TREASURE VAULT', 'the Deep Dark rewards the brave');
            this.gainHeroCharge(15);
          }
        }
      } else if (res.reason === 'weak_tool') this.showHint('Need better pickaxe — craft one with C');
      return;
    }

    if (act.kind === 'melee') {
      if (dist > PLAYER_REACH_TILES) return;
      if (this.player.attackCooldown() > 0) return;
      this.player.triggerAttackCooldown(300);
      const dmg = this.playerDamage(this.player.meleeAttackDamage());
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
      // Hit any nearby chickens too
      for (const c of this.chickens) {
        if (!c.alive) continue;
        const d = Math.hypot(c.x - worldX, c.y - worldY);
        if (d < 20 && this.player.tileDistance(this.world.worldToTile(c.x, c.y).x, this.world.worldToTile(c.x, c.y).y) <= 1.5) {
          hitSomething = true;
          this.effects.burst(c.x, c.y, c.golden ? 0xffd700 : 0xffffff, 6, 60, 300, 0.6);
          if (c.golden) this.catchGoldenChicken(c);
          else c.scareFrom(this.player.x, this.player.y);
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
        damage: this.playerDamage(act.weapon === 'bow' ? 14 + classBowBonus(this.state) : 30),
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

    if (act.kind === 'hammer') {
      if (dist > PLAYER_REACH_TILES) return;
      if (!this.state.hasHammer) return this.showHint('Craft a repair hammer first (press C)');
      const outcome = useHammer(this.world, tp.x, tp.y, this.state);
      if (outcome.ok) {
        sounds.place();
        this.world.refreshHpBar(tp.x, tp.y);
        const wc = this.world.tileToWorldCenter(tp.x, tp.y);
        this.effects.burst(wc.x, wc.y, 0xffffaa, 10, 90, 380, 1.0);
        this.popNumber(wc.x, wc.y - 10, `-1 ${outcome.material}`, '#ffd166');
      } else if (outcome.reason === 'no_material') {
        this.showHint('Not enough material to repair');
      } else if (outcome.reason === 'not_damaged') {
        this.showHint('Already at full HP');
      } else {
        this.showHint('Can only repair placed structures');
      }
      return;
    }

    if (act.kind === 'wand') {
      this.useWand(act.wand, worldX, worldY);
      return;
    }

    if (act.kind === 'fish') {
      this.handleFishTap(tp.x, tp.y, dist);
      return;
    }

    if (act.kind === 'throw') {
      if (!hasItem(this.state.inventory, act.ammo, 1)) return this.showHint('Out of bombs');
      if (this.player.attackCooldown() > 0) return;
      this.player.triggerAttackCooldown(400);
      removeItem(this.state.inventory, act.ammo, 1);
      const aim = Projectile.aimVector({ x: this.player.x, y: this.player.y }, { x: worldX, y: worldY });
      const spawn: ProjectileSpawn = {
        x: this.player.x + aim.dx * TILE_SIZE * 0.3,
        y: this.player.y + aim.dy * TILE_SIZE * 0.3,
        dx: aim.dx,
        dy: aim.dy,
        damage: BOMB_DAMAGE,
        owner: 'player',
        kind: 'bomb',
        onBombExplode: (tx, ty) => this.resolveBombExplosion(tx, ty),
      };
      this.projectiles.push(new Projectile(this, this.world, spawn));
      sounds.click();
      return;
    }

    if (act.kind === 'place') {
      if (dist > PLAYER_REACH_TILES) return;
      const t = this.world.getTileAt(tp.x, tp.y);
      if (!t) return;
      const wantsWater = act.onto === 'water';
      const validSurface = wantsWater
        ? t.type === TileType.Water
        : isPlaceableGround(t.type);
      if (!validSurface) {
        if (wantsWater) this.showHint('Bridges go on water');
        else this.showHint('Build on clear ground');
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
      this.recordDailyQuestProgress('build');
      if (act.tile === TileType.SpikeTrap) this.showHint('Trap set: lure zombies over the spikes');
      if (act.tile === TileType.TurretBasic || act.tile === TileType.TurretFlame) {
        const kind =
          act.tile === TileType.TurretFlame ? 'flame' :
          'basic';
        const barrel = makeTurretBarrel(this, tp.x, tp.y, kind);
        this.turrets.push({ tileX: tp.x, tileY: tp.y, kind, cooldownMs: 0, barrel });
      }
    }
  }

  /**
   * For touch UI: returns a brief tag identifying an interactable tile the
   * player is adjacent to (within a 1-tile radius), or null.
   */
  getAdjacentInteractable(): 'shop' | 'door' | 'descend' | 'ascend' | 'gate' | null {
    const p = this.world.worldToTile(this.player.x, this.player.y);
    const standing = this.world.getTileAt(p.x, p.y);
    if (standing) {
      if (standing.type === TileType.CaveEntrance || standing.type === TileType.LadderDown) return 'descend';
      if (standing.type === TileType.LadderUp) return 'ascend';
    }
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const t = this.world.getTileAt(p.x + dx, p.y + dy);
        if (!t) continue;
        if (t.type === TileType.ShopNPC) return 'shop';
        if (t.type === TileType.DoorWood) return 'door';
        if (t.type === TileType.ThroneGate) return 'gate';
      }
    }
    return null;
  }

  private resolveBombExplosion(tx: number, ty: number): void {
    const wc = this.world.tileToWorldCenter(tx, ty);
    this.cameras.main.shake(180, 0.006);
    this.effects.burst(wc.x, wc.y, 0xff4d1a, 30, 200, 700, 1.8);
    this.effects.burst(wc.x, wc.y, 0xffcc66, 18, 160, 600, 1.4);
    sounds.bossRoar();
    const victims: BombVictim[] = this.zombies.map((z) => ({
      get alive() { return z.alive; },
      get x() { return z.sprite.x; },
      get y() { return z.sprite.y; },
      takeDamage: (amount: number): boolean => {
        const ax = z.sprite.x;
        const ay = z.sprite.y;
        const died = z.takeDamage(amount);
        this.effects.bloodBurst(ax, ay, 0x8a1a1a);
        this.popNumber(ax, ay - 18, `-${amount}`, '#ffaa55');
        if (died) this.onZombieKilled(ax, ay, z.variant);
        return died;
      },
    }));
    bombExplosion(this.world, tx, ty, BOMB_RADIUS, BOMB_DAMAGE, victims);
  }

  private regenAccumMs = 0;
  private torchAccumMs = 0;
  private trapAccumMs = 0;
  private freezeCdMs = 0;
  private stormCdMs = 0;
  private nightMeteorMs = 0;
  private fishing: {
    phase: 'waiting' | 'bite';
    timerMs: number;
    x: number;
    y: number;
    bobber: Phaser.GameObjects.Arc;
    exclaim?: Phaser.GameObjects.Text;
  } | null = null;

  /** Freeze/Storm wands — crystal magic on a shared-per-wand cooldown. */
  private useWand(wand: 'freeze' | 'storm', worldX: number, worldY: number): void {
    if (wand === 'freeze') {
      if (!this.state.hasFreezeWand) return this.showHint('Craft a Freeze Wand first (press C)');
      if (this.freezeCdMs > 0) return this.showHint('❄ Freeze Wand is recharging…');
      this.freezeCdMs = 5000;
      const radius = TILE_SIZE * 3;
      this.effects.burst(worldX, worldY, 0x9fdcff, 30, 190, 700, 1.6);
      this.effects.burst(worldX, worldY, 0xffffff, 14, 130, 600, 1.2);
      sounds.arrowShoot();
      let caught = 0;
      for (const z of this.zombies) {
        if (!z.alive) continue;
        if (Math.hypot(z.sprite.x - worldX, z.sprite.y - worldY) <= radius) {
          z.applySlow(4000, 0.45);
          z.sprite.setTint(0x9fdcff);
          this.time.delayedCall(4000, () => z.alive && z.sprite.clearTint());
          caught++;
        }
      }
      this.showHint(caught > 0 ? `❄ Froze ${caught} enem${caught === 1 ? 'y' : 'ies'}!` : '❄ Whiff — nothing in the frost');
      return;
    }

    if (!this.state.hasStormWand) return this.showHint('Craft a Storm Wand first (press C)');
    if (this.stormCdMs > 0) return this.showHint('⚡ Storm Wand is recharging…');
    // Chain lightning: nearest enemy to the tap, arcing to up to 3 more
    let current: Zombie | null = null;
    let bestD = TILE_SIZE * 4;
    for (const z of this.zombies) {
      if (!z.alive) continue;
      const d = Math.hypot(z.sprite.x - worldX, z.sprite.y - worldY);
      if (d < bestD) { current = z; bestD = d; }
    }
    if (!current) return this.showHint('⚡ No enemy near there');
    this.stormCdMs = 5000;
    sounds.bossRoar();
    const hitList: Zombie[] = [];
    let from = { x: this.player.x, y: this.player.y };
    while (current && hitList.length < 4) {
      hitList.push(current);
      // Bolt visual between points
      const seg = this.add.line(0, 0, from.x, from.y, current.sprite.x, current.sprite.y, 0xfff8a0, 0.95)
        .setOrigin(0, 0).setLineWidth(2).setDepth(60);
      this.tweens.add({ targets: seg, alpha: 0, duration: 260, onComplete: () => seg.destroy() });
      this.effects.burst(current.sprite.x, current.sprite.y, 0xfff8a0, 12, 110, 450, 1.1);
      from = { x: current.sprite.x, y: current.sprite.y };
      const last: Zombie = current;
      current = null;
      let nextD = TILE_SIZE * 3;
      for (const z of this.zombies) {
        if (!z.alive || hitList.includes(z)) continue;
        const d = Math.hypot(z.sprite.x - last.sprite.x, z.sprite.y - last.sprite.y);
        if (d < nextD) { current = z; nextD = d; }
      }
    }
    for (const z of hitList) {
      const zx = z.sprite.x;
      const zy = z.sprite.y;
      const dmg = 18;
      this.popNumber(zx, zy - 18, `-${dmg}⚡`, '#fff8a0');
      if (z.takeDamage(dmg)) this.onZombieKilled(zx, zy, z.variant);
    }
    this.showHint(`⚡ Chain lightning hit ${hitList.length}!`);
  }

  /** Fishing: cast at water, wait for the "!", tap to reel. */
  private handleFishTap(tx: number, ty: number, dist: number): void {
    if (!this.state.hasRod) return this.showHint('Craft a Fishing Rod first (press C)');
    if (this.fishing?.phase === 'bite') {
      this.reelIn();
      return;
    }
    if (this.fishing) {
      this.cancelFishing('Reeled in early — nothing yet');
      return;
    }
    const t = this.world.getTileAt(tx, ty);
    if (!t || t.type !== TileType.Water) return this.showHint('Cast into the water');
    if (dist > PLAYER_REACH_TILES + 1) return this.showHint('Get closer to the water');
    const wc = this.world.tileToWorldCenter(tx, ty);
    const bobber = this.add.circle(wc.x, wc.y, 4, 0xff4d4d).setStrokeStyle(1, 0xffffff, 0.9).setDepth(12);
    this.tweens.add({ targets: bobber, y: wc.y - 2, yoyo: true, repeat: -1, duration: 600 });
    this.fishing = {
      phase: 'waiting',
      timerMs: 1500 + Math.random() * 2500,
      x: wc.x,
      y: wc.y,
      bobber,
    };
    sounds.click();
    this.showHint('🎣 Waiting for a bite… stay still!');
  }

  private cancelFishing(hint?: string): void {
    if (!this.fishing) return;
    this.fishing.bobber.destroy();
    this.fishing.exclaim?.destroy();
    this.fishing = null;
    if (hint) this.showHint(hint);
  }

  private reelIn(): void {
    if (!this.fishing) return;
    const { x, y } = this.fishing;
    this.cancelFishing();
    this.effects.burst(x, y, 0x8fc7ff, 14, 120, 500, 1.1);
    sounds.pickup();
    const roll = Math.random();
    if (roll < 0.45) {
      const heal = 10;
      this.state.playerHp = Math.min(this.state.playerMaxHp, this.state.playerHp + heal);
      this.popNumber(this.player.x, this.player.y - 22, `🐟 +${heal} ♥`, '#9effa0');
      this.showHint('🐟 A tasty fish! +10 HP');
    } else if (roll < 0.7) {
      const gold = 1 + Math.floor(Math.random() * 2);
      this.pickups.push(new Pickup(this, x, y - 6, 'gold', gold));
      this.showHint('✨ Something shiny!');
    } else if (roll < 0.9) {
      this.pickups.push(new Pickup(this, x, y - 6, 'wood', 1));
      this.showHint('🥾 …an old boot. And a plank?');
    } else {
      this.pickups.push(new Pickup(this, x, y - 6, Math.random() < 0.5 ? 'crystal' : 'gold', Math.random() < 0.5 ? 1 : 3));
      this.effects.burst(x, y, 0xffd700, 22, 160, 800, 1.5);
      this.showBanner('🎣 RARE CATCH', 'sunken treasure!');
      sounds.cake();
    }
  }

  private updateFishing(delta: number, moving: boolean): void {
    this.freezeCdMs = Math.max(0, this.freezeCdMs - delta);
    this.stormCdMs = Math.max(0, this.stormCdMs - delta);
    if (!this.fishing) return;
    if (moving) {
      this.cancelFishing('You scared the fish away');
      return;
    }
    this.fishing.timerMs -= delta;
    if (this.fishing.phase === 'waiting' && this.fishing.timerMs <= 0) {
      this.fishing.phase = 'bite';
      this.fishing.timerMs = 900;
      this.fishing.exclaim = this.add.text(this.fishing.x, this.fishing.y - 22, '❗', {
        fontFamily: 'system-ui', fontSize: '22px', color: '#ffd166', fontStyle: 'bold',
        stroke: '#000', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(30);
      this.effects.burst(this.fishing.x, this.fishing.y, 0x8fc7ff, 10, 90, 400, 0.9);
      sounds.pickup();
    } else if (this.fishing.phase === 'bite' && this.fishing.timerMs <= 0) {
      this.cancelFishing('It got away…');
    }
  }

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

  private applySpikeTrapDamage(): void {
    const traps: { tx: number; ty: number; x: number; y: number }[] = [];
    this.world.forEachTileOfType(TileType.SpikeTrap, (tx, ty) => {
      const tile = this.world.getTileAt(tx, ty);
      if (!tile || tile.hp <= 0) return;
      const wc = this.world.tileToWorldCenter(tx, ty);
      traps.push({ tx, ty, x: wc.x, y: wc.y });
    });
    if (traps.length === 0) return;

    for (const trap of traps) {
      let triggered = false;
      for (const z of this.zombies) {
        if (!z.alive) continue;
        const d = Math.hypot(z.sprite.x - trap.x, z.sprite.y - trap.y);
        if (d > SPIKE_TRAP_TRIGGER_RADIUS) continue;
        triggered = true;
        this.effects.burst(z.sprite.x, z.sprite.y, 0xc7ccd4, 4, 70, 300, 0.75);
        this.popNumber(z.sprite.x, z.sprite.y - 18, `-${SPIKE_TRAP_DAMAGE}`, '#dce4ee');
        if (z.takeDamage(SPIKE_TRAP_DAMAGE)) {
          this.onZombieKilled(z.sprite.x, z.sprite.y, z.variant);
        }
      }
      if (triggered) {
        this.world.damageTile(trap.tx, trap.ty, 1, { onDamage: () => sounds.wallHit() });
      }
    }
  }

  update(_time: number, delta: number): void {
    if (!this.state.running) return;
    const mv = this.input2.getMoveVector();
    this.player.update(delta, mv.x, mv.y);
    tickPowerUps(this.state, delta);
    this.updateFishing(delta, Math.abs(mv.x) > 0.1 || Math.abs(mv.y) > 0.1);

    this.cycle.tick(delta);
    if (this.state.depth === 0) this.worldEvents.update(delta);

    // Spider webs decay; player is slowed while standing in one
    if (this.webTiles.length > 0) {
      for (const wt of this.webTiles) {
        wt.ttlMs -= delta;
        if (wt.ttlMs <= 0) {
          const t = this.world.getTileAt(wt.x, wt.y);
          if (t && t.type === TileType.Web) this.world.damageTile(wt.x, wt.y, 999);
        }
      }
      this.webTiles = this.webTiles.filter((wt) => wt.ttlMs > 0);
    }
    const underPlayer = this.world.getTileAt(
      this.world.worldToTile(this.player.x, this.player.y).x,
      this.world.worldToTile(this.player.x, this.player.y).y,
    );
    this.player.externalSpeedMult = underPlayer?.type === TileType.Web ? 0.55 : 1;

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

    // Spawn pacing (night sieges + boss scheduling) lives in the director.
    for (const req of this.director.update(delta, this.state)) {
      if (req.kind === 'boss') this.spawnBoss();
      else this.spawnZombie();
    }
    // Ambient cave pressure while underground
    for (const _req of this.director.updateCave(delta, this.state.depth, this.state.phase, this.zombies.length)) {
      this.spawnCaveMonster();
    }

    // Combo countdown
    if (this.combo > 0) {
      this.comboTimerMs -= delta;
      if (this.comboTimerMs <= 0) this.combo = 0;
    }

    // Lightning strikes during rain (surface only — and rain hides underground)
    this.rainEmitter?.setVisible(this.state.depth === 0);
    if (this.rainActive && this.state.depth === 0) {
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
    if (this.state.phase === 'night' && this.director.allSpawned && this.zombies.length === 0) {
      const remaining = this.cycle.phaseDuration(this.state.phase) - this.state.phaseElapsedMs;
      if (remaining > 500) this.state.phaseElapsedMs = this.cycle.phaseDuration(this.state.phase) - 400;
    }

    for (const z of this.zombies) z.update(delta, this.player, this.zombies);
    this.updateBossMechanics(delta);

    if (this.zombies.length > 0) {
      this.trapAccumMs -= delta;
      if (this.trapAccumMs <= 0) {
        this.trapAccumMs = SPIKE_TRAP_TICK_MS;
        this.applySpikeTrapDamage();
      }
    }

    // Zombies bite companions that stray too close
    for (const pet of [this.dog, this.buddy]) {
      if (!pet?.alive) continue;
      for (const z of this.zombies) {
        if (!z.alive) continue;
        const d = Math.hypot(z.sprite.x - pet.x, z.sprite.y - pet.y);
        if (d < 22 && Math.random() < delta / 1200) {
          pet.hurt(z.damage / 2);
          this.effects.bloodBurst(pet.x, pet.y, 0x8a1a1a);
        }
      }
    }
    this.zombies = this.zombies.filter((z) => z.alive);

    if (this.dog?.alive) this.dog.update(delta, this.player, this.zombies);
    if (this.buddy?.alive) this.buddy.update(delta, this.player, this.zombies);

    // Chickens wander around (surface only). Golden chickens are caught by contact.
    if (this.state.depth === 0) {
      for (const c of this.chickens) {
        c.update(delta, this.player.x, this.player.y, this.zombies);
        if (c.golden && c.alive && Math.hypot(c.x - this.player.x, c.y - this.player.y) < 18) {
          this.catchGoldenChicken(c);
        }
      }
    }
    this.chickens = this.chickens.filter((c) => c.alive);

    // Turrets
    const spawns = tickTurrets(this.turrets, this.zombies, this.world, delta);
    for (const s of spawns) {
      this.projectiles.push(new Projectile(this, this.world, s));
      sounds.turretShoot();
    }
    this.turrets = this.turrets.filter((t) => {
      const tile = this.world.getTileAt(t.tileX, t.tileY);
      const ok = tile && (tile.type === TileType.TurretBasic || tile.type === TileType.TurretFlame);
      if (!ok) {
        t.barrel.destroy();
        return false;
      }
      return true;
    });

    // Projectiles
    for (const pr of this.projectiles) {
      pr.update(delta);
      if (!pr.alive) continue;
      // Bombs resolve via fuse, not collision.
      if (pr.kind === 'bomb') continue;
      // Enemy projectiles (bones) hurt the player, never zombies.
      if (pr.owner === 'enemy') {
        const d = Math.hypot(this.player.x - pr.sprite.x, this.player.y - pr.sprite.y);
        if (d < 14) {
          this.player.hurt(pr.damage);
          this.effects.bloodBurst(this.player.x, this.player.y, 0x8a1a1a);
          sounds.playerHurt();
          pr.destroy();
        }
        continue;
      }
      const hitSet = new Set<Zombie>();
      for (const z of this.zombies) {
        if (!z.alive) continue;
        const d = Math.hypot(z.sprite.x - pr.sprite.x, z.sprite.y - pr.sprite.y);
        const hitR = Math.max(12, z.sprite.displayWidth * 0.45);
        if (d < hitR) hitSet.add(z);
      }
      if (hitSet.size === 0) continue;
      if (pr.kind === 'flame') {
        // Piercing: damage multiple zombies, consume pierce budget.
        for (const z of hitSet) {
          if (pr.pierceBudget <= 0) break;
          pr.pierceBudget -= 1;
          const dmg = z.projectileResistant ? 1 : pr.damage;
          this.effects.bloodBurst(z.sprite.x, z.sprite.y, 0xff8030);
          this.popNumber(z.sprite.x, z.sprite.y - 18, z.projectileResistant ? 'resist' : `-${dmg}`, z.projectileResistant ? '#9aa0aa' : '#ffcc33');
          sounds.zombieHit();
          if (z.takeDamage(dmg)) this.onZombieKilled(z.sprite.x, z.sprite.y, z.variant);
        }
        if (pr.pierceBudget <= 0) pr.destroy();
      } else {
        const z = hitSet.values().next().value!;
        // The Stone Golem shrugs off arrows and bullets
        const dmg = z.projectileResistant ? 1 : pr.damage;
        this.effects.bloodBurst(z.sprite.x, z.sprite.y, 0x8a1a1a);
        this.popNumber(z.sprite.x, z.sprite.y - 18, z.projectileResistant ? 'resist' : `-${dmg}`, z.projectileResistant ? '#9aa0aa' : pr.kind === 'bullet' ? '#ffaa33' : '#ddddff');
        sounds.zombieHit();
        if (z.takeDamage(dmg)) this.onZombieKilled(z.sprite.x, z.sprite.y, z.variant);
        pr.destroy();
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

    // Power orbs
    for (const orb of this.powerOrbs) {
      const res = orb.update(delta, this.player.x, this.player.y);
      if (res.collect && res.kind) this.activatePowerUp(res.kind);
    }
    this.powerOrbs = this.powerOrbs.filter((p) => p.alive);

    // Darkness level for the lighting system
    let alpha = 0;
    switch (this.state.phase) {
      case 'day': alpha = 0; break;
      case 'dusk': alpha = 0.5 * this.cycle.phaseProgress(); break;
      case 'night': alpha = 0.78; break;
      case 'dawn': alpha = 0.78 * (1 - this.cycle.phaseProgress()); break;
    }
    const underground = this.state.depth > 0;
    if (underground) alpha = 0.94; // caves are pitch black at any hour
    // Fog Night: darker and shorter light pools during the siege
    const fogNow = !underground && this.nightTwist.fog && (this.state.phase === 'night' || this.state.phase === 'dusk');
    if (fogNow) alpha = Math.min(0.92, alpha + 0.1);
    this.lighting.setRadiusMult(fogNow ? 0.55 : 1);
    this.lighting.setDarkness(alpha);
    this.lighting.update(delta, [
      { x: this.player.x, y: this.player.y, radius: underground ? 130 : 145 },
    ]);

    // Meteor Night: the sky keeps falling while the siege runs
    if (this.nightTwist.nightMeteors && this.state.phase === 'night' && this.state.depth === 0) {
      this.nightMeteorMs -= delta;
      if (this.nightMeteorMs <= 0) {
        this.nightMeteorMs = 9000 + Math.random() * 6000;
        this.worldEvents.forceScheduleMeteor(1500);
      }
    }

    // Warm sunset/sunrise overlay: peaks during dusk & dawn, fades to 0 at pure day/night
    let warm = 0;
    if (!underground) {
      if (this.state.phase === 'dusk') warm = 0.25 * (1 - Math.abs(0.5 - this.cycle.phaseProgress()) * 2);
      else if (this.state.phase === 'dawn') warm = 0.25 * (1 - Math.abs(0.5 - this.cycle.phaseProgress()) * 2);
    }
    this.warmOverlay.setFillStyle(0xff7a33, warm);

    // Blood moon tint — only during night phase of boss nights
    if (this.bloodOverlay) {
      const bloodAlpha = (this.bloodMoon && (this.state.phase === 'night' || this.state.phase === 'dusk')) ? 0.35 : 0;
      this.bloodOverlay.setFillStyle(0xaa0000, bloodAlpha);
    }

    // Stars visible roughly proportional to overlay darkness (never underground)
    const starAlpha = underground ? 0 : Math.min(1, alpha * 1.4);
    for (const s of this.stars) {
      if (s.alpha !== starAlpha) s.setAlpha(starAlpha * (0.7 + 0.3 * Math.sin((this.time.now + s.x) / 500)));
    }

    // Interact prompt: show when near shop/door
    this.updateInteractPrompt();

    // Player death
    if (this.state.playerHp <= 0 && this.state.running) {
      this.state.running = false;
      sounds.playerHurt();
      // Bank Star Coins for the run (once)
      let coinsEarned = 0;
      if (!this.state.runMeta.coinsAwarded) {
        this.state.runMeta.coinsAwarded = true;
        coinsEarned = starCoinsForRun({
          nights: this.state.score,
          bossKills: this.state.runMeta.bossKills,
          maxDepth: this.state.runMeta.maxDepth,
          graveyardsCleared: this.state.runMeta.graveyardsCleared,
          victory: this.state.victory,
        });
        MetaStore.addCoins(coinsEarned);
      }
      this.time.delayedCall(600, () => {
        SaveStore.updateBestScore(this.state.score);
        // Death ends the run — clear the save so "Continue" doesn't offer it
        SaveLoad.clear();
        this.scene.stop('UI');
        this.scene.start('GameOver', { score: this.state.score, stats: this.state.stats, state: this.state, coinsEarned });
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

  private startDailyQuest(withBanner: boolean): void {
    const alreadyHadQuestForDay = this.state.dailyQuest?.day === this.state.nightNumber;
    const quest = ensureDailyQuest(this.state);
    if (alreadyHadQuestForDay) return;

    const subtitle = `${quest.title}  ->  ${questRewardLabel(quest)}`;
    if (withBanner) this.showBanner('🎯 DAILY QUEST', subtitle);
    else this.time.delayedCall(900, () => this.showHint(`🎯 Quest: ${quest.title}`));
  }

  private recordDailyQuestProgress(kind: DailyQuestKind, amount = 1): void {
    const completion = recordQuestProgress(this.state, kind, amount);
    if (!completion) return;

    const rewardText = completion.rewards.map((r) => `+${r.count} ${r.material}`).join('  ');
    sounds.pickup();
    this.effects.burst(this.player.x, this.player.y - 12, 0xffd166, 24, 150, 800, 1.4);
    this.popNumber(this.player.x, this.player.y - 28, rewardText, '#ffd166');
    this.showBanner('🎯 QUEST COMPLETE', `${completion.quest.title} · ${rewardText}`);
    this.spawnPowerOrb(randomPowerUpKind(this.state.nightNumber + completion.quest.goal), this.player.x, this.player.y - 10);
    this.gainHeroCharge(30);
  }

  private gainHeroCharge(amount: number): void {
    const before = this.state.heroCharge;
    const after = addHeroCharge(this.state, amount);
    if (before < HERO_BLAST_MAX_CHARGE && after >= HERO_BLAST_MAX_CHARGE) {
      this.showHint('⚡ Hero Blast ready! Press R');
      this.effects.burst(this.player.x, this.player.y - 8, 0x4dd7ff, 18, 120, 650, 1.25);
      sounds.pickup();
    }
  }

  canUseHeroBlast(): boolean {
    return canUseHeroBlastState(this.state);
  }

  useHeroBlast(): boolean {
    if (!canUseHeroBlastState(this.state)) {
      this.showHint('Hero Blast is still charging');
      return false;
    }

    const victims = this.zombies.filter((z) => z.alive && Math.hypot(z.sprite.x - this.player.x, z.sprite.y - this.player.y) <= HERO_BLAST_RADIUS_PX);
    if (victims.length === 0) {
      this.showHint('No enemies in Hero Blast range');
      return false;
    }

    consumeHeroBlast(this.state);
    sounds.bossRoar();
    this.cameras.main.shake(260, 0.01);
    const ring = this.add.circle(this.player.x, this.player.y, 26, 0x4dd7ff, 0.14)
      .setStrokeStyle(4, 0xffffff, 0.95)
      .setDepth(80);
    this.tweens.add({
      targets: ring,
      scale: HERO_BLAST_RADIUS_PX / 26,
      alpha: 0,
      duration: 280,
      onComplete: () => ring.destroy(),
    });
    this.effects.burst(this.player.x, this.player.y, 0x4dd7ff, 42, 240, 900, 1.8);
    this.showHint(`⚡ Hero Blast hit ${victims.length}!`);

    for (const z of victims) {
      const zx = z.sprite.x;
      const zy = z.sprite.y;
      this.effects.bloodBurst(zx, zy, z.variant === 'goblin' ? 0x5fbf46 : 0x8a1a1a);
      this.popNumber(zx, zy - 18, `-${HERO_BLAST_DAMAGE}`, '#9eefff');
      if (z.takeDamage(HERO_BLAST_DAMAGE)) this.onZombieKilled(zx, zy, z.variant);
    }
    return true;
  }

  private playerDamage(base: number): number {
    return Math.ceil(base * damageMultiplierForState(this.state));
  }

  private spawnPowerOrb(kind: PowerUpKind, x: number, y: number): void {
    this.powerOrbs.push(new PowerOrb(this, x + (Math.random() - 0.5) * 18, y + (Math.random() - 0.5) * 18, kind));
    this.effects.burst(x, y, 0xffffff, 8, 80, 400, 0.8);
  }

  private activatePowerUp(kind: PowerUpKind): void {
    const spec = applyPowerUp(this.state, kind);
    sounds.pickup();
    this.effects.burst(this.player.x, this.player.y - 8, spec.color, 26, 150, 700, 1.5);
    this.popNumber(this.player.x, this.player.y - 26, spec.label, '#ffffff');
    this.showHint(`${spec.label}!`);
  }

  /** A goblin's treasure map: bury a chest somewhere far away, mark the map. */
  private buryTreasure(): void {
    const pt = this.world.worldToTile(this.player.x, this.player.y);
    for (let tries = 0; tries < 60; tries++) {
      const tx = 4 + Math.floor(Math.random() * (this.world.w - 8));
      const ty = 4 + Math.floor(Math.random() * (this.world.h - 8));
      if (Math.hypot(tx - pt.x, ty - pt.y) < 20) continue;
      const t = this.world.getTileAt(tx, ty);
      if (!t || (t.type !== TileType.Grass && t.type !== TileType.Dirt && t.type !== TileType.Sand)) continue;
      this.world.replaceTile(tx, ty, TileType.VaultChest);
      this.showBanner('🗺 TREASURE MAP!', 'the goblin marked an ✕ on your map — find the chest!');
      sounds.cake();
      return;
    }
  }

  private catchGoldenChicken(chicken: Chicken): void {
    if (!chicken.alive || !chicken.golden) return;
    const x = chicken.x;
    const y = chicken.y;
    chicken.capture();
    addItem(this.state.inventory, 'gold', 12);
    this.state.stats.goldEarned += 12;
    this.gainHeroCharge(20);
    this.effects.burst(x, y, 0xffd700, 28, 170, 850, 1.7);
    this.popNumber(x, y - 18, '+12 gold', '#ffd166');
    this.showBanner('✨ GOLDEN CHICKEN', '+12 gold');
    sounds.cake();
  }

  private pickSpawnEdge(): { tx: number; ty: number } {
    const edge = Math.floor(Math.random() * 4);
    let tx = 1;
    let ty = 1;
    if (edge === 0) { tx = Math.floor(Math.random() * this.world.w); ty = 1; }
    if (edge === 1) { tx = Math.floor(Math.random() * this.world.w); ty = this.world.h - 2; }
    if (edge === 2) { tx = 1; ty = Math.floor(Math.random() * this.world.h); }
    if (edge === 3) { tx = this.world.w - 2; ty = Math.floor(Math.random() * this.world.h); }
    return { tx, ty };
  }

  private spawnZombie(): void {
    const { tx, ty } = this.pickSpawnEdge();
    const wc = this.world.tileToWorldCenter(tx, ty);
    this.zombies.push(new Zombie(this, this.world, wc.x, wc.y, this.specForSpawn()));
    this.effects.burst(wc.x, wc.y, 0x884488, 6, 60, 300, 0.8);
  }

  private specForSpawn(): ZombieSpec {
    let spec: ZombieSpec;
    if (this.nightTwist.goblinChance > 0 && Math.random() < this.nightTwist.goblinChance) {
      spec = specForGoblin(this.state.nightNumber);
    } else {
      spec = specForNight(this.state.nightNumber);
      if (this.nightTwist.runnerChance > 0 && spec.variant === 'normal' && Math.random() < this.nightTwist.runnerChance) {
        spec = {
          ...spec,
          variant: 'fast',
          hp: Math.max(1, spec.hp * 0.8),
          speed: spec.speed * 1.55,
          tint: 0xa8d65c,
        };
      }
    }
    if (this.state.endlessPlus) spec = { ...spec, hp: spec.hp * 1.25 };
    // Winter World: slower but tougher ice zombies
    if (this.state.modifierId === 'winter') {
      spec = { ...spec, hp: spec.hp * 1.2, speed: spec.speed * 0.85, tint: 0xaaddff };
    }
    // Frost Night twist
    if (this.nightTwist.enemyHpMult || this.nightTwist.enemySpeedMult) {
      spec = {
        ...spec,
        hp: spec.hp * (this.nightTwist.enemyHpMult ?? 1),
        speed: spec.speed * (this.nightTwist.enemySpeedMult ?? 1),
      };
    }
    return spec;
  }

  private spawnBoss(): void {
    const { tx, ty } = this.pickSpawnEdge();
    const wc = this.world.tileToWorldCenter(tx, ty);
    const kind = bossKindForNight(this.state.nightNumber);
    const boss = new Zombie(this, this.world, wc.x, wc.y, specForBossKind(kind, this.state.nightNumber));
    this.zombies.push(boss);
    this.necroTimerMs = NECRO_CHANNEL_EVERY_MS * 0.6; // first ritual comes a bit sooner
    this.necroChannelMs = 0;
    this.queenTimerMs = QUEEN_SPAWN_EVERY_MS * 0.6;
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
    const intro = BOSS_INTROS[kind];
    this.showBanner(intro.title, intro.tip);
  }

  /** Per-frame boss mechanics: necromancer rituals, queen brood, king phases. */
  private updateBossMechanics(delta: number): void {
    const boss = this.zombies.find((z) => z.alive && (z.variant === 'boss' || z.variant === 'king'));
    if (!boss) {
      if (this.necroBeam) { this.necroBeam.destroy(); this.necroBeam = undefined; }
      return;
    }

    if (boss.bossKind === 'necromancer') {
      if (this.necroChannelMs > 0) {
        // Channeling — interrupted by any damage
        if (boss.hp < this.necroChannelStartHp) {
          this.necroChannelMs = 0;
          this.necroBeam?.destroy();
          this.necroBeam = undefined;
          this.showHint('✨ Ritual broken!');
          this.popNumber(boss.sprite.x, boss.sprite.y - 30, 'INTERRUPTED', '#9cff9c');
        } else {
          this.necroChannelMs -= delta;
          this.necroBeam?.setPosition(boss.sprite.x, boss.sprite.y);
          if (this.necroChannelMs <= 0) {
            this.necroBeam?.destroy();
            this.necroBeam = undefined;
            const raised = pickFallenToRaise(this.fallenThisNight, NECRO_RAISE_COUNT);
            for (const f of raised) {
              const spec = specForNight(this.state.nightNumber);
              spec.hp = Math.max(1, spec.hp * NECRO_RAISED_HP_FACTOR);
              this.zombies.push(new Zombie(this, this.world, f.x, f.y, spec));
              this.effects.burst(f.x, f.y, 0x9fff6a, 14, 120, 550, 1.2);
            }
            if (raised.length > 0) {
              sounds.bossRoar();
              this.showHint(`☠ The Necromancer raised ${raised.length} fallen!`);
            }
            this.necroTimerMs = NECRO_CHANNEL_EVERY_MS;
          }
        }
      } else {
        this.necroTimerMs -= delta;
        if (this.necroTimerMs <= 0) {
          this.necroChannelMs = NECRO_CHANNEL_DURATION_MS;
          this.necroChannelStartHp = boss.hp;
          this.necroBeam = this.add.circle(boss.sprite.x, boss.sprite.y, 34, 0x9fff6a, 0.18)
            .setStrokeStyle(3, 0x9fff6a, 0.9)
            .setDepth(15);
          this.tweens.add({ targets: this.necroBeam, scale: 1.5, alpha: 0.5, yoyo: true, repeat: -1, duration: 300 });
          this.showHint('⚠ The Necromancer is channeling — hit him!');
          sounds.nightStart();
        }
      }
    }

    if (boss.bossKind === 'spiderQueen') {
      this.queenTimerMs -= delta;
      if (this.queenTimerMs <= 0) {
        this.queenTimerMs = QUEEN_SPAWN_EVERY_MS;
        for (let i = 0; i < QUEEN_SPIDERLING_COUNT; i++) {
          const ox = (Math.random() - 0.5) * 40;
          const oy = (Math.random() - 0.5) * 40;
          this.zombies.push(new Zombie(this, this.world, boss.sprite.x + ox, boss.sprite.y + oy, specForSpiderling(this.state.nightNumber)));
          this.effects.burst(boss.sprite.x + ox, boss.sprite.y + oy, 0xd04060, 8, 80, 350, 0.8);
        }
        this.showHint('🕷 Spiderlings!');
      }
    }

    if (boss.variant === 'king') {
      const phase = kingPhase(Math.max(0, boss.hp) / boss.maxHp);
      if (phase !== this.kingPhaseNow) {
        this.kingPhaseNow = phase;
        const tuning = KING_PHASES[phase];
        boss.speedBoost = tuning.speedMult;
        boss.wallDamageMult = tuning.wallDamageMult;
        this.cameras.main.shake(300, 0.008);
        sounds.bossRoar();
        this.showBanner(phase === 2 ? '👑 THE KING ENRAGES' : '👑 FINAL FURY', phase === 2 ? 'he smashes through walls!' : 'end him now!');
      }
      this.kingSummonMs -= delta;
      if (this.kingSummonMs <= 0) {
        const tuning = KING_PHASES[this.kingPhaseNow];
        this.kingSummonMs = tuning.summonEveryMs;
        const kt = this.world.worldToTile(boss.sprite.x, boss.sprite.y);
        let spawned = 0;
        for (let tries = 0; tries < 30 && spawned < tuning.summonCount; tries++) {
          const tx = kt.x + Math.floor((Math.random() - 0.5) * 12);
          const ty = kt.y + Math.floor((Math.random() - 0.5) * 12);
          if (!this.world.isWalkable(tx, ty)) continue;
          const wc = this.world.tileToWorldCenter(tx, ty);
          this.zombies.push(new Zombie(this, this.world, wc.x, wc.y, specForCave(3, this.state.nightNumber)));
          this.effects.burst(wc.x, wc.y, 0xc46aff, 10, 90, 400, 1);
          spawned++;
        }
        if (spawned > 0) sounds.zombieHit();
      }
    }
  }

  /** Unseal the throne room (needs the Crystal Key) and wake the King. */
  private openThroneRoom(): void {
    if (!this.state.hasCrystalKey) {
      this.showHint(GATE_HINT);
      sounds.click();
      return;
    }
    const cave = this.caves[2];
    if (!cave) return;
    const gates: { x: number; y: number }[] = [];
    this.world.forEachTileOfType(TileType.ThroneGate, (x, y) => gates.push({ x, y }));
    for (const g of gates) {
      this.world.replaceTile(g.x, g.y, TileType.CaveFloor);
      const wc = this.world.tileToWorldCenter(g.x, g.y);
      this.effects.burst(wc.x, wc.y, 0x6a2a8a, 20, 160, 700, 1.5);
    }
    this.cameras.main.shake(500, 0.01);
    sounds.bossRoar();
    music.setTheme('boss');
    const center = cave.throneCenter ?? cave.entry;
    const wc = this.world.tileToWorldCenter(center.x, center.y);
    const king = new Zombie(this, this.world, wc.x, wc.y, kingSpec(this.state.nightNumber));
    this.zombies.push(king);
    this.kingPhaseNow = 1;
    this.kingSummonMs = KING_PHASES[1].summonEveryMs;
    this.showBanner(BOSS_INTROS.king.title, BOSS_INTROS.king.tip);
  }

  /** The King is dead. Fireworks, cake, credits, Endless+. */
  private triggerVictory(x: number, y: number): void {
    this.state.victory = true;
    this.state.endlessPlus = true;
    this.state.runMeta.bossKills += 1;
    MetaStore.recordVictory();
    music.setTheme('victory');
    sounds.cake();
    this.cameras.main.shake(500, 0.012);
    this.effects.burst(x, y, 0xffd700, 60, 260, 1200, 2.4);
    this.launchFireworks();
    // Cake rain!
    for (let i = 0; i < 10; i++) {
      this.time.delayedCall(i * 160, () => {
        const cx = this.cameras.main.worldView.x + Math.random() * this.cameras.main.worldView.width;
        const cy = this.cameras.main.worldView.y - 20;
        const cake = this.add.image(cx, cy, TEX.cake).setDepth(90).setScale(1.2);
        this.tweens.add({
          targets: cake,
          y: cy + this.cameras.main.worldView.height * (0.4 + Math.random() * 0.5),
          angle: (Math.random() - 0.5) * 360,
          duration: 1400,
          ease: 'Bounce.easeOut',
          onComplete: () => this.tweens.add({ targets: cake, alpha: 0, delay: 800, duration: 400, onComplete: () => cake.destroy() }),
        });
      });
    }
    // Royal loot burst
    const loot: { m: MaterialId; c: number }[] = [
      { m: 'gold', c: 20 }, { m: 'crystal', c: 5 }, { m: 'obsidian', c: 3 },
    ];
    for (const l of loot) {
      this.pickups.push(new Pickup(this, x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 40, l.m, l.c));
    }
    this.saveRun('Victory saved!');
    this.showBanner('👑 THE KING HAS FALLEN', 'YOU BEAT THE GAME!');
    this.time.delayedCall(2600, () => {
      this.scene.pause('UI');
      this.scene.pause();
      this.scene.launch('Credits', { night: this.state.nightNumber, stats: this.state.stats });
    });
  }

  private onZombieKilled(x: number, y: number, variant?: ZombieVariant): void {
    this.scene.get('UI').events.emit('zombie_killed');
    sounds.zombieDie();
    this.effects.bloodExplode(x, y);
    this.cameras.main.shake(60, 0.002);
    this.state.stats.zombiesKilled += 1;
    this.recordDailyQuestProgress('kill');
    this.gainHeroCharge(heroChargeForKill(variant));

    // The King's fall ends the story (and starts Endless+)
    if (variant === 'king') {
      this.triggerVictory(x, y);
      return;
    }

    // The Necromancer can re-raise tonight's fallen (surface sieges only)
    if (this.state.depth === 0 && this.state.phase === 'night' && variant !== 'boss' && this.fallenThisNight.length < 40) {
      this.fallenThisNight.push({ x, y, raised: false });
    }

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

    // Boss loot — big payoff with fireworks + a Boss Soul for the Crystal Key
    if (variant === 'boss') {
      this.showBanner('🏆 BOSS DOWN', '+1 Boss Soul · massive loot!');
      sounds.cake();
      music.setTheme('night');
      this.state.runMeta.bossKills += 1;
      this.effects.burst(x, y, 0xffd700, 40, 220, 1000, 2);
      this.launchFireworks();
      this.pickups.push(new Pickup(this, x, y - 10, 'soul', 1));
      for (const l of bossLoot()) {
        this.pickups.push(new Pickup(this, x + (Math.random() - 0.5) * 28, y + (Math.random() - 0.5) * 28, l.m, l.c));
      }
      this.spawnPowerOrb('haste', x - 18, y);
      this.spawnPowerOrb('fury', x, y - 8);
      this.spawnPowerOrb('shield', x + 18, y);
      return;
    }

    // Goblins sometimes drop a treasure map — an X appears somewhere out there
    if (variant === 'goblin' && this.state.depth === 0 && Math.random() < 0.15) {
      this.buryTreasure();
    }

    // Drops — generous to reward kills. Combo boost + blood moon boost.
    const drops = rollKillDrops({
      variant,
      night: this.state.nightNumber,
      combo: this.combo,
      bloodMoon: this.bloodMoon,
      lootMultiplier: this.nightTwist.lootMultiplier,
    });
    for (const d of drops) {
      this.pickups.push(new Pickup(this, x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10, d.m, d.c));
      if (d.m === 'gold') this.state.stats.goldEarned += d.c;
    }
    if (this.combo > 0 && this.combo % 5 === 0) {
      this.spawnPowerOrb(randomPowerUpKind(this.combo + this.state.nightNumber + kills), x, y);
      this.showHint(`Combo x${this.combo}: power orb!`);
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
    const standing = this.world.getTileAt(p.x, p.y);
    if (standing?.type === TileType.CaveEntrance) prompt = 'E — descend into the Deep Dark';
    else if (standing?.type === TileType.LadderDown) prompt = 'E — climb deeper';
    else if (standing?.type === TileType.LadderUp) prompt = 'E — climb up';
    if (!prompt) {
      outer: for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const t = this.world.getTileAt(p.x + dx, p.y + dy);
          if (!t) continue;
          if (t.type === TileType.ShopNPC) { prompt = 'E — open Shop'; break outer; }
          if (t.type === TileType.DoorWood) { prompt = 'E — open/close door'; break outer; }
          if (t.type === TileType.ThroneGate) {
            prompt = this.state.hasCrystalKey ? 'E — unlock the Throne Room 👑' : 'E — inspect the sealed gate';
            break outer;
          }
        }
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
      tiles: this.surfaceTiles,
      playerSpawn: this.world.playerSpawn,
      shopPos: this.world.shopPos,
      playerWorldPos: { x: this.player.x, y: this.player.y },
      dog: this.dog
        ? { alive: this.dog.alive, hp: this.dog.hp, level: this.dog.level, kills: this.dog.kills, x: this.dog.x, y: this.dog.y }
        : null,
      buddy: this.buddy
        ? { id: this.buddy.id, alive: this.buddy.alive, hp: this.buddy.hp, level: this.buddy.level, kills: this.buddy.kills, x: this.buddy.x, y: this.buddy.y }
        : null,
      caves: this.caves,
      depth: this.state.depth,
      runSeed: this.runSeed,
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
