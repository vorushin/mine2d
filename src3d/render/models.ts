import * as THREE from 'three';
import { tex } from './textures';

// Blocky voxel models built from boxes. Each model owns its materials so it
// can flash white when hit.

export function lambert(color: number, emissive = 0, extra: THREE.MeshLambertMaterialParameters = {}): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, emissive, ...extra });
}

const geoCache = new Map<string, THREE.BoxGeometry>();

/** Box geometries are shared between all models of the same size. */
function boxGeo(w: number, h: number, d: number): THREE.BoxGeometry {
  const k = `${w},${h},${d}`;
  let g = geoCache.get(k);
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d);
    geoCache.set(k, g);
  }
  return g;
}

export function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(boxGeo(w, h, d), mat);
  m.position.set(x, y, z);
  // Tiny parts (eyes, noses) don't need shadows.
  m.castShadow = w * h * d > 0.002;
  m.receiveShadow = true;
  return m;
}

/** An Object3D pivot at (x,y,z) holding a box hanging below it. */
function limb(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Object3D {
  const p = new THREE.Object3D();
  p.position.set(x, y, z);
  p.add(box(w, h, d, mat, 0, -h / 2, 0));
  return p;
}

export interface Rig {
  root: THREE.Group;
  body: THREE.Object3D;
  head: THREE.Object3D;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  mats: THREE.MeshLambertMaterial[];
  eyes: THREE.MeshBasicMaterial;
}

export interface HumanoidLook {
  skin: number;
  shirt: number;
  pants: number;
  hair?: number;
  eye?: number;
  noLegs?: boolean;
  transparent?: boolean;
}

export function humanoid(look: HumanoidLook): Rig {
  const root = new THREE.Group();
  const t = look.transparent ? { transparent: true, opacity: 0.55, depthWrite: false } : {};
  const skin = lambert(look.skin, 0, t);
  const shirt = lambert(look.shirt, 0, t);
  const pants = lambert(look.pants, 0, t);
  const mats = [skin, shirt, pants];

  const body = new THREE.Object3D();
  body.position.y = 0.42;
  root.add(body);
  body.add(box(0.4, 0.42, 0.24, shirt, 0, 0.21, 0));

  const head = new THREE.Object3D();
  head.position.y = 0.42;
  body.add(head);
  head.add(box(0.34, 0.34, 0.34, skin, 0, 0.17, 0));
  if (look.hair !== undefined) {
    const hair = lambert(look.hair, 0, t);
    mats.push(hair);
    head.add(box(0.36, 0.1, 0.36, hair, 0, 0.35, 0));
    head.add(box(0.36, 0.2, 0.08, hair, 0, 0.24, -0.15));
  }
  // Eyes ignore fog, so zombie eyes glow through Fog Night.
  const eyes = new THREE.MeshBasicMaterial({ color: look.eye ?? 0x1a1a1a, fog: look.eye === undefined });
  head.add(box(0.07, 0.07, 0.02, eyes, -0.08, 0.2, 0.175));
  head.add(box(0.07, 0.07, 0.02, eyes, 0.08, 0.2, 0.175));

  const armL = limb(0.13, 0.4, 0.13, skin, -0.27, 0.4, 0);
  const armR = limb(0.13, 0.4, 0.13, skin, 0.27, 0.4, 0);
  body.add(armL, armR);
  armL.children[0].add(box(0.15, 0.16, 0.15, shirt, 0, 0.12, 0));
  armR.children[0].add(box(0.15, 0.16, 0.15, shirt, 0, 0.12, 0));

  const legL = limb(0.16, 0.42, 0.16, pants, -0.1, 0.42, 0);
  const legR = limb(0.16, 0.42, 0.16, pants, 0.1, 0.42, 0);
  if (!look.noLegs) root.add(legL, legR);

  return { root, body, head, armL, armR, legL, legR, mats, eyes };
}

export function animateWalk(r: Rig, phase: number, amount: number): void {
  const s = Math.sin(phase) * 0.7 * amount;
  r.legL.rotation.x = s;
  r.legR.rotation.x = -s;
  r.body.position.y = 0.42 + Math.abs(Math.cos(phase)) * 0.04 * amount;
}

export function flash(mats: THREE.MeshLambertMaterial[], k: number, r = 1, g = 1, b = 1): void {
  for (const m of mats) m.emissive.setRGB(k * r, k * g, k * b);
}

export function pickaxe(color: number): { group: THREE.Group; head: THREE.MeshLambertMaterial } {
  const g = new THREE.Group();
  const wood = lambert(0x7a5230);
  const head = lambert(color, 0);
  g.add(box(0.06, 0.62, 0.06, wood, 0, 0.2, 0));
  g.add(box(0.44, 0.08, 0.08, head, 0, 0.48, 0));
  g.add(box(0.08, 0.1, 0.08, head, -0.24, 0.44, 0));
  g.add(box(0.08, 0.1, 0.08, head, 0.24, 0.44, 0));
  return { group: g, head };
}

export function dog(): { root: THREE.Group; legs: THREE.Object3D[]; tail: THREE.Object3D; head: THREE.Object3D } {
  const root = new THREE.Group();
  const fur = lambert(0xc98a4b);
  const dark = lambert(0x6b4423);
  const white = lambert(0xf1e3cf);
  root.add(box(0.3, 0.26, 0.56, fur, 0, 0.36, 0));
  const head = new THREE.Object3D();
  head.position.set(0, 0.52, 0.3);
  head.add(box(0.28, 0.26, 0.26, fur, 0, 0, 0));
  head.add(box(0.16, 0.12, 0.14, white, 0, -0.05, 0.18));
  head.add(box(0.06, 0.06, 0.04, new THREE.MeshBasicMaterial({ color: 0x111111 }), 0, -0.01, 0.26));
  head.add(box(0.08, 0.14, 0.06, dark, -0.12, 0.14, -0.04));
  head.add(box(0.08, 0.14, 0.06, dark, 0.12, 0.14, -0.04));
  const eye = new THREE.MeshBasicMaterial({ color: 0x111111 });
  head.add(box(0.05, 0.05, 0.02, eye, -0.07, 0.05, 0.135));
  head.add(box(0.05, 0.05, 0.02, eye, 0.07, 0.05, 0.135));
  root.add(head);
  const tail = new THREE.Object3D();
  tail.position.set(0, 0.46, -0.28);
  tail.add(box(0.06, 0.06, 0.24, dark, 0, 0.06, -0.1));
  tail.rotation.x = 0.6;
  root.add(tail);
  const legs: THREE.Object3D[] = [];
  for (const [x, z] of [[-0.1, 0.18], [0.1, 0.18], [-0.1, -0.18], [0.1, -0.18]]) {
    const l = limb(0.09, 0.24, 0.09, fur, x, 0.24, z);
    legs.push(l);
    root.add(l);
  }
  return { root, legs, tail, head };
}

export function chicken(): THREE.Group {
  const g = new THREE.Group();
  const white = lambert(0xf8f8f0);
  g.add(box(0.26, 0.24, 0.34, white, 0, 0.26, 0));
  g.add(box(0.18, 0.22, 0.16, white, 0, 0.46, 0.14));
  g.add(box(0.06, 0.08, 0.1, lambert(0xe23b2e), 0, 0.6, 0.14));
  g.add(box(0.08, 0.05, 0.08, lambert(0xf5a623), 0, 0.46, 0.25));
  g.add(box(0.04, 0.14, 0.04, lambert(0xf5a623), -0.06, 0.07, 0));
  g.add(box(0.04, 0.14, 0.04, lambert(0xf5a623), 0.06, 0.07, 0));
  return g;
}

export function turretModel(): { root: THREE.Group; head: THREE.Object3D; mats: THREE.MeshLambertMaterial[] } {
  const root = new THREE.Group();
  const base = new THREE.MeshLambertMaterial({ map: tex.bricks() });
  const wood = new THREE.MeshLambertMaterial({ map: tex.planks() });
  root.add(box(0.8, 0.6, 0.8, base, 0, 0.3, 0));
  root.add(box(0.6, 0.2, 0.6, wood, 0, 0.7, 0));
  const head = new THREE.Object3D();
  head.position.y = 0.9;
  head.add(box(0.14, 0.14, 0.7, wood, 0, 0, 0.1));
  head.add(box(0.8, 0.08, 0.1, lambert(0x5b3a1e), 0, 0.02, 0.3));
  head.add(box(0.04, 0.04, 0.5, lambert(0xdddddd), 0, 0.1, 0.2));
  root.add(head);
  return { root, head, mats: [base, wood] };
}

export function chestModel(): { root: THREE.Group; lid: THREE.Object3D } {
  const root = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ map: tex.chest() });
  root.add(box(0.8, 0.5, 0.6, m, 0, 0.25, 0));
  const lid = new THREE.Object3D();
  lid.position.set(0, 0.5, -0.3);
  lid.add(box(0.82, 0.2, 0.62, m, 0, 0.1, 0.3));
  root.add(lid);
  return { root, lid };
}

