import * as THREE from 'three';
import { DOG_DAMAGE, DOG_SPEED, TNT_FUSE, TURRET_COOLDOWN, TURRET_DAMAGE, TURRET_RANGE } from '../config';
import { audio } from '../audio';
import { B } from '../rules';
import { balloon, box, chestModel, chicken, dog, lambert, turretModel } from '../render/models';
import { tex } from '../render/textures';
import { angleTo, dist2d, lerpAngle, moveWithCollision } from './body';
import type { Zombie } from './zombie';
import type { Game } from '../game';

// ─────────────────────────── Rex the dog ───────────────────────────
export class Dog {
  readonly pos = new THREE.Vector3();
  private m = dog();
  private facing = 0;
  private walk = 0;
  private biteCd = 0;
  private happy = 0;

  constructor(private game: Game, x: number, z: number) {
    this.pos.set(x, 0, z);
    game.stage.scene.add(this.m.root);
  }

  pet(): void {
    this.happy = 1.5;
    audio.bark();
    this.game.fx.text(this.pos, '❤', 'heart');
  }

  update(dt: number): void {
    const g = this.game;
    const p = g.player.pos;
    let target: THREE.Vector3 | null = null;
    let prey: Zombie | null = null;
    let best = 7;
    for (const z of g.zombies) {
      if (z.dead || z.rising > 0) continue;
      const d = dist2d(z.pos, p);
      if (d < best) {
        best = d;
        prey = z;
      }
    }
    if (prey) target = prey.pos;
    else if (dist2d(this.pos, p) > 2) target = p;

    let speed = 0;
    if (dist2d(this.pos, p) > 12) {
      this.pos.set(p.x - 0.8, 0, p.z - 0.8);
    } else if (target) {
      const d = dist2d(this.pos, target);
      const a = angleTo(this.pos, target);
      this.facing = lerpAngle(this.facing, a, Math.min(1, dt * 10));
      if (d > (prey ? 0.7 : 1.6)) {
        speed = DOG_SPEED * (prey ? 1 : Math.min(1, d / 3));
        moveWithCollision(g.grid, this.pos, Math.sin(a) * speed * dt, Math.cos(a) * speed * dt, 0.25);
      }
      this.biteCd -= dt;
      if (prey && d < 0.9 && this.biteCd <= 0) {
        this.biteCd = 0.6;
        g.damageZombie(prey, DOG_DAMAGE + g.player.tier, this.pos, 2);
        audio.bark();
      }
    }
    this.walk += dt * (speed > 0 ? 16 : 3);
    const m = this.m;
    m.root.position.copy(this.pos);
    m.root.rotation.y = this.facing;
    m.legs.forEach((l, i) => (l.rotation.x = speed > 0 ? Math.sin(this.walk + (i % 2) * Math.PI) * 0.7 : 0));
    this.happy = Math.max(0, this.happy - dt);
    m.tail.rotation.y = Math.sin(this.walk * (this.happy > 0 ? 3 : 1)) * 0.6;
    m.root.position.y = this.happy > 0 ? Math.abs(Math.sin(this.happy * 8)) * 0.3 : 0;
  }
}

// ─────────────────────────── Turrets & arrows ───────────────────────────
interface Arrow {
  mesh: THREE.Mesh;
  v: THREE.Vector3;
  life: number;
}

export class Turret {
  private m = turretModel();
  private cd = 0.5;
  private arrows: Arrow[] = [];
  readonly pos: THREE.Vector3;
  gone = false;

  constructor(private game: Game, readonly tx: number, readonly ty: number) {
    this.pos = new THREE.Vector3(tx + 0.5, 0, ty + 0.5);
    this.m.root.position.copy(this.pos);
    game.stage.scene.add(this.m.root);
  }

