# Dynamic Map Growth & Engineering Tech — Design Spec

**Date:** 2026-04-23
**Status:** Approved for planning
**Supersedes:** n/a — extends the v1 design in `2026-04-21-mine2d-design.md`.

## Overview

Adds three coupled features on top of the v1 mine2d game:

1. **Growing map** — the playable area starts small and expands over the run as an outer mist barrier recedes in bands.
2. **Engineering tech** — four new craftables: reinforced wall, repair hammer, flame turret, and throwable bomb.
3. **Brute zombie variant** — a larger, tougher zombie that starts appearing mid-run.

All three are additive; no existing mechanic is removed.

## Goals & Non-goals

**Goals**
- Make the world feel alive during day phase (it opens up over time).
- Give late-run defense more depth without expanding the material tiers beyond iron.
- Keep enemy roster simple — one new variant driven by stat differences, not new AI.

**Non-goals**
- Islands rising in water, hidden ruins, fog-of-war reveal by milestone — considered and rejected for scope.
- Alchemy / chemistry subsystem — bombs are a single recipe, not a branch.
- New top-tier material above iron.
- New enemy behaviors or AI states.
- True world-array resizing at runtime — the array stays a fixed size; growth is a moving access mask.

## Architecture

Three new modules, each with a focused responsibility:

```
src/systems/
├── DynamicTerrain.ts    — map-growth state + per-frame reveal animation
├── Engineering.ts       — repair-hammer logic + bomb explosion helper (pure functions)
└── EnemyVariants.ts     — stat table for zombie variants
```

Construction wiring: `GameScene.create` builds `DynamicTerrain` after `World`, and hooks it to `DayNightCycle`'s `dayStart` event. `Engineering` is a module of pure functions — no instance. `EnemyVariants` is a const table.

`WorldEvents` (existing) is not merged with `DynamicTerrain`. Clean split: `WorldEvents` owns destruction/hazards (meteors, volcano lava spread); `DynamicTerrain` owns terrain creation/reveal.

## Feature 1 — Growing map

### World size

- `WORLD_WIDTH` and `WORLD_HEIGHT` increase from 60 to **100**. `generateWorld` is unchanged; noise scales.
- At run start, a `revealedBounds = { xMin, yMin, xMax, yMax }` is set to a 40×40 inner square centered on spawn (`INITIAL_REVEAL_HALF_SIZE = 20`).

### Access mask

- All non-revealed tiles render as **mist**: opaque, impassable, not breakable, not mineable. Implemented as a check in `World.isWalkable`, `World.damageTile`, and the render path — no new tile type; the mist layer is a visual overlay plus a boolean lookup against `revealedBounds`.
- Zombies cannot exist in unrevealed tiles. The spawner already picks edge tiles; it naturally respects the mask.

### Expansion schedule

- `DynamicTerrain` holds `daysUntilNextExpansion`, initialized to `REVEAL_EXPAND_DAYS = 2`.
- On `onDayStart`, decrement. When zero, schedule a ring expansion by `REVEAL_RING_TILES = 3` on all sides, clamped to world bounds. Reset counter.

### Reveal animation

- When scheduled, the ring tiles are queued. Every ~40 ms pop one and "reveal" it: clear the mist overlay, spawn a small particle burst (`Effects.burst`, white/grey). Total animation ~2 s for a full ring.
- Fire `terrainRevealed` event on the scene bus once the animation starts. `UIScene` shows a toast: "The mist recedes…"
- If the player saves mid-animation, the remaining queue is flushed instantly before serialization (no mid-animation persistence state).

### Save/load

- `revealedBounds` (four ints) persists.
- `daysUntilNextExpansion` persists.

### Minimap

- `Minimap` reads `revealedBounds`; non-revealed tiles render in flat grey.

## Feature 2 — Engineering tech

### New tile types (in `tileTypes.ts`)

| TileType | HP | PickaxeTier | Drop | Notes |
|---|---|---|---|---|
| `WallReinforced` | 320 | 2 (iron) | 1 iron | Strongest non-door tile. |
| `TurretFlame` | 50 | 1 (stone) | 1 iron | Short-range cone attacker. |

### New materials (in `MaterialId`)

- `'bomb'` — consumable, thrown by the player.
- `'wallReinforced'` — placement token for the reinforced wall.
- `'turretFlame'` — placement token for the flame turret.

### New recipes (in `Crafting.RECIPES`)

