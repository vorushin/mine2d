// Procedural sound effects + a tiny chiptune sequencer. No audio files.

type Theme = 'menu' | 'day' | 'night' | 'boss' | 'victory';

const _ = null;
interface Pattern {
  bpm: number;
  root: number;
  lead: (number | null)[];
  bass: (number | null)[];
  perc: ('k' | 'h' | 's' | null)[];
}

const THEMES: Record<Theme, Pattern> = {
  menu: {
    bpm: 92, root: 62,
    lead: [0, _, 7, _, 12, _, 7, _, 9, _, 5, _, 4, _, 2, _, 0, _, 7, _, 12, _, 14, _, 16, _, 14, _, 12, _, 7, _],
    bass: [-12, _, _, _, -5, _, _, _, -7, _, _, _, -8, _, _, _, -12, _, _, _, -5, _, _, _, -3, _, _, _, -5, _, _, _],
    perc: [_, _, _, _, 'h', _, _, _, _, _, _, _, 'h', _, _, _, _, _, _, _, 'h', _, _, _, _, _, _, _, 'h', _, _, 'h'],
  },
  day: {
    bpm: 116, root: 60,
    lead: [0, 4, 7, _, 9, 7, 4, _, 5, 4, 2, _, 4, _, _, _, 0, 4, 7, _, 12, 11, 9, _, 7, 5, 4, 2, 0, _, _, _],
    bass: [-12, _, -5, _, -12, _, -5, _, -7, _, -3, _, -8, _, -5, _, -12, _, -5, _, -3, _, -7, _, -5, _, -8, _, -12, _, _, _],
    perc: ['k', _, 'h', _, 's', _, 'h', _, 'k', _, 'h', 'k', 's', _, 'h', _, 'k', _, 'h', _, 's', _, 'h', _, 'k', 'k', 'h', _, 's', _, 'h', 'h'],
  },
  night: {
    bpm: 128, root: 57,
    lead: [0, _, _, 3, _, _, 7, _, 8, _, 7, _, 3, _, 2, _, 0, _, _, 3, _, _, 7, _, 10, _, 8, 7, 5, _, 3, 2],
    bass: [-12, -12, _, -12, -12, _, -12, _, -16, -16, _, -16, -14, _, -14, _, -12, -12, _, -12, -12, _, -12, _, -9, -9, _, -9, -10, _, -10, _],
    perc: ['k', _, _, 'h', 'k', _, 'h', _, 'k', _, _, 'h', 's', _, 'h', _, 'k', _, _, 'h', 'k', _, 'h', _, 'k', _, 'k', 'h', 's', 'h', 's', 's'],
  },
  boss: {
    bpm: 152, root: 55,
    lead: [0, 3, 7, 3, 8, 7, 3, 2, 0, 3, 7, 10, 12, 10, 8, 7, 0, 3, 7, 3, 8, 7, 3, 2, 12, 11, 10, 8, 7, 5, 3, 2],
    bass: [-12, -12, -12, -12, -9, -9, -9, -9, -16, -16, -16, -16, -14, -14, -14, -14, -12, -12, -12, -12, -9, -9, -9, -9, -7, -7, -7, -7, -5, -5, -6, -6],
    perc: ['k', 'h', 's', 'h', 'k', 'h', 's', 'h', 'k', 'h', 's', 'h', 'k', 'k', 's', 's', 'k', 'h', 's', 'h', 'k', 'h', 's', 'h', 'k', 'h', 's', 'h', 'k', 's', 's', 's'],
  },
  victory: {
    bpm: 132, root: 60,
    lead: [0, 4, 7, 12, _, 12, _, 12, 14, 12, 11, 12, 16, _, _, _, 12, 16, 19, 24, _, 19, _, 16, 17, 16, 14, 12, 12, _, _, _],
    bass: [-12, _, -12, _, -5, _, -5, _, -7, _, -7, _, -12, -12, -12, -12, -8, _, -8, _, -5, _, -5, _, -7, _, -7, _, -12, _, -12, _],
    perc: ['k', _, 'k', _, 's', _, 'h', _, 'k', 'h', 'k', 'h', 's', 's', 's', 's', 'k', _, 'k', _, 's', _, 'h', _, 'k', 'h', 'k', 'h', 's', 's', 's', 's'],
  },
};

