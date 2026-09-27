import * as THREE from 'three';
import { Rng } from '../rng';

// Tiny procedural 16×16 pixel-art textures, Minecraft-style.

type Painter = (px: (x: number, y: number, c: string) => void, r: Rng) => void;

const cache = new Map<string, THREE.Texture>();

function make(key: string, paint: Painter, size = 16): THREE.Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  const r = new Rng(key.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  paint((x, y, c) => {
    g.fillStyle = c;
    g.fillRect(x, y, 1, 1);
  }, r);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapLinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 + amt))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function speckle(base: string, spread: number): Painter {
  return (px, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, shade(base, (r.next() - 0.5) * spread));
  };
}

export const tex = {
  grassTop: () => make('grassTop', (px, r) => {
    speckle('#5fb84a', 0.28)(px, r);
    for (let i = 0; i < 10; i++) px(r.int(0, 15), r.int(0, 15), '#7fd35e');
  }),
  grassSide: () => make('grassSide', (px, r) => {
    speckle('#8a5a36', 0.3)(px, r);
    for (let x = 0; x < 16; x++) {
      const h = 3 + r.int(0, 2);
      for (let y = 0; y < h; y++) px(x, y, shade('#5fb84a', (r.next() - 0.5) * 0.3));
    }
  }),
  dirt: () => make('dirt', speckle('#8a5a36', 0.3)),
  sand: () => make('sand', speckle('#dcc585', 0.14)),
  stone: () => make('stone', (px, r) => {
    speckle('#8c8f94', 0.22)(px, r);
    for (let i = 0; i < 6; i++) {
      const x = r.int(0, 14), y = r.int(0, 14);
      px(x, y, '#6c6f74');
      px(x + 1, y, '#6c6f74');
    }
  }),
  ore: (color: string, name: string) => make('ore' + name, (px, r) => {
    speckle('#8c8f94', 0.2)(px, r);
    for (let i = 0; i < 7; i++) {
      const x = r.int(1, 13), y = r.int(1, 13);
      px(x, y, color);
      px(x + 1, y, shade(color, -0.2));
      px(x, y + 1, shade(color, 0.25));
    }
  }),
  bark: () => make('bark', (px, r) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) px(x, y, shade(x % 4 === 0 ? '#4d3219' : '#6b4526', (r.next() - 0.5) * 0.25));
  }),
  leaves: () => make('leaves', (px, r) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const v = r.next();
        px(x, y, v < 0.15 ? '#2a6b25' : shade('#3f9a36', (r.next() - 0.5) * 0.35));
      }
  }),
  planks: () => make('planks', (px, r) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const seam = y % 4 === 3 || (x === (y >> 2) * 5 % 16);
        px(x, y, seam ? '#6e4a28' : shade('#b3834f', (r.next() - 0.5) * 0.18));
      }
  }),
  bricks: () => make('bricks', (px, r) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const row = y >> 2;
        const seam = y % 4 === 3 || (x + (row % 2) * 4) % 8 === 7;
        px(x, y, seam ? '#55585c' : shade('#9aa0a6', (r.next() - 0.5) * 0.18));
      }
  }),
  tnt: () => make('tnt', (px, r) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const band = y >= 6 && y <= 9;
        px(x, y, band ? '#f2f2f2' : shade('#d8352a', (r.next() - 0.5) * 0.2));
      }
    const T = [[2, 7], [3, 7], [4, 7], [3, 8], [6, 7], [6, 8], [7, 7], [8, 8], [8, 7], [10, 7], [11, 7], [12, 7], [11, 8]];
    for (const [x, y] of T) px(x, y, '#222');
  }),
  chest: () => make('chest', (px, r) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const edge = x === 0 || x === 15 || y === 0 || y === 15 || y === 6;
        px(x, y, edge ? '#4a2c12' : shade('#a0662a', (r.next() - 0.5) * 0.18));
      }
    for (let y = 5; y < 9; y++) for (let x = 7; x < 9; x++) px(x, y, '#ffd84a');
  }),
};