| Recipe | Inputs | Produces |
|---|---|---|
| Reinforced Wall ×4 | 2 iron, 3 stone | 4× `wallReinforced` material |
| Repair Hammer | 2 wood, 1 iron | `hasHammer = true` |
| Flame Turret | 6 wood, 4 stone, 4 iron | 1× `turretFlame` material |
| Bomb ×3 | 3 wood, 2 iron | 3× `bomb` material |

New `CraftAction` variant: `unlock_hammer`. The rest reuse the existing `kind: 'material'` variant.

### New `GameState` fields

- `hasHammer: boolean` (default `false`)

### Hotbar additions (in `hotbarDef.ts`)

- **Reinforced wall** — `kind: 'place'`, tile `WallReinforced`, cost `[{material: 'wallReinforced', count: 1}]`.
- **Repair hammer** — new `kind: 'tool'; id: 'hammer'`. Only available when `state.hasHammer`. Always-available once unlocked (no consumable).
- **Flame turret** — `kind: 'place'`, tile `TurretFlame`, cost `[{material: 'turretFlame', count: 1}]`.
- **Bomb** — new `kind: 'throw'; id: 'bomb'; ammo: 'bomb'`. Click or tap to throw toward cursor; arcs; explodes on landing.

### Engineering module — pure functions

```ts
useHammer(world, tx, ty, state): { ok: true; cost: MaterialId } | { ok: false; reason: 'not_damaged' | 'no_material' | 'invalid_tile' }
bombExplosion(world, effects, tx, ty, radius, damage): void
```

`useHammer` semantics:
- Looks up the tile; if its `hp < baseHp`:
  - If the tile's `dropMaterial` is set and the player has ≥1 of it: consume 1, restore `hp` to `baseHp`, emit `hammerRepaired` event, return `ok: true`.
  - Else return `no_material`.
- If `hp === baseHp`: return `not_damaged`.
- If the tile is not a player-placeable structure (e.g. grass, water): return `invalid_tile`. A safe list: walls, doors, turrets, crafting bench, chest.

`bombExplosion` semantics:
- For each tile within Chebyshev (or Euclidean ≤ radius+0.3) radius of (tx, ty):
  - If `isBreakable(type)`: apply `damage` via `World.damageTile`. Shop NPC tile excluded.
- Spawn a particle burst (reuse meteor-style `Effects.burst`) at impact.
- Apply radial damage to zombies in range via the existing zombie-damage path.

### Projectile kinds (extend existing `Projectile`)

- `'bomb'` — arcs (simple parabolic `y` offset), 1 s fuse from launch, on impact calls `bombExplosion`. Damage and radius tunable in `config.ts`.
- `'flame'` — short range (3 tiles), reduced lifetime, piercing (damages multiple zombies in its line). Fired only by `TurretFlame`.

### Flame turret behavior (in `Turret`)

- On tick, nearest zombie in range ≤ 3 tiles. Fire a `'flame'` projectile toward it every 600 ms.
- The projectile pierces, so up to 2 zombies behind the target also take damage if aligned.

## Feature 3 — Brute zombie

### Variant table (`EnemyVariants.ts`)

```ts
export type VariantId = 'base' | 'brute';

export const VARIANTS: Record<VariantId, {
  hp: number;
  speed: number;  // tiles/sec
  damage: number;
  scale: number;
  tint: number;
}> = {
  base:  { hp: 20, speed: 1.8, damage: 10, scale: 1.0, tint: 0xffffff },
  brute: { hp: 60, speed: 1.2, damage: 22, scale: 1.6, tint: 0xff8080 },
};
```

### `Zombie` changes

- Constructor accepts `variant: VariantId`. Reads stats from `VARIANTS`. Applies `scale` and `tint` to sprite.
- No subclass; no new AI.

### Spawn logic

In the existing zombie spawner, roll per-zombie:

| Night | P(brute) |
|---|---|
| 1–4 | 0% |
| 5–7 | 15% |
| 8+ | 30% |

Probabilities are constants in `config.ts`.

## Data flow

### Per-frame update order (additions italicized)

1. `Input` reads → intents.
2. `Player` updates.
3. `Enemies` tick.
4. `Projectiles` tick — now includes `bomb` and `flame`.
5. `Turrets` tick — flame turret uses the new projectile kind.
6. `DayNightCycle` ticks.
7. `WorldEvents` updates.
8. ***`DynamicTerrain` updates*** — drains the reveal queue if active.
9. `World` redraws dirty tiles.
10. `UIScene` updates HUD.

### Events (Phaser `EventEmitter`)

