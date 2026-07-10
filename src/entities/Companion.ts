import Phaser from 'phaser';
import { World } from '../world/World';
import { Player } from './Player';
import { Zombie } from './Zombie';
import { TileType, TILE_SPECS } from '../world/tileTypes';

/**
 * Companions — Rex and friends. One chassis (follow, HP, petting, levels,
 * dawn revive) with a pluggable ability:
 *  - bite     (Rex):      darts at nearby enemies and chomps them
 *  - firespit (Ember):    hovers near you and spits fireballs
 *  - treasure (Whiskers): periodically sniffs out and digs up buried loot
 *  - repair   (Bolt):     patches up your damaged structures for free
 */

import { CompanionId } from '../systems/MetaStore';

export type { CompanionId };
export type CompanionAbility = 'bite' | 'firespit' | 'treasure' | 'repair';

export interface CompanionSpec {
  id: CompanionId;
  name: string;
  maxHp: number;
  speed: number;
  ability: CompanionAbility;
  abilityCooldownMs: number;
  texKey: string;
  scale: number;
  labelColor: string;
  blurb: string;
}

export const COMPANION_SPECS: Record<CompanionId, CompanionSpec> = {
  rex: {
    id: 'rex', name: 'Rex', maxHp: 60, speed: 130,
    ability: 'bite', abilityCooldownMs: 650,
    texKey: 'dog', scale: 1.1, labelColor: '#ffd166',
    blurb: 'The very best boy. Bites zombies, levels up, loves pets.',
  },
  whiskers: {
    id: 'whiskers', name: 'Whiskers', maxHp: 45, speed: 145,
    ability: 'treasure', abilityCooldownMs: 75000,
    texKey: 'companion_cat', scale: 1.15, labelColor: '#c8a2ff',
    blurb: 'Sniffs out buried treasure and digs it up for you.',
  },
  ember: {
    id: 'ember', name: 'Ember', maxHp: 50, speed: 135,
    ability: 'firespit', abilityCooldownMs: 2400,
    texKey: 'companion_dragon', scale: 1.2, labelColor: '#ff8a5a',
    blurb: 'A baby dragon. Spits fireballs at anything spooky.',
  },
  bolt: {
    id: 'bolt', name: 'Bolt', maxHp: 70, speed: 125,
    ability: 'repair', abilityCooldownMs: 3800,
    texKey: 'companion_robot', scale: 1.1, labelColor: '#7fe7ff',
    blurb: 'A robo-pup that auto-repairs your walls. Beep beep.',
  },
};

const KILLS_PER_LEVEL = 6;
const BITE_BASE_DAMAGE = 8;
const BITE_DAMAGE_PER_LEVEL = 3;
const FIRE_BASE_DAMAGE = 6;
const FIRE_DAMAGE_PER_LEVEL = 2;
const REPAIR_BASE = 10;
const REPAIR_PER_LEVEL = 4;

/** Tile types Bolt is willing to repair (player-built structures). */
const REPAIRABLE = new Set<TileType>([
  TileType.WallWood, TileType.WallStone, TileType.WallIron, TileType.WallReinforced,
  TileType.WallObsidian, TileType.DoorWood, TileType.TurretBasic, TileType.TurretFlame,
  TileType.SpikeTrap, TileType.Bridge,
]);

