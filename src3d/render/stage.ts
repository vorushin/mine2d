import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export interface LightSpot {
  x: number;
  y: number;
  z: number;
  color: number;
  intensity: number;
  distance: number;
}

export interface Atmosphere {
  /** 0 = night, 1 = full day */
  day: number;
  /** 0..1 sunset glow */
  dusk: number;
  blood: boolean;
  fog: boolean;
  /** Extra sky flash (lightning) 0..1 */
  flash: number;
}

const C = (h: number) => new THREE.Color(h);
const SKY_DAY = C(0x9fd8ff), SKY_DUSK = C(0xff9566), SKY_NIGHT = C(0x0b1030), SKY_BLOOD = C(0x2b0508), SKY_FOG = C(0x3a4150);
const HEMI_DAY = C(0xeaf6ff), HEMI_NIGHT = C(0x34457e), HEMI_BLOOD = C(0x9a2a2a);
const SUN_DAY = C(0xfff2d6), SUN_DUSK = C(0xff9a50), MOON = C(0x9db4ff), MOON_BLOOD = C(0xff4a3a);

export const isTouch =
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0 || new URLSearchParams(location.search).has('touch'));

function glowTexture(): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Renderer, camera rig, sky and lights. */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private lantern: THREE.PointLight;
  private pool: THREE.PointLight[] = [];
  private stars: THREE.Points;
  private moon: THREE.Group;
  private moonDisk: THREE.MeshBasicMaterial;
  private moonGlow: THREE.SpriteMaterial;
  readonly glow = glowTexture();
  private fog: THREE.Fog;
  private sky: THREE.Mesh;
  private skyTop: THREE.Color;
  private skyBottom: THREE.Color;

  // Camera rig
  readonly target = new THREE.Vector3();
  private focus = new THREE.Vector3();
  pitch = 0.95;
  dist = 15;
  lookLift = 0;
  yaw = 0;
  private shakeAmt = 0;
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  constructor(container: HTMLElement, center: THREE.Vector3, signal?: AbortSignal) {
    this.renderer = new THREE.WebGLRenderer({ antialias: !isTouch, powerPreference: 'high-performance', stencil: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
    this.fog = new THREE.Fog(0x9fd8ff, 30, 80);
    this.scene.fog = this.fog;
    this.scene.background = SKY_DAY.clone();
    this.skyTop = new THREE.Color();
    this.skyBottom = new THREE.Color();
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(300, 24, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { top: { value: this.skyTop }, bottom: { value: this.skyBottom } },
        vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vP;
          void main(){ float h = clamp(vP.y * 2.2, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 0.7)), 1.0); }`,
      }),
    );
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);

    this.hemi = new THREE.HemisphereLight(0xeaf6ff, 0x5a6b3a, 1.5);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2d6, 2.6);
    this.sun.castShadow = true;
    const s = this.sun.shadow;
    s.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
    s.camera.left = -20; s.camera.right = 20; s.camera.top = 20; s.camera.bottom = -20;
    s.camera.near = 1; s.camera.far = 80;
    s.bias = -0.0008;
    s.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    this.lantern = new THREE.PointLight(0xffd6a0, 0, 11, 1.3);
    this.scene.add(this.lantern);
    for (let i = 0; i < 8; i++) {
      const l = new THREE.PointLight(0xffa040, 0, 8, 1.5);
      this.pool.push(l);
      this.scene.add(l);
    }

    // Stars
    const starGeo = new THREE.BufferGeometry();
    const pts: number[] = [];
    for (let i = 0; i < 600; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9 + 0.05;
      const r = 160;
      pts.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 1.3, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }),
    );
    this.stars.position.copy(center);
    this.scene.add(this.stars);

    // Moon (seen during the dusk cinematic)
    this.moon = new THREE.Group();
    this.moonDisk = new THREE.MeshBasicMaterial({ color: 0xf6f1d2, fog: false });
    const disk = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), this.moonDisk);
    this.moon.add(disk);
    for (const [x, y, r] of [[0.3, 0.25, 0.22], [-0.35, -0.1, 0.18], [0.05, -0.4, 0.14]]) {
      const crater = new THREE.Mesh(
        new THREE.CircleGeometry(r, 10),
        new THREE.MeshBasicMaterial({ color: 0xcfc8a8, fog: false, transparent: true, opacity: 0.6 }),
      );
      crater.position.set(x, y, 0.99);
      this.moon.add(crater);
    }
    this.moonGlow = new THREE.SpriteMaterial({ map: this.glow, color: 0xfff6c0, transparent: true, opacity: 0.6, fog: false, depthWrite: false });
    const halo = new THREE.Sprite(this.moonGlow);
    halo.scale.setScalar(5);
    this.moon.add(halo);
    this.moon.visible = false;
    this.scene.add(this.moon);

    if (!isTouch) {
      this.composer = new EffectComposer(
        this.renderer,
        new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType, stencilBuffer: true }),
      );
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.5, 0.9);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }

    this.resize();
    window.addEventListener('resize', () => this.resize(), { signal });
    this.focus.copy(center);
    this.target.copy(center);
  }

  resize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
    this.bloom?.resolution.set(w / 2, h / 2);
    this.camera.aspect = w / h;
    // Portrait phones see less width — pull the camera back a bit.
    this.camera.fov = w < h ? 58 : 42;
    this.camera.updateProjectionMatrix();
  }

  shake(amount: number): void {
    this.shakeAmt = Math.max(this.shakeAmt, amount);
  }

  /** Moon size/colour for tonight; shown only while `visible`. */
  setMoon(visible: boolean, night: number, blood: boolean): void {
    this.moon.visible = visible;
    const s = 3.5 + night * 1.3;
    this.moon.scale.setScalar(s);
    this.moonDisk.color.set(blood ? 0xff4a3a : 0xf6f1d2);
    this.moonGlow.color.set(blood ? 0xff3020 : 0xfff6c0);
    this.moon.position.set(this.focus.x, 9 + night * 1.6, this.focus.z - 95);
  }

  setAtmosphere(a: Atmosphere): void {
    const sky = SKY_NIGHT.clone().lerp(SKY_DAY, a.day);
    if (a.dusk > 0) sky.lerp(SKY_DUSK, a.dusk * 0.8);
    if (a.blood) sky.lerp(SKY_BLOOD, 1 - a.day);
    if (a.fog) sky.lerp(SKY_FOG, 0.7 * (1 - a.day));
    if (a.flash > 0) sky.lerp(C(0xe8ecff), a.flash);
    (this.scene.background as THREE.Color).copy(sky);
    this.fog.color.copy(sky);
    this.skyBottom.copy(sky);
    // Zenith: deeper blue by day, near-black by night.
    this.skyTop.copy(sky).lerp(C(a.blood ? 0x120003 : 0x02040f), 0.55 * (1 - a.day)).lerp(C(0x3f8fe0), 0.55 * a.day);
    if (a.dusk > 0) this.skyTop.lerp(C(0x4a3a8a), a.dusk * 0.6);
    const night = 1 - a.day;
    // Distances are from the camera, which sits ~15 units from the player.
    this.fog.near = a.fog ? 12 + a.day * 18 : 30 - night * 6;
    this.fog.far = a.fog ? 23 + a.day * 57 : 80 - night * 28;

    this.hemi.color.copy(HEMI_NIGHT).lerp(HEMI_DAY, a.day);
    if (a.blood) this.hemi.color.lerp(HEMI_BLOOD, night * 0.6);
    this.hemi.intensity = 0.4 + a.day * 1.15 + a.flash * 3;
    this.sun.color.copy(a.blood ? MOON_BLOOD : MOON).lerp(SUN_DAY, a.day);
    if (a.dusk > 0) this.sun.color.lerp(SUN_DUSK, a.dusk);
    this.sun.intensity = 0.55 + a.day * 2.15;
    (this.stars.material as THREE.PointsMaterial).opacity = Math.max(0, (night - 0.4) / 0.6) * (a.fog ? 0.2 : 1);
    this.lantern.intensity = night * 7;
    if (this.bloom) this.bloom.strength = 0.18 + night * 0.6;
    this.renderer.toneMappingExposure = 1.0 + night * 0.15;
  }

  /** Assign the pooled point lights to the nearest light spots. */
  setLights(spots: LightSpot[], player: THREE.Vector3): void {
    spots.sort((a, b) => (a.x - player.x) ** 2 + (a.z - player.z) ** 2 - ((b.x - player.x) ** 2 + (b.z - player.z) ** 2));
    for (let i = 0; i < this.pool.length; i++) {
      const l = this.pool[i];
      const s = spots[i];
      if (!s) {
        l.intensity = 0;
        continue;
      }
      l.position.set(s.x, s.y, s.z);
      l.color.setHex(s.color);
      l.intensity = s.intensity;
      l.distance = s.distance;
    }
    this.lantern.position.set(player.x, player.y + 2.8, player.z + 0.6);
  }

  /** Where on the ground (y=0) is this screen point? */
  pick(clientX: number, clientY: number): THREE.Vector3 | null {
    const ndc = new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const out = new THREE.Vector3();
    return this.ray.ray.intersectPlane(this.plane, out);
  }

  /** Screen position of a world point (for DOM overlays). */
  toScreen(p: THREE.Vector3): { x: number; y: number; behind: boolean } {
    const v = p.clone().project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight, behind: v.z > 1 };
  }

  render(dt: number): void {
    this.tick(dt);
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }

  /** Advance the camera rig without drawing. */
  tick(dt: number): void {
    const k = 1 - Math.pow(0.0015, dt);
    this.focus.lerp(this.target, k);
    const f = this.focus;
    const cx = Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist;
    const cz = Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist;
    this.camera.position.set(f.x + cx, f.y + Math.sin(this.pitch) * this.dist, f.z + cz);
    if (this.shakeAmt > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmt;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmt;
      this.shakeAmt *= Math.pow(0.004, dt);
    }
    this.camera.lookAt(f.x, f.y + this.lookLift, f.z);

    // Shadow box follows the camera focus.
    this.sun.position.set(f.x - 12, 26, f.z + 8);
    this.sun.target.position.set(f.x, 0, f.z);
    this.stars.position.set(f.x, 0, f.z);
    this.sky.position.copy(this.camera.position);
  }
}
