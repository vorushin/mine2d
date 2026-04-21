/**
 * Synth-based sound effects. No external audio files.
 * Uses the Web Audio API to play short procedural tones. The audio context is
 * lazy-initialized on the first user interaction (browsers require a gesture).
 */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private _muted = false;

  /** Call once after any user gesture (pointerdown/keydown) to unlock audio. */
  ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = (window as typeof window & { webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.25;
    this.masterGain.connect(this.ctx.destination);
    return this.ctx;
  }

  set muted(v: boolean) {
    this._muted = v;
    if (this.masterGain) this.masterGain.gain.value = v ? 0 : 0.25;
  }
  get muted(): boolean { return this._muted; }

  private tone(opts: {
    type?: OscillatorType;
    freq: number;
    freqEnd?: number;
    duration: number;
    gain?: number;
    attack?: number;
    release?: number;
  }): void {
    const ctx = this.ensure();
    if (!ctx || !this.masterGain || this._muted) return;
    const osc = ctx.createOscillator();
    osc.type = opts.type ?? 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(opts.freq, now);
    if (opts.freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqEnd), now + opts.duration);
    const g = ctx.createGain();
    const peak = opts.gain ?? 0.35;
    const attack = opts.attack ?? 0.005;
    const release = opts.release ?? 0.04;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration + release);
    osc.connect(g).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + opts.duration + release + 0.02);
  }

  private noise(duration: number, gain = 0.18, highpass = 800): void {
    const ctx = this.ensure();
    if (!ctx || !this.masterGain || this._muted) return;
    const now = ctx.currentTime;
    const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * duration)), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = highpass;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(this.masterGain);
    src.start(now);
    src.stop(now + duration + 0.05);
  }

  mine(): void {
    this.tone({ type: 'square', freq: 280, freqEnd: 150, duration: 0.06, gain: 0.18 });
    this.noise(0.04, 0.08, 1200);
  }
  mineBreak(): void {
    this.tone({ type: 'triangle', freq: 500, freqEnd: 150, duration: 0.18, gain: 0.3 });
    this.noise(0.1, 0.2, 600);
  }
  place(): void {
    this.tone({ type: 'triangle', freq: 600, duration: 0.05, gain: 0.2 });
    this.tone({ type: 'sine', freq: 820, duration: 0.08, gain: 0.12 });
  }
  zombieHit(): void {
    this.tone({ type: 'sawtooth', freq: 180, freqEnd: 90, duration: 0.12, gain: 0.22 });
    this.noise(0.04, 0.06, 1500);
  }
  zombieDie(): void {
    this.tone({ type: 'sawtooth', freq: 300, freqEnd: 60, duration: 0.35, gain: 0.28 });
    this.noise(0.2, 0.12, 600);
  }
  wallHit(): void {
    this.tone({ type: 'square', freq: 160, freqEnd: 80, duration: 0.08, gain: 0.2 });
    this.noise(0.06, 0.1, 200);
  }
  playerHurt(): void {
    this.tone({ type: 'triangle', freq: 440, freqEnd: 260, duration: 0.18, gain: 0.34 });
  }
  arrowShoot(): void {
    this.tone({ type: 'sine', freq: 900, freqEnd: 300, duration: 0.08, gain: 0.18 });
    this.noise(0.04, 0.06, 3000);
  }
  pistolShoot(): void {
    this.tone({ type: 'square', freq: 800, freqEnd: 120, duration: 0.07, gain: 0.35 });
    this.noise(0.06, 0.28, 400);
  }
  turretShoot(): void {
    this.tone({ type: 'triangle', freq: 700, freqEnd: 200, duration: 0.06, gain: 0.16 });
  }
  craft(): void {
    this.tone({ type: 'sine', freq: 600, duration: 0.08, gain: 0.25 });
    setTimeout(() => this.tone({ type: 'sine', freq: 900, duration: 0.1, gain: 0.3 }), 70);
    setTimeout(() => this.tone({ type: 'sine', freq: 1200, duration: 0.12, gain: 0.25 }), 140);
  }
  buy(): void {
    this.tone({ type: 'triangle', freq: 880, duration: 0.08, gain: 0.3 });
    setTimeout(() => this.tone({ type: 'triangle', freq: 1320, duration: 0.1, gain: 0.25 }), 60);
  }
  nightStart(): void {
    this.tone({ type: 'sine', freq: 200, freqEnd: 90, duration: 0.9, gain: 0.35 });
  }
  dawn(): void {
    this.tone({ type: 'sine', freq: 440, freqEnd: 880, duration: 0.8, gain: 0.3 });
  }
  click(): void {
    this.tone({ type: 'square', freq: 1200, duration: 0.03, gain: 0.12 });
  }
  footstep(): void {
    this.noise(0.04, 0.06, 200);
    this.tone({ type: 'sine', freq: 90, freqEnd: 60, duration: 0.04, gain: 0.06 });
  }
  pickup(): void {
    this.tone({ type: 'triangle', freq: 660, duration: 0.05, gain: 0.2 });
    setTimeout(() => this.tone({ type: 'triangle', freq: 990, duration: 0.07, gain: 0.18 }), 50);
  }
  bossRoar(): void {
    this.tone({ type: 'sawtooth', freq: 120, freqEnd: 50, duration: 0.9, gain: 0.45 });
    this.noise(0.7, 0.2, 200);
  }
  cake(): void {
    this.tone({ type: 'triangle', freq: 523, duration: 0.15, gain: 0.3 }); // C
    setTimeout(() => this.tone({ type: 'triangle', freq: 659, duration: 0.15, gain: 0.3 }), 120); // E
    setTimeout(() => this.tone({ type: 'triangle', freq: 784, duration: 0.25, gain: 0.35 }), 240); // G
    setTimeout(() => this.tone({ type: 'triangle', freq: 1046, duration: 0.4, gain: 0.4 }), 400); // C5
  }
}

export const sounds = new SoundManager();
