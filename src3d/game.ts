import * as THREE from 'three';
import {
  BUILD_REACH, DAWN_LENGTH, DAY_LENGTH, DUSK_LENGTH, MAP_SIZE, NIGHT_MAX_LENGTH, PLAYER_REGEN_DAY, REACH,
  SWING_COOLDOWN, TORCH_BURN_DPS, TORCH_BURN_RADIUS, TOTAL_NIGHTS,
} from './config';
import { audio } from './audio';
import {
  cardFor, DAY_EVENTS, DayEventId, dayEventFor, hpScale, NIGHT_CARDS, NightCardId, nightSpawns, planRun, RunPlan,
  spawnWindow, ZType,
} from './director';
import { computeFlowField } from './flowfield';
import { Grid } from './grid';
import { Input } from './input';
import { Rng } from './rng';
import {
  add, B, BLOCKS, BUILD_IDS, buildOption, canAfford, Cost, costText, emptyInventory, Ground, Inventory, pay,
  PICK_TIERS, RES_ICON, RES_LIST,
} from './rules';
import { generateWorld, shoreTiles } from './worldgen';
import { angleTo, dist2d, moveWithCollision, tileOf } from './entities/body';
import { Player } from './entities/player';
import { Chest, Chicken, Dog, Merchant, Meteor, Tnt, Turret } from './entities/things';
import { Zombie } from './entities/zombie';
import { Fx, Marker } from './render/fx';
import { isTouch, LightSpot, Stage } from './render/stage';
import { Terrain } from './render/terrain';
import { Hud, PointerView } from './ui/hud';
import { Best, endScreen, helpScreen, Offer, tradeScreen } from './ui/screens';

type Phase = 'menu' | 'day' | 'dusk' | 'night' | 'dawn' | 'over';

const BLOCK_CHIPS: Partial<Record<B, number[]>> = {
  [B.Tree]: [0x6b4526, 0x3f9a36, 0x2a6b25],
  [B.Rock]: [0x8c8f94, 0x6c6f74],
  [B.Iron]: [0x8c8f94, 0xd9825f],
  [B.Gold]: [0x8c8f94, 0xffd43b],
  [B.Crystal]: [0x7ff6ff, 0x19b7d8, 0xffffff],
  [B.WallWood]: [0xb3834f, 0x6e4a28],
  [B.WallStone]: [0x9aa0a6, 0x55585c],
  [B.Torch]: [0xb3834f, 0xffb13b],
  [B.Turret]: [0x9aa0a6, 0xb3834f],
};
const RES_COLOR: Record<string, number> = { wood: 0xb3834f, stone: 0x9a9da2, iron: 0xd9825f, gold: 0xffd43b, crystal: 0x7ff6ff };
const BEST_KEY = 'mine3d:best';

interface TempLight extends LightSpot {
  t: number;
  dur: number;
}

interface Hazard {
  marker: Marker;
  t: number;
  x: number;
  z: number;
  kind: 'bolt';
}

export function loadBest(): Best {
  try {
    const v = JSON.parse(localStorage.getItem(BEST_KEY) ?? '');
    return { nights: v.nights ?? 0, wins: v.wins ?? 0 };
  } catch {
    return { nights: 0, wins: 0 };
  }
}

export class Game {
  readonly stage: Stage;
  readonly grid: Grid;
  readonly terrain: Terrain;
  readonly fx: Fx;
  readonly hud: Hud;
  readonly input: Input;
  readonly player: Player;
  readonly spawnPoint: { x: number; y: number };
  private shore: { x: number; y: number }[];
  private rng: Rng;
  private plan: RunPlan;
  private abort = new AbortController();
  private raf = 0;
  private lastT = performance.now();

  zombies: Zombie[] = [];
  private turrets: Turret[] = [];
  private tnts = new Map<number, Tnt>();
  private chests: Chest[] = [];
  private chickens: Chicken[] = [];
  private meteors: Meteor[] = [];
  private merchant: Merchant | null = null;
  private dog: Dog | null = null;
  private hazards: Hazard[] = [];
  private tempLights: TempLight[] = [];
  private crater: { x: number; z: number } | null = null;
  private ghost!: THREE.Mesh;
  private outline!: THREE.LineSegments;

  field: Float32Array;
  private fieldT = 0;
  private fieldKey = '';

  inv: Inventory = emptyInventory();
  private selected = 0;
  phase: Phase = 'menu';
  private phaseT = 0;
  private night = 0;
  private card: NightCardId | null = null;
  private spawnQueue: ZType[] = [];
  private spawnTimer = 0;
  private spawnGap = 1;
  private nightTotal = 0;
  private landing: { x: number; y: number }[] = [];
  private eventDone = false;
  private endless = false;
  private victory = false;

  zombieSpeedMul = 1;
  turretRateMul = 1;
  private golden = false;
  private hazardT = 0;
  private skyFlash = 0;
  private hitStop = 0;
  private torchT = 0;
  private hurtGlow = 0;
  private buildCd = 0;
  private lastBuildTile = -1;
  private mouseAimT = 0;
  private cinematic = -1;
  private modal: HTMLElement | null = null;
  private offers: Offer[] = [];
  private tutorial = 0;
  private groanT = 3;
  private overT = -1;
  private stats = { kills: 0, blocks: 0, built: 0 };
  private king: Zombie | null = null;
  private giant: Zombie | null = null;
  private fireworksT = 0;
  private menuYaw = 0;
  private dayLevel = 1;
  private cardShown = false;
  private smokeT = 0;

  constructor(container: HTMLElement, private overlay: HTMLElement, seed: number, private onExit: (again: boolean) => void) {
    this.rng = new Rng(seed);
    this.plan = planRun(seed);
    const w = generateWorld(MAP_SIZE, seed);
    this.grid = w.grid;
    this.spawnPoint = w.spawn;
    this.shore = shoreTiles(this.grid);
    const center = new THREE.Vector3(MAP_SIZE / 2, 0, MAP_SIZE / 2);
    this.stage = new Stage(container, center, this.abort.signal);
    this.terrain = new Terrain(this.grid);
    this.stage.scene.add(this.terrain.group);
    this.fx = new Fx(this.stage, overlay);
    this.fx.onLootArrive = () => audio.pickup();
    this.hud = new Hud(overlay, isTouch);
    this.input = new Input(this.stage.renderer.domElement, overlay, this.abort.signal);
    this.input.onGesture = () => audio.unlock();
    this.player = new Player(this.stage.scene, w.spawn.x + 0.5, w.spawn.y + 0.5);
    this.field = computeFlowField(this.grid, w.spawn.x, w.spawn.y);
    this.wireHud();
    this.makeCursor();
    this.hud.show(false);
    this.hud.setMuted(audio.muted);
    this.stage.target.copy(center);
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  // ───────────────────────────── lifecycle ─────────────────────────────

  start(): void {
    this.phase = 'day';
    this.phaseT = 0;
    this.night = 0;
    this.hud.show(true);
    audio.unlock();
    audio.music('day');
    this.hud.banner('☀️ Day 1', 'Gather wood and stone. Build before dark!', 3500);
    this.player.pos.set(this.spawnPoint.x + 0.5, 0, this.spawnPoint.y + 0.5);
    // Warm welcome: a little starting wood.
    this.inv.wood = 4;
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.abort.abort();
    this.stage.renderer.dispose();
    this.stage.renderer.forceContextLoss();
    this.stage.renderer.domElement.remove();
    this.overlay.innerHTML = '';
  }

  private wireHud(): void {
    const h = this.hud;
    h.onSelect = (i) => this.select(i);
    h.onUpgrade = () => this.upgrade();
    h.onNight = () => this.bringNight();
    h.onMute = () => h.setMuted(audio.toggleMute());
    h.onHelp = () => this.openHelp();
    h.onContext = () => this.interact();
    h.onAction = (down) => (this.input.actionHeld = down);
  }

  private loop(now: number): void {
    this.raf = requestAnimationFrame(this.loop);
    let dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      dt *= 0.08;
    }
    if (this.overT >= 0) dt *= 0.35;
    if (!this.modal) this.update(dt);
    else this.handleModalKeys();
    this.stage.render(dt);
  }