export class Companion {
  readonly spec: CompanionSpec;
  readonly sprite: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Ellipse;
  hp: number;
  maxHp: number;
  alive = true;
  kills = 0;
  level = 1;
  private scene: Phaser.Scene;
  private world: World;
  private cooldownMs = 0;
  private walkPhase = 0;
  private hpBarBg?: Phaser.GameObjects.Rectangle;
  private hpBarFg?: Phaser.GameObjects.Rectangle;
  private nameLabel: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, world: World, id: CompanionId, x: number, y: number) {
    this.scene = scene;
    this.world = world;
    this.spec = COMPANION_SPECS[id];
    this.hp = this.spec.maxHp;
    this.maxHp = this.spec.maxHp;
    this.shadow = scene.add.ellipse(x, y + 8, 18, 5, 0x000000, 0.35).setDepth(8);
    this.sprite = scene.add.image(x, y, this.spec.texKey);
    this.sprite.setScale(this.spec.scale);
    this.sprite.setDepth(10);
    this.sprite.setInteractive({ useHandCursor: true });
    this.sprite.on('pointerdown', () => this.onPet());
    this.nameLabel = scene.add.text(x, y - 18, this.spec.name, {
      fontFamily: 'system-ui', fontSize: '10px', color: this.spec.labelColor, fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(11);
    if (id === 'ember') {
      // Baby dragons hover
      scene.tweens.add({ targets: this.sprite, y: y - 3, yoyo: true, repeat: -1, duration: 700 });
    }
  }

  get id(): CompanionId { return this.spec.id; }
  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }

  get biteDamage(): number {
    return BITE_BASE_DAMAGE + (this.level - 1) * BITE_DAMAGE_PER_LEVEL;
  }

  get fireDamage(): number {
    return FIRE_BASE_DAMAGE + (this.level - 1) * FIRE_DAMAGE_PER_LEVEL;
  }

  get repairAmount(): number {
    return REPAIR_BASE + (this.level - 1) * REPAIR_PER_LEVEL;
  }

  recordKill(): void {
    this.kills += 1;
    const newLevel = 1 + Math.floor(this.kills / KILLS_PER_LEVEL);
    if (newLevel > this.level) {
      this.level = newLevel;
      this.showLevelPopup();
    }
  }

  private showLevelPopup(): void {
    const t = this.scene.add.text(this.sprite.x, this.sprite.y - 24, `${this.spec.name} Lv ${this.level}!`, {
      fontFamily: 'system-ui', fontSize: '12px', color: this.spec.labelColor, fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(30);
    this.scene.tweens.add({ targets: t, y: t.y - 18, alpha: 0, duration: 900, onComplete: () => t.destroy() });
    this.scene.tweens.add({ targets: this.sprite, scaleX: this.sprite.scaleX * 1.3, duration: 160, yoyo: true });
  }

  private onPet(): void {
    const colors = [0xff69b4, 0xff4d88, 0xffc0cb];
    for (let i = 0; i < 6; i++) {
      const dx = (Math.random() - 0.5) * 20;
      const h = this.scene.add.text(this.sprite.x + dx, this.sprite.y - 8, '♥', {
        fontFamily: 'system-ui', fontSize: '14px', color: '#' + colors[i % colors.length].toString(16).padStart(6, '0'),
      }).setOrigin(0.5).setDepth(30);
      this.scene.tweens.add({
        targets: h, y: h.y - 28 - Math.random() * 10, alpha: 0,
        duration: 700 + Math.random() * 200, delay: i * 40,
        onComplete: () => h.destroy(),
      });
    }
    this.scene.tweens.add({
      targets: this.sprite, angle: 15, yoyo: true, repeat: 2, duration: 80,
      onComplete: () => this.sprite.setAngle(0),
    });
    this.scene.events.emit('dog_pet', this.sprite.x, this.sprite.y);
  }

  update(deltaMs: number, player: Player, zombies: Zombie[]): void {
    if (!this.alive) return;
    if (this.cooldownMs > 0) this.cooldownMs -= deltaMs;

    let tx = this.sprite.x;
    let ty = this.sprite.y;
    let chasing = false;

    if (this.spec.ability === 'bite') {
      // Find nearest zombie within aggro range and go chomp it
      let target: Zombie | null = null;
      let tdist = 180;
      for (const z of zombies) {
        if (!z.alive) continue;
        const d = Math.hypot(z.sprite.x - this.sprite.x, z.sprite.y - this.sprite.y);
        if (d < tdist) { target = z; tdist = d; }
      }
      if (target) {
        tx = target.sprite.x;
        ty = target.sprite.y;
        chasing = true;
        if (tdist < 24 && this.cooldownMs <= 0) {
          this.cooldownMs = this.spec.abilityCooldownMs;
          const dmg = this.biteDamage;
          const killed = target.takeDamage(dmg);
          this.scene.events.emit('dog_bite', target.sprite.x, target.sprite.y, dmg);
          this.scene.tweens.add({ targets: this.sprite, scaleX: this.sprite.scaleX * 1.2, duration: 70, yoyo: true });
          if (killed) {
            this.recordKill();
            this.scene.events.emit('dog_killed_zombie', target.sprite.x, target.sprite.y, target.variant);
          }
        }
      }
    } else if (this.spec.ability === 'firespit') {
      // Stay near the player; spit at the nearest enemy in range
      if (this.cooldownMs <= 0) {
        let target: Zombie | null = null;
        let tdist = 5 * 32;
        for (const z of zombies) {
          if (!z.alive) continue;
          const d = Math.hypot(z.sprite.x - this.sprite.x, z.sprite.y - this.sprite.y);
          if (d < tdist) { target = z; tdist = d; }
        }
        if (target) {
          this.cooldownMs = this.spec.abilityCooldownMs;
          const mag = tdist || 1;
          this.scene.events.emit(
            'companion_firespit',
            this.sprite.x, this.sprite.y,
            (target.sprite.x - this.sprite.x) / mag,
            (target.sprite.y - this.sprite.y) / mag,
            this.fireDamage,
          );
          this.scene.tweens.add({ targets: this.sprite, scaleX: this.sprite.scaleX * 1.25, duration: 90, yoyo: true });
        }
      }
    } else if (this.spec.ability === 'treasure') {
      if (this.cooldownMs <= 0) {
        this.cooldownMs = this.spec.abilityCooldownMs;
        this.scene.events.emit('companion_sniff', this.sprite.x, this.sprite.y);
        this.recordKill(); // treasure finds level Whiskers up too
        this.scene.tweens.add({ targets: this.sprite, angle: 20, yoyo: true, repeat: 3, duration: 90 });
      }
    } else if (this.spec.ability === 'repair') {
      if (this.cooldownMs <= 0) {
        const fixed = this.repairNearby();
        if (fixed) {
          this.cooldownMs = this.spec.abilityCooldownMs;
          this.scene.tweens.add({ targets: this.sprite, scaleY: this.sprite.scaleY * 1.2, duration: 90, yoyo: true });
        } else {
          this.cooldownMs = 800; // check again soon
        }
      }
    }

    // Follow the player when not chasing something
    if (!chasing) {
      const fromPlayer = Math.hypot(player.x - this.sprite.x, player.y - this.sprite.y);
      if (fromPlayer > 48) {
        tx = player.x;
        ty = player.y + 4;
      }
    }

    const dx = tx - this.sprite.x;
    const dy = ty - this.sprite.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 2) {
      const speed = chasing ? this.spec.speed : this.spec.speed * 0.85;
      const step = (speed * deltaMs) / 1000;
      const vx = (dx / dist) * step;
      const vy = (dy / dist) * step;
      let nx = this.sprite.x + vx;
      let ny = this.sprite.y + vy;
      if (!this.canStand(nx, ny)) {
        if (this.canStand(nx, this.sprite.y)) ny = this.sprite.y;
        else if (this.canStand(this.sprite.x, ny)) nx = this.sprite.x;
        else { nx = this.sprite.x; ny = this.sprite.y; }
      }
      this.sprite.x = nx;
      this.sprite.y = ny;
      this.sprite.setFlipX(vx < 0);
      this.walkPhase += deltaMs / 80;
      this.sprite.setRotation(Math.sin(this.walkPhase) * 0.08);
    } else {
      this.sprite.setRotation(0);
    }
    this.shadow.setPosition(this.sprite.x, this.sprite.y + 9);
    this.nameLabel.setPosition(this.sprite.x, this.sprite.y - 16);
    this.nameLabel.setText(this.level > 1 ? `${this.spec.name} Lv${this.level}` : this.spec.name);
    this.updateHpBar();
  }

  /** Bolt: restore the most damaged repairable structure within 4 tiles. Returns true if repaired. */
  private repairNearby(): boolean {
    const center = this.world.worldToTile(this.sprite.x, this.sprite.y);
    let best: { x: number; y: number; missing: number } | null = null;
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const t = this.world.getTileAt(center.x + dx, center.y + dy);
        if (!t || !REPAIRABLE.has(t.type)) continue;
        const missing = TILE_SPECS[t.type].baseHp - t.hp;
        if (missing <= 0) continue;
        if (!best || missing > best.missing) best = { x: center.x + dx, y: center.y + dy, missing };
      }
    }
    if (!best) return false;
    const t = this.world.getTileAt(best.x, best.y)!;
    t.hp = Math.min(TILE_SPECS[t.type].baseHp, t.hp + this.repairAmount);
    this.world.refreshHpBar(best.x, best.y);
    this.scene.events.emit('companion_repair', best.x, best.y);
    return true;
  }

  private canStand(wx: number, wy: number): boolean {
    const tp = this.world.worldToTile(wx, wy);
    return this.world.isWalkable(tp.x, tp.y);
  }

  hurt(amount: number): void {
    if (!this.alive) return;
    this.hp -= amount;
    this.sprite.setTint(0xff6060);
    this.scene.time.delayedCall(100, () => this.alive && this.sprite.clearTint());
    this.showHpBarIfNeeded();
    if (this.hp <= 0) this.die();
  }

  private showHpBarIfNeeded(): void {
    if (!this.hpBarBg) {
      this.hpBarBg = this.scene.add.rectangle(this.sprite.x, this.sprite.y - 16, 24, 4, 0x000000, 0.7).setDepth(20);
      this.hpBarFg = this.scene.add.rectangle(this.sprite.x, this.sprite.y - 16, 22, 2, 0x66ff66, 1).setDepth(21);
    }
  }

  private updateHpBar(): void {
    if (!this.hpBarBg || !this.hpBarFg) return;
    const pct = Math.max(0, this.hp) / this.maxHp;
    this.hpBarBg.setPosition(this.sprite.x, this.sprite.y - 16);
    this.hpBarFg.setPosition(this.sprite.x - 11 + (22 * pct) / 2, this.sprite.y - 16);
    this.hpBarFg.width = 22 * pct;
    this.hpBarFg.fillColor = pct > 0.5 ? 0x66ff66 : pct > 0.2 ? 0xffcc33 : 0xff4444;
    if (pct >= 0.99) {
      this.hpBarBg.destroy();
      this.hpBarFg.destroy();
      this.hpBarBg = undefined;
      this.hpBarFg = undefined;
    }
  }

  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.showHpBarIfNeeded();
  }

  setPosition(x: number, y: number): void {
    this.sprite.setPosition(x, y);
  }

  reactToPlayerHit(): void {
    if (!this.alive) return;
    this.scene.tweens.add({ targets: this.sprite, scaleX: this.sprite.scaleX * 1.1, duration: 80, yoyo: true });
  }

  die(): void {
    if (!this.alive) return;
    this.alive = false;
    if (this.hpBarBg) this.hpBarBg.destroy();
    if (this.hpBarFg) this.hpBarFg.destroy();
    this.shadow.destroy();
    this.nameLabel.destroy();
    this.scene.tweens.killTweensOf(this.sprite);
    this.scene.tweens.add({
      targets: this.sprite, alpha: 0, angle: 180, scale: 0.5, duration: 300,
      onComplete: () => this.sprite.destroy(),
    });
  }
}
