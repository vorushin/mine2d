# mine2d — Design Spec

**Date:** 2026-04-21
**Status:** Approved for planning

## Overview

mine2d is a browser-based, mobile-friendly 2D survival game in the spirit of Minecraft. The player alternates between a building/mining **day** phase and a combat/defense **night** phase against zombies. Each play session is a single roguelike **run**: start with nothing, survive as long as possible, die and try again.

## Goals & Non-goals

**Goals**
- Playable in any modern browser on desktop and mobile (phone) via a URL.
- Tight gameplay loop: explore → mine → build → defend → repeat.
- Meaningful progression inside a single run (wood → stone → iron → pistols).
- Clean separation of subsystems so the codebase stays understandable as features grow.

**Non-goals (v1)**
- Multiplayer.
- Persistent save of in-progress runs (only best-score persists).
- Procedurally infinite world (map is bounded).
- Boss fights / finite win condition (run is endless survival).
- Meta-progression between runs (unlockables across sessions).

## Target platforms

- **Browser:** modern evergreen browsers (Chromium, Firefox, Safari) on desktop and mobile.
- **Input:** WASD + mouse on desktop; virtual joystick + tap-on-tile on touch devices.
- **Distribution:** static site (no backend). Deployable to any static host.

## Gameplay summary

### Session structure
- One run = one continuous game. Player dies → game over → new run with a freshly generated world.
- **Day length:** ~3 minutes. **Night length:** ~2 minutes. Player can trigger night early when ready.
- Difficulty ramps each night: more zombies, tougher variants over time.
- Endless survival. Score = nights survived. Best score stored in `localStorage`.
- Starting state: player spawns with a wooden pickaxe and no other items. No pre-built base.

### Day phase
- Player explores the bounded map (60×60 tiles).
- **Mine:** chop trees (wood), break stone, extract ore (iron, gold) using a pickaxe of sufficient tier.
- **Build:** place structures from the hotbar, consuming materials.
- **Trade:** find the shop NPC; buy items with gold or barter with raw materials.
- **Craft:** at a crafting bench, turn raw materials into tools, weapons, and advanced structures.

### Night phase
- Zombies spawn around the map edges and path toward the player.
- **Hybrid combat model:** walls slow/block zombies, but the player also fights (melee, bow, pistol) — especially through gaps or when walls are breached.
- Zombies attack walls/doors that block them, damaging them tile by tile. When a wall's HP reaches zero, it breaks.
- If player HP reaches zero → run ends.
- At dawn, remaining zombies despawn.

## Materials & progression

### Material tiers
| Material | Source | Notes |
|---|---|---|
| Wood | Trees | Basic tier. Weak walls, basic tools. |
| Stone | Stone tiles (wood+ pickaxe) | Mid tier. Stronger walls, better pickaxe. |
| Iron | Iron ore deposits (stone+ pickaxe) | High tier. Strong walls, sword, bow. |
| Gold | Rare ore deposits (iron pickaxe) | Currency for the shop. |
| Lava | Placeable from late-game resources (gated behind iron tier) | Defensive terrain — damages whatever stands on it (zombies or player). |

### Tools & weapons
- **Pickaxe:** wood → stone → iron (mine faster, unlock harder tiles).
- **Sword:** wood → iron (melee damage).
- **Bow + arrows:** iron tier (ranged).
- **Pistol + bullets:** late-run power spike (shop or gold-gated).

### Buildables
- **Wall** (wood / stone / iron) — blocks zombies; HP scales with tier.
- **Door** (wood / iron) — player passes through; zombies must break to enter.
- **Turret** (basic = arrows, advanced = bullets) — auto-fires at nearest zombie in range. **Endless ammo** (no supply management).
- **Torch** — light source.
- **Lava tile** — placeable defensive terrain.
- **Crafting bench** — required to craft advanced items.
- **Chest** — store extra materials beyond inventory.

### Shop
- NPC placed somewhere on the map at run start.
- Accepts **both gold and barter** (e.g., "3 gold = 1 arrow" OR "5 wood = 1 arrow").
- Sells: arrows, bullets, upgraded tools, health potions, special wall types, lava (late-tier unlock).

## Controls

