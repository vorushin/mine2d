import * as THREE from 'three';
import { isTouch } from './render/stage';

export type InputEvent =
  | { type: 'key'; key: string }
  | { type: 'tap'; x: number; y: number }
  | { type: 'click'; x: number; y: number }
  | { type: 'rclick' };

/** Keyboard, mouse and touch (joystick + taps), boiled down to intents. */
export class Input {
  readonly move = new THREE.Vector2();
  actionHeld = false;
  mouseHeld = false;
  pointer: { x: number; y: number } | null = null;
  readonly events: InputEvent[] = [];
  private keys = new Set<string>();
  private stickId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private stickVec = new THREE.Vector2();
  private stickEl: HTMLDivElement;
  private knobEl: HTMLDivElement;
  onGesture: (() => void) | null = null;
  enabled = true;

  constructor(canvas: HTMLElement, overlay: HTMLElement, signal: AbortSignal) {
    const opt = { signal };
    this.stickEl = document.createElement('div');
    this.stickEl.className = 'stick';
    this.knobEl = document.createElement('div');
    this.knobEl.className = 'knob';
    this.stickEl.appendChild(this.knobEl);
    overlay.appendChild(this.stickEl);

    window.addEventListener('keydown', (e) => {
      this.onGesture?.();
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (k === ' ') {
        this.actionHeld = true;
        e.preventDefault();
      }
      this.events.push({ type: 'key', key: k });
    }, opt);
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      this.keys.delete(k);
      if (k === ' ') {
        this.actionHeld = false;
        e.preventDefault(); // don't let Space "click" a focused HUD button
      }
    }, opt);
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.actionHeld = false;
      this.mouseHeld = false;
    }, opt);

    canvas.addEventListener('contextmenu', (e) => e.preventDefault(), opt);
    canvas.addEventListener('pointerdown', (e) => this.down(e), opt);
    window.addEventListener('pointermove', (e) => this.moveP(e), opt);
    window.addEventListener('pointerup', (e) => this.up(e), opt);
    window.addEventListener('pointercancel', (e) => this.up(e), opt);
  }

  private down(e: PointerEvent): void {
    this.onGesture?.();
    if (!this.enabled) return;
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      // Left 45% of the screen = floating joystick.
      if (e.clientX < window.innerWidth * 0.45 && this.stickId === null) {
        this.stickId = e.pointerId;
        this.stickOrigin = { x: e.clientX, y: e.clientY };
        this.stickEl.style.display = 'block';
        this.stickEl.style.left = e.clientX + 'px';
        this.stickEl.style.top = e.clientY + 'px';
        this.knobEl.style.transform = 'translate(-50%,-50%)';
        return;
      }
      this.events.push({ type: 'tap', x: e.clientX, y: e.clientY });
      return;
    }
    this.pointer = { x: e.clientX, y: e.clientY };
    if (e.button === 2) {
      this.events.push({ type: 'rclick' });
      return;
    }
    this.mouseHeld = true;
    this.events.push({ type: 'click', x: e.clientX, y: e.clientY });
  }

  private moveP(e: PointerEvent): void {
    if (e.pointerId === this.stickId) {
      const dx = e.clientX - this.stickOrigin.x, dy = e.clientY - this.stickOrigin.y;
      const len = Math.hypot(dx, dy);
      const max = 55;
      const k = len > max ? max / len : 1;
      this.stickVec.set((dx * k) / max, (dy * k) / max);
      this.knobEl.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
      return;
    }
    if (e.pointerType === 'mouse') this.pointer = { x: e.clientX, y: e.clientY };
  }

  private up(e: PointerEvent): void {
    if (e.pointerId === this.stickId) {
      this.stickId = null;
      this.stickVec.set(0, 0);
      this.stickEl.style.display = 'none';
    }
    if (e.pointerType === 'mouse' && e.button === 0) this.mouseHeld = false;
  }

  update(): void {
    let x = 0, y = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
    this.move.set(x, y);
    if (this.move.lengthSq() > 1) this.move.normalize();
    if (this.stickVec.lengthSq() > 0.01) this.move.copy(this.stickVec);
    if (!this.enabled) this.move.set(0, 0);
  }

  get touch(): boolean {
    return isTouch;
  }
}