export function crown(): THREE.Group {
  const g = new THREE.Group();
  const gold = lambert(0xffd23a, 0x6a4a00);
  g.add(box(0.4, 0.1, 0.4, gold, 0, 0.05, 0));
  for (const [x, z] of [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16], [0, 0.18], [0, -0.18]]) {
    g.add(box(0.07, 0.14, 0.07, gold, x, 0.16, z));
  }
  g.add(box(0.07, 0.07, 0.03, lambert(0xff2255, 0x660011), 0, 0.08, 0.21));
  return g;
}

export function balloon(): THREE.Group {
  const g = new THREE.Group();
  const colors = [0xe94f37, 0xf6f7eb, 0x3f88c5, 0xf6f7eb];
  for (let i = 0; i < 8; i++) {
    const y = 2.4 + i * 0.3;
    const r = Math.sin(((i + 0.5) / 8) * Math.PI) * 1.0 + 0.25;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.3, 12), lambert(colors[i % colors.length]));
    c.position.y = y;
    c.castShadow = true;
    g.add(c);
  }
  const rope = lambert(0x6b4423);
  for (const [x, z] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) {
    g.add(box(0.03, 1.6, 0.03, rope, x, 1.4, z));
  }
  const basket = new THREE.MeshLambertMaterial({ map: tex.planks() });
  g.add(box(0.8, 0.5, 0.8, basket, 0, 0.35, 0));
  const m = humanoid({ skin: 0xf1c27d, shirt: 0x8e44ad, pants: 0x333333, hair: 0xeeeeee });
  m.root.position.y = 0.15;
  m.root.scale.setScalar(0.9);
  m.armL.rotation.z = -2.5;
  g.add(m.root);
  const hat = lambert(0x222222);
  m.head.add(box(0.44, 0.04, 0.44, hat, 0, 0.36, 0));
  m.head.add(box(0.28, 0.2, 0.28, hat, 0, 0.48, 0));
  return g;
}

/**
 * Adds a flat silhouette that only draws where the model is hidden behind
 * something. The model's visible pixels mark the stencil buffer, and the
 * silhouette skips marked pixels, so it never tints the model itself.
 */
export function addXray(root: THREE.Object3D, color: number): void {
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.5, depthWrite: false, depthFunc: THREE.GreaterDepth, fog: false,
    stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.KeepStencilOp,
  });
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  const marked = new Set<THREE.Material>();
  for (const m of meshes) {
    const mm = m.material as THREE.Material;
    if (!marked.has(mm)) {
      marked.add(mm);
      mm.stencilWrite = true;
      mm.stencilRef = 1;
      mm.stencilFunc = THREE.AlwaysStencilFunc;
      mm.stencilZPass = THREE.ReplaceStencilOp;
    }
    const x = new THREE.Mesh(m.geometry, mat);
    x.renderOrder = 5;
    x.castShadow = false;
    m.add(x);
  }
}
