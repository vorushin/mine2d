# mine2d II: The Deep Dark — Rewrite Design Spec

**Date:** 2026-07-10
**Status:** Approved
**Extends:** `2026-04-21-mine2d-design.md`, `2026-04-23-dynamic-map-and-tech-tree-design.md`

## Overview

A surprise "sequel" rewrite of mine2d for Robert. The game keeps its core loop
(mine by day, survive the night) but gains four pillars that make it feel
completely new:

1. **The Deep Dark** — a real underground: cave floors below the surface with
   darkness, new ores, new monsters, and treasure.
2. **An ending** — mechanically distinct bosses culminating in the Zombie King
   fight and a victory screen with credits. The game becomes beatable.
3. **A tomorrow** — meta-progression (Star Coins → companions, classes, world
   modifiers) so every death unlocks something.
4. **Atmosphere** — procedural chiptune music and dynamic lighting.

Delivered as a series of twists (0–7), each independently shippable; the game
stays playable and tests stay green after every phase.

## Goals & non-goals

**Goals**
- Feels like a brand-new game within the first minute (music + lighting + title).
- Every day poses a real choice: fortify, raid a graveyard, or descend.
- Beatable: Zombie King fight gated by boss-soul Crystal Key; credits + Endless+.
- Death always earns Star Coins toward permanent unlocks.
- Mobile-first parity for every new interaction (tap = the primary input).
- All new game logic is pure-testable (Vitest), same as existing systems.

**Non-goals**
- Multiplayer, server backends, external asset packs (art/audio stay procedural).
- Infinite cave depth (exactly 3 floors + throne room).
- Hunger/food survival mechanics.

## Twist 0 — Lights & Music (S)

**Music.** `MusicEngine` in `src/systems/Music.ts`: a WebAudio step-sequencer
(square/triangle leads, noise percussion) playing generated loop patterns.
Themes: `day` (calm major), `night` (tense minor), `boss` (driving), `caves`
(sparse ambient), `victory` (fanfare). Crossfades on phase change. Mute toggle
persisted in localStorage, exposed in the overflow menu. No audio assets.

**Lighting.** `LightingSystem` in `src/systems/Lighting.ts`: a screen-sized
darkness `RenderTexture` (scrollFactor 0) drawn each frame: fill with darkness
level (0 by day, ~0.78 at night on the surface, ~0.94 in caves), then ERASE
radial-gradient light sprites at each light source in view (player aura, torch,
campfire, lava, volcano, turret muzzle flashes optional). Replaces the flat
night overlay; blood-moon tint stays as a separate overlay.

## Twist 1 — The Deep Dark (L)

**Layered worlds.** `GameState.depth: 0 | 1 | 2 | 3` (0 = surface). A run owns
one surface world + caves generated lazily on first descent, all persisted.
`World` renders the active layer only; switching layers rebuilds tile sprites
(<100 ms for 100×100; caves are 60×60).

**Cave generation** (`src/world/generateCave.ts`, pure, seeded): random-walk
carver over solid rock producing corridors and chambers. Contents per floor:
- Floor 1: coal-ish `CaveRock`, iron, some gold, bats + cave spiders.
- Floor 2: + **crystal** ore, lava pools, skeleton miners.
- Floor 3: + **obsidian**, dense danger, the sealed **Throne Gate**.
- All floors: torch-lit **treasure vaults** (loot chests ringed by rock),
  a ladder-up tile at the entry point, one ladder-down (floors 1–2).

**Traversal.** `CaveEntrance` tiles seeded in the surface rocky biome (plus a
guaranteed one within ~20 tiles of spawn). Interact (E / tap Interact) on an
entrance/ladder to change depth. Rex + active companion come along; chickens
stay on the surface.

**Cave monsters** (reuse `Zombie` engine with new specs + textures):
- **Bat** — fast, weak, erratic flutter, ignores wall-attack behavior.
- **Cave spider** — quick, lays brief slow-webs on floor tiles it crosses.
- **Skeleton miner** — medium, throws bone projectiles (first ranged enemy).
Caves have ambient spawns day and night (denser at night and deeper). While the
player is underground at night, surface sieges don't spawn (the horde is *in*
the caves); score still counts nights survived.

**New materials & tech.** `crystal`, `obsidian` materials. Recipes: Crystal
Pickaxe (tier 3, fastest), Crystal Sword (tier 2 melee), Obsidian Wall (top HP
wall), plus Twist 7 wands. Mining crystal requires iron pickaxe; obsidian
requires crystal pickaxe.

## Twist 2 — Bosses with brains (M)

Blood-moon (every 5th night) bosses become a rotation with signature mechanics,
each with an intro banner + tip:
- **Necromancer** (night 5): channels visibly and re-raises fallen zombies from
  where they died until interrupted (damage taken breaks the channel).
- **Spider Queen** (night 10): drops slow-webs, periodically births spiderlings.
- **Stone Golem** (night 15): near-immune to arrows/bullets (1 dmg); takes full
  damage from melee, bombs, lava, spikes — a "use your tools" check.
Rotation repeats scaled after night 15. Each boss drops a **Boss Soul** plus
regular boss loot.

## Twist 3 — The Zombie King & the ending (L)

- **Crystal Key** recipe: 2 Boss Souls + 3 crystal → key item.
- **Throne room** on floor 3: a sealed arena; the gate opens only with the key.
- **Zombie King fight**, 3 phases: (1) melee + summons waves of minions,
  (2) below 50% HP enrages — faster, smashes tiles in his path,
  (3) below 25% — desperate summon + speed surge. Big HP bar UI.
