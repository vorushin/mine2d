import { sounds } from './Sound';

/**
 * Procedural chiptune background music. No audio files — a tiny WebAudio
 * step-sequencer plays hand-authored 16-step loops (square lead, triangle
 * bass, noise percussion). Shares the SoundManager's AudioContext, which is
 * unlocked on the first user gesture.
 */

export type ThemeId = 'menu' | 'day' | 'night' | 'boss' | 'caves' | 'victory';
export const THEME_IDS: ThemeId[] = ['menu', 'day', 'night', 'boss', 'caves', 'victory'];

export type PercHit = 'k' | 'h' | 's' | null;

export interface ThemePattern {
  bpm: number;
  /** MIDI note of the tonal center for the lead voice. */
  root: number;
  /** Pitch classes (0-11) of the theme's scale — for tests/sanity. */
  scale: number[];
  /** Semitone offsets from root; null = rest. 16 steps. */
  lead: (number | null)[];
  bass: (number | null)[];
  perc: PercHit[];
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const PENT_MINOR = [0, 3, 5, 7, 10];

const _ = null;

const THEMES: Record<ThemeId, ThemePattern> = {
  menu: {
    bpm: 96, root: 60, scale: MAJOR,
    lead: [0, _, 4, _, 7, _, 4, _, 9, _, 7, _, 4, _, 2, _],
    bass: [-12, _, _, _, -7, _, _, _, -5, _, _, _, -7, _, _, _],
    perc: [_, _, _, _, 'h', _, _, _, _, _, _, _, 'h', _, _, _],
  },
  day: {
    bpm: 112, root: 60, scale: MAJOR,
    lead: [0, 4, 7, 4, 9, 7, 4, 2, 0, 4, 7, 12, 9, 7, 4, 2],
    bass: [-12, _, -5, _, -7, _, -5, _, -12, _, -5, _, -7, -7, -5, _],
    perc: ['k', _, 'h', _, 's', _, 'h', _, 'k', _, 'h', 'k', 's', _, 'h', 'h'],
  },
  night: {
    bpm: 124, root: 57, scale: MINOR,
    lead: [0, _, _, 3, _, _, 2, _, 0, _, _, 3, 5, _, 3, 2],
    bass: [-12, -12, _, -12, -12, -12, _, -12, -14, -14, _, -14, -9, -9, _, -9],
    perc: ['k', _, _, 'h', 'k', _, 'h', _, 'k', _, _, 'h', 'k', 'h', _, 's'],
  },
  boss: {
    bpm: 150, root: 55, scale: MINOR,
    lead: [0, 3, 5, 3, 7, 5, 3, 2, 0, 3, 5, 7, 8, 7, 5, 3],
    bass: [-12, -12, -12, -12, -9, -9, -9, -9, -12, -12, -12, -12, -5, -5, -4, -4],
    perc: ['k', 'h', 's', 'h', 'k', 'h', 's', 'h', 'k', 'h', 's', 'h', 'k', 'k', 's', 's'],
  },
  caves: {
    bpm: 70, root: 50, scale: PENT_MINOR,
    lead: [0, _, _, _, 7, _, _, _, 5, _, _, 3, _, _, 10, _],
    bass: [-12, _, _, _, _, _, _, _, -5, _, _, _, _, _, _, _],
    perc: [_, _, _, _, _, _, _, _, _, _, _, _, 'h', _, _, _],
  },
  victory: {
    bpm: 132, root: 60, scale: MAJOR,
    lead: [0, 4, 7, 12, _, 12, _, 12, 14, 12, 11, 12, 16, _, _, _],
    bass: [-12, _, -12, _, -5, _, -5, _, -7, _, -7, _, -12, -12, -12, -12],
    perc: ['k', _, 'k', _, 's', _, 'h', _, 'k', 'h', 'k', 'h', 's', 's', 's', 's'],
  },
};

export function buildTheme(id: ThemeId): ThemePattern {
  const t = THEMES[id];
  return { ...t, lead: [...t.lead], bass: [...t.bass], perc: [...t.perc], scale: [...t.scale] };
}

const MUTE_KEY = 'mine2d:muted';
const LOOKAHEAD_S = 1.2;
const TICK_MS = 300;

function midiFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class MusicEngine {
  private gain: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private theme: ThemeId | null = null;
  private pattern: ThemePattern | null = null;
  private step = 0;
  private nextStepTime = 0;
  private _muted = false;
  private volume = 0.16;

  constructor() {
    try {
      this._muted = localStorage.getItem(MUTE_KEY) === '1';
      sounds.muted = this._muted;
    } catch { /* storage unavailable — stay unmuted */ }
  }

  get muted(): boolean { return this._muted; }

  /** Mutes/unmutes music AND sound effects, persisted across sessions. */
  setMuted(m: boolean): void {
    this._muted = m;
    sounds.muted = m;
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* ignore */ }
    if (this.gain) {
      const ctx = sounds.ensure();
      if (ctx) this.gain.gain.linearRampToValueAtTime(m ? 0 : this.volume, ctx.currentTime + 0.2);
    }
  }

