import * as THREE from 'three';
import { Grid } from '../grid';
import { B, Ground } from '../rules';
import { tex } from './textures';

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const tmpC = new THREE.Color();
const up = new THREE.Vector3(0, 1, 0);
const DAMAGED = new THREE.Color(0x3a3030);

function hash(x: number, y: number, k = 0): number {
  let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

type Part = {
  mesh: THREE.InstancedMesh;
  /** local offset, size, and optional random jitter per instance */
  place: (x: number, y: number, add: (px: number, py: number, pz: number, sx: number, sy: number, sz: number, rotY?: number) => void) => void;
};

/** Renders the island: ground tiles, natural blocks and player walls/torches as instanced meshes. */
export class Terrain {
  readonly group = new THREE.Group();
  private parts = new Map<B, Part[]>();
  private groundMeshes: { type: Ground; mesh: THREE.InstancedMesh }[] = [];
  private deco!: THREE.InstancedMesh;
  private flames!: THREE.InstancedMesh;
  private water!: THREE.Mesh;
  private waterBase!: Float32Array;
  private seenVersion = -1;
  private groundDirty = true;
  private shakes = new Map<number, number>();
  private torchSpots: { x: number; y: number }[] = [];
  private time = 0;
  hitDirty = false;

  constructor(private grid: Grid) {
    this.buildGround();
    this.buildBlocks();
    this.buildWater();
  }

  private inst(geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], cap: number, shadow = true): THREE.InstancedMesh {
    const m = new THREE.InstancedMesh(geo, mat, cap);
    m.castShadow = shadow;
    m.receiveShadow = true;
    m.count = 0;
    m.frustumCulled = false;
    this.group.add(m);
    return m;
  }

  private buildGround(): void {
    const n = this.grid.size * this.grid.size;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, -0.5, 0);
    const dirt = new THREE.MeshLambertMaterial({ map: tex.dirt() });
    const grassSide = new THREE.MeshLambertMaterial({ map: tex.grassSide() });
    const grassTop = new THREE.MeshLambertMaterial({ map: tex.grassTop() });
    const sand = new THREE.MeshLambertMaterial({ map: tex.sand() });
    const mk = (type: Ground, mats: THREE.Material[]) => {
      const mesh = this.inst(geo, mats, n, false);
      this.groundMeshes.push({ type, mesh });
    };
    mk(Ground.Grass, [grassSide, grassSide, grassTop, dirt, grassSide, grassSide]);
    mk(Ground.Sand, [sand, sand, sand, sand, sand, sand]);
    mk(Ground.Dirt, [dirt, dirt, dirt, dirt, dirt, dirt]);

    const tuft = new THREE.BoxGeometry(0.07, 0.22, 0.07);
    tuft.translate(0, 0.11, 0);
    this.deco = this.inst(tuft, new THREE.MeshLambertMaterial({ color: 0xffffff }), n * 3, false);
  }

  private buildBlocks(): void {
    const n = this.grid.size * this.grid.size;
    const unit = () => {
      const g = new THREE.BoxGeometry(1, 1, 1);
      g.translate(0, 0.5, 0);
      return g;
    };
    const L = (map: THREE.Texture, extra: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ map, ...extra });

    const trunk = this.inst(unit(), L(tex.bark()), n);
    const leaves = this.inst(unit(), L(tex.leaves()), n * 2);
    this.parts.set(B.Tree, [
      { mesh: trunk, place: (_x, _y, add) => add(0, 0, 0, 0.42, 1.25, 0.42) },
      {
        mesh: leaves,
        place: (x, y, add) => {
          const h = hash(x, y, 3) * 0.3;
          add(0, 1.0 + h, 0, 1.2, 1.0, 1.2, hash(x, y) * 0.5);
          add(0, 1.95 + h, 0, 0.75, 0.55, 0.75, hash(x, y, 9));
        },
      },
    ]);

    const stoneMat = L(tex.stone());
    const rock = this.inst(unit(), stoneMat, n);
    this.parts.set(B.Rock, [
      { mesh: rock, place: (x, y, add) => add(0, 0, 0, 0.92, 0.7 + hash(x, y) * 0.35, 0.92, (hash(x, y, 1) - 0.5) * 0.3) },
    ]);
    const oreMesh = (color: string, name: string, emissive = 0) =>
      this.inst(unit(), L(tex.ore(color, name), { emissive, emissiveIntensity: 0.25 }), n);
    const iron = oreMesh('#d9825f', 'iron');
    const gold = oreMesh('#ffe23b', 'gold', 0x4a3a00);
    this.parts.set(B.Iron, [{ mesh: iron, place: (_x, _y, add) => add(0, 0, 0, 0.95, 0.95, 0.95) }]);
    this.parts.set(B.Gold, [{ mesh: gold, place: (_x, _y, add) => add(0, 0, 0, 0.95, 0.95, 0.95) }]);

    const crystalRock = this.inst(unit(), stoneMat, n);
    const shards = this.inst(
      unit(),
      new THREE.MeshLambertMaterial({ color: 0x7ff6ff, emissive: 0x19b7d8, emissiveIntensity: 0.9 }),
      n * 3,
    );
    this.parts.set(B.Crystal, [
      { mesh: crystalRock, place: (_x, _y, add) => add(0, 0, 0, 0.9, 0.35, 0.9) },
      {
        mesh: shards,
        place: (_x, _y, add) => {
          add(0, 0.2, 0, 0.26, 1.1, 0.26, 0.3);
          add(-0.22, 0.2, 0.15, 0.2, 0.75, 0.2, 0.9);
          add(0.24, 0.2, -0.1, 0.18, 0.6, 0.18, 1.7);
        },
      },
    ]);

    const planks = this.inst(unit(), L(tex.planks()), n);
    this.parts.set(B.WallWood, [{ mesh: planks, place: (_x, _y, add) => add(0, 0, 0, 1, 1.1, 1) }]);
    const bricks = this.inst(unit(), L(tex.bricks()), n);
    this.parts.set(B.WallStone, [{ mesh: bricks, place: (_x, _y, add) => add(0, 0, 0, 1, 1.35, 1) }]);

    const stick = this.inst(unit(), L(tex.planks()), n);
    this.parts.set(B.Torch, [{ mesh: stick, place: (_x, _y, add) => add(0, 0, 0, 0.1, 0.75, 0.1) }]);
    this.flames = this.inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffb13b }), n, false);
  }

  private buildWater(): void {
    const S = this.grid.size * 3;
    const geo = new THREE.PlaneGeometry(S, S, 72, 72);
    geo.rotateX(-Math.PI / 2);
    this.waterBase = Float32Array.from(geo.attributes.position.array as Float32Array);
    this.water = new THREE.Mesh(
      geo,
      new THREE.MeshLambertMaterial({ color: 0x2c86d1, transparent: true, opacity: 0.82, flatShading: true }),
    );
    this.water.position.set(this.grid.size / 2, -0.42, this.grid.size / 2);
    this.water.receiveShadow = true;
    this.group.add(this.water);
    // Endless flat sea beyond the animated patch, so the horizon fades into fog.
    const far = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshLambertMaterial({ color: 0x2c86d1 }));
    far.rotation.x = -Math.PI / 2;
    far.position.set(this.grid.size / 2, -0.5, this.grid.size / 2);
    this.group.add(far);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(S, S), new THREE.MeshLambertMaterial({ color: 0x1b5a86 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(this.grid.size / 2, -1.4, this.grid.size / 2);
    this.group.add(floor);
  }

  markGroundDirty(): void {
    this.groundDirty = true;
  }

  /** Wobble a block that was just hit. */
  shake(x: number, y: number): void {
    this.shakes.set(this.grid.idx(x, y), 0.18);
    this.hitDirty = true;
  }

  torches(): { x: number; y: number }[] {
    return this.torchSpots;
  }

  update(dt: number): void {
    this.time += dt;
    if (this.groundDirty) this.rebuildGround();
    if (this.seenVersion !== this.grid.version || this.shakes.size || this.hitDirty) {
      for (const [k, t] of this.shakes) {
        if (t - dt <= 0) this.shakes.delete(k);
        else this.shakes.set(k, t - dt);
      }
      this.rebuildBlocks();
      this.hitDirty = false;
    }
    this.animate();
  }

  private rebuildGround(): void {
    this.groundDirty = false;
    const g = this.grid;
    for (const gm of this.groundMeshes) gm.mesh.count = 0;
    let dc = 0;
    for (let y = 0; y < g.size; y++) {
      for (let x = 0; x < g.size; x++) {
        const t = g.groundAt(x, y);
        if (t === Ground.Water) continue;
        const gm = this.groundMeshes.find((m) => m.type === t)!;
        const top = t === Ground.Sand ? -0.08 : 0;
        tmpP.set(x + 0.5, top, y + 0.5);
        tmpS.set(1, 1, 1);
        tmpM.compose(tmpP, tmpQ.identity(), tmpS);
        const i = gm.mesh.count++;
        gm.mesh.setMatrixAt(i, tmpM);
        const v = 0.92 + hash(x, y, 5) * 0.16;
        gm.mesh.setColorAt(i, tmpC.setRGB(v, v, v));
        if (t === Ground.Grass) {
          for (let k = 0; k < 3; k++) {
            if (hash(x, y, 20 + k) > 0.3) continue;
            tmpP.set(x + 0.15 + hash(x, y, 30 + k) * 0.7, 0, y + 0.15 + hash(x, y, 40 + k) * 0.7);
            const flower = hash(x, y, 50 + k) < 0.18;
            tmpS.set(1, flower ? 1.2 : 0.7 + hash(x, y, 60 + k), 1);
            tmpM.compose(tmpP, tmpQ.identity(), tmpS);
            this.deco.setMatrixAt(dc, tmpM);
            const fc = hash(x, y, 70 + k);
            this.deco.setColorAt(dc, tmpC.set(flower ? (fc < 0.5 ? 0xff5a7a : 0xffe14a) : 0x4fae3c));
            dc++;
          }
        }
      }
    }
    this.deco.count = dc;
    for (const gm of [...this.groundMeshes.map((m) => m.mesh), this.deco]) {
      gm.instanceMatrix.needsUpdate = true;
      if (gm.instanceColor) gm.instanceColor.needsUpdate = true;
    }
  }

  private rebuildBlocks(): void {
    this.seenVersion = this.grid.version;
    const g = this.grid;
    for (const ps of this.parts.values()) for (const p of ps) p.mesh.count = 0;
    this.torchSpots = [];
    for (let y = 0; y < g.size; y++) {
      for (let x = 0; x < g.size; x++) {
        const b = g.blockAt(x, y);
        if (b === B.Torch) this.torchSpots.push({ x, y });
        const ps = this.parts.get(b);
        if (!ps) continue;
        const idx = g.idx(x, y);
        const sh = this.shakes.get(idx) ?? 0;
        const wob = sh > 0 ? Math.sin(sh * 70) * sh * 0.5 : 0;
        const squash = 1 - sh * 0.5;
        const frac = g.hpFrac(x, y);
        tmpC.setRGB(1, 1, 1).lerp(DAMAGED, (1 - frac) * 0.75);
        for (const p of ps) {
          p.place(x, y, (px, py, pz, sx, sy, sz, rotY = 0) => {
            tmpP.set(x + 0.5 + px + wob, py * squash, y + 0.5 + pz);
            tmpS.set(sx * (1 + sh * 0.3), sy * squash, sz * (1 + sh * 0.3));
            tmpQ.setFromAxisAngle(up, rotY);
            tmpM.compose(tmpP, tmpQ, tmpS);
            const i = p.mesh.count++;
            p.mesh.setMatrixAt(i, tmpM);
            p.mesh.setColorAt(i, tmpC);
          });
        }
      }
    }
    for (const ps of this.parts.values())
      for (const p of ps) {
        p.mesh.instanceMatrix.needsUpdate = true;
        if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true;
      }
  }

  private animate(): void {
    // Flickering torch flames.
    let i = 0;
    for (const t of this.torchSpots) {
      const f = 1 + Math.sin(this.time * 17 + t.x * 3 + t.y) * 0.18;
      tmpP.set(t.x + 0.5, 0.86, t.y + 0.5);
      tmpS.set(0.2 * f, 0.26 * f, 0.2 * f);
      tmpQ.setFromAxisAngle(up, this.time * 2 + t.x);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.flames.setMatrixAt(i++, tmpM);
    }
    this.flames.count = i;
    this.flames.instanceMatrix.needsUpdate = true;

    // Gentle waves.
    const pos = this.water.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const t = this.time;
    for (let k = 0; k < arr.length; k += 3) {
      const x = this.waterBase[k], z = this.waterBase[k + 2];
      arr[k + 1] = Math.sin(x * 0.7 + t * 1.3) * 0.06 + Math.cos(z * 0.9 + t * 1.1) * 0.06;
    }
    pos.needsUpdate = true;
    this.water.geometry.computeVertexNormals();
  }
}