  update(dt: number): void {
    const g = this.game;
    if (g.grid.blockAt(this.tx, this.ty) !== B.Turret) {
      this.gone = true;
    }
    const frac = g.grid.hpFrac(this.tx, this.ty);
    for (const mat of this.m.mats) mat.color.setRGB(1, 1, 1).lerp(new THREE.Color(0x3a3030), (1 - frac) * 0.7);

    this.cd -= dt;
    let target: Zombie | null = null;
    let best = TURRET_RANGE;
    if (!this.gone) {
      for (const z of g.zombies) {
        if (z.dead || z.rising > 0.3) continue;
        const d = dist2d(z.pos, this.pos);
        if (d < best) {
          best = d;
          target = z;
        }
      }
    }
    if (target) {
      const a = angleTo(this.pos, target.pos);
      this.m.head.rotation.y = lerpAngle(this.m.head.rotation.y, a, Math.min(1, dt * 12));
      if (this.cd <= 0) {
        this.cd = TURRET_COOLDOWN / g.turretRateMul;
        const mesh = box(0.05, 0.05, 0.5, lambert(0xf5f0e0, 0x444444));
        mesh.castShadow = false;
        mesh.position.set(this.pos.x, 0.95, this.pos.z);
        const lead = target.pos.clone().setY(0.7);
        const v = lead.sub(mesh.position).normalize().multiplyScalar(18);
        mesh.lookAt(mesh.position.clone().add(v));
        g.stage.scene.add(mesh);
        this.arrows.push({ mesh, v, life: 0.7 });
        audio.arrow();
      }
    }
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const ar = this.arrows[i];
      ar.life -= dt;
      ar.mesh.position.addScaledVector(ar.v, dt);
      let hit = false;
      for (const z of g.zombies) {
        if (z.dead || z.rising > 0.3) continue;
        if (dist2d(z.pos, ar.mesh.position) < z.radius + 0.2) {
          g.damageZombie(z, TURRET_DAMAGE, this.pos, 1.5);
          hit = true;
          break;
        }
      }
      if (hit || ar.life <= 0) {
        g.stage.scene.remove(ar.mesh);
        this.arrows.splice(i, 1);
      }
    }
    if (this.gone && this.arrows.length === 0) this.dispose();
  }

  dispose(): void {
    this.game.stage.scene.remove(this.m.root);
    for (const a of this.arrows) this.game.stage.scene.remove(a.mesh);
    this.arrows = [];
  }
}

// ─────────────────────────── TNT ───────────────────────────
export class Tnt {
  private mesh: THREE.Mesh;
  private mat: THREE.MeshLambertMaterial;
  fuse = -1;
  gone = false;

  constructor(private game: Game, readonly tx: number, readonly ty: number) {
    this.mat = new THREE.MeshLambertMaterial({ map: tex.tnt() });
    this.mesh = box(0.7, 0.7, 0.7, this.mat, tx + 0.5, 0.35, ty + 0.5);
    game.stage.scene.add(this.mesh);
  }

  light(): void {
    if (this.fuse >= 0 || this.gone) return;
    this.fuse = TNT_FUSE;
    audio.fuse();
  }

  update(dt: number): void {
    const g = this.game;
    if (this.gone) return;
    if (g.grid.blockAt(this.tx, this.ty) !== B.TNT) {
      this.dispose();
      return;
    }
    if (this.fuse < 0) {
      for (const z of g.zombies) {
        if (!z.dead && z.rising <= 0 && Math.hypot(z.pos.x - (this.tx + 0.5), z.pos.z - (this.ty + 0.5)) < 0.8) {
          this.light();
          break;
        }
      }
      return;
    }
    this.fuse -= dt;
    const blink = Math.sin(this.fuse * 30) > 0;
    this.mat.emissive.setRGB(blink ? 1 : 0, blink ? 1 : 0, blink ? 1 : 0);
    this.mesh.scale.setScalar(1 + (TNT_FUSE - this.fuse) * 0.25);
    if (Math.random() < 0.5) g.fx.burst(this.mesh.position.clone().setY(0.8), [0xffd040, 0xff7020], 1, { glow: true, speed: 0.5, up: 2, size: 0.08, life: 0.4 });
    if (this.fuse <= 0) {
      this.dispose();
      g.grid.setBlock(this.tx, this.ty, B.None);
      g.explode(new THREE.Vector3(this.tx + 0.5, 0, this.ty + 0.5), 2.6, 60, 60, 'tnt');
    }
  }

  dispose(): void {
    this.gone = true;
    this.game.stage.scene.remove(this.mesh);
  }
}

// ─────────────────────────── Treasure chest ───────────────────────────
export class Chest {
  private m = chestModel();
  private beam: THREE.Mesh;
  opened = -1;
  gone = false;
  readonly pos: THREE.Vector3;

  constructor(private game: Game, readonly tx: number, readonly ty: number) {
    this.pos = new THREE.Vector3(tx + 0.5, 0, ty + 0.5);
    this.m.root.position.copy(this.pos);
    this.m.root.rotation.y = Math.random() * Math.PI * 2;
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.4, 30, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffe070, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide }),
    );
    this.beam.position.set(this.pos.x, 15, this.pos.z);
    game.stage.scene.add(this.m.root, this.beam);
  }

  open(): void {
    if (this.opened >= 0) return;
    this.opened = 0;
    const g = this.game;
    audio.upgrade();
    g.stage.scene.remove(this.beam);
    g.fx.burst(this.pos.clone().setY(0.7), [0xffe070, 0xffffff], 40, { glow: true, speed: 4, up: 6 });
    g.giveLoot(this.pos, { gold: 5, iron: 4, crystal: 1, stone: 3 }, 'Treasure!');
    g.grid.setBlock(this.tx, this.ty, B.None);
  }

  update(dt: number): void {
    if (this.opened < 0) {
      (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.25 + Math.sin(performance.now() / 300) * 0.1;
      if (this.game.grid.blockAt(this.tx, this.ty) !== B.Chest) this.open();
      return;
    }
    this.opened += dt;
    this.m.lid.rotation.x = -Math.min(1.9, this.opened * 6);
    if (this.opened > 2.5) {
      this.m.root.scale.setScalar(Math.max(0.001, 1 - (this.opened - 2.5) * 3));
      if (this.opened > 2.9) {
        this.gone = true;
        this.game.stage.scene.remove(this.m.root);
      }
    }
  }
}