- `terrainRevealed` — fired when a ring expansion animation begins. `UIScene` shows the toast.
- `hammerRepaired(tx, ty)` — fired by `useHammer`. `Effects` hooks for sparkles.
- No other new events.

### `GameState` additions

```ts
hasHammer: boolean;
revealedBounds: { xMin: number; yMin: number; xMax: number; yMax: number };
// daysUntilNextExpansion lives on DynamicTerrain; persisted via SaveLoad.
```

Bomb/reinforced-wall/flame-turret counts live in `inventory.counts` via new `MaterialId`s — no structural change.

### Save/load

- `hasHammer`, `revealedBounds`, `daysUntilNextExpansion`: plain serializable values; add to existing SaveLoad payload.
- New materials auto-work (inventory is already a generic map).
- New tile types auto-work (tile grid is already a flat type enum).

### Config additions

```ts
WORLD_WIDTH = 100;
WORLD_HEIGHT = 100;
INITIAL_REVEAL_HALF_SIZE = 20;
REVEAL_EXPAND_DAYS = 2;
REVEAL_RING_TILES = 3;
REVEAL_TILE_INTERVAL_MS = 40;

// Indexed by nightNumber - 1. Beyond the array, use the last value.
BRUTE_CHANCE_BY_NIGHT = [0, 0, 0, 0, 0.15, 0.15, 0.15, 0.30];

BOMB_DAMAGE = 60;
BOMB_RADIUS = 2;
BOMB_FUSE_MS = 1000;

FLAME_DAMAGE = 8;
FLAME_RANGE_TILES = 3;
FLAME_FIRE_INTERVAL_MS = 600;
```

## Error handling & edge cases

**Map growth**
- Expansion reaches world edge: clamp silently; no more expansions beyond the wall.
- Player saves mid-reveal: flush remaining queue instantly before serialization.
- Zombie AI tries to path through mist: `isWalkable` returns `false`, greedy-step detour already handles this.

**Engineering**
- Hammer used on a player tile that has full HP: no-op with a UI hint (same pattern as mining an invalid tile).
- Hammer used on a non-structure tile (e.g. grass): `invalid_tile`, no-op hint.
- Bomb thrown at a mist tile: projectile explodes on the mist's edge tile per normal tile-collision rules; no damage to mist (it's not breakable).
- Flame turret placed with no zombies in range: idles. Same as arrow turret.

**Enemies**
- Brute roll happens once at spawn, fixed for that zombie's lifetime.
- Existing zombie count scaling unchanged; adding variant doesn't increase total spawns.

## Testing

### Automated (Vitest)

- `DynamicTerrain.planExpansion(bounds, worldSize, ring)` — given bounds (20,20,60,60) and ring 3, returns (17,17,63,63); clamps at world edge; idempotent at max bounds.
- `World.isWalkable` — inside revealed bounds walkable, outside not.
- `Engineering.useHammer`:
  - Damaged tile + material in inventory → `ok`, consumes 1, restores hp.
  - No material → `no_material`.
  - Full hp → `not_damaged`.
  - Grass tile → `invalid_tile`.
- `Engineering.bombExplosion` — damages breakable tiles in radius, leaves unbreakable tiles alone, excludes the shop NPC tile.
- `Crafting` — each new recipe consumes inputs correctly; `unlock_hammer` sets `hasHammer` and is idempotent.
- `EnemyVariants` — `VARIANTS['brute'].hp === 60`; variant-roll function deterministic given seed + night.

### Manual

- Reach night 3: mist recedes twice with toast + animation; revealed region is walkable and mineable.
- Reach night 5: a brute spawns; visibly larger, tougher, hits harder than a base zombie.
- Craft and use each engineering item:
  - Reinforced wall takes more hits than an iron wall before breaking.
  - Hammer restores a damaged wall to full and consumes 1 unit of its material.
  - Flame turret hits up to 3 zombies in a line within 3 tiles.
  - Bomb arcs, explodes, damages tiles and zombies in radius 2.
- Save mid-run with partial map revealed → reload → revealed region, hammer unlock, and inventory counts all persist.
- Mobile: flame turret placeable via tap; bomb throwable via tap-and-target or action button.

## Open items to resolve during implementation

- Exact tuning: brute HP/damage, bomb radius, flame range and pierce count. Adjusted after playtest.
- Visual treatment of mist tiles (solid colour vs. simple animated fog shader). Pick the cheapest that reads clearly.
- Whether the starting reveal is a square or a circle — square is simpler, but a circle might read better. Implementation-time call.
