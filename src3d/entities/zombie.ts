import * as THREE from 'three';
import { ZSTATS, ZStats, ZType } from '../director';
import { nextStep } from '../flowfield';
import { audio } from '../audio';
import { animateWalk, box, crown, flash, humanoid, HumanoidLook, lambert, Rig } from '../render/models';
import { angleTo, dist2d, lerpAngle, moveWithCollision, tileOf } from './body';
import type { Game } from '../game';

const LOOKS: Record<ZType, HumanoidLook> = {
  walker: { skin: 0x6fb05a, shirt: 0x3e8fb0, pants: 0x4b3b8f, eye: 0xff3030 },
  runner: { skin: 0x9ccf4a, shirt: 0xe07b2a, pants: 0x4a4a4a, eye: 0xffe030 },
  brute: { skin: 0x3f6e3a, shirt: 0x5a4632, pants: 0x2e2e2e, eye: 0xff3030 },
  boomer: { skin: 0x7bff6a, shirt: 0x3dcc3a, pants: 0x2f6a2a, eye: 0xffffff },
  ghost: { skin: 0xe6f2ff, shirt: 0xcfe8ff, pants: 0xcfe8ff, eye: 0x30c0ff, noLegs: true, transparent: true },
  giant: { skin: 0x4d7f45, shirt: 0x6a5238, pants: 0x3a2e24, eye: 0xff2020 },
  king: { skin: 0x7fa06a, shirt: 0x6a2c9c, pants: 0x3a1a5a, eye: 0xff2060 },
};

export class Zombie {
  readonly stats: ZStats;
  readonly rig: Rig;
  readonly pos = new THREE.Vector3();
  private knock = new THREE.Vector3();
  hp: number;
  maxHp: number;
  dead = false;
  rising = 1.1;
  private facing = 0;
  private walk = Math.random() * 6;
  private biteCd = 0.5;
  /** Wind-up before a bite; a hit interrupts it. */
  private windup = -1;
  private lunge = 0;
  private hitFlash = 0;
  private fuse = -1;
  private stompCd = 3;
  private stompWind = -1;
  private summonCd = 7;
  private stuckT = 0;
  private lastPos = new THREE.Vector3();
  enraged = false;
  private bar: THREE.Group | null = null;
  private barFill: THREE.Mesh | null = null;
  private aura: THREE.Sprite | null = null;