  /** Debug/playtest hook: simulate `seconds` of game time at 60 fps, then draw one frame. */
  advance(seconds: number): void {
    const steps = Math.round(seconds * 60);
    for (let i = 0; i < steps; i++) {
      if (!this.modal) this.update(1 / 60);
      this.stage.tick(1 / 60);
    }
    this.stage.render(0);
  }

  // ───────────────────────────── main update ─────────────────────────────

  private update(dt: number): void {
    if (this.phase === 'menu') {
      this.menuYaw += dt * 0.08;
      this.stage.yaw = Math.sin(this.menuYaw) * 0.6;
      this.stage.pitch = 0.62;
      this.stage.dist = 36;
      this.stage.lookLift = 0;
      this.player.update(dt, this.grid, new THREE.Vector2(), null);
      this.terrain.update(dt);
      this.fx.update(dt, this.player.pos);
      this.stage.setAtmosphere({ day: 1, dusk: 0.15, blood: false, fog: false, flash: 0 });
      this.stage.setLights([], this.player.pos);
      return;
    }

    this.phaseT += dt;
    this.input.update();
    this.handleEvents();
    this.updatePhase(dt);

    const alive = this.player.hp > 0;
    // Aim: mouse cursor on desktop, or auto-aim for touch/keyboard swings.
    let face: number | null = null;
    const aim = this.aimPoint();
    const swinging = alive && (this.input.actionHeld || (this.input.mouseHeld && this.selected === 0));
    if (aim && this.input.mouseHeld) face = angleTo(this.player.pos, aim);
    else if (swinging && this.selected === 0) {
      const z = this.nearestZombie(this.player.pos, 2.6);
      if (z) face = angleTo(this.player.pos, z.pos);
    }
    this.player.update(dt, this.grid, alive && this.cinematic < 0 ? this.input.move : new THREE.Vector2(), face);

    if (swinging && this.player.swingCd <= 0 && this.cinematic < 0) {
      if (this.selected === 0) this.swing(aim && this.input.mouseHeld ? aim : null);
      else if (this.input.actionHeld) this.buildAt(this.frontTile());
    }
    this.buildCd -= dt;
    if (this.input.mouseHeld && this.selected > 0 && aim && this.buildCd <= 0) {
      const t = { x: Math.floor(aim.x), y: Math.floor(aim.z) };
      const k = this.grid.idx(t.x, t.y);
      if (k !== this.lastBuildTile) {
        this.lastBuildTile = k;
        this.buildCd = 0.06;
        this.buildAt(t, true);
      }
    }
    if (!this.input.mouseHeld) this.lastBuildTile = -1;

    // Flow field toward the player (recomputed when the player moves tile or blocks change).
    this.fieldT -= dt;
    const pt = tileOf(this.player.pos);
    const key = `${pt.x},${pt.y},${this.grid.version}`;
    if (this.fieldT <= 0 && key !== this.fieldKey) {
      this.field = computeFlowField(this.grid, pt.x, pt.y);
      this.fieldKey = key;
      this.fieldT = 0.2;
    }

    this.updateZombies(dt);
    this.turrets = this.turrets.filter((t) => {
      t.update(dt);
      return !(t.gone);
    });
    for (const [k, t] of this.tnts) {
      t.update(dt);
      if (t.gone) this.tnts.delete(k);
    }
    this.chests = this.chests.filter((c) => {
      c.update(dt);
      return !c.gone;
    });
    this.chickens = this.chickens.filter((c) => {
      if (!c.caught) c.update(dt);
      return !c.caught;
    });
    this.meteors = this.meteors.filter((m) => {
      m.update(dt);
      return !m.done;
    });
    if (this.merchant) {
      this.merchant.update(dt);
      if (this.merchant.gone) this.merchant = null;
    }
    this.dog?.update(dt);
    this.updateHazards(dt);
    this.updateTorches(dt);
    if (this.crater) {
      this.smokeT -= dt;
      if (this.smokeT <= 0) {
        this.smokeT = 0.12;
        const c = new THREE.Vector3(this.crater.x + (Math.random() - 0.5) * 0.6, 0.5, this.crater.z + (Math.random() - 0.5) * 0.6);
        this.fx.burst(c, [0x555555, 0x777777, 0x444444], 1, { speed: 0.3, up: 2.2, size: 0.35, life: 2.6, gravity: -0.4 });
        if (Math.random() < 0.3) this.fx.burst(c, [0x7ff6ff], 1, { glow: true, speed: 0.4, up: 1.5, size: 0.08, life: 1.2, gravity: -0.5 });
      }
    }

    if (this.phase === 'day' && alive) this.player.hp = Math.min(this.player.maxHp, this.player.hp + PLAYER_REGEN_DAY * dt);

    this.updateCamera(dt);
    this.updateCursor();
    this.updateLights(dt);
    this.terrain.update(dt);
    this.fx.update(dt, this.player.pos);
    this.updateHud(dt);
    if (this.victory) this.updateFireworks(dt);
    if (this.overT >= 0) {
      this.overT += dt / 0.35;
    }
  }

  /** While a panel is open, the game is paused; H/Esc/E close it. */
  private handleModalKeys(): void {
    for (const e of this.input.events.splice(0)) {
      const isEndScreen = !!this.modal?.querySelector('[data-again]');
      if (e.type === 'key' && ['h', '?', 'escape', 'e'].includes(e.key) && !isEndScreen) this.closeModal();
    }
  }

  private handleEvents(): void {
    for (const e of this.input.events.splice(0)) {
      if (e.type === 'key') {
        if (e.key >= '1' && e.key <= '5') this.select(Number(e.key) - 1);
        else if (e.key === 'q' || e.key === 'escape') this.select(0);
        else if (e.key === 'u') this.upgrade();
        else if (e.key === 'n') this.bringNight();
        else if (e.key === 'e') this.interact();
        else if (e.key === 'm') this.hud.setMuted(audio.toggleMute());
        else if (e.key === 'h' || e.key === '?') this.openHelp();
        else if (e.key === 'tab') this.select((this.selected + 1) % 5);
      } else if (e.type === 'rclick') {
        this.select(0);
      } else if (e.type === 'tap') {
        // Touch: tap the world. Build mode → place there; pick mode → swing toward it.
        const p = this.stage.pick(e.x, e.y);
        if (!p || this.player.hp <= 0 || this.cinematic >= 0) continue;
        if (this.selected > 0) this.buildAt({ x: Math.floor(p.x), y: Math.floor(p.z) });
        else if (this.player.swingCd <= 0) {
          this.player.facing = angleTo(this.player.pos, p);
          this.swing(p);
        }
      } else if (e.type === 'click') {
        this.mouseAimT = 3;
      }
    }
  }

  private aimPoint(): THREE.Vector3 | null {
    if (isTouch || !this.input.pointer) return null;
    return this.stage.pick(this.input.pointer.x, this.input.pointer.y);
  }

  private frontTile(): { x: number; y: number } {
    const p = this.player.pos;
    const f = this.player.facing;
    return { x: Math.floor(p.x + Math.sin(f) * 1.05), y: Math.floor(p.z + Math.cos(f) * 1.05) };
  }

  // ───────────────────────────── phases ─────────────────────────────

  private updatePhase(dt: number): void {
    const t = this.phaseT;
    switch (this.phase) {
      case 'day':
        if (!this.eventDone && t > 7) {
          this.eventDone = true;
          const ev = dayEventFor(this.plan, this.night + 1, this.rng);
          if (ev) this.runDayEvent(ev);
        }
        if (t >= DAY_LENGTH) this.beginDusk();
        break;
      case 'dusk':
        this.updateCinematic(dt);
        if (t >= DUSK_LENGTH + 1.5) this.beginNight();
        break;
      case 'night': {
        this.updateSpawning(dt);
        this.updateNightHazards(dt);
        const left = this.spawnQueue.length + this.zombies.filter((z) => !z.dead).length;
        const kingAlive = this.king && !this.king.dead;
        if ((left === 0 && t > 8) || (t > NIGHT_MAX_LENGTH && !kingAlive)) this.beginDawn();
        break;
      }
      case 'dawn':
        if (t >= DAWN_LENGTH) this.beginDay();
        break;
      default:
        break;
    }
  }