### Desktop
- **Movement:** WASD
- **Tile interaction:** mouse click on a tile (mine/place with currently-selected hotbar slot)
- **Hotbar slot select:** number keys 1–8 or mouse wheel
- **Attack:** click in direction (melee swings, ranged shoots toward cursor)

### Mobile (touch)
- **Movement:** virtual joystick (left thumb)
- **Tile interaction:** tap on a world tile (mine/place)
- **Hotbar:** tap a slot in the bottom bar to select
- **Attack:** action button on right side; auto-targets nearest hostile in range

A single `Input` abstraction emits the same high-level events (`move`, `useHotbar`, `interactWith`) regardless of source.

## Art & assets

- **Style:** pixel art, top-down perspective, tile-grid.
- **Source:** Kenney.nl CC0 tilesets (e.g., RPG Urban / Topdown packs). No custom art commissioned for v1.
- **Tile size:** 32×32 (typical for Kenney top-down packs; confirm at asset-selection time).

## Technical architecture

### Stack
- **Language:** TypeScript (strict mode).
- **Engine:** Phaser 3.
- **Build/dev:** Vite (TypeScript, HMR, production bundling).
- **Tests:** Vitest.
- **Runtime:** static site. Served as plain files.

### Scenes (Phaser)
- `BootScene` — minimal bootstrap, splash.
- `PreloadScene` — asset loading with progress bar; surfaces load errors.
- `MenuScene` — title, "Start run" button, best-score display.
- `GameScene` — main gameplay. Runs in parallel with `UIScene`.
- `UIScene` — camera-independent HUD: hotbar, health bar, day/night clock, virtual joystick on mobile.
- `GameOverScene` — summary, "Try again" button.

### Subsystems (inside GameScene)
Each is a focused class with a small public API. Cross-system communication goes through a shared `GameState` (for reads) and Phaser's `EventEmitter` (for events).

- **World** — 60×60 tile grid. Procedurally generated on run start from a seed. Tiles are objects `{ type, hp }`. Exposes `getTileAt`, `damageTile`, `placeTile`, etc. Own module responsible for render-on-change.
- **Player** — position, velocity, health, inventory, equipped tool, hotbar. Handles mining (tile adjacent + tool tier check), placing (consume material, spawn tile), attacking.
- **Input** — unified keyboard/mouse + touch/joystick abstraction. Emits high-level intents.
- **Enemies** — zombie entities. Greedy-step pathing toward player with wall-detour fallback (no A* for v1). Zombie subtypes (fast, armored) plug into the same interface and are added as difficulty scales.
- **Projectiles** — one `Projectile` class parameterized by sprite/damage/speed/owner. Used by bow, pistol, turrets.
- **Turrets** — placed entities. On tick: nearest-zombie-in-range → spawn projectile. Endless ammo.
- **DayNightCycle** — state machine `DAY → DUSK → NIGHT → DAWN`. Emits `onNightStart`, `onDawn`. Owns difficulty scaling.
- **Shop** — NPC entity + interaction modal (launched as a UIScene overlay). Transaction logic handles gold and barter.
- **Crafting** — recipe table. Requires adjacent crafting bench. Pure function from (recipe, inventory) → (new inventory, crafted item).
- **SaveStore** — thin wrapper over `localStorage`. Only persists best score.

### Data flow — per-frame update order
1. `Input` reads state → emits intents.
2. `Player` consumes intents → updates velocity, fires actions.
3. `Enemies` tick AI.
4. `Projectiles` tick → resolve collisions/damage.
5. `Turrets` tick → target and fire.
6. `DayNightCycle` ticks clock → emits transition events.
7. `World` redraws dirty tiles only.
8. `UIScene` reads `GameState` → updates HUD.

### Shared state & events
- **`GameState`** — a plain TypeScript object passed into scenes. Holds references to player, world, time, night number, score. Subsystems read freely; only owners write.
- **Event bus** — Phaser's built-in `EventEmitter`. Cross-subsystem events like `zombieKilled`, `tileMined`, `dawn`, `playerDied`. Decouples producers from consumers (e.g., `UIScene` listens for `zombieKilled` without `Enemies` knowing about `UIScene`).

### Run lifecycle
**Start:** `GameScene.create()` generates world from a fresh random seed → spawns player → initializes day/night at day 1 → launches `UIScene` in parallel.

**End:** Player HP reaches 0 → read `GameState.score` (nights survived) → `SaveStore.updateBestScore(score)` → transition to `GameOverScene`.

