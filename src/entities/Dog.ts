import Phaser from 'phaser';
import { World } from '../world/World';
import { Player } from './Player';
import { Zombie } from './Zombie';
import { TEX } from '../gfx/textures';
import { TILE_SIZE } from '../config';

/**
 * Rex — the loyal companion dog. Trails the player, darts toward nearby zombies,
 * bites them, has his own HP so he won't die instantly in a swarm. Non-respawning.
 */
export class Dog {
  readonly sprite: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Ellipse;
  hp = 60;
  readonly maxHp = 60;
  alive = true;
  kills = 0;
  level = 1;
  private scene: Phaser.Scene;
  private world: World;
  private attackCooldownMs = 0;
  private walkPhase = 0;
  private hpBarBg?: Phaser.GameObjects.Rectangle;
  private hpBarFg?: Phaser.GameObjects.Rectangle;
  private nameLabel: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, world: World, x: number, y: number) {
    this.scene = scene;
    this.world = world;
    this.shadow = scene.add.ellipse(x, y + 8, 18, 5, 0x000000, 0.35).setDepth(8);
    this.sprite = scene.add.image(x, y, TEX.dog);
    this.sprite.setScale(1.1);
    this.sprite.setDepth(10);
    this.sprite.setInteractive({ useHandCursor: true });
    this.sprite.on('pointerdown', () => this.onPet());
    this.nameLabel = scene.add.text(x, y - 18, 'Rex', {
      fontFamily: 'system-ui', fontSize: '10px', color: '#ffd166', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(11);
  }

  get biteDamage(): number {
    return 12 + (this.level - 1) * 4;
  }

  /** Called when Rex lands a killing blow. Scales up his power. */
  recordKill(): void {
    this.kills += 1;
    const newLevel = 1 + Math.floor(this.kills / 4);
    if (newLevel > this.level) {
      this.level = newLevel;
      this.showLevelPopup();
    }
  }

  private showLevelPopup(): void {
    const t = this.scene.add.text(this.sprite.x, this.sprite.y - 24, `Rex Lv ${this.level}!`, {
      fontFamily: 'system-ui', fontSize: '12px', color: '#ffd166', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(30);
    this.scene.tweens.add({
      targets: t, y: t.y - 18, alpha: 0, duration: 900, onComplete: () => t.destroy(),
    });
    // Sparkle
    this.scene.tweens.add({
      targets: this.sprite, scaleX: this.sprite.scaleX * 1.3, duration: 160, yoyo: true,
    });
  }

  private onPet(): void {
    // Little heart burst + joyful yip
    const colors = [0xff69b4, 0xff4d88, 0xffc0cb];
    for (let i = 0; i < 6; i++) {
      const dx = (Math.random() - 0.5) * 20;
      const h = this.scene.add.text(this.sprite.x + dx, this.sprite.y - 8, '♥', {
        fontFamily: 'system-ui', fontSize: '14px', color: '#' + colors[i % colors.length].toString(16).padStart(6, '0'),
      }).setOrigin(0.5).setDepth(30);
      this.scene.tweens.add({
        targets: h,
        y: h.y - 28 - Math.random() * 10,
        alpha: 0,
        duration: 700 + Math.random() * 200,
        delay: i * 40,
        onComplete: () => h.destroy(),
      });
    }
    // Happy wiggle
    this.scene.tweens.add({
      targets: this.sprite, angle: 15, yoyo: true, repeat: 2, duration: 80,
      onComplete: () => this.sprite.setAngle(0),
    });
    this.scene.events.emit('dog_pet', this.sprite.x, this.sprite.y);
  }

  update(deltaMs: number, player: Player, zombies: Zombie[]): void {
    if (!this.alive) return;
    if (this.attackCooldownMs > 0) this.attackCooldownMs -= deltaMs;

    // Find nearest zombie within aggro range
    let target: Zombie | null = null;
    let tdist = 180; // aggro radius in px
    for (const z of zombies) {
      if (!z.alive) continue;
      const d = Math.hypot(z.sprite.x - this.sprite.x, z.sprite.y - this.sprite.y);
      if (d < tdist) { target = z; tdist = d; }
    }

    let tx: number;
    let ty: number;
    if (target) {
      tx = target.sprite.x;
      ty = target.sprite.y;
      // Bite if close
      if (tdist < 24 && this.attackCooldownMs <= 0) {
        const dmg = this.biteDamage;
        const killed = target.takeDamage(dmg);
        this.attackCooldownMs = 650;
        this.scene.events.emit('dog_bite', target.sprite.x, target.sprite.y, dmg);
        this.scene.tweens.add({ targets: this.sprite, scaleX: this.sprite.scaleX * 1.2, duration: 70, yoyo: true });
        if (killed) {
          this.recordKill();
          this.scene.events.emit('dog_killed_zombie', target.sprite.x, target.sprite.y, target.variant);
        }
      }
    } else {
      // Stay near player if no target
      const fromPlayer = Math.hypot(player.x - this.sprite.x, player.y - this.sprite.y);
      if (fromPlayer > 48) {
        tx = player.x;
        ty = player.y + 4;
      } else {
        tx = this.sprite.x;
        ty = this.sprite.y;
      }
    }

    const dx = tx - this.sprite.x;
    const dy = ty - this.sprite.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 2) {
      const speed = target ? 130 : 110;
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
    this.nameLabel.setText(this.level > 1 ? `Rex Lv${this.level}` : 'Rex');
    this.updateHpBar();
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
    if (pct >= 0.99) { this.hpBarBg.destroy(); this.hpBarFg.destroy(); this.hpBarBg = undefined; this.hpBarFg = undefined; }
  }

  die(): void {
    if (!this.alive) return;
    this.alive = false;
    if (this.hpBarBg) this.hpBarBg.destroy();
    if (this.hpBarFg) this.hpBarFg.destroy();
    this.shadow.destroy();
    this.nameLabel.destroy();
    this.scene.tweens.add({
      targets: this.sprite, alpha: 0, angle: 180, scale: 0.5, duration: 300,
      onComplete: () => this.sprite.destroy(),
    });
  }

  /** Called when player is hit and dog is nearby — dog growls (small screen shake). */
  reactToPlayerHit(): void {
    if (!this.alive) return;
    this.scene.tweens.add({ targets: this.sprite, scaleX: this.sprite.scaleX * 1.1, duration: 80, yoyo: true });
  }

  /** Heal dog a bit. */
  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.showHpBarIfNeeded();
  }

  // Kept to reassure TS we use world
  get worldRef(): World { return this.world; }
  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }
}

// Keep unused import warning at bay
void TILE_SIZE;
