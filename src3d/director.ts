import { TOTAL_NIGHTS } from './config';
import { Rng } from './rng';

// The story director: what each night and each day has in store.

export type ZType = 'walker' | 'runner' | 'brute' | 'boomer' | 'ghost' | 'giant' | 'king';

export interface ZStats {
  hp: number;
  speed: number; // tiles / s
  damage: number; // per bite (player)
  wallDamage: number; // per bite (blocks)
  scale: number;
  color: number;
  /** Passes through walls. */
  ghost?: boolean;
  /** Explodes on contact. */
  explodes?: boolean;
}

export const ZSTATS: Record<ZType, ZStats> = {
  walker: { hp: 10, speed: 1.6, damage: 6, wallDamage: 5, scale: 1, color: 0x5a9e4b },
  runner: { hp: 6, speed: 3.1, damage: 5, wallDamage: 3, scale: 0.8, color: 0x9ccf4a },
  brute: { hp: 42, speed: 1.15, damage: 16, wallDamage: 16, scale: 1.35, color: 0x3f6e3a },
  boomer: { hp: 8, speed: 1.7, damage: 28, wallDamage: 70, scale: 1.05, color: 0x7bff6a, explodes: true },
  ghost: { hp: 6, speed: 1.2, damage: 8, wallDamage: 0, scale: 1, color: 0xcfe8ff, ghost: true },
  giant: { hp: 180, speed: 0.95, damage: 20, wallDamage: 60, scale: 2.6, color: 0x4d7f45 },
  king: { hp: 480, speed: 1.1, damage: 26, wallDamage: 80, scale: 3.1, color: 0x6a4c9c },
};

export type NightCardId =
  | 'first' | 'runners' | 'boomers' | 'giant' | 'fog' | 'meteors' | 'ghosts' | 'lucky' | 'storm' | 'king';

export interface NightCard {
  id: NightCardId;
  title: string;
  emoji: string;
  text: string;
  good?: boolean;
}

export const NIGHT_CARDS: Record<NightCardId, NightCard> = {
  first: { id: 'first', emoji: '🌙', title: 'The First Night', text: 'They crawl out of the sea. Stay near your torches.' },
  runners: { id: 'runners', emoji: '💨', title: 'Night of Runners', text: 'Small, fast and hungry. Walls buy you time.' },
  boomers: { id: 'boomers', emoji: '💥', title: 'Boomer Night', text: 'Glowing zombies explode on touch. Hit them from afar!' },
  giant: { id: 'giant', emoji: '🗿', title: 'The Giant Wakes', text: 'The ground shakes. Something huge is coming…' },
  fog: { id: 'fog', emoji: '🌫️', title: 'Fog Night', text: 'You can barely see. Watch for glowing eyes.' },
  meteors: { id: 'meteors', emoji: '☄️', title: 'Meteor Shower', text: 'Stars are falling! Dodge the red circles — they leave iron.' },
  ghosts: { id: 'ghosts', emoji: '👻', title: 'Ghost Night', text: 'Ghosts float through walls. One good hit and they are gone.' },
  lucky: { id: 'lucky', emoji: '🍀', title: 'Lucky Moon', text: 'Fewer zombies tonight — and they carry gold!', good: true },
  storm: { id: 'storm', emoji: '⛈️', title: 'Thunderstorm', text: 'Lightning strikes the horde… and sometimes you. Keep moving!' },
  king: { id: 'king', emoji: '👑', title: 'The Zombie King', text: 'The moon turns red. The King rises from the sea. This is it!' },
};

const RANDOM_CARDS: NightCardId[] = ['runners', 'boomers', 'fog', 'meteors', 'ghosts', 'lucky', 'storm'];

export type DayEventId = 'dog' | 'meteor' | 'treasure' | 'merchant' | 'chickens' | 'earthquake';

export interface DayEvent {
  id: DayEventId;
  title: string;
  emoji: string;
  text: string;
}