## Error handling & edge cases

**Recoverable failures:**
- **Asset load failure** — `PreloadScene` catches, shows an error screen with a retry button.
- **localStorage unavailable** — `SaveStore` wraps all I/O in try/catch. Silent failure; game remains playable, best score just doesn't persist.
- **Invalid tile interaction** (weak tool, occupied cell) — no-op with a short UI hint.
- **Tab backgrounded** — Phaser pauses its loop natively. Day/night timer uses frame `delta`, so long pauses don't collapse world state on resume.
- **Resize / orientation change** — Phaser's scale manager handles canvas resize; virtual joystick re-anchors.

**Explicitly not guarded:**
- Corrupted `localStorage` score (parse as number; fall back to 0).
- Concurrent multi-tab writes (last writer wins is acceptable for a single int).
- Client-side cheating (devtools edits). Solo browser game — not worth the complexity.

**Dev-time invariants** (assert and throw; stripped from prod builds):
- Tile coordinates in bounds on all reads/writes.
- Inventory counts never negative.
- No two entities occupying the same integer tile (relevant for turrets, chests; not player vs zombies).

## Testing

### Automated (Vitest)
Focus on framework-free logic. All testable units take state in and return new state — no DOM or Phaser needed at test time.

- World generation: deterministic for a given seed; ore counts within expected ranges.
- Inventory: add/remove/has-enough; never goes negative.
- Crafting: recipe resolution, material consumption.
- Shop: gold purchase, barter purchase, insufficient-resources rejection.
- DayNightCycle: state transitions at correct elapsed times; difficulty scaling formula.
- Zombie AI: next-step selection given (map, player position) — deterministic.
- Turret targeting: nearest zombie in range.

### Not automated
Rendering, input across devices, game feel and balance. These are verified by manual playtesting.

### Manual test plan (before any "done" claim)
- Desktop: keyboard + mouse play through nights 1–3.
- Mobile (Chrome DevTools touch emulator): joystick + tap through nights 1–3.
- Real phone (browser) when possible: one full run.
- Resize window mid-game: canvas and joystick adapt correctly.

### Coverage
No numeric target. Tests exist to catch regressions in logic, not to hit a percentage.

## Project layout (proposed)

```
mine2d/
├── docs/superpowers/specs/        # specs (this doc)
├── public/                        # static assets copied verbatim
│   └── assets/
│       ├── tilesets/
│       ├── sprites/
│       └── audio/
├── src/
│   ├── main.ts                    # Phaser game entry
│   ├── config.ts                  # constants: tile size, world size, day/night timings
│   ├── scenes/
│   │   ├── BootScene.ts
│   │   ├── PreloadScene.ts
│   │   ├── MenuScene.ts
│   │   ├── GameScene.ts
│   │   ├── UIScene.ts
│   │   └── GameOverScene.ts
│   ├── world/
│   │   ├── World.ts
│   │   ├── tileTypes.ts
│   │   └── generate.ts
│   ├── entities/
│   │   ├── Player.ts
│   │   ├── Zombie.ts
│   │   ├── Projectile.ts
│   │   └── Turret.ts
│   ├── systems/
│   │   ├── Input.ts
│   │   ├── DayNightCycle.ts
│   │   ├── Crafting.ts
│   │   ├── Shop.ts
│   │   └── SaveStore.ts
│   ├── ui/
│   │   ├── Hotbar.ts
│   │   ├── VirtualJoystick.ts
│   │   └── ShopModal.ts
│   └── state/
│       └── GameState.ts
├── tests/                         # Vitest unit tests mirroring src/
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Out of scope for v1 (may revisit later)

- Multiplayer.
- Boss/finite win condition.
- Meta-progression between runs.
- Procedurally infinite world.
- Audio beyond basic SFX (music nice-to-have, not core).
- Hunger/food mechanic.
- Day/night light-radius effects on zombie spawns.

## Open items to resolve during implementation

- Exact damage/HP/speed numbers for each material tier and zombie variant — tuned via playtesting after mechanics work.
- Specific Kenney tileset(s) to use — picked during preload-scene implementation.
- Whether the pistol requires a separate ammo resource or unlimited (leaning unlimited, consistent with turrets, but revisit when shop economy is tuned).