// ─────────────────────────── Chickens ───────────────────────────
export class Chicken {
  readonly pos = new THREE.Vector3();
  private m = chicken();
  private vy = 0;
  private facing = Math.random() * 6;
  private wanderT = 0;
  private hop = 0;
  caught = false;

  constructor(private game: Game, x: number, z: number, fromSky: boolean) {
    this.pos.set(x, fromSky ? 14 + Math.random() * 6 : 0, z);
    game.stage.scene.add(this.m);
  }

  update(dt: number): void {
    const g = this.game;
    if (this.pos.y > 0) {
      this.vy -= 12 * dt;
      this.vy = Math.max(this.vy, -5); // flapping slows the fall
      this.pos.y += this.vy * dt;
      this.m.rotation.z = Math.sin(performance.now() / 50) * 0.3;
      if (this.pos.y <= 0) {
        this.pos.y = 0;
        this.m.rotation.z = 0;
        g.fx.burst(this.pos.clone().setY(0.3), 0xffffff, 8, { speed: 2, up: 2, size: 0.08 });
        audio.cluck();
      }
    } else {
      const d = dist2d(this.pos, g.player.pos);
      let speed = 0;
      if (d < 3) {
        this.facing = angleTo(g.player.pos, this.pos) + Math.sin(performance.now() / 200) * 0.6;
        speed = 3.1;
      } else {
        this.wanderT -= dt;
        if (this.wanderT <= 0) {
          this.wanderT = 1 + Math.random() * 2;
          this.facing = Math.random() * Math.PI * 2;
        }
        speed = this.wanderT > 1 ? 0.8 : 0;
      }
      moveWithCollision(g.grid, this.pos, Math.sin(this.facing) * speed * dt, Math.cos(this.facing) * speed * dt, 0.2);
      this.hop += dt * speed * 6;
      this.m.position.y = Math.abs(Math.sin(this.hop)) * 0.1;
      if (d < 0.7) {
        this.caught = true;
        g.catchChicken(this);
      }
    }
    this.m.position.x = this.pos.x;
    this.m.position.z = this.pos.z;
    if (this.pos.y > 0) this.m.position.y = this.pos.y;
    this.m.rotation.y = this.facing;
  }

  dispose(): void {
    this.game.stage.scene.remove(this.m);
  }
}

// ─────────────────────────── Merchant balloon ───────────────────────────
export class Merchant {
  private m = balloon();
  readonly pos: THREE.Vector3;
  private y = 22;
  leaving = false;
  gone = false;

  constructor(private game: Game, x: number, z: number) {
    this.pos = new THREE.Vector3(x, 0, z);
    this.m.position.set(x, this.y, z);
    game.stage.scene.add(this.m);
  }

  get landed(): boolean {
    return this.y < 0.05 && !this.leaving;
  }

  update(dt: number): void {
    if (this.leaving) this.y += dt * 4;
    else this.y = Math.max(0, this.y - dt * 5);
    this.m.position.y = this.y + (this.landed ? 0 : Math.sin(performance.now() / 400) * 0.2);
    this.m.rotation.y += dt * 0.2;
    if (this.y > 30) {
      this.gone = true;
      this.game.stage.scene.remove(this.m);
    }
  }
}

// ─────────────────────────── Meteors ───────────────────────────
export class Meteor {
  private mesh: THREE.Mesh;
  private from: THREE.Vector3;
  private t = 0;
  done = false;

  constructor(private game: Game, readonly target: THREE.Vector3, private dur: number, readonly big: boolean, private onLand: (m: Meteor) => void) {
    const s = big ? 1.2 : 0.5;
    this.mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), lambert(0x3a2a2a, 0xff5010));
    this.from = target.clone().add(new THREE.Vector3(18, 34, -14));
    this.mesh.position.copy(this.from);
    game.stage.scene.add(this.mesh);
  }

  update(dt: number): void {
    this.t += dt;
    const k = Math.min(1, this.t / this.dur);
    this.mesh.position.lerpVectors(this.from, this.target, k * k);
    this.mesh.rotation.x += dt * 5;
    this.mesh.rotation.y += dt * 3;
    this.game.fx.burst(this.mesh.position, [0xffa030, 0xff5010, 0xffe070], this.big ? 3 : 1, { glow: true, speed: 0.6, up: 0.5, size: this.big ? 0.35 : 0.2, life: 0.6, gravity: 0 });
    if (k >= 1 && !this.done) {
      this.done = true;
      this.game.stage.scene.remove(this.mesh);
      this.onLand(this);
    }
  }
}