const MUTE_KEY = 'mine3d:muted';
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class Audio {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null;
  private mus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;
  private theme: Theme | null = null;
  private wanted: Theme | null = null;
  private step = 0;
  private nextAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      /* storage unavailable */
    }
  }

  /** Call from a user gesture. */
  unlock(): void {
    if (!this.ctx) {
      const W = window as typeof window & { webkitAudioContext?: typeof AudioContext };
      const C = W.AudioContext ?? W.webkitAudioContext;
      if (!C) return;
      this.ctx = new C();
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = this.muted ? 0 : 0.32;
      this.sfx.connect(this.ctx.destination);
      this.mus = this.ctx.createGain();
      this.mus.gain.value = this.muted ? 0 : 0.11;
      this.mus.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.wanted && this.wanted !== this.theme) this.music(this.wanted);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (this.sfx) this.sfx.gain.value = this.muted ? 0 : 0.32;
    if (this.mus) this.mus.gain.value = this.muted ? 0 : 0.11;
    return this.muted;
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, gain = 0.3, delay = 0, out?: GainNode | null): void {
    const ctx = this.ctx;
    const dest = out ?? this.sfx;
    if (!ctx || !dest || this.muted) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  private noise(dur: number, gain: number, freq: number, type: BiquadFilterType = 'highpass', delay = 0, out?: GainNode | null, at?: number): void {
    const ctx = this.ctx;
    const dest = out ?? this.sfx;
    if (!ctx || !dest || !this.noiseBuf || this.muted) return;
    const t = at ?? ctx.currentTime + delay;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }

  // ── sound effects ──
  swing() { this.noise(0.09, 0.12, 2500, 'bandpass'); }
  chop() { this.tone('square', 220, 120, 0.05, 0.14); this.noise(0.05, 0.15, 900, 'bandpass'); }
  clink() { this.tone('square', 1300, 900, 0.05, 0.12); this.noise(0.04, 0.12, 4000); }
  clank() { this.tone('square', 180, 160, 0.12, 0.2); this.tone('square', 90, 80, 0.12, 0.15); }
  breakBlock() { this.tone('triangle', 420, 110, 0.16, 0.26); this.noise(0.18, 0.25, 500, 'lowpass'); }
  place() { this.tone('triangle', 520, 520, 0.05, 0.22); this.tone('sine', 780, 780, 0.07, 0.14, 0.04); }
  hit() { this.tone('sawtooth', 200, 90, 0.1, 0.2); this.noise(0.06, 0.2, 1400, 'bandpass'); }
  zombieDie() { this.tone('sawtooth', 260, 50, 0.35, 0.22); this.noise(0.25, 0.2, 700, 'lowpass'); }
  groan() { this.tone('sawtooth', 110 + Math.random() * 40, 80, 0.5, 0.08); }
  hurt() { this.tone('triangle', 480, 220, 0.2, 0.35); this.noise(0.08, 0.15, 800, 'lowpass'); }
  pickup() { this.tone('triangle', 880 + Math.random() * 80, 1320, 0.06, 0.12); }
  arrow() { this.tone('sine', 1100, 300, 0.08, 0.14); this.noise(0.05, 0.08, 3500); }
  fuse() { this.noise(0.9, 0.05, 5000); }
  boom() {
    this.tone('sine', 140, 30, 0.7, 0.6);
    this.noise(0.9, 0.55, 900, 'lowpass');
    this.noise(0.3, 0.3, 3000, 'bandpass');
  }
  thunder() { this.noise(1.6, 0.6, 400, 'lowpass'); this.tone('sine', 70, 30, 1.2, 0.4); this.noise(0.15, 0.4, 5000, 'highpass'); }
  whoosh() { this.noise(0.8, 0.2, 1200, 'bandpass'); }
  bark() { this.tone('square', 520, 300, 0.07, 0.18); this.tone('square', 560, 320, 0.07, 0.16, 0.12); }
  cluck() { this.tone('square', 900, 1300, 0.05, 0.12); this.tone('square', 700, 500, 0.08, 0.1, 0.07); }
  upgrade() { [523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.14, 0.28, i * 0.09)); }
  coin() { this.tone('square', 988, 988, 0.06, 0.14); this.tone('square', 1318, 1318, 0.18, 0.14, 0.06); }
  denied() { this.tone('square', 200, 150, 0.12, 0.15); }
  roar() { this.tone('sawtooth', 130, 45, 1.1, 0.45); this.noise(0.9, 0.3, 300, 'lowpass'); this.tone('square', 65, 40, 1.0, 0.25); }
  stomp() { this.tone('sine', 90, 35, 0.35, 0.5); this.noise(0.3, 0.3, 250, 'lowpass'); }
  gong() { this.tone('sine', 196, 180, 1.8, 0.35); this.tone('sine', 392, 370, 1.4, 0.12); this.tone('triangle', 98, 96, 2, 0.2); }
  dawn() { [392, 523, 659, 784].forEach((f, i) => this.tone('sine', f, f, 0.35, 0.22, i * 0.12)); }
  card() { this.tone('triangle', 330, 660, 0.25, 0.2); this.noise(0.25, 0.1, 2000, 'bandpass'); }
  fanfare() { [523, 523, 523, 659, 784, 659, 784, 1046].forEach((f, i) => this.tone('square', f, f, 0.16, 0.18, i * 0.13)); }

  // ── music ──
  music(theme: Theme): void {
    this.wanted = theme;
    const ctx = this.ctx;
    if (!ctx || !this.mus) return;
    if (this.theme === theme) return;
    this.theme = theme;
    this.step = 0;
    this.nextAt = ctx.currentTime + 0.3;
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 200);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.theme || this.muted) return;
    const p = THEMES[this.theme];
    const dur = 60 / p.bpm / 4;
    if (this.nextAt < ctx.currentTime - 0.5) this.nextAt = ctx.currentTime + 0.05;
    while (this.nextAt < ctx.currentTime + 0.8) {
      const i = this.step % p.lead.length;
      const at = this.nextAt - ctx.currentTime;
      const l = p.lead[i];
      if (l !== null) this.tone('square', mtof(p.root + 12 + l), mtof(p.root + 12 + l), dur * 0.85, 0.12, at, this.mus);
      const b = p.bass[i];
      if (b !== null) this.tone('triangle', mtof(p.root + b), mtof(p.root + b), dur * 0.95, 0.3, at, this.mus);
      const k = p.perc[i];
      if (k === 'k') this.tone('sine', 140, 40, 0.1, 0.45, at, this.mus);
      else if (k === 'h') this.noise(0.03, 0.06, 7000, 'highpass', 0, this.mus, this.nextAt);
      else if (k === 's') this.noise(0.08, 0.1, 1800, 'bandpass', 0, this.mus, this.nextAt);
      this.step++;
      this.nextAt += dur;
    }
  }
}

export const audio = new Audio();
