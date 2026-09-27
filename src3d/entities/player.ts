import * as THREE from 'three';
import { PLAYER_MAX_HP, PLAYER_SPEED } from '../config';
import { Grid } from '../grid';
import { PICK_TIERS } from '../rules';
import { addXray, animateWalk, flash, humanoid, pickaxe, Rig } from '../render/models';
import { lerpAngle, moveWithCollision } from './body';

export class Player {
  readonly pos = new THREE.Vector3();
  readonly rig: Rig;
  facing = 0;
  hp = PLAYER_MAX_HP;
  maxHp = PLAYER_MAX_HP;
  tier = 0;
  swingCd = 0;
  private swingAnim = 0;
  private walkPhase = 0;
  private hurtFlash = 0;
  invuln = 0;
  private pick: ReturnType<typeof pickaxe>;
  private tierGlow = 0;

  constructor(scene: THREE.Scene, x: number, z: number) {
    this.rig = humanoid({ skin: 0xf2c08c, shirt: 0x2f7fd8, pants: 0x3b3b6d, hair: 0x5a3a1c });
    this.pick = pickaxe(PICK_TIERS[0].color);
    this.pick.group.position.set(0, -0.38, 0.05);
    this.pick.group.rotation.x = Math.PI / 2;
    this.rig.armR.add(this.pick.group);
    addXray(this.rig.root, 0x7fc4ff);
    this.pos.set(x, 0, z);
    scene.add(this.rig.root);
  }

  setTier(t: number): void {
    this.tier = t;
    this.pick.head.color.setHex(PICK_TIERS[t].color);
    this.pick.head.emissive.setHex(t === 3 ? 0x1a8fa8 : 0x000000);
    this.tierGlow = 1;
  }

  swing(): void {
    this.swingAnim = 1;
  }

  hurt(): void {
    this.hurtFlash = 0.15;
  }

  update(dt: number, grid: Grid, move: THREE.Vector2, faceOverride: number | null): void {
    this.swingCd = Math.max(0, this.swingCd - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    const len = move.length();
    if (len > 0.05) {
      const m = Math.min(1, len);
      const dx = (move.x / len) * m * PLAYER_SPEED * dt;
      const dz = (move.y / len) * m * PLAYER_SPEED * dt;
      moveWithCollision(grid, this.pos, dx, dz, 0.28);
      if (faceOverride === null) this.facing = lerpAngle(this.facing, Math.atan2(move.x, move.y), Math.min(1, dt * 14));
      this.walkPhase += dt * 11 * m;
    } else {
      this.walkPhase *= 0.8;
    }
    if (faceOverride !== null) this.facing = lerpAngle(this.facing, faceOverride, Math.min(1, dt * 22));

    const r = this.rig;
    r.root.position.copy(this.pos);
    r.root.rotation.y = this.facing;
    animateWalk(r, this.walkPhase, len > 0.05 ? 1 : 0);
    r.armL.rotation.x = -Math.sin(this.walkPhase) * 0.6 * Math.min(1, len);

    // Swing: raise then chop down.
    this.swingAnim = Math.max(0, this.swingAnim - dt * 4.5);
    const s = this.swingAnim;
    r.armR.rotation.x = s > 0 ? -(s > 0.6 ? (1 - s) / 0.4 * 2.6 : s / 0.6 * 2.6) + 0.3 : Math.sin(this.walkPhase) * 0.6 * Math.min(1, len) - 0.2;

    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.tierGlow = Math.max(0, this.tierGlow - dt);
    if (this.hurtFlash > 0) flash(r.mats, 0.9, 1, 0.1, 0.05);
    else flash(r.mats, this.tierGlow * 0.6, 0.6, 1, 1);
    r.root.visible = this.invuln <= 0 || Math.sin(this.invuln * 40) > -0.5;
  }
}
