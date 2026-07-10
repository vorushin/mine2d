import Phaser from 'phaser';
import { TileType } from '../world/tileTypes';
import { World } from '../world/World';
import { TEX } from '../gfx/textures';

/**
 * Dynamic darkness with light pools. A camera-view-sized RenderTexture is
 * filled with darkness each frame, then radial glow stamps are ERASE-drawn at
 * every light source in view, punching warm holes into the night. Replaces
 * the old flat night overlay.
 */

export interface LightSource {
  x: number;
  y: number;
  radius: number;
  /** 0..1 — how completely the light clears the darkness at its center. */
  intensity?: number;
}

/** Static (tile-based) light sources are rescanned on this cadence. */
const RESCAN_MS = 400;

const TILE_LIGHTS: [TileType, number, number][] = [
  // [type, radius px, intensity]
  [TileType.Torch, 120, 1],
  [TileType.Campfire, 155, 1],
  [TileType.Lava, 58, 0.55],
  [TileType.Volcano, 175, 0.8],
  [TileType.Cake, 70, 0.6],
];

export class LightingSystem {
  private scene: Phaser.Scene;
  private world: World;
  private rt!: Phaser.GameObjects.RenderTexture;
  private stamp: Phaser.GameObjects.Image;
  private darkness = 0;
  private radiusMult = 1;
  private cached: LightSource[] = [];
  private rescanMs = 0;

  constructor(scene: Phaser.Scene, world: World) {
    this.scene = scene;
    this.world = world;
    this.stamp = scene.make.image({ key: TEX.light_glow, add: false });
    this.createRT();
    scene.scale.on('resize', this.onResize, this);
  }

  private onResize = (): void => {
    this.rt.destroy();
    this.createRT();
  };

  private createRT(): void {
    this.rt = this.scene.add.renderTexture(
      0, 0,
      Math.ceil(this.scene.scale.width) + 64,
      Math.ceil(this.scene.scale.height) + 64,
    );
    this.rt.setOrigin(0, 0);
    this.rt.setDepth(100);
    this.rt.setVisible(false);
  }

  /** Swap the world the static-scan reads from (used on cave layer changes). */
  setWorld(world: World): void {
    this.world = world;
    this.rescanMs = 0;
  }

  /** 0 = full daylight … ~0.95 = cave-black. */
  setDarkness(a: number): void {
    this.darkness = Phaser.Math.Clamp(a, 0, 0.97);
  }

  get currentDarkness(): number {
    return this.darkness;
  }

  /** Fog nights shrink all light pools. */
  setRadiusMult(m: number): void {
    this.radiusMult = m;
  }

  /** Force the static tile-light cache to refresh next frame. */
  invalidate(): void {
    this.rescanMs = 0;
  }

  update(deltaMs: number, dynamicLights: LightSource[]): void {
    const cam = this.scene.cameras.main;
    const view = cam.worldView;
    if (this.darkness <= 0.01) {
      this.rt.setVisible(false);
      return;
    }
    this.rt.setVisible(true);
    this.rt.setPosition(view.x, view.y);

    this.rescanMs -= deltaMs;
    if (this.rescanMs <= 0) {
      this.rescanMs = RESCAN_MS;
      this.rescanStatic();
    }

    this.rt.clear();
    this.rt.fill(0x05050e, this.darkness);
    this.drawLights(this.cached, view);
    this.drawLights(dynamicLights, view);
  }

  private drawLights(lights: LightSource[], view: Phaser.Geom.Rectangle): void {
    for (const l of lights) {
      const r = l.radius * this.radiusMult;
      const lx = l.x - view.x;
      const ly = l.y - view.y;
      if (lx < -r || ly < -r || lx > view.width + r || ly > view.height + r) continue;
      this.stamp.setDisplaySize(r * 2, r * 2);
      this.stamp.setAlpha(l.intensity ?? 1);
      this.rt.erase(this.stamp, lx, ly);
    }
  }

  private rescanStatic(): void {
    this.cached.length = 0;
    for (const [type, radius, intensity] of TILE_LIGHTS) {
      this.world.forEachTileOfType(type, (tx, ty) => {
        const wc = this.world.tileToWorldCenter(tx, ty);
        this.cached.push({ x: wc.x, y: wc.y, radius, intensity });
      });
    }
  }

  destroy(): void {
    this.scene.scale.off('resize', this.onResize, this);
    this.rt.destroy();
    this.stamp.destroy();
  }
}