- **Victory:** fireworks + cake rain + `CreditsScene` ("A game made for Robert"
  + run stats), `state.victory = true`, big Star Coin bonus, and **Endless+**
  continues the run with harder scaling for players who keep going.
- Score line becomes "beat the game on night N" when victorious.

## Twist 4 — Graveyard Raids (M)

2–3 graveyards seeded on the surface (gravestone tiles around a high-HP **Crypt**
core). Each intact graveyard adds +25% to the night's zombie target (shown in
the night banner). By day each is defended by a few resident zombies that don't
despawn at dawn. Destroying the crypt neutralizes it permanently: loot burst +
Star Coins + banner. Minimap marks graveyards (skull dots) until destroyed.

## Twist 5 — Friends Forever (M)

Refactor `Dog` into a `Companion` framework (shared movement/HP/level chassis,
pluggable behavior). Rex always joins. One unlockable buddy may be chosen at
run start (New Run screen):
- **Whiskers** (cat) — every ~90 s sniffs out buried treasure: reveals a dig
  spot nearby that yields loot when mined.
- **Ember** (baby dragon) — hovers, spits small fireballs at nearby enemies.
- **Bolt** (robo-pup) — slowly auto-repairs damaged player structures nearby.
Companions are pettable (of course), revive at dawn, and persist in saves.

## Twist 6 — The Hero's Hut (M)

**Star Coins** earned every run: `nights·2 + bosses·5 + maxDepth·3 + victory·25
+ graveyards·2`. Persisted meta store (`MetaStore`, localStorage, versioned).

**Hero's Hut screen** (from the menu): spend coins on permanent unlocks —
- **Companions:** Whiskers (30), Ember (60), Bolt (90).
- **Classes** (pick one per run): Knight (+melee, starts iron sword), Ranger
  (starts bow + 20 arrows, +bow damage), Engineer (starts turret kit + hammer),
  Miner (mines 2× fast, starts stone pickaxe). 40 coins each; Adventurer free.
- **World modifiers** (optional per run): Winter World (frozen walkable lake,
  slower-but-tougher ice zombies), Island World (archipelago map), Lava World
  (more volcanoes/lava, more gold). 50 coins each.
**Menu v2:** rebrand to *MINE2D II: THE DEEP DARK*, show coins, class/companion
/modifier pickers on New Run, credits replay button after first victory.

## Twist 7 — Wonder & Chaos pack (S each)

Priority order (implement top-down as time allows):
1. **Chicken Army** — pet a chicken to recruit it (max 3); they follow and peck
   enemies for chip damage. Golden chicken still pays gold.
2. **Wands** (crystal tech): Freeze Wand (AoE slow burst), Storm Wand (chain
   lightning between enemies). Crafted at bench; consume no ammo, cooldown-based.
3. **Treasure maps** — goblins sometimes drop one; an ✕ appears on the minimap;
   dig (mine) the spot for a loot cache.
4. **Fishing** — craft a rod; tap water to cast; a timed "!" bite → tap to reel:
   fish (heal), gold, or rare treasure. Calm counterpoint to the combat loop.
5. **New night twists:** Fog Night (short sight, denser darkness), Meteor Night
   (meteors fall during the night), Frost Night (slow tough enemies).
6. **Rideable pig** — saddle a pig for +60% speed, dismount to fight (stretch).
7. **Trader caravan** — rare daytime wandering NPC with 3 exotic offers (stretch).

## Architecture & refactoring

`GameScene.ts` (1,464 lines) is split as twists land — each extraction keeps
behavior identical:
- `systems/SpawnDirector.ts` — night targets, pacing, variant rolls, boss
  scheduling, cave ambient spawns, graveyard contributions.
- `systems/LootTables.ts` — kill/boss/crate/vault drop rolls (pure).
- `systems/Lighting.ts`, `systems/Music.ts` — Twist 0.
- `systems/MetaStore.ts` — Star Coins + unlocks (pure logic + storage wrapper).
- `entities/Companion.ts` — chassis; `Dog` becomes Rex behavior.
- `world/generateCave.ts` — cave floors (pure, seeded).
- `scenes/CreditsScene.ts` — victory credits.
GameScene keeps: orchestration, input wiring, per-frame update order.

**Save/load:** every new field (depth, cave layers, graveyards, companions,
souls/key, victory, recruited chickens) joins the snapshot with best-effort
deserialization defaults, same pattern as today. Meta store is separate from
run saves. Old saves load: missing fields default (depth 0, no caves yet).

**Testing:** pure logic tested per module (cave gen determinism + connectivity,
boss rotation/phases, star-coin math, unlock gating, graveyard night-target
math, wand cooldowns, chicken recruitment caps, class kits, save round-trip
with new fields). Rendering/feel verified by manual playtest + dev build.

## Error handling & edge cases

- Descend blocked if save is mid-write; ladders always spawn on walkable tiles.
- Player dies underground → normal game over (no corpse run; kid-friendly).
- Old save without caves: caves generate on next descent from run seed.
- Boss souls cap at what recipes need; key craft idempotent (`hasCrystalKey`).
- Necromancer can't re-raise a zombie more than once (flag on death record).
- Graveyard crypts excluded from meteor destruction (must be earned) but not
  from the player's bombs.
- localStorage full/unavailable: MetaStore no-ops silently like SaveStore.
- All new tap targets ≥ 40 px on touch; interact button covers ladders/rod/etc.

## Out of scope

Multiplayer, cloud saves, leaderboards, seasonal events, photo mode, custom
art/audio assets, infinite depth, procedural quests beyond the daily system.