  private bringNight(): void {
    if (this.phase !== 'day' || this.phaseT < 3) return;
    this.beginDusk();
  }

  private beginDusk(): void {
    this.night++;
    this.phase = 'dusk';
    this.phaseT = 0;
    this.card = cardFor(this.plan, this.night, this.rng);
    this.cinematic = 0;
    this.input.actionHeld = false;
    this.closeModal();
    if (this.merchant) this.merchant.leaving = true;
    for (const c of this.chickens) c.dispose();
    this.chickens = [];
    audio.gong();
    this.hud.hint(null);
    this.hud.banner('', '', 1);
    this.cardShown = false;
    // Pick where they will come ashore tonight.
    const far = this.shore.filter((s) => Math.hypot(s.x - this.player.pos.x, s.y - this.player.pos.z) > 10);
    const pool = far.length > 5 ? far : this.shore;
    const sites = this.card === 'king' ? 1 : this.night >= 3 ? 3 : 2;
    this.landing = [];
    for (let i = 0; i < sites; i++) this.landing.push(this.rng.pick(pool));
  }

  private updateCinematic(dt: number): void {
    if (this.cinematic < 0) return;
    this.cinematic += dt;
    const c = this.cinematic;
    if (!this.cardShown && c > 1.3 && this.card) {
      this.cardShown = true;
      audio.card();
      this.hud.card(this.night, NIGHT_CARDS[this.card], 4000, () => {
        if (this.cinematic >= 0 && this.cinematic < 5.2) this.cinematic = 5.2;
      });
    }
    const into = Math.min(1, c / 1.2);
    const out = c > 5.2 ? Math.min(1, (c - 5.2) / 1.2) : 0;
    const k = ease(into) * (1 - ease(out));
    this.stage.pitch = lerp(0.95, 0.45, k);
    this.stage.dist = lerp(15, 14, k);
    this.stage.lookLift = lerp(0, 5.5, k);
    this.stage.setMoon(k > 0.01, this.night, this.card === 'king');
    if (c > 6.4) {
      this.cinematic = -1;
      this.stage.setMoon(false, this.night, false);
      this.stage.pitch = 0.95;
      this.stage.dist = 15;
      this.stage.lookLift = 0;
    }
  }

  private beginNight(): void {
    this.phase = 'night';
    this.phaseT = 0;
    const card = this.card!;
    this.spawnQueue = nightSpawns(this.night, card, this.rng);
    this.nightTotal = this.spawnQueue.length;
    this.spawnGap = spawnWindow(this.night) / this.spawnQueue.length;
    this.spawnTimer = 1;
    this.golden = card === 'lucky';
    this.hazardT = 3;
    audio.music(card === 'king' || card === 'giant' ? 'boss' : 'night');
    const c = NIGHT_CARDS[card];
    this.hud.banner(`${c.emoji} Night ${this.night}${this.night <= TOTAL_NIGHTS ? ` of ${TOTAL_NIGHTS}` : ''}`, 'They are coming ashore — follow the 🧟 arrows!', 3000);
  }

  private beginDawn(): void {
    this.phase = 'dawn';
    this.phaseT = 0;
    this.spawnQueue = [];
    for (const z of this.zombies) {
      if (!z.dead) this.fx.burst(z.pos.clone().setY(0.6), [0xffa030, 0xff5010, 0x333333], 10, { glow: true, speed: 2, up: 4 });
      z.dead = true;
      z.dispose();
    }
    this.zombies = [];
    this.hazards.forEach((h) => h.marker.remove());
    this.hazards = [];
    this.giant = null;
    audio.dawn();
    audio.music('day');
    const heal = Math.round(this.player.maxHp * 0.5);
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
    this.saveBest();
    const next = this.night + 1;
    if (this.victory && this.night === TOTAL_NIGHTS) {
      // The victory banner is already up.
    } else if (this.night === TOTAL_NIGHTS - 1) {
      this.hud.banner(`☀️ You survived night ${this.night}!`, 'The sea is boiling… Tomorrow night, the King comes. 👑', 5000);
    } else {
      this.hud.banner(`☀️ You survived night ${this.night}!`, next <= TOTAL_NIGHTS ? `${TOTAL_NIGHTS - this.night} to go · +${heal} ❤️` : `Endless mode · +${heal} ❤️`, 3500);
    }
  }

  private beginDay(): void {
    this.phase = 'day';
    this.phaseT = 0;
    this.eventDone = false;
    this.card = null;
    this.golden = false;
  }

  // ───────────────────────────── surprises ─────────────────────────────

  private runDayEvent(id: DayEventId): void {
    const ev = DAY_EVENTS[id];
    this.hud.banner(`${ev.emoji} ${ev.title}`, ev.text, 4200);
    const p = this.player.pos;
    switch (id) {
      case 'dog': {
        const s = this.freeTileNear(p.x, p.z, 7, 10) ?? { x: Math.floor(p.x) + 2, y: Math.floor(p.z) };
        this.dog = new Dog(this, s.x + 0.5, s.y + 0.5);
        audio.bark();
        break;
      }
      case 'meteor': {
        const s = this.freeTileNear(p.x, p.z, 8, 13, Ground.Grass) ?? this.freeTileNear(p.x, p.z, 4, 16)!;
        const target = new THREE.Vector3(s.x + 0.5, 0, s.y + 0.5);
        audio.whoosh();
        this.meteors.push(new Meteor(this, target, 2.4, true, () => this.meteorCrash(s.x, s.y)));
        break;
      }
      case 'treasure': {
        const beach = this.shore.filter((t) => this.grid.blockAt(t.x, t.y) === B.None && Math.hypot(t.x - p.x, t.y - p.z) > 8);
        const s = this.rng.pick(beach.length ? beach : this.shore);
        this.grid.setBlock(s.x, s.y, B.Chest);
        this.chests.push(new Chest(this, s.x, s.y));
        break;
      }
      case 'merchant': {
        const s = this.freeTileNear(p.x, p.z, 3, 6) ?? { x: Math.floor(p.x) + 3, y: Math.floor(p.z) };
        this.merchant = new Merchant(this, s.x + 0.5, s.y + 0.5);
        this.offers = this.makeOffers();
        break;
      }
      case 'chickens': {
        for (let i = 0; i < 9; i++) {
          const s = this.freeTileNear(p.x, p.z, 2, 9);
          if (s) this.chickens.push(new Chicken(this, s.x + 0.5, s.y + 0.5, true));
        }
        break;
      }
      case 'earthquake': {
        this.stage.shake(1.2);
        audio.stomp();
        setTimeout(() => audio.stomp(), 400);
        const ores: B[] = [B.Iron, B.Iron, B.Iron, B.Iron, B.Iron, B.Gold, B.Gold, B.Gold, B.Gold, B.Crystal, B.Crystal];
        for (const b of ores) {
          const s = this.freeTileNear(p.x, p.z, 4, 12, Ground.Grass);
          if (!s) continue;
          this.grid.setBlock(s.x, s.y, b);
          this.fx.burst(new THREE.Vector3(s.x + 0.5, 0.2, s.y + 0.5), [0x8a5a36, 0xffe070], 14, { speed: 3, up: 6 });
        }
        break;
      }
    }
  }