export const DAY_EVENTS: Record<DayEventId, DayEvent> = {
  dog: { id: 'dog', emoji: '🐶', title: 'A lost dog!', text: 'Rex followed the smell of your campfire. He bites zombies!' },
  meteor: { id: 'meteor', emoji: '☄️', title: 'Something fell from the sky!', text: 'A meteor crashed on the island. Crystals inside!' },
  treasure: { id: 'treasure', emoji: '🧰', title: 'Treasure washed ashore!', text: 'Follow the golden beam to the beach.' },
  merchant: { id: 'merchant', emoji: '🎈', title: 'A merchant balloon lands!', text: 'Trade your gold for goodies. It leaves at dusk.' },
  chickens: { id: 'chickens', emoji: '🐔', title: 'It is raining chickens!', text: 'Catch them for health and gold!' },
  earthquake: { id: 'earthquake', emoji: '🌋', title: 'Earthquake!', text: 'New ore burst out of the ground. Go look!' },
};

export interface RunPlan {
  /** cards[n-1] is night n. */
  cards: NightCardId[];
  /** days[n-1] is the surprise of day n (day 1 has none). */
  days: (DayEventId | null)[];
}

export function planRun(seed: number): RunPlan {
  const rng = new Rng(seed ^ 0x5eed);
  const pool = rng.shuffle([...RANDOM_CARDS]).slice(0, 4);
  // The Giant always shows up on night 4 or 5; nights 2–6 are otherwise random.
  const middle = [...pool];
  middle.splice(rng.int(2, 3), 0, 'giant');
  const cards: NightCardId[] = ['first', ...middle, 'king'];

  const later = rng.shuffle<DayEventId>(['treasure', 'merchant', 'chickens', 'earthquake']);
  const days: (DayEventId | null)[] = [null, 'dog', 'meteor', ...later];
  return { cards, days };
}

/** Card for any night, including endless nights after the King. */
export function cardFor(plan: RunPlan, night: number, rng: Rng): NightCardId {
  if (night <= TOTAL_NIGHTS) return plan.cards[night - 1];
  return rng.pick([...RANDOM_CARDS, 'giant']);
}

export function dayEventFor(plan: RunPlan, day: number, rng: Rng): DayEventId | null {
  if (day <= plan.days.length) return plan.days[day - 1];
  return rng.pick<DayEventId>(['meteor', 'treasure', 'merchant', 'chickens', 'earthquake']);
}

/** The list of zombies to spawn over a night, in order. */
export function nightSpawns(night: number, card: NightCardId, rng: Rng): ZType[] {
  let count = 5 + night * 3;
  if (card === 'lucky') count = Math.round(count * 0.7);
  if (card === 'storm') count = Math.round(count * 1.2);
  const out: ZType[] = [];
  for (let i = 0; i < count; i++) {
    const r = rng.next();
    let t: ZType = 'walker';
    if (card === 'runners' && r < 0.5) t = 'runner';
    else if (card === 'boomers' && r < 0.35) t = 'boomer';
    else if (card === 'ghosts' && r < 0.4) t = 'ghost';
    else if (night >= 2 && r < 0.6 && rng.chance(0.18)) t = 'runner';
    else if (night >= 3 && rng.chance(0.1 + night * 0.01)) t = 'brute';
    else if (night >= 5 && rng.chance(0.07)) t = 'boomer';
    out.push(t);
  }
  if (card === 'giant') out.splice(Math.floor(out.length * 0.4), 0, 'giant');
  if (card === 'king') {
    out.splice(3, 0, 'king');
  }
  if (night > TOTAL_NIGHTS) {
    const extraGiants = Math.floor((night - TOTAL_NIGHTS) / 2);
    for (let g = 0; g < extraGiants; g++) out.push('giant');
  }
  return out;
}

/** How long the horde takes to arrive, in seconds. */
export function spawnWindow(night: number): number {
  return Math.min(55, 28 + night * 4);
}

/** HP multiplier for endless nights. */
export function hpScale(night: number): number {
  return night <= TOTAL_NIGHTS ? 1 + (night - 1) * 0.06 : 1.4 + (night - TOTAL_NIGHTS) * 0.15;
}
