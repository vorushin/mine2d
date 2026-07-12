# Campaign Mode — Design

**Date:** 2026-07-12
**Status:** Implemented

## What

A hand-authored **Campaign**: 6 themed worlds × 3 missions = 18 levels, played on
fixed seeds with scripted nights and explicit objectives. The campaign starts the
player with nothing but a pickaxe and a sword, and unlocks the game's content
piece by piece — walls, crafting, the shop, engineering, the Deep Dark, wands,
and finally the Zombie King — so the full toolbox is *earned* across the arc.

Classic mode ("Start Run") is untouched: campaign gating only applies while
`state.campaign` is set, campaign runs never write the classic save slot, and
death in a campaign level never clears it.

## The road

| World | Theme | Map | New toys |
|---|---|---|---|
| 1 · Green Meadows | mine, build, survive | classic | Pickaxe, Sword, Wooden Wall, Door, Torch, Spike Trap |
| 2 · Stonecrag Hills | the crafting bench | classic | Stone/Iron walls, Stone→Iron pickaxes, Iron Sword, Repair Hammer, Bow + arrows |
| 3 · Saltwind Isles | trade & water | island | Shop (potions, ammo, Pistol), Bridges, Fishing Rod, Lava |
| 4 · Rustworks | engineering | lava | Arrow/Flame turrets, Bombs, Reinforced Walls |
| 5 · The Deep Dark | descent | classic | Cave access, Crystal/Obsidian tools, Freeze & Storm wands, Obsidian Wall |
| 6 · The Crown | endgame | winter | Boss-rush nights, souls, Crystal Key, the Zombie King |

Unlocks are **cumulative across the flat level list** (`rulesForLevel(i)` is the
union of every earlier level's `unlocks` delta). A test asserts the final level's
rules equal the complete HOTBAR/recipe/shop content, so new game items added
later will fail the test until they're placed somewhere on the road.

## Level anatomy (`src/systems/Campaign.ts`)

- `seed` + `worldModifier` — deterministic map per mission (verified in tests:
  graveyard missions have crypts, gold missions have ore).
- `startNight` — difficulty dial; later worlds start at night 5–8 so zombie
  specs/brute chances scale without re-tuning spawners.
- `start` + `startInventory` + `maxHp` + optional `buddy` — the loadout a player
  would plausibly have at that point in the arc.
- `nights[]` — scripted sieges `{ target, boss?, twist? }`; night *i* uses entry
  `min(i, len-1)`; targets are exact (0 = quiet night), bosses are forced or
  suppressed explicitly (`SpawnDirector.beginNight` gained `bossMode`/
  `exactTarget` opts).
- `objectives[]` — see below.
- `parNights` + `reward` — 3⭐ within par, 2⭐ at par+1, else 1⭐; Star Coins are
  banked into the existing `MetaStore` on first completion (campaign feeds the
  Hero's Hut economy instead of replacing it).

## Objectives

Kinds: `collect`, `mine`, `build` (optionally per-tile), `kill` (optionally
per-variant), `bossKill`, `survive`, `upgrade`, `own`, `depth`, `graveyards`,
`fish`, `victory`.

Progress is **derived from live GameState** (`objectiveProgress`) rather than a
parallel event bus — inventory counts, `stats`, `runMeta`, tool flags — plus a
small `counters` record on the run state for the three things state doesn't
already track (builds by tile, kills by variant, fish reeled). `done` flags
latch on (`updateCampaignObjectives`), so spending collected materials doesn't
un-complete an objective. GameScene ticks this every frame; all-done triggers
the level-complete flow (stars → `CampaignStore` → coins → fireworks → back to
the map).

## Gating

One rule snapshot (`CampaignRules`) is resolved onto `state.campaign.rules` at
level start:

- **Hotbar** — `hotbarCampaignLocked()` inside `hotbarAvailable()`; locked slots
  render as 🔒, number keys/wheel/taps refuse with a hint, the wheel skips them.
- **Build picker** — locked placements are filtered out entirely; the grid
  shrinks to the rows in use.
- **Crafting/Shop modal** — recipes/offers filtered; friendly empty-state copy.
- **Caves & shop NPC** — interaction blocked with "sealed/closed" hints and
  matching interact prompts.

## Persistence

`CampaignStore` (`mine2d:campaign_v1`): per-level `{ stars, bestNights }` with
stars-only-improve / nights-only-shrink semantics. Levels unlock strictly in
order. Defensive reads like `MetaStore`.

## UI

- **MenuScene** — a Campaign button + mission count in the status line.
- **CampaignScene** — scrollable world cards (icon, tagline, "NEW:" strip,
  three level nodes with lock/PLAY/stars states), a mission-briefing panel
  (objectives, unlock badges, reward, par), completion toast, and a
  campaign-complete banner. Auto-scrolls to the frontier mission.
- **In-game HUD** — the daily-quest pill becomes a stacked objective checklist
  (`✅ / ▫` with live counters); daily quests are disabled during campaign
  levels. Buff/hero/boss bars flow below the checklist.
- **GameOverScene** — campaign deaths get "level failed" + Retry Level /
  Campaign Map.

## Tests

`tests/campaign.test.ts` (29 tests): definition integrity, monotonic unlock
growth, full-coverage-at-final-level, per-objective feasibility against each
level's rules (craftable upgrades, reachable materials, caves for depth
objectives, seed-verified crypts/gold), objective evaluation + latching, night
script clamping, SpawnDirector boss modes/exact targets, hotbar/picker gating,
star scoring, store persistence/ordering/corruption.