  toggleMuted(): boolean {
    this.setMuted(!this._muted);
    return this._muted;
  }

  private desired: ThemeId | null = null;

  setTheme(id: ThemeId): void {
    this.desired = id;
    this.tryStart();
  }

  /** Call after any user gesture — (re)starts music if audio was locked earlier. */
  poke(): void {
    this.tryStart();
  }

  private tryStart(): void {
    const id = this.desired;
    if (!id) return;
    if (this.theme === id && this.pattern) return;
    const ctx = sounds.ensure();
    if (!ctx) return; // audio not unlocked yet; poke() retries on the next gesture
    this.theme = id;
    if (!this.gain) {
      this.gain = ctx.createGain();
      this.gain.gain.value = this._muted ? 0 : this.volume;
      this.gain.connect(ctx.destination);
    }
    // Quick dip-and-swap: fade out, switch pattern, fade back in.
    const g = this.gain.gain;
    const now = ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0.0001, now + 0.35);
    if (!this._muted) g.linearRampToValueAtTime(this.volume, now + 0.9);
    this.pattern = buildTheme(id);
    this.step = 0;
    this.nextStepTime = now + 0.4;
    if (!this.timer) {
      this.timer = setInterval(() => this.schedule(), TICK_MS);
      this.schedule();
    }
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.theme = null;
    this.pattern = null;
  }

  private schedule(): void {
    const ctx = sounds.ensure();
    if (!ctx || !this.pattern || !this.gain) return;
    const stepDur = 60 / this.pattern.bpm / 4; // 16th notes
    while (this.nextStepTime < ctx.currentTime + LOOKAHEAD_S) {
      if (this.nextStepTime >= ctx.currentTime - 0.05) {
        this.playStep(ctx, this.pattern, this.step % 16, this.nextStepTime, stepDur);
      }
      this.step += 1;
      this.nextStepTime += stepDur;
    }
  }

  private playStep(ctx: AudioContext, p: ThemePattern, i: number, at: number, stepDur: number): void {
    if (this._muted) return;
    const lead = p.lead[i];
    if (lead !== null) this.voice(ctx, 'square', midiFreq(p.root + 12 + lead), at, stepDur * 0.9, 0.16);
    const bass = p.bass[i];
    if (bass !== null) this.voice(ctx, 'triangle', midiFreq(p.root - 12 + bass), at, stepDur * 0.95, 0.3);
    const perc = p.perc[i];
    if (perc === 'k') this.kick(ctx, at);
    else if (perc === 'h') this.noiseHit(ctx, at, 0.03, 0.05, 6000);
    else if (perc === 's') this.noiseHit(ctx, at, 0.07, 0.09, 1500);
  }

  private voice(ctx: AudioContext, type: OscillatorType, freq: number, at: number, dur: number, gain: number): void {
    if (!this.gain) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(this.gain);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  private kick(ctx: AudioContext, at: number): void {
    if (!this.gain) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, at);
    osc.frequency.exponentialRampToValueAtTime(40, at + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
    osc.connect(g).connect(this.gain);
    osc.start(at);
    osc.stop(at + 0.15);
  }

  private noiseHit(ctx: AudioContext, at: number, dur: number, gain: number, highpass: number): void {
    if (!this.gain) return;
    const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let j = 0; j < data.length; j++) data[j] = (Math.random() * 2 - 1) * (1 - j / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = highpass;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(this.gain);
    src.start(at);
    src.stop(at + dur + 0.05);
  }
}

export const music = new MusicEngine();