  private meteorCrash(x: number, y: number): void {
    const c = new THREE.Vector3(x + 0.5, 0, y + 0.5);
    this.explode(c, 2.2, 30, 80, 'meteor');
    this.stage.shake(1.4);
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const tx = x + dx, ty = y + dy;
        if (!this.grid.isLand(tx, ty) || dx * dx + dy * dy > 5) continue;
        this.grid.ground[this.grid.idx(tx, ty)] = Ground.Dirt;
        const b = this.grid.blockAt(tx, ty);
        if (b !== B.None && BLOCKS[b].built) continue;
        const r = dx * dx + dy * dy;
        if (r === 0) this.grid.setBlock(tx, ty, B.Crystal);
        else if (r <= 2 && this.rng.chance(0.55)) this.grid.setBlock(tx, ty, this.rng.chance(0.5) ? B.Crystal : B.Iron);
        else if (this.rng.chance(0.3)) this.grid.setBlock(tx, ty, B.Iron);
        else this.grid.setBlock(tx, ty, B.None);
      }
    this.terrain.markGroundDirty();
    this.crater = { x: c.x, z: c.z };
  }

  private makeOffers(): Offer[] {
    const say = (s: string) => this.fx.text(this.player.pos, s, 'gain');
    return [
      { emoji: '❤️', title: 'Full heal', text: 'Feel brand new', cost: { gold: 2 }, buy: () => this.buy(0, () => (this.player.hp = this.player.maxHp)) },
      { emoji: '⛓️', title: '6 iron', text: 'For turrets & tools', cost: { gold: 3 }, buy: () => this.buy(1, () => add(this.inv, { iron: 6 })) },
      { emoji: '💎', title: '2 crystals', text: 'Straight from the moon', cost: { gold: 4 }, buy: () => this.buy(2, () => add(this.inv, { crystal: 2 })) },
      { emoji: '📦', title: 'Builder crate', text: '10 wood + 10 stone', cost: { gold: 1 }, buy: () => this.buy(3, () => { add(this.inv, { wood: 10, stone: 10 }); say('+10🪵 +10🪨'); }) },
    ];
  }

  private buy(i: number, effect: () => void): void {
    const o = this.offers[i];
    if (o.sold || !pay(this.inv, o.cost)) return;
    o.sold = true;
    effect();
    audio.coin();
  }

  catchChicken(c: Chicken): void {
    c.dispose();
    audio.cluck();
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 12);
    add(this.inv, { gold: 1 });
    this.fx.burst(c.pos.clone().setY(0.4), [0xffffff, 0xf8f8f0], 14, { speed: 3, up: 3, size: 0.1, gravity: 3 });
    this.fx.text(c.pos, '+12❤ +1🪙', 'gain');
  }

  private updateNightHazards(dt: number): void {
    if (this.card !== 'meteors' && this.card !== 'storm') return;
    this.hazardT -= dt;
    if (this.hazardT > 0) return;
    const p = this.player.pos;
    if (this.card === 'meteors') {
      this.hazardT = 1.6 + this.rng.next() * 1.4;
      const near = this.rng.chance(0.25);
      const s = near
        ? { x: Math.floor(p.x + (this.rng.next() - 0.5) * 5), y: Math.floor(p.z + (this.rng.next() - 0.5) * 5) }
        : this.freeTileNear(p.x, p.z, 2, 11);
      if (!s || !this.grid.isLand(s.x, s.y)) return;
      const target = new THREE.Vector3(s.x + 0.5, 0, s.y + 0.5);
      const marker = this.fx.marker(target.x, target.z, 1.3, 0xff3a2a);
      audio.whoosh();
      this.meteors.push(
        new Meteor(this, target, 1.8, false, () => {
          marker.remove();
          this.explode(target, 1.3, 14, 40, 'meteor');
          if (this.rng.chance(0.45) && this.grid.blockAt(s.x, s.y) === B.None && dist2d(target, this.player.pos) > 0.9) {
            this.grid.setBlock(s.x, s.y, B.Iron);
          }
        }),
      );
    } else {
      this.hazardT = 1.3 + this.rng.next();
      const alive = this.zombies.filter((z) => !z.dead && z.rising <= 0);
      let x: number, z: number;
      if (alive.length && this.rng.chance(0.8)) {
        const zz = this.rng.pick(alive);
        x = zz.pos.x;
        z = zz.pos.z;
      } else {
        x = p.x + (this.rng.next() - 0.5) * 3;
        z = p.z + (this.rng.next() - 0.5) * 3;
      }
      this.hazards.push({ marker: this.fx.marker(x, z, 1.2, 0xbfd4ff), t: 0.9, x, z, kind: 'bolt' });
    }
  }

  private updateHazards(dt: number): void {
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.t -= dt;
      h.marker.mesh.scale.setScalar(1 + Math.sin(h.t * 30) * 0.05);
      if (h.t > 0) continue;
      h.marker.remove();
      this.hazards.splice(i, 1);
      const pos = new THREE.Vector3(h.x, 0, h.z);
      this.fx.bolt(h.x, h.z);
      audio.thunder();
      this.skyFlash = 1;
      this.stage.shake(0.5);
      this.tempLights.push({ x: h.x, y: 3, z: h.z, color: 0xcfe0ff, intensity: 40, distance: 14, t: 0.3, dur: 0.3 });
      this.fx.burst(pos.clone().setY(0.2), [0xeaf0ff, 0x9fc0ff], 18, { glow: true, speed: 5, up: 5 });
      for (const z of this.zombies) if (!z.dead && dist2d(z.pos, pos) < 1.4) this.damageZombie(z, 30, pos, 6);
      if (dist2d(this.player.pos, pos) < 1.1) this.hurtPlayer(10, pos);
    }
  }

  // ───────────────────────────── zombies ─────────────────────────────

  private updateSpawning(dt: number): void {
    if (!this.spawnQueue.length) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = this.spawnGap * (0.5 + this.rng.next());
    const type = this.spawnQueue.shift()!;
    const site = this.rng.pick(this.landing);
    const near = this.shore.filter((s) => Math.abs(s.x - site.x) + Math.abs(s.y - site.y) < 5 && this.grid.walkable(s.x, s.y));
    const s = near.length ? this.rng.pick(near) : site;
    this.spawnZombie(type, s.x + 0.5, s.y + 0.5);
  }

  spawnZombie(type: ZType, x: number, z: number): Zombie {
    const zb = new Zombie(this, type, x, z, hpScale(this.night), this.golden && type === 'walker');
    this.zombies.push(zb);
    if (type === 'giant') {
      this.giant = zb;
      this.hud.banner('🗿 THE GIANT!', 'Huge, slow and hits like a truck. Use TNT and turrets!', 3500);
      audio.roar();
      this.stage.shake(1);
    } else if (type === 'king') {
      this.king = zb;
      this.hud.banner('👑 THE ZOMBIE KING', 'Defeat him to save the island!', 4000);
      audio.roar();
      this.stage.shake(1.4);
      this.fx.burst(new THREE.Vector3(x, 0.3, z), [0x2c86d1, 0xffffff], 50, { speed: 6, up: 9 });
    }
    return zb;
  }

  private updateZombies(dt: number): void {
    const zs = this.zombies;
    for (const z of zs) if (!z.dead) z.update(dt);
    // Keep them from stacking into one blob.
    for (let i = 0; i < zs.length; i++) {
      const a = zs[i];
      if (a.dead || a.rising > 0) continue;
      for (let j = i + 1; j < zs.length; j++) {
        const b = zs[j];
        if (b.dead || b.rising > 0) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const min = (a.radius + b.radius) * 0.9;
        const d2 = dx * dx + dz * dz;
        if (d2 > min * min || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const push = ((min - d) / d) * 0.5;
        const ga = a.stats.ghost ? () => true : undefined, gb = b.stats.ghost ? () => true : undefined;
        moveWithCollision(this.grid, a.pos, -dx * push, -dz * push, 0.3, ga);
        moveWithCollision(this.grid, b.pos, dx * push, dz * push, 0.3, gb);
      }
    }
    // ...and from standing inside the player.
    const pp = this.player.pos;
    for (const z of zs) {
      if (z.dead || z.rising > 0) continue;
      const dx = z.pos.x - pp.x, dz = z.pos.z - pp.z;
      const min = 0.3 + z.radius;
      const d = Math.hypot(dx, dz);
      if (d < min && d > 1e-4) moveWithCollision(this.grid, z.pos, (dx / d) * (min - d), (dz / d) * (min - d), 0.3, z.stats.ghost ? () => true : undefined);
    }
    for (let i = zs.length - 1; i >= 0; i--) {
      if (zs[i].dead) {
        this.onZombieDeath(zs[i]);
        zs.splice(i, 1);
      }
    }
    if (this.phase === 'night') {
      this.groanT -= dt;
      if (this.groanT <= 0 && zs.length) {
        this.groanT = 2 + Math.random() * 3;
        audio.groan();
      }
    }
  }

  damageZombie(z: Zombie, amount: number, from: THREE.Vector3 | null, knock = 4, crit = false): void {
    if (z.dead || z.rising > 0.4) return;
    const killed = z.damage(amount, from, knock);
    this.fx.text(z.pos.clone().setY(z.stats.scale), crit ? `${amount}!` : String(amount), crit ? 'crit' : '');
    this.fx.burst(z.pos.clone().setY(0.7 * z.stats.scale), [z.stats.color, 0x3a6a2a], 4, { speed: 2.5, up: 3, size: 0.1 });
    audio.hit();
    if (killed) z.dead = true;
  }

  private onZombieDeath(z: Zombie): void {
    if (this.phase === 'dawn') {
      z.dispose();
      return;
    }
    this.stats.kills++;
    const s = z.stats.scale;
    const big = z.type === 'giant' || z.type === 'king';
    this.fx.burst(z.pos.clone().setY(0.6 * s), [z.stats.color, 0x3e8fb0, 0x4b3b8f, 0x2a5a2a], big ? 90 : 16, {
      speed: big ? 7 : 3.5,
      up: big ? 9 : 5,
      size: 0.16 * Math.sqrt(s),
      life: big ? 1.6 : 0.9,
    });
    audio.zombieDie();
    this.stage.shake(big ? 1.2 : 0.12);
    z.dispose();
    if (z.stats.explodes) {
      this.fx.text(z.pos, 'POP!', 'crit');
      this.explode(z.pos.clone(), 2.2, 0, 0, 'pop');
    }
    if (z.golden) this.giveLoot(z.pos, { gold: 2 });
    else if (z.type === 'giant') this.giveLoot(z.pos, { iron: 8, gold: 4, crystal: 2 }, 'Giant loot!');
    else if (z.type === 'brute') this.giveLoot(z.pos, { iron: 2 });
    else if (Math.random() < 0.12) this.giveLoot(z.pos, this.rng.pick<Cost>([{ wood: 2 }, { stone: 2 }, { iron: 1 }]));
    if (z === this.giant) this.giant = null;
    if (z.type === 'king') this.winGame(z.pos);
  }

  private nearestZombie(p: THREE.Vector3, max: number): Zombie | null {
    let best: Zombie | null = null;
    let bd = max;
    for (const z of this.zombies) {
      if (z.dead || z.rising > 0.4) continue;
      const d = dist2d(z.pos, p) - z.radius;
      if (d < bd) {
        bd = d;
        best = z;
      }
    }
    return best;
  }

  hurtPlayer(dmg: number, from: THREE.Vector3): void {
    const pl = this.player;
    if (pl.invuln > 0 || pl.hp <= 0 || this.phase === 'over') return;
    pl.hp -= dmg;
    pl.invuln = 0.45;
    pl.hurt();
    audio.hurt();
    this.stage.shake(0.3);
    this.hurtGlow = 1;
    this.fx.text(pl.pos, `-${dmg}`, 'bad');
    const a = angleTo(from, pl.pos);
    moveWithCollision(this.grid, pl.pos, Math.sin(a) * 0.35, Math.cos(a) * 0.35, 0.28);
    if (pl.hp <= 0) this.loseGame();
  }

  zombieHitsBlock(x: number, y: number, dmg: number): void {
    const b = this.grid.blockAt(x, y);
    if (b === B.None) return;
    if (b === B.TNT) {
      this.tnts.get(this.grid.idx(x, y))?.light();
      return;
    }
    if (b === B.Chest) return;
    const broke = this.grid.damage(x, y, dmg);
    this.terrain.shake(x, y);
    const c = new THREE.Vector3(x + 0.5, 0.6, y + 0.5);
    this.fx.burst(c, BLOCK_CHIPS[b] ?? [0x888888], broke ? 16 : 3, { speed: 2.5, up: 3, size: 0.12 });
    if (dist2d(c, this.player.pos) < 9) (broke ? audio.breakBlock() : audio.chop());
  }

  explode(pos: THREE.Vector3, radius: number, dmg: number, wallDmg: number, source: 'tnt' | 'boomer' | 'meteor' | 'pop'): void {
    audio.boom();
    this.stage.shake(source === 'pop' ? 0.4 : radius * 0.45);
    this.hitStop = Math.max(this.hitStop, 0.06);
    const c = pos.clone().setY(0.5);
    const colors = source === 'boomer' || source === 'pop' ? [0x9bff6a, 0x5adf3a, 0xeaffd0] : [0xffe070, 0xff9a30, 0xff5010];
    this.fx.burst(c, colors, 50, { glow: true, speed: radius * 3, up: 5, size: 0.22, life: 0.7, gravity: 4 });
    this.fx.burst(c, [0x333333, 0x555555, 0x222222], 16, { speed: radius * 2, up: 7, size: 0.28, life: 1.2 });
    this.fx.ring(pos, colors[0], radius * 1.3, 0.4);
    this.tempLights.push({ x: pos.x, y: 1.5, z: pos.z, color: colors[1], intensity: 35, distance: radius * 5, t: 0.35, dur: 0.35 });

    for (const z of this.zombies) {
      if (z.dead) continue;
      const d = dist2d(z.pos, pos);
      if (d > radius + z.radius) continue;
      const zdmg = source === 'pop' || source === 'boomer' ? 30 : Math.round(dmg * (1 - (d / radius) * 0.5));
      this.damageZombie(z, zdmg, pos, 9);
    }
    const pd = dist2d(this.player.pos, pos);
    if (pd < radius && dmg > 0) {
      const scale = source === 'tnt' ? 0.4 : 1;
      this.hurtPlayer(Math.max(1, Math.round(dmg * scale * (1 - (pd / radius) * 0.5))), pos);
    }
    const t = tileOf(pos);
    const r = Math.ceil(radius);
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const x = t.x + dx, y = t.y + dy;
        const d = Math.hypot(x + 0.5 - pos.x, y + 0.5 - pos.z);
        if (d > radius) continue;
        const b = this.grid.blockAt(x, y);
        if (b === B.TNT) {
          const other = this.tnts.get(this.grid.idx(x, y));
          if (other && other.fuse < 0) other.fuse = 0.2;
          continue;
        }
        if (b === B.Chest) {
          this.grid.setBlock(x, y, B.None);
          continue;
        }
        if (b === B.None) {
          if (source !== 'pop' && d < radius * 0.5 && this.grid.groundAt(x, y) === Ground.Grass) {
            this.grid.ground[this.grid.idx(x, y)] = Ground.Dirt;
            this.terrain.markGroundDirty();
          }
          continue;
        }
        const def = BLOCKS[b];
        if (!def.built && source === 'tnt' && d < radius - 0.5) {
          // TNT mines natural blocks and hands you the loot.
          this.grid.setBlock(x, y, B.None);
          this.giveLoot(new THREE.Vector3(x + 0.5, 0, y + 0.5), def.drops);
          this.stats.blocks++;
        } else if (def.built && wallDmg > 0) {
          this.zombieHitsBlock(x, y, wallDmg * (1 - (d / radius) * 0.5));
        }
      }
  }

  // ───────────────────────────── player actions ─────────────────────────────

  private select(i: number): void {
    if (i < 0 || i > 4) return;
    this.selected = i;
    audio.place();
  }

  private swing(aim: THREE.Vector3 | null): void {
    const pl = this.player;
    pl.swingCd = SWING_COOLDOWN;
    pl.swing();
    audio.swing();
    const tier = PICK_TIERS[pl.tier];
    if (aim) pl.facing = angleTo(pl.pos, aim);
    const f = pl.facing;
    this.fx.slash(pl.pos, f, pl.tier === 3 ? 0x9ff8ff : 0xffffff);

    // 1) Hit zombies in a wide arc in front.
    let hitAny = false;
    for (const z of this.zombies) {
      if (z.dead || z.rising > 0.4) continue;
      const d = dist2d(z.pos, pl.pos);
      if (d > REACH + z.radius) continue;
      let da = Math.abs(angleTo(pl.pos, z.pos) - f);
      if (da > Math.PI) da = Math.PI * 2 - da;
      if (da > 1.0 && d > 0.6) continue;
      const crit = Math.random() < 0.15;
      this.damageZombie(z, crit ? tier.damage * 2 : tier.damage, pl.pos, 2.6, crit);
      hitAny = true;
    }
    if (hitAny) {
      this.hitStop = 0.045;
      this.stage.shake(0.12);
      return;
    }

    // 2) Otherwise mine the block we are aiming at (or the nearest one in front).
    const target = this.blockTarget(aim);
    if (target) this.hitBlock(target.x, target.y);
  }

  private blockTarget(aim: THREE.Vector3 | null): { x: number; y: number } | null {
    const p = this.player.pos;
    if (aim) {
      const t = { x: Math.floor(aim.x), y: Math.floor(aim.z) };
      if (this.grid.blockAt(t.x, t.y) !== B.None && Math.hypot(t.x + 0.5 - p.x, t.y + 0.5 - p.z) < 2.3) return t;
    }
    const f = this.player.facing;
    for (const reach of [0.75, 1.2, 1.6]) {
      const x = Math.floor(p.x + Math.sin(f) * reach), y = Math.floor(p.z + Math.cos(f) * reach);
      if (this.grid.blockAt(x, y) !== B.None) return { x, y };
    }
    // Forgiving auto-target: nearest block in the front half within reach.
    let best: { x: number; y: number } | null = null;
    let bd = 1.9;
    const px = Math.floor(p.x), py = Math.floor(p.z);
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const x = px + dx, y = py + dy;
        const b = this.grid.blockAt(x, y);
        if (b === B.None || b === B.Torch) continue;
        const cx = x + 0.5 - p.x, cz = y + 0.5 - p.z;
        const d = Math.hypot(cx, cz);
        if (d >= bd) continue;
        if (cx * Math.sin(f) + cz * Math.cos(f) < 0) continue;
        bd = d;
        best = { x, y };
      }
    if (best) this.player.facing = Math.atan2(best.x + 0.5 - p.x, best.y + 0.5 - p.z);
    return best;
  }

  private hitBlock(x: number, y: number): void {
    const b = this.grid.blockAt(x, y);
    const def = BLOCKS[b];
    const c = new THREE.Vector3(x + 0.5, 0.6, y + 0.5);
    if (b === B.TNT) {
      this.tnts.get(this.grid.idx(x, y))?.light();
      return;
    }
    const tier = this.player.tier;
    if (tier < def.minTier) {
      audio.clank();
      this.fx.burst(c, [0xffffff, 0xffe070], 6, { glow: true, speed: 3, up: 3, size: 0.07, life: 0.3 });
      this.fx.text(c, `Needs ${PICK_TIERS[def.minTier].name}`, 'info');
      this.terrain.shake(x, y);
      return;
    }
    const broke = this.grid.damage(x, y, PICK_TIERS[tier].blockPower);
    this.terrain.shake(x, y);
    this.fx.burst(c, BLOCK_CHIPS[b] ?? [0x888888], broke ? 18 : 5, { speed: 2.5, up: 4, size: 0.12 });
    if (b === B.Tree || b === B.WallWood) audio.chop();
    else audio.clink();
    if (!broke) return;
    audio.breakBlock();
    this.stats.blocks++;
    this.giveLoot(c, def.drops);
    if (b === B.Crystal) this.fx.burst(c, [0x7ff6ff, 0xffffff], 20, { glow: true, speed: 3, up: 5 });
  }

  giveLoot(at: THREE.Vector3, loot: Cost, label?: string): void {
    add(this.inv, loot);
    const parts: string[] = [];
    for (const r of RES_LIST) {
      const n = loot[r];
      if (!n) continue;
      parts.push(`+${n}${RES_ICON[r]}`);
      this.fx.loot(at, RES_COLOR[r], Math.min(n, 6));
    }
    if (parts.length) this.fx.text(at, (label ? label + ' ' : '') + parts.join(' '), 'gain');
  }

  private buildAt(t: { x: number; y: number }, fromDrag = false): void {
    const id = BUILD_IDS[this.selected - 1];
    const opt = buildOption(id, this.inv);
    const p = this.player.pos;
    const c = new THREE.Vector3(t.x + 0.5, 0.5, t.y + 0.5);
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    if (!this.grid.isLand(t.x, t.y) || this.grid.blockAt(t.x, t.y) !== B.None || d > BUILD_REACH) {
      if (!fromDrag) audio.denied();
      return;
    }
    const solid = BLOCKS[opt.block].solid;
    if (solid) {
      if (Math.abs(c.x - p.x) < 0.5 + 0.28 && Math.abs(c.z - p.z) < 0.5 + 0.28) return;
      if (this.zombies.some((z) => !z.dead && Math.abs(z.pos.x - c.x) < 0.75 && Math.abs(z.pos.z - c.z) < 0.75)) return;
      if (this.merchant && dist2d(this.merchant.pos, c) < 1) return;
    }
    if (!pay(this.inv, opt.cost)) {
      audio.denied();
      this.fx.text(c, `Need ${costText(opt.cost)}`, 'info');
      return;
    }
    this.grid.setBlock(t.x, t.y, opt.block);
    const k = this.grid.idx(t.x, t.y);
    if (opt.block === B.Turret) this.turrets.push(new Turret(this, t.x, t.y));
    if (opt.block === B.TNT) this.tnts.set(k, new Tnt(this, t.x, t.y));
    this.terrain.shake(t.x, t.y);
    this.fx.burst(c.setY(0.1), [0xffffff, 0xdddddd], 8, { speed: 2, up: 1.5, size: 0.1, life: 0.5 });
    audio.place();
    this.stats.built++;
    if (!fromDrag) this.player.swing();
  }

  private upgrade(): void {
    const pl = this.player;
    if (pl.tier >= PICK_TIERS.length - 1 || this.player.hp <= 0) return;
    const next = PICK_TIERS[pl.tier + 1];
    if (!pay(this.inv, next.cost)) {
      audio.denied();
      this.fx.text(pl.pos, `Need ${costText(next.cost)}`, 'info');
      return;
    }
    pl.setTier(pl.tier + 1);
    audio.upgrade();
    this.fx.burst(pl.pos.clone().setY(1), [next.color, 0xffffff, 0xffe070], 40, { glow: true, speed: 4, up: 6 });
    this.fx.ring(pl.pos, 0xffe070, 3, 0.5);
    this.hud.banner(`⛏️ ${next.name}!`, pl.tier === 3 ? 'The strongest pickaxe on the island.' : 'Mines faster and hits harder.', 2500);
  }

  private interact(): void {
    const p = this.player.pos;
    if (this.merchant?.landed && dist2d(this.merchant.pos, p) < 2.6) {
      this.openTrade();
      return;
    }
    if (this.dog && dist2d(this.dog.pos, p) < 2) {
      this.dog.pet();
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 3);
    }
  }

  private openTrade(): void {
    this.input.actionHeld = false;
    this.modal = tradeScreen(this.overlay, this.inv, this.offers, () => this.closeModal());
  }

  private openHelp(): void {
    if (this.modal) return this.closeModal();
    this.input.actionHeld = false;
    this.modal = helpScreen(this.overlay, () => this.closeModal());
  }

  private closeModal(): void {
    this.modal?.remove();
    this.modal = null;
    this.lastT = performance.now();
  }

  private updateTorches(dt: number): void {
    this.torchT -= dt;
    if (this.torchT > 0) return;
    this.torchT = 0.5;
    for (const t of this.terrain.torches()) {
      const c = new THREE.Vector3(t.x + 0.5, 0, t.y + 0.5);
      for (const z of this.zombies) {
        if (z.dead || z.rising > 0 || dist2d(z.pos, c) > TORCH_BURN_RADIUS) continue;
        z.damage(TORCH_BURN_DPS * 0.5, null);
        this.fx.burst(z.pos.clone().setY(0.8), [0xffb13b, 0xff6010], 3, { glow: true, speed: 0.6, up: 2, size: 0.1, gravity: -1, life: 0.5 });
      }
    }
  }

  // ───────────────────────────── win / lose ─────────────────────────────

  private saveBest(): void {
    const best = loadBest();
    const nights = Math.max(best.nights, this.night);
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify({ nights, wins: best.wins }));
    } catch {
      /* ignore */
    }
  }

  private loseGame(): void {
    if (this.phase === 'over') return;
    const survived = Math.max(0, this.night - (this.phase === 'night' || this.phase === 'dusk' ? 1 : 0));
    this.phase = 'over';
    this.overT = 0;
    this.player.rig.root.rotation.z = Math.PI / 2;
    this.fx.burst(this.player.pos.clone().setY(0.6), [0x2f7fd8, 0xf2c08c, 0xff4040], 30, { speed: 3, up: 5 });
    audio.music('menu');
    const best = loadBest();
    const bestNow = { nights: Math.max(best.nights, survived), wins: best.wins };
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify(bestNow));
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      this.hud.show(false);
      endScreen(this.overlay, { nights: survived, victory: false, ...this.stats }, best, () => this.onExit(true), null);
    }, 1800);
  }

  private winGame(at: THREE.Vector3): void {
    this.victory = true;
    this.king = null;
    this.hitStop = 0.5;
    this.stage.shake(2);
    this.hud.banner('👑 THE KING IS DEFEATED! 👑', 'The island is saved!', 5000);
    audio.fanfare();
    audio.music('victory');
    this.giveLoot(at, { gold: 20, crystal: 5 });
    for (const z of this.zombies) z.dead = true;
    this.spawnQueue = [];
    const best = loadBest();
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify({ nights: Math.max(best.nights, this.night), wins: best.wins + 1 }));
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      if (this.phase === 'over') return;
      this.modal = endScreen(
        this.overlay,
        { nights: this.night, victory: true, ...this.stats },
        loadBest(),
        () => this.onExit(true),
        () => {
          this.closeModal();
          this.endless = true;
        },
      );
      this.lastT = performance.now();
    }, 6000);
  }

  private updateFireworks(dt: number): void {
    if (this.endless) return;
    this.fireworksT -= dt;
    if (this.fireworksT > 0) return;
    this.fireworksT = 0.35 + Math.random() * 0.4;
    const p = this.player.pos;
    const c = new THREE.Vector3(p.x + (Math.random() - 0.5) * 14, 5 + Math.random() * 4, p.z - 3 - Math.random() * 6);
    const col = [0xff4a6a, 0xffd23a, 0x6ad8ff, 0x9bff6a, 0xc07aff][Math.floor(Math.random() * 5)];
    this.fx.burst(c, [col, 0xffffff], 40, { glow: true, speed: 6, up: 2, size: 0.15, gravity: 3, life: 1.2 });
    this.tempLights.push({ x: c.x, y: c.y, z: c.z, color: col, intensity: 30, distance: 20, t: 0.5, dur: 0.5 });
    audio.coin();
  }

  // ───────────────────────────── camera, lights, HUD ─────────────────────────────

  private makeCursor(): void {
    this.ghost = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
      new THREE.MeshBasicMaterial({ color: 0x6bff8a, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.04, 1.04, 1.04).translate(0, 0.52, 0)),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }),
    );
    this.ghost.visible = this.outline.visible = false;
    this.stage.scene.add(this.ghost, this.outline);
  }

  /** Build preview (green = OK, red = can't) and a white outline on the block you'd mine. */
  private updateCursor(): void {
    this.ghost.visible = this.outline.visible = false;
    if (this.player.hp <= 0 || this.cinematic >= 0 || this.phase === 'over') return;
    const aim = this.aimPoint();
    const p = this.player.pos;
    if (this.selected > 0) {
      const t = aim ? { x: Math.floor(aim.x), y: Math.floor(aim.z) } : this.frontTile();
      const opt = buildOption(BUILD_IDS[this.selected - 1], this.inv);
      const d = Math.hypot(t.x + 0.5 - p.x, t.y + 0.5 - p.z);
      const ok = this.grid.isLand(t.x, t.y) && this.grid.blockAt(t.x, t.y) === B.None && d <= BUILD_REACH && canAfford(this.inv, opt.cost);
      const h = opt.block === B.Torch ? 0.8 : opt.block === B.TNT ? 0.7 : opt.block === B.WallStone ? 1.35 : 1.1;
      this.ghost.position.set(t.x + 0.5, 0, t.y + 0.5);
      this.ghost.scale.set(opt.block === B.Torch ? 0.3 : 1, h, opt.block === B.Torch ? 0.3 : 1);
      (this.ghost.material as THREE.MeshBasicMaterial).color.setHex(ok ? 0x6bff8a : 0xff5a5a);
      (this.ghost.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(performance.now() / 150) * 0.08;
      this.ghost.visible = true;
      return;
    }
    if (!aim) return;
    const t = { x: Math.floor(aim.x), y: Math.floor(aim.z) };
    const b = this.grid.blockAt(t.x, t.y);
    if (b === B.None || Math.hypot(t.x + 0.5 - p.x, t.y + 0.5 - p.z) > 2.3) return;
    const tall = b === B.Tree ? 2.4 : b === B.WallStone ? 1.35 : b === B.Torch ? 0.8 : 1.05;
    this.outline.position.set(t.x + 0.5, 0, t.y + 0.5);
    this.outline.scale.set(1, tall, 1);
    const tooHard = this.player.tier < BLOCKS[b].minTier;
    (this.outline.material as THREE.LineBasicMaterial).color.setHex(tooHard ? 0xff5a5a : 0xffffff);
    this.outline.visible = true;
  }

  private updateCamera(dt: number): void {
    const p = this.player.pos;
    this.stage.target.set(p.x, 0, p.z);
    const st = this.stage;
    const k = 1 - Math.pow(0.12, dt);
    st.yaw += (0 - st.yaw) * k;
    if (this.overT >= 0) st.dist = Math.max(8, st.dist - dt * 4);
    else if (this.cinematic < 0) {
      st.dist += (15 - st.dist) * k;
      st.pitch += (0.95 - st.pitch) * k;
      st.lookLift += (0 - st.lookLift) * k;
    }
    this.mouseAimT -= dt;
  }

  private updateLights(dt: number): void {
    const spots: LightSpot[] = [];
    const p = this.player.pos;
    for (const t of this.terrain.torches()) {
      if (Math.abs(t.x - p.x) > 16 || Math.abs(t.y - p.z) > 14) continue;
      const fl = 1 + Math.sin(performance.now() / 70 + t.x) * 0.12;
      spots.push({ x: t.x + 0.5, y: 1.2, z: t.y + 0.5, color: 0xff9a3a, intensity: 9 * fl * (0.08 + 0.92 * (1 - this.dayLevel)), distance: 9 });
    }
    for (let i = this.tempLights.length - 1; i >= 0; i--) {
      const l = this.tempLights[i];
      l.t -= dt;
      if (l.t <= 0) {
        this.tempLights.splice(i, 1);
        continue;
      }
      spots.push({ ...l, intensity: l.intensity * (l.t / l.dur) });
    }
    if (this.crater) spots.push({ x: this.crater.x, y: 1.2, z: this.crater.z, color: 0x5fe8ff, intensity: 1 + 5 * (1 - this.dayLevel), distance: 7 });
    // Temp lights first so explosions always get a light.
    const temp = spots.filter((s) => s.intensity > 10);
    const rest = spots.filter((s) => s.intensity <= 10);
    this.stage.setLights([...temp, ...rest], p);

    const t = this.phaseT;
    let day = 1, dusk = 0;
    if (this.phase === 'day') dusk = Math.max(0, (t - (DAY_LENGTH - 20)) / 20) * 0.5;
    else if (this.phase === 'dusk') {
      const k = Math.min(1, t / (DUSK_LENGTH + 1));
      day = 1 - k;
      dusk = Math.sin(k * Math.PI) * 0.9 + (1 - k) * 0.3;
    } else if (this.phase === 'night' || this.phase === 'over') day = this.phase === 'over' && this.night === 0 ? 1 : 0;
    else if (this.phase === 'dawn') {
      const k = Math.min(1, t / DAWN_LENGTH);
      day = k;
      dusk = Math.sin(k * Math.PI) * 0.7;
    }
    if (this.victory && !this.endless) day = Math.max(day, 0.35);
    this.dayLevel = day;
    this.skyFlash = Math.max(0, this.skyFlash - dt * 4);
    const nightish = this.phase === 'dusk' || this.phase === 'night';
    this.stage.setAtmosphere({
      day,
      dusk,
      blood: nightish && this.card === 'king',
      fog: nightish && this.card === 'fog',
      flash: this.skyFlash,
    });
  }

  private updateHud(dt: number): void {
    const h = this.hud;
    const pl = this.player;
    h.setHp(pl.hp, pl.maxHp);
    h.setRes(this.inv);
    this.hurtGlow = Math.max(pl.hp < pl.maxHp * 0.25 ? 0.35 : 0, this.hurtGlow - dt * 2.5);
    h.hurt(this.hurtGlow);

    const nightLbl = this.night <= TOTAL_NIGHTS ? `${this.night} / ${TOTAL_NIGHTS}` : `${this.night} ∞`;
    if (this.phase === 'day') {
      const left = Math.max(0, DAY_LENGTH - this.phaseT);
      h.setPhase(`☀️ Day ${this.night + 1}`, `Night falls in ${fmt(left)}`, left / DAY_LENGTH, false, false);
    } else if (this.phase === 'dusk') h.setPhase('🌆 Dusk', 'Get ready…', 1, true, this.card === 'king');
    else if (this.phase === 'night') {
      const left = this.spawnQueue.length + this.zombies.filter((z) => !z.dead).length;
      const sub = this.king ? 'Defeat the King!' : `🧟 ${left} left`;
      h.setPhase(`🌙 Night ${nightLbl}`, sub, this.nightTotal ? left / this.nightTotal : 0, true, this.card === 'king');
    } else if (this.phase === 'dawn') h.setPhase('🌅 Dawn', 'You made it!', 1, false, false);
    h.setNightButton(this.phase === 'day' && this.phaseT > 3);

    const slots = [
      { icon: '⛏️', cost: PICK_TIERS[pl.tier].name.split(' ')[0], title: PICK_TIERS[pl.tier].name, affordable: true },
      ...BUILD_IDS.map((id) => {
        const o = buildOption(id, this.inv);
        return { icon: o.icon, cost: costText(o.cost), title: o.label, affordable: canAfford(this.inv, o.cost) };
      }),
    ];
    const next = PICK_TIERS[pl.tier + 1];
    h.setToolbar(this.selected, slots, next ? { label: next.name.replace(' Pickaxe', ''), cost: costText(next.cost), ready: canAfford(this.inv, next.cost) } : null);

    const boss = this.king ?? this.giant;
    h.boss(boss && !boss.dead ? (boss === this.king ? `👑 Zombie King${this.king?.enraged ? ' — ENRAGED' : ''}` : '🗿 The Giant') : null, boss ? boss.hp / boss.maxHp : 0);

    // Context button
    let ctx: string | null = null;
    if (this.merchant?.landed && dist2d(this.merchant.pos, pl.pos) < 2.6) ctx = `🎈 Trade${isTouch ? '' : ' (E)'}`;
    else if (this.dog && dist2d(this.dog.pos, pl.pos) < 2) ctx = `🐶 Pet Rex${isTouch ? '' : ' (E)'}`;
    h.context(this.phase === 'over' ? null : ctx);

    if (ctx) h.hint(null);
    else this.updateTutorial();
    this.updatePointers();
  }

  private updateTutorial(): void {
    if (this.night > 0 || this.phase !== 'day') return;
    const key = (k: string, touch: string) => (isTouch ? touch : `<kbd>${k}</kbd>`);
    const steps: [() => boolean, string][] = [
      [() => this.inv.wood >= 7, `🌳 Walk up to a tree and hold ${key('Space', 'the ⛏️ button')} to chop it`],
      [() => this.inv.stone >= 3, `🪨 Now mine some rocks for stone`],
      [() => this.stats.built >= 3, `🧱 Pick a wall with ${key('2', 'the 🧱 slot')}, then ${isTouch ? 'tap' : 'click'} the ground to build`],
      [() => this.terrain.torches().length > 0, `🔥 Place a torch ${key('3', '(🔥 slot)')} — nights are dark and zombies hate fire`],
      [() => this.player.tier >= 1, `⬆ Get more stone and upgrade your pickaxe ${key('U', '(green button)')}`],
    ];
    while (this.tutorial < steps.length && steps[this.tutorial][0]()) this.tutorial++;
    if (this.tutorial < steps.length) this.hud.hint(steps[this.tutorial][1]);
    else this.hud.hint(this.phaseT < DAY_LENGTH - 5 ? `Ready? ${key('N', '🌙')} brings the night. Survive 7 nights to win!` : null);
  }

  private updatePointers(): void {
    const list: PointerView[] = [];
    const add = (pos: THREE.Vector3, icon: string, always = false) => {
      const s = this.stage.toScreen(pos);
      const W = window.innerWidth, H = window.innerHeight, m = 40;
      const onscreen = !s.behind && s.x > m && s.x < W - m && s.y > m + 60 && s.y < H - m - 70;
      if (onscreen && !always) return;
      if (onscreen) {
        list.push({ x: s.x, y: s.y - 50 + Math.sin(performance.now() / 200) * 5, icon });
        return;
      }
      let dx = s.x - W / 2, dy = s.y - H / 2;
      if (s.behind) {
        dx = -dx;
        dy = -dy;
      }
      const k = Math.min((W / 2 - m) / Math.abs(dx || 1), (H / 2 - m - 60) / Math.abs(dy || 1));
      list.push({ x: W / 2 + dx * k, y: H / 2 + dy * k, icon });
    };
    for (const c of this.chests) if (c.opened < 0) add(c.pos.clone().setY(1), '🧰');
    for (const m of this.meteors) if (m.big) add(m.target.clone().setY(0.5), '☄️', true);
    if (this.merchant && !this.merchant.leaving) add(this.merchant.pos.clone().setY(2), '🎈');
    if (this.crater) {
      const t = tileOf(new THREE.Vector3(this.crater.x, 0, this.crater.z));
      let left = false;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (this.grid.blockAt(t.x + dx, t.y + dy) === B.Crystal) left = true;
      if (left) add(new THREE.Vector3(this.crater.x, 1, this.crater.z), '💎');
      else this.crater = null;
    }
    if ((this.phase === 'dusk' || (this.phase === 'night' && this.phaseT < 12)) && this.cinematic < 0) {
      for (const s of this.landing) add(new THREE.Vector3(s.x + 0.5, 0.5, s.y + 0.5), '🧟', true);
    }
    if (this.king && !this.king.dead) add(this.king.pos.clone().setY(3), '👑');
    this.hud.pointers(list);
  }

  // ───────────────────────────── helpers ─────────────────────────────

  private freeTileNear(x: number, z: number, minR: number, maxR: number, ground?: Ground): { x: number; y: number } | null {
    for (let i = 0; i < 200; i++) {
      const a = this.rng.next() * Math.PI * 2;
      const r = minR + this.rng.next() * (maxR - minR);
      const tx = Math.floor(x + Math.cos(a) * r), ty = Math.floor(z + Math.sin(a) * r);
      if (!this.grid.walkable(tx, ty) || this.grid.blockAt(tx, ty) !== B.None) continue;
      if (ground !== undefined && this.grid.groundAt(tx, ty) !== ground) continue;
      return { x: tx, y: ty };
    }
    return null;
  }

  banner(title: string, sub: string): void {
    this.hud.banner(title, sub, 2500);
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function ease(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
}