  constructor(private game: Game, readonly type: ZType, x: number, z: number, hpScale: number, readonly golden = false) {
    this.stats = ZSTATS[type];
    this.hp = this.maxHp = Math.round(this.stats.hp * hpScale);
    const look = { ...LOOKS[type] };
    if (golden) look.shirt = 0xffcc33;
    this.rig = humanoid(look);
    const r = this.rig;
    r.root.scale.setScalar(this.stats.scale);
    r.armL.rotation.x = r.armR.rotation.x = -1.35;
    if (type === 'king') {
      const c = crown();
      c.position.y = 0.34;
      r.head.add(c);
      const cape = lambert(0xa31c3a);
      r.mats.push(cape);
      r.body.add(box(0.46, 0.7, 0.05, cape, 0, 0.05, -0.16));
    }
    if (type === 'boomer' || type === 'ghost' || type === 'king' || golden) {
      this.aura = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: game.stage.glow,
          color: type === 'boomer' ? 0x7bff6a : type === 'ghost' ? 0x9fd4ff : golden ? 0xffd040 : 0xff2050,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      this.aura.scale.setScalar(2.2);
      this.aura.position.y = 0.7;
      r.root.add(this.aura);
    }
    this.pos.set(x, -1.3, z);
    this.lastPos.copy(this.pos);
    game.stage.scene.add(r.root);
    if (type !== 'giant' && type !== 'king') {
      this.bar = new THREE.Group();
      const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.09), new THREE.MeshBasicMaterial({ color: 0x220000, fog: false }));
      this.barFill = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.09), new THREE.MeshBasicMaterial({ color: 0xff4040, fog: false }));
      this.barFill.position.z = 0.001;
      this.bar.add(bg, this.barFill);
      this.bar.visible = false;
      game.stage.scene.add(this.bar);
    }
  }

  get radius(): number {
    return 0.3 * Math.max(1, this.stats.scale * 0.7);
  }

  /** Returns true if this hit killed it. */
  damage(amount: number, from: THREE.Vector3 | null, knock = 4): boolean {
    if (this.dead || this.rising > 0.4) return false;
    this.hp -= amount;
    this.hitFlash = 0.12;
    // A hit staggers the bite wind-up a little (but can't stop it forever).
    if (this.windup >= 0 && this.type !== 'giant' && this.type !== 'king') this.windup = Math.min(0.45, this.windup + 0.15);
    if (from) {
      const heavy = this.type === 'giant' || this.type === 'king' ? 0.1 : this.type === 'brute' ? 0.4 : 1;
      const d = new THREE.Vector3(this.pos.x - from.x, 0, this.pos.z - from.z).normalize().multiplyScalar(knock * heavy);
      this.knock.add(d);
    }
    if (this.hp <= 0) {
      this.dead = true;
      return true;
    }
    return false;
  }

  update(dt: number): void {
    const g = this.game;
    const r = this.rig;
    const st = this.stats;

    if (this.rising > 0) {
      this.rising -= dt;
      this.pos.y = -1.3 * Math.max(0, this.rising / 1.1);
      if (Math.random() < 0.3) g.fx.burst(this.pos.clone().setY(0.1), [0xe8d38f, 0x2c86d1], 1, { speed: 1.5, up: 3, size: 0.1 });
      this.sync(dt, 0);
      return;
    }
    this.pos.y = st.ghost ? 0.25 + Math.sin(this.walk * 0.5) * 0.12 : 0;

    const player = g.player;
    const dPlayer = dist2d(this.pos, player.pos);
    let speed = st.speed * (this.enraged ? 1.6 : 1) * g.zombieSpeedMul;
    let moving = false;

    // Knockback
    if (this.knock.lengthSq() > 0.0001) {
      moveWithCollision(g.grid, this.pos, this.knock.x * dt, this.knock.z * dt, 0.3, st.ghost ? () => true : undefined);
      this.knock.multiplyScalar(Math.pow(0.002, dt));
    }

    // Boomer fuse
    if (this.fuse >= 0) {
      this.fuse -= dt;
      r.root.scale.setScalar(st.scale * (1 + (0.8 - this.fuse) * 0.5));
      flash(r.mats, Math.sin(this.fuse * 40) > 0 ? 0.7 : 0);
      if (this.fuse <= 0) {
        this.dead = true;
        g.explode(this.pos.clone(), 2.1, st.damage, st.wallDamage, 'boomer');
      }
      return;
    }

    // Giant / King stomp
    if (this.type === 'giant' || this.type === 'king') this.updateBoss(dt, dPlayer);
    if (this.stompWind >= 0) {
      this.sync(dt, 0);
      return;
    }

    this.biteCd -= dt;
    const reach = 0.55 + this.radius + 0.15;
    if (dPlayer < reach && player.hp > 0) {
      this.facing = lerpAngle(this.facing, angleTo(this.pos, player.pos), Math.min(1, dt * 10));
      if (st.explodes) {
        this.fuse = 0.8;
        audio.fuse();
      } else if (this.windup >= 0) {
        this.windup -= dt;
        if (this.windup < 0) {
          this.biteCd = 0.9;
          this.lunge = 1;
          g.hurtPlayer(st.damage, this.pos);
        }
      } else if (this.biteCd <= 0) {
        this.windup = this.type === 'runner' ? 0.25 : 0.4;
      }
    } else if (st.ghost) {
      this.windup = -1;
      const a = angleTo(this.pos, player.pos);
      this.facing = lerpAngle(this.facing, a, Math.min(1, dt * 6));
      this.pos.x += Math.sin(a) * speed * dt;
      this.pos.z += Math.cos(a) * speed * dt;
      moving = true;
    } else {
      // A started bite stays "loaded" while briefly knocked out of reach.
      if (this.windup >= 0) this.windup = dPlayer > reach + 0.8 ? -1 : Math.max(0.001, this.windup - dt);
      const t = tileOf(this.pos);
      const next = nextStep(g.grid, g.field, t.x, t.y);
      // Close to the player with a clear line: walk straight at them.
      const direct = dPlayer < 1.6;
      if (direct) {
        const a = angleTo(this.pos, player.pos);
        this.facing = lerpAngle(this.facing, a, Math.min(1, dt * 10));
        moveWithCollision(g.grid, this.pos, Math.sin(a) * speed * dt, Math.cos(a) * speed * dt, 0.3);
        moving = true;
      } else if (next) {
        const cx = next.x + 0.5, cz = next.y + 0.5;
        const a = Math.atan2(cx - this.pos.x, cz - this.pos.z);
        this.facing = lerpAngle(this.facing, a, Math.min(1, dt * 8));
        if (!g.grid.walkable(next.x, next.y)) {
          // A wall (or tree) is in the way: chew through it.
          const dd = Math.hypot(cx - this.pos.x, cz - this.pos.z);
          if (dd > 0.95) {
            moveWithCollision(g.grid, this.pos, Math.sin(a) * speed * dt, Math.cos(a) * speed * dt, 0.3);
            moving = true;
          }
          if (this.biteCd <= 0 && dd < 1.3) {
            if (st.explodes) {
              this.fuse = 0.8;
              audio.fuse();
            } else {
              this.biteCd = 0.9;
              this.lunge = 1;
              g.zombieHitsBlock(next.x, next.y, st.wallDamage);
            }
          }
        } else {
          moveWithCollision(g.grid, this.pos, Math.sin(a) * speed * dt, Math.cos(a) * speed * dt, 0.3);
          moving = true;
        }
      }
    }

    // Unstick
    if (moving) {
      if (this.pos.distanceTo(this.lastPos) < speed * dt * 0.2) this.stuckT += dt;
      else this.stuckT = 0;
      if (this.stuckT > 1.5) {
        this.knock.set((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6);
        this.stuckT = 0;
      }
    }
    this.lastPos.copy(this.pos);
    speed = moving ? speed : 0;
    this.sync(dt, speed);
  }

  private updateBoss(dt: number, dPlayer: number): void {
    const g = this.game;
    const st = this.stats;
    if (this.type === 'king') {
      if (!this.enraged && this.hp < this.maxHp * 0.5) {
        this.enraged = true;
        g.banner('👑 The King is ENRAGED!', 'He moves faster. Keep hitting!');
        audio.roar();
        g.stage.shake(0.6);
      }
      this.summonCd -= dt;
      if (this.summonCd <= 0) {
        this.summonCd = this.enraged ? 6 : 9;
        audio.roar();
        for (let i = 0; i < (this.enraged ? 4 : 3); i++) {
          const a = (i / 3) * Math.PI * 2 + Math.random();
          g.spawnZombie(Math.random() < 0.3 ? 'runner' : 'walker', this.pos.x + Math.cos(a) * 1.8, this.pos.z + Math.sin(a) * 1.8);
        }
        g.fx.burst(this.pos.clone().setY(1), [0x9b4dff, 0xff2060], 30, { glow: true, speed: 5, up: 3 });
      }
    }
    this.stompCd -= dt;
    if (this.stompWind < 0 && this.stompCd <= 0 && dPlayer < 3.2) {
      this.stompWind = 0.7;
      this.rig.armL.rotation.x = this.rig.armR.rotation.x = -2.8;
    }
    if (this.stompWind >= 0) {
      this.stompWind -= dt;
      if (this.stompWind < 0) {
        this.stompCd = this.type === 'king' ? (this.enraged ? 2.6 : 3.6) : 4.2;
        this.rig.armL.rotation.x = this.rig.armR.rotation.x = -1.35;
        audio.stomp();
        g.stage.shake(0.7);
        g.fx.ring(this.pos, 0xffe6a0, 3.2, 0.5);
        g.fx.burst(this.pos.clone().setY(0.1), [0x8a5a36, 0x5fb84a], 24, { speed: 6, up: 5 });
        if (dist2d(this.pos, g.player.pos) < 2.6) g.hurtPlayer(Math.round(st.damage * 0.8), this.pos);
        const t = tileOf(this.pos);
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const b = g.grid.blockAt(t.x + dx, t.y + dy);
            if (b !== 0) g.zombieHitsBlock(t.x + dx, t.y + dy, st.wallDamage);
          }
      }
    }
  }

  private sync(dt: number, speed: number): void {
    const r = this.rig;
    this.walk += dt * (4 + speed * 3);
    r.root.position.copy(this.pos);
    r.root.rotation.y = this.facing;
    animateWalk(r, this.walk, speed > 0 ? 1 : 0);
    this.lunge = Math.max(0, this.lunge - dt * 4);
    if (this.stompWind < 0) r.armL.rotation.x = r.armR.rotation.x = -1.35 - this.lunge * 0.6 + Math.sin(this.walk * 0.5) * 0.08;
    r.body.rotation.x = this.lunge * 0.3 - (this.windup >= 0 ? 0.35 : 0);
    if (this.windup >= 0 && this.stompWind < 0) r.armL.rotation.x = r.armR.rotation.x = -2.3;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.fuse < 0) {
      const glow = this.type === 'boomer' ? 0.25 + Math.sin(this.walk) * 0.2 : 0;
      // Big bodies flash softer so bloom doesn't turn them into a white blob.
      const big = this.stats.scale > 2;
      if (this.hitFlash > 0) flash(r.mats, big ? 0.14 : 0.45, 1, big ? 0.5 : 1, big ? 0.4 : 1);
      else flash(r.mats, glow, 0.4, 1, 0.3);
    }
    if (this.aura) {
      const m = this.aura.material as THREE.SpriteMaterial;
      m.opacity = 0.3 + Math.sin(this.walk * 0.7) * 0.15 + (this.enraged ? 0.3 : 0);
    }
    if (this.type === 'ghost') {
      for (const m of r.mats) m.opacity = 0.35 + Math.sin(this.walk * 0.4) * 0.15;
    }
    if (this.bar && this.barFill) {
      const show = this.hp < this.maxHp && !this.dead;
      this.bar.visible = show;
      if (show) {
        const f = Math.max(0, this.hp / this.maxHp);
        this.bar.position.set(this.pos.x, this.pos.y + 1.45 * this.stats.scale + 0.1, this.pos.z);
        this.bar.quaternion.copy(this.game.stage.camera.quaternion);
        this.barFill.scale.x = f;
        this.barFill.position.x = -0.35 * (1 - f);
      }
    }
  }

  dispose(): void {
    this.game.stage.scene.remove(this.rig.root);
    if (this.bar) this.game.stage.scene.remove(this.bar);
  }
}
