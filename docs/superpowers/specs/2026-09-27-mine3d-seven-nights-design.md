# MINE3D: Seven Nights — Design Spec

**Date:** 2026-09-27
**Status:** Approved (autonomous build)
**Replaces as main game:** mine2d II: The Deep Dark (kept at `/classic.html`)

## Why a new version

mine2d grew to ~14k lines and ~40 systems (caves, 3 bosses + King, classes,
companions, wands, fishing, chicken army, star coins, treasure maps, quests,
power orbs…). Each was fun alone; together the game is hard to read and the
core loop — *mine by day, survive the night* — drowns in menus.

MINE3D keeps the loop, drops the clutter, and spends the budget on **feel**
(3D voxel world, real day/night light, juicy hits and explosions) and on
**surprise** (a hand-crafted 7-night story with random twists every day and
night).

## Pillars

1. **One tool, four builds.** A single pickaxe mines *and* fights. Four
   buildables: Wall, Torch, Turret, TNT. Upgrading the pickaxe is one button.
2. **A goal you can reach.** Survive 7 nights. Night 7 the Zombie King climbs
   out of the sea under a blood-red moon. Beat it → victory. (Endless after.)
3. **Every night is a surprise card.** At dusk a card flips: Runners, Boomers,
   The Giant, Fog, Meteor Shower, Ghosts, Lucky Moon, Thunderstorm…
4. **Every day has a surprise event.** Meteor crash (crystals!), treasure
   washed ashore, merchant balloon, chicken rain. Plus story beats: a lost dog
   (Rex) finds you after night 1; the moon grows bigger every night.
5. **Juice.** Voxel debris on every hit, zombies burst into cubes, TNT craters
   the island, hit-stop, screen shake, floating numbers, loot that flies to you.

## World

- 44×44 tile island surrounded by sea. Ground is flat for gameplay; blocks
  are 1-tile voxel cubes. Pixel-art canvas textures (NearestFilter).
- Blocks: Tree (wood), Rock (stone), Iron ore, Gold ore, Crystal (glows).
  Iron/gold need a stone pick; crystal needs an iron pick.
- Player builds: Wood/Stone Wall, Torch (light + burns zombies close by),
  Turret (auto-crossbow), TNT (explodes on zombie contact or when hit).

## Loop & numbers (tunable in `src3d/config.ts`)

- Day 150 s (button: "Bring the night"), night ~90 s, ends early when the
  horde is cleared. Dawn heals 50%.
- Pickaxe tiers: Wood → Stone (5 wood + 5 stone) → Iron (6 iron + 4 wood) →
  Crystal (3 crystal + 4 gold). Damage to blocks and zombies grows per tier.
- Zombies: Walker, Runner, Brute (breaks walls), Boomer (explodes), Ghost
  (walks through walls), Giant, King. Pathing: Dijkstra flow field from the
  player where walls are expensive-but-passable → zombies route around walls
  when they can and chew through them when they can't.

## Controls

- Desktop: WASD move; Space / left-click = swing (mine or hit); 1–4 pick a
  build, click a tile to place; Q/Esc/right-click = back to pickaxe; N = bring night.
- Touch: left joystick; big ⛏ button (auto-aims nearest zombie/block); tap a
  build slot then tap the ground to place.

## Architecture

`src3d/` — Three.js + DOM HUD. Pure, tested logic: `grid`, `worldgen`,
`flowfield`, `rules`, `director`. Rendering and entities sit on top.
Old game untouched in `src/`, served from `classic.html`.

## Out of scope

Caves, classes, meta-currency, save/resume of runs (runs are ~20 minutes),
crafting menus, multiplayer.
