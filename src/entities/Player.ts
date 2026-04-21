import Phaser from 'phaser';
import { TILE_SIZE, PLAYER_SPEED } from '../config';
import { GameState } from '../state/GameState';
import { World } from '../world/World';
import { TileType, TILE_SPECS } from '../world/tileTypes';
import { TEX } from '../gfx/textures';
import { sounds } from '../systems/Sound';

export class Player {
  readonly sprite: Phaser.GameObjects.Image;
  readonly scene: Phaser.Scene;
  readonly state: GameState;
  readonly world: World;
  facing: { x: number; y: number } = { x: 0, y: 1 };
  private attackCooldownMs = 0;
  private walkPhase = 0;
  private dashMs = 0;
  private dashCooldownMs = 0;

  private shadow!: Phaser.GameObjects.Ellipse;
  private weaponSprite!: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, state: GameState, world: World) {
    this.scene = scene;
    this.state = state;
    this.world = world;
    const spawn = world.playerSpawn;
    const spawnWorld = world.tileToWorldCenter(spawn.x, spawn.y);
    this.shadow = scene.add.ellipse(spawnWorld.x, spawnWorld.y + 12, 20, 7, 0x000000, 0.35);
    this.shadow.setDepth(9);
    this.sprite = scene.add.image(spawnWorld.x, spawnWorld.y, TEX.player);
    this.sprite.setDepth(10);
    this.sprite.setScale(1.25);
    scene.physics.add.existing(this.sprite);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setSize(18, 18);
    this.weaponSprite = scene.add.image(spawnWorld.x, spawnWorld.y, TEX.weapon_pickaxe);
    this.weaponSprite.setDepth(10.5);
    this.weaponSprite.setScale(1.0);
  }

  setEquippedWeaponTexture(key: string | null): void {
    if (!key) { this.weaponSprite.setVisible(false); return; }
    this.weaponSprite.setVisible(true);
    this.weaponSprite.setTexture(key);
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }

  tryDash(): boolean {
    if (this.dashCooldownMs > 0 || this.dashMs > 0) return false;
    this.dashMs = 400;
    this.dashCooldownMs = 3000;
    this.scene.tweens.add({ targets: this.sprite, scaleX: this.sprite.scaleX * 1.1, duration: 100, yoyo: true });
    return true;
  }

  dashRemaining(): number { return this.dashMs; }
  dashCooldownRemaining(): number { return this.dashCooldownMs; }

  update(deltaMs: number, moveX: number, moveY: number): void {
    if (!this.state.running) return;
    if (this.dashMs > 0) this.dashMs -= deltaMs;
    if (this.dashCooldownMs > 0) this.dashCooldownMs -= deltaMs;
    const speedMult = this.dashMs > 0 ? 2.2 : 1;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(moveX * PLAYER_SPEED * speedMult, moveY * PLAYER_SPEED * speedMult);

    // Track facing from movement intent
    const isMoving = Math.abs(moveX) > 0.1 || Math.abs(moveY) > 0.1;
    if (isMoving) {
      const mag = Math.hypot(moveX, moveY);
      this.facing = { x: moveX / mag, y: moveY / mag };
      if (Math.abs(moveX) > 0.1) this.sprite.setFlipX(moveX < 0);
      const prevPhase = this.walkPhase;
      this.walkPhase += deltaMs / 80;
      this.sprite.setRotation(Math.sin(this.walkPhase) * 0.06);
      // Footstep on each stride peak
      if (Math.floor(prevPhase / Math.PI) !== Math.floor(this.walkPhase / Math.PI)) {
        sounds.footstep();
      }
    } else {
      this.sprite.setRotation(0);
    }

    // Tile-level collision (walls/trees) — push player out of non-walkable tiles
    this.resolveTileCollision();

    // Shadow follows
    this.shadow.setPosition(this.sprite.x, this.sprite.y + 12);
    // Weapon follows — offset based on facing
    const wx = this.sprite.x + (this.sprite.flipX ? -9 : 9);
    const wy = this.sprite.y + 4;
    this.weaponSprite.setPosition(wx, wy);
    this.weaponSprite.setFlipX(this.sprite.flipX);

    // Damage from lava
    const tilePos = this.world.worldToTile(this.sprite.x, this.sprite.y);
    const tile = this.world.getTileAt(tilePos.x, tilePos.y);
    if (tile) {
      const spec = TILE_SPECS[tile.type];
      if (spec.damageOnEnterDps && spec.damageOnEnterDps > 0) {
        this.state.playerHp -= (spec.damageOnEnterDps * deltaMs) / 1000;
        if (this.state.playerHp < 0) this.state.playerHp = 0;
      }
    }

    if (this.attackCooldownMs > 0) this.attackCooldownMs -= deltaMs;
  }

  private resolveTileCollision(): void {
    // Sample 4 corners of a slightly-shrunk hitbox and push out
    const halfW = (this.sprite.width - 4) / 2;
    const halfH = (this.sprite.height - 4) / 2;
    const corners: [number, number][] = [
      [this.sprite.x - halfW, this.sprite.y - halfH],
      [this.sprite.x + halfW, this.sprite.y - halfH],
      [this.sprite.x - halfW, this.sprite.y + halfH],
      [this.sprite.x + halfW, this.sprite.y + halfH],
    ];
    for (const [wx, wy] of corners) {
      const tp = this.world.worldToTile(wx, wy);
      if (!this.world.isWalkable(tp.x, tp.y)) {
        const center = this.world.tileToWorldCenter(tp.x, tp.y);
        const dx = this.sprite.x - center.x;
        const dy = this.sprite.y - center.y;
        const overlapX = TILE_SIZE / 2 + halfW - Math.abs(dx);
        const overlapY = TILE_SIZE / 2 + halfH - Math.abs(dy);
        if (overlapX > 0 && overlapY > 0) {
          if (overlapX < overlapY) {
            this.sprite.x += dx > 0 ? overlapX : -overlapX;
          } else {
            this.sprite.y += dy > 0 ? overlapY : -overlapY;
          }
        }
      }
    }
  }

  getReachTile(worldTargetX: number, worldTargetY: number): { x: number; y: number } {
    return this.world.worldToTile(worldTargetX, worldTargetY);
  }

  tileDistance(x: number, y: number): number {
    const p = this.world.worldToTile(this.sprite.x, this.sprite.y);
    return Math.max(Math.abs(p.x - x), Math.abs(p.y - y));
  }

  meleeAttackDamage(): number {
    return this.state.swordTier === 0 ? 6 : 14;
  }

  attackCooldown(): number { return this.attackCooldownMs; }

  triggerAttackCooldown(ms: number): void { this.attackCooldownMs = ms; }

  hurt(amount: number): void {
    this.state.playerHp -= amount;
    if (this.state.playerHp < 0) this.state.playerHp = 0;
    this.scene.cameras.main.shake(80, 0.004);
    this.sprite.setTint(0xff6a6a);
    this.scene.time.delayedCall(100, () => this.sprite.clearTint());
  }

  isAdjacentTo(tileX: number, tileY: number): boolean {
    const p = this.world.worldToTile(this.sprite.x, this.sprite.y);
    const dx = Math.abs(p.x - tileX);
    const dy = Math.abs(p.y - tileY);
    return Math.max(dx, dy) <= 1;
  }

  /** Returns the tile in front of the player (the tile the player's facing vector points to). */
  facingTile(): { x: number; y: number } {
    const p = this.world.worldToTile(this.sprite.x, this.sprite.y);
    const fx = Math.round(this.facing.x);
    const fy = Math.round(this.facing.y);
    return { x: p.x + fx, y: p.y + fy };
  }

  adjacentToTileType(type: TileType): boolean {
    const p = this.world.worldToTile(this.sprite.x, this.sprite.y);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const t = this.world.getTileAt(p.x + dx, p.y + dy);
        if (t && t.type === type) return true;
      }
    }
    return false;
  }
}
