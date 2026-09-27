import * as THREE from 'three';
import { Stage } from './stage';

interface Bit {
  p: THREE.Vector3;
  v: THREE.Vector3;
  life: number;
  max: number;
  size: number;
  color: THREE.Color;
  spin: number;
  gravity: number;
  /** Fly to the player after this many seconds (loot). */
  home: number;
}

interface Ring {
  mesh: THREE.Mesh;
  t: number;
  dur: number;
  r: number;
  slash?: boolean;
}

interface Label {
  el: HTMLDivElement;
  p: THREE.Vector3;
  t: number;
}

export interface Marker {
  mesh: THREE.Mesh;
  remove(): void;
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpE = new THREE.Euler();

/** Voxel debris, sparks, shockwaves, lightning and floating numbers. */
export class Fx {
  private cubes: THREE.InstancedMesh;
  private sparks: THREE.InstancedMesh;
  private bits: Bit[] = [];
  private glowBits: Bit[] = [];
  private rings: Ring[] = [];
  private bolts: { g: THREE.Group; t: number }[] = [];
  private labels: Label[] = [];
  private layer: HTMLDivElement;
  private time = 0;
  onLootArrive: (() => void) | null = null;

  constructor(private stage: Stage, overlay: HTMLElement) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.cubes = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), 900);
    this.cubes.castShadow = true;
    this.cubes.frustumCulled = false;
    this.cubes.count = 0;
    this.sparks = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), 500);
    this.sparks.frustumCulled = false;
    this.sparks.count = 0;
    stage.scene.add(this.cubes, this.sparks);
    this.layer = document.createElement('div');
    this.layer.className = 'fx-layer';
    overlay.appendChild(this.layer);
  }

  /** Voxel chunks flying out of p. */
  burst(p: THREE.Vector3, colors: number | number[], count: number, o: { speed?: number; size?: number; up?: number; life?: number; glow?: boolean; gravity?: number } = {}): void {
    const list = o.glow ? this.glowBits : this.bits;
    const cap = o.glow ? 500 : 900;
    const cols = Array.isArray(colors) ? colors : [colors];
    for (let i = 0; i < count; i++) {
      if (list.length >= cap) list.shift();
      const a = Math.random() * Math.PI * 2;
      const sp = (o.speed ?? 3) * (0.4 + Math.random() * 0.8);
      const life = (o.life ?? 0.8) * (0.6 + Math.random() * 0.6);
      list.push({
        p: p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, Math.random() * 0.3, (Math.random() - 0.5) * 0.3)),
        v: new THREE.Vector3(Math.cos(a) * sp, (o.up ?? 4) * (0.5 + Math.random() * 0.8), Math.sin(a) * sp),
        life,
        max: life,
        size: (o.size ?? 0.14) * (0.6 + Math.random() * 0.8),
        color: new THREE.Color(cols[i % cols.length]),
        spin: (Math.random() - 0.5) * 16,
        gravity: o.gravity ?? (o.glow ? 2 : 16),
        home: -1,
      });
    }
  }

  /** Resource cubes that hop out then fly to the player. */
  loot(p: THREE.Vector3, color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      this.bits.push({
        p: p.clone().setY(0.6),
        v: new THREE.Vector3(Math.cos(a) * 2, 5 + Math.random() * 2, Math.sin(a) * 2),
        life: 3,
        max: 3,
        size: 0.2,
        color: new THREE.Color(color),
        spin: 6,
        gravity: 16,
        home: 0.35 + i * 0.07,
      });
    }
  }

  /** A quick white crescent in front of the player when swinging. */
  slash(p: THREE.Vector3, facing: number, color = 0xffffff): void {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 1.45, 18, 1, -0.95, 1.9),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, fog: false }),
    );
    mesh.rotation.set(-Math.PI / 2, 0, facing - Math.PI / 2);
    mesh.position.set(p.x, 0.65, p.z);
    this.stage.scene.add(mesh);
    this.rings.push({ mesh, t: 0, dur: 0.16, r: 0, slash: true });
  }

  ring(p: THREE.Vector3, color: number, radius: number, dur = 0.45): void {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, fog: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(p.x, 0.06, p.z);
    this.stage.scene.add(mesh);
    this.rings.push({ mesh, t: 0, dur, r: radius });
  }

  marker(x: number, z: number, r: number, color: number): Marker {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(r * 0.82, r, 36),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, fog: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.07, z);
    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(r * 0.82, 36),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false, fog: false }),
    );
    mesh.add(dot);
    this.stage.scene.add(mesh);
    return {
      mesh,
      remove: () => {
        this.stage.scene.remove(mesh);
        mesh.geometry.dispose();
      },
    };
  }

  bolt(x: number, z: number): void {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xeaf0ff, fog: false, transparent: true });
    let px = x, pz = z, py = 0;
    while (py < 22) {
      const ny = py + 1.2 + Math.random() * 1.5;
      const nx = x + (Math.random() - 0.5) * 1.6, nz = z + (Math.random() - 0.5) * 1.6;
      const a = new THREE.Vector3(px, py, pz), b = new THREE.Vector3(nx, ny, nz);
      const len = a.distanceTo(b);
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.14, len, 0.14), mat);
      seg.position.copy(a).add(b).multiplyScalar(0.5);
      seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      g.add(seg);
      px = nx; py = ny; pz = nz;
    }
    this.stage.scene.add(g);
    this.bolts.push({ g, t: 0.35 });
  }

  text(p: THREE.Vector3, s: string, cls = ''): void {
    const el = document.createElement('div');
    el.className = 'float ' + cls;
    el.textContent = s;
    this.layer.appendChild(el);
    this.labels.push({ el, p: p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0, 0)), t: 0 });
    if (this.labels.length > 40) {
      this.labels.shift()!.el.remove();
    }
  }

  update(dt: number, player: THREE.Vector3): void {
    this.time += dt;
    this.step(this.bits, this.cubes, dt, player);
    this.step(this.glowBits, this.sparks, dt, player);

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      const k = r.t / r.dur;
      if (r.slash) r.mesh.scale.setScalar(0.85 + k * 0.3);
      else r.mesh.scale.setScalar(0.2 + k * r.r);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (r.slash ? 0.55 : 0.9) * (1 - k);
      if (k >= 1) {
        this.stage.scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        this.rings.splice(i, 1);
      }
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.t -= dt;
      b.g.visible = Math.sin(b.t * 80) > -0.3;
      if (b.t <= 0) {
        this.stage.scene.remove(b.g);
        this.bolts.splice(i, 1);
      }
    }
    for (let i = this.labels.length - 1; i >= 0; i--) {
      const l = this.labels[i];
      l.t += dt;
      const s = this.stage.toScreen(l.p.clone().setY(l.p.y + 1.4 + l.t * 1.2));
      l.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%) scale(${Math.min(1, 0.5 + l.t * 5)})`;
      l.el.style.opacity = String(Math.max(0, 1 - Math.max(0, l.t - 0.6) / 0.4));
      if (l.t > 1) {
        l.el.remove();
        this.labels.splice(i, 1);
      }
    }
  }

  private step(list: Bit[], mesh: THREE.InstancedMesh, dt: number, player: THREE.Vector3): void {
    let n = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      b.life -= dt;
      if (b.home >= 0) {
        b.home -= dt;
        if (b.home < 0) {
          b.home = -2; // homing
        }
      }
      if (b.home === -2) {
        const to = player.clone().setY(0.9).sub(b.p);
        const d = to.length();
        if (d < 0.35) {
          list.splice(i, 1);
          this.onLootArrive?.();
          continue;
        }
        b.v.lerp(to.normalize().multiplyScalar(14), Math.min(1, dt * 10));
      } else {
        b.v.y -= b.gravity * dt;
      }
      b.p.addScaledVector(b.v, dt);
      if (b.p.y < b.size / 2 && b.home !== -2 && b.gravity > 3) {
        b.p.y = b.size / 2;
        b.v.y *= -0.35;
        b.v.x *= 0.6;
        b.v.z *= 0.6;
      }
      if (b.life <= 0) {
        list.splice(i, 1);
        continue;
      }
    }
    for (const b of list) {
      const k = Math.min(1, b.life / Math.min(0.3, b.max));
      tmpS.setScalar(b.size * k);
      tmpQ.setFromEuler(tmpE.set(this.time * b.spin, this.time * b.spin * 0.7, 0));
      tmpM.compose(b.p, tmpQ, tmpS);
      mesh.setMatrixAt(n, tmpM);
      mesh.setColorAt(n, b.color);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}
