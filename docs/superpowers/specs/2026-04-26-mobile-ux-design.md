# Mobile UX Redesign — Design Spec

**Date:** 2026-04-26
**Status:** Approved — ready for implementation plan
**Supersedes:** Mobile-touch sections of `2026-04-21-mine2d-design.md` and the touch fallbacks in `2026-04-23-dynamic-map-and-tech-tree-design.md`.

## Overview

Rework the touch / smartphone UX so the game is actually playable on a phone. Three concrete pain points drive this:

1. The 17-slot hotbar is unusable on a phone — slots compress to ~21 px each in landscape, smaller than a thumb.
2. Actions (especially "pick" / mine) silently fail when the player taps the left half of the screen, because that half is reserved for the joystick. There are also overlap conflicts with HUD elements.
3. The 140 px minimap eats a corner the new right pad needs.

Desktop (keyboard + mouse) stays untouched. This spec is purely additive for touch devices, gated by `ontouchstart` / `navigator.maxTouchPoints` detection at scene start.

## Goals & Non-goals

**Goals**
- Two well-defined, always-visible thumb pads in fixed positions. No surprise touch zones, no tap-anywhere magic.
- A reduced, predictable hotbar that fits in landscape on a typical phone (~750 px wide CSS pixels).
- Reliable mining and combat — the active tool fires consistently when the player aims toward a target.
- Minimap stays available but doesn't fight the right pad for corner space.

**Non-goals**
- Redesigning desktop UX. Number-key hotbar (1–9, 0), click-to-interact, scroll-wheel slot cycling, full inventory chip strip, and the full 17-slot hotbar all stay.
- Portrait support. Game is landscape-only on touch; portrait shows a "rotate to landscape" overlay.
- New gameplay mechanics. This is a UI/input redesign; tile types, combat math, drops, day/night cycle, save/load are all untouched.
- Manual desktop ↔ touch toggle. Auto-detection at startup is enough.
- Mobile dash. The Shift-key dash stays keyboard-only.
- Mobile manual save. Auto-save at dawn already exists; mobile players don't get a "save now" button.

## Design principles (preserved across this redesign)

- **Visible touch zones, no surprises.** Every touch-sensitive area has a drawn boundary the player can see. The current "tap left half = invisible joystick appears wherever you touched" model is removed.
- **Pads are sacred.** Anything inside a pad's circle is for that pad only. Hotbar, HUD, and Build picker live outside the pad zones.
- **Direction, not coordinates.** Touch input never asks the player to hit a specific tile. All actions are direction-based via the right pad.

## Architecture

The mobile UX is a different rendering of the same game state. `GameScene` and the systems it owns are untouched; only the `UI` scene changes.

```
src/scenes/UIScene.ts          ← gains a touch branch that builds the new layout
src/ui/
├── VirtualJoystick.ts         ← reworked: fixed-position, always-visible base
├── AimPad.ts                  ← NEW: the right thumbstick (aim/fire)
├── InHandBar.ts               ← NEW: the 7-button bottom bar (6 tools + Build)
├── BuildPicker.ts             ← NEW: modal placement grid + ghost preview state
├── MinimapToggle.ts           ← NEW: small icon + full-screen overlay
├── Minimap.ts                 ← still used; rendered inside MinimapToggle's overlay on touch
├── hotbarDef.ts               ← unchanged data; the touch UI consumes the same actions
└── HelpOverlay.ts, ShopModal.ts ← unchanged
```

`GameScene.handleTileInteraction(worldX, worldY)` is reused unchanged. The new touch UI computes a target world position from the right-pad direction and calls into it. Same for `handleInteractPressed()`.

## Layout

Landscape-only. Five fixed regions:

```
+----------------------------------------------------------+
| HP[████░░] 64    ☉DAY ▓▓▓▓░░    Night 3 · Score 240   🗺 ⏵|  ← top HUD
| W4  S2  I0                                                |
| G1  A8  B0                                                |  ← inventory chips, 3-col mini-grid
| F2  P1                                                    |
|                                                          |
|                  [game world view]                       |
|                                                          |
|                                                          |
|     [Pick][Sword][Bow][Pistol][Bomb][Hammer][🛠 Build]    |  ← in-hand bar (7 buttons, centered)
|                                                          |
| ⊙ LEFT PAD                              ⊙ RIGHT PAD      |  ← fixed 120 px circles in corners
+----------------------------------------------------------+
```

### Pads

- **Left pad** — movement joystick. Fixed circle, base centered ~`(80, h - 80)`, radius 60 px (120 px diameter), drawn at ~30 % opacity. Touch within the circle activates it; thumb glides up to the radius. Touch outside the circle is ignored by the pad.
- **Right pad** — aim / fire. Fixed circle, base centered ~`(w - 80, h - 80)`, radius 60 px, same opacity. Same activation rules.
- Both pads use a small dead-zone (~25 % of radius) — pushes inside that zone read as "at rest".

The current `VirtualJoystick` "follows your finger anywhere on the left half" behavior is removed. The base is always painted, in the same spot, every frame.

### In-hand bar

A horizontal strip of 7 buttons centered above the pads, each ~52 px wide × 60 px tall, with 6 px gaps. Total width ~410 px. The bar sits **vertically above** the pads (different y row), so it doesn't fight them for horizontal space — even on a 750 px-wide screen, the bar fits with comfortable headroom above the pad row.

```
[ Pick ][ Sword ][ Bow ][ Pistol ][ Bomb ][ Hammer ][ 🛠 ]
  pinned   pinned
```

- Slots 0 and 1 are **pinned to Pickaxe and Sword** — the two most-used tools. They cannot be reordered or hidden, even when unavailable.
- Slots 2–5 hold Bow, Pistol, Bomb, Hammer in fixed positions. Each slot is greyed-out (50 % alpha) when unavailable (no weapon owned, no ammo) so the layout never shifts.
- Slot 6 is the **🛠 Build** button. Tapping it opens the Build picker (see below). When in placement mode, this button morphs into a **✓ Place** button. A small **✕ Cancel** button (~32 px circle) appears just **above** the ✓ Place button — it does not replace any in-hand tool slot, so all 6 tools remain visible and tappable for a fast escape from placement mode.
- Tapping a tool slot **only equips** that tool — it never fires. Firing happens through the right pad.
- The selected slot uses the existing yellow-stroke selection style. Ammo / material count badges in the top-right corner of each cell are preserved.

### Top HUD

A single horizontal strip at the top, ~32 px tall:

- **HP bar** (existing 140 × 16 px style) — top-left.
- **Phase bar + label** (DAY / DUSK / NIGHT / DAWN) — left-of-center.
- **Stats** (Night #, Score, kills, dog level if any) — right-of-center.
- **🗺 Map icon** — small ~28 px square, top-right. Tap → minimap overlay (see below). Shows a small red dot indicator when there's an off-screen threat (boss alive, or any zombie alive at night).
- **⏵ Skip-to-Night** — only visible during day phase, far top-right.

Below the HP bar, **inventory chips** are reorganized from a 9-wide single row into a **3-column grid**:

```
W2  S4  I1
G3  A8  B0
F1  P0  L0
```

Only chips with non-zero counts get the bright stroke; zero-count chips stay greyed (current convention). The two consumable chips, **Food (F)** and **Potion (P)**, are **tappable** on touch — tap consumes one (same effect as the F / P keyboard keys). All other chips are display-only.

### Boss HP bar

Stays at the top-center, just below the phase bar (current implementation). Unchanged.

### Help button

The "?" button stays. It moves to the top-left edge above the HP bar (currently it's bottom-left near the hotbar; that area now belongs to the left pad). ~28 px square.

### Shop off-screen compass arrow

Unchanged behavior. The arrow indicating the shop's direction when off-screen continues to draw at the screen edge with the same logic.

## Right pad behavior (aim / fire)

The right pad's stick direction drives every offensive / utility action. The active hotbar tool determines what happens:

| Tool | Pushed past dead-zone | Notes |
|---|---|---|
| Pickaxe | Mines tile 1 step away in stick direction (snap to 8-way grid) on cooldown | Same break logic as click-mine; 8-way snap means push "northeast" mines the NE-adjacent tile. |
| Hammer | Repairs tile 1 step away in stick direction on cooldown | Same `useHammer` logic. |
| Sword | Swings at any zombie within reach in the stick's hemisphere | Same melee math; the stick direction filters which zombies count as "in front". |
| Bow / Pistol | Fires a projectile in stick direction on cooldown | Auto-targets the nearest zombie within ±45° of the stick direction (auto-aim assist for fat-finger imprecision). Falls back to pure stick direction if no zombie in arc. |
| Bomb | **Single shot per push.** Pushing past the dead-zone, then releasing, throws one bomb in the released direction. | Holding does NOT auto-throw repeatedly; bombs are precious. Re-arms only after the stick returns inside the dead-zone. |
| (Placement tools while in placement mode) | Rotates the ghost preview to a different adjacent tile (8-way) | See Build picker section. |

**Player facing.** When the right pad is past the dead-zone, the player sprite faces the stick direction (overrides movement-based facing). When at rest, the player faces the left-pad movement direction (current behavior).

**Visual feedback while held:**
- A subtle world-space arrow at the player points in the stick direction.
- For pickaxe / hammer / placement, the targeted tile gets a soft highlight.
- These are existing primitives (the `reticle` rectangle at depth 14 already does similar work) — reuse rather than build new.

## In-hand hotbar logic

Touch UI exposes only the 6 in-hand tools and the Build button. Internally, however, the engine still uses `HOTBAR` indices for everything (drops, equipped weapon, attack cooldowns, etc.).

A small mapping array translates the 6 visible touch slots back to `HOTBAR` indices:

```
TOUCH_INHAND_SLOTS = [
  0,  // Pick     → HOTBAR index 0 (mine)
  1,  // Sword    → HOTBAR index 1 (melee)
  2,  // Bow      → HOTBAR index 2 (ranged bow)
  3,  // Pistol   → HOTBAR index 3 (ranged pistol)
  16, // Bomb     → HOTBAR index 16 (throw)
  15, // Hammer   → HOTBAR index 15 (hammer)
]
```

Tapping touch slot `i` sets `state.hotbarSlot = TOUCH_INHAND_SLOTS[i]` and fires the existing `hotbar_changed` event. Everything downstream (`refreshPlayerWeapon`, `handleTileInteraction`'s switch, ammo counts) keeps working unchanged.

The `HOTBAR` constant in `src/ui/hotbarDef.ts` is **not reordered** — desktop still uses indices 0–16 verbatim with their number-key bindings.

Greying logic is `hotbarAvailable(state)` per-slot, already present.

**Coverage check:** the 6 touch in-hand slots cover HOTBAR indices `[0, 1, 2, 3, 16, 15]` (Pick, Sword, Bow, Pistol, Bomb, Hammer). The Build picker covers HOTBAR indices `[4, 5, 6, 13, 7, 8, 12, 11, 9, 14, 10]` (4 walls + door + torch + bridge + lava + 2 turrets + bench = 11 items). 6 + 11 = 17, so every existing HOTBAR action is reachable on touch.

## Build picker + placement flow

### The picker (modal overlay)

Tapping **🛠 Build** opens a translucent panel covering the bottom half of the screen (game world stays visible above). Pads remain active behind it (player can keep moving / aiming) but the in-hand bar is hidden behind the panel.

11 placement actions in a 4×3 grid:

```
[Wall W] [Wall S] [Wall I] [Wall R]      ← walls, low → high tier
[Door  ] [Torch ] [Bridge] [Lava  ]      ← utility / hazards
[Turret] [T Flame] [Bench] [      ]      ← turrets + bench
                                  [✕ Close]
```

Each cell shows the icon swatch (existing `act.color`), short label, and a count badge of the cheapest material's available count. Cells where `hotbarAvailable(slot, state) === false` are greyed (50 % alpha) and non-tappable.

### Selecting a placement item

Tapping an enabled cell:

1. Closes the picker.
2. Sets the active hotbar slot to that placement's `HOTBAR` index. The in-hand bar's slot 6 now shows **✓ Place** (the Build button morphs in place); a small **✕ Cancel** button floats just above slot 6. The 6 in-hand tool slots stay visible and still equippable.
3. Spawns a **ghost preview** at the tile 1 step away from the player in the current right-pad direction (defaults to "south" if pad is at rest). Ghost renders at the placement tile color with ~50 % alpha and a dashed outline.

### Adjusting and committing

While in placement mode:
- Pushing the right pad rotates the ghost to the corresponding adjacent tile (8-way snap, must be within `PLAYER_REACH_TILES`).
- The ghost is invalid (red tint) if the target tile fails the placement rules (`act.onto === 'water'` mismatch, or non-grass/dirt for non-water placements). Tapping ✓ Place when invalid does nothing visible — same as current "showHint('Bridges go on water')" behavior.
- Tapping **✓ Place** commits: deducts materials, calls `world.placeTile(...)`, plays the place sound, and refreshes the ghost at the new facing-direction tile (the player can chain-place by walking and aiming).
- Tapping **✕ Cancel** exits placement mode: ghost disappears, the in-hand bar reverts to its 7-button layout, and the previously-selected in-hand tool (cached when Build was opened) is re-equipped.

Tapping any tool slot in the in-hand bar while in placement mode **also exits placement mode** (cancel) and equips the tapped tool. Sensible escape.

## Minimap toggle

The 140 × 162 px corner minimap is replaced on touch by a small **🗺 icon** in the top-right HUD area. Tapping the icon opens a centered modal with a much larger minimap (~60 % of screen width).

- **Game keeps running** while the modal is open. Boss fights and night raids stay live; the map is a glance, not a pause.
- The modal has a translucent backdrop. Tapping outside the map or tapping a small ✕ button closes it.
- The map itself is a scaled-up version of the existing `Minimap` rendering — same paint logic, just bigger. The static layer can be re-rendered at the larger size when the modal opens.
- The 🗺 icon shows a small red dot when (a) any zombie is alive AND it's night/dusk, or (b) a boss is alive at any time. Helps the player know when to peek without spamming the icon.

## Mode detection

In `UIScene.create()`:

```ts
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
```

Today's check, kept verbatim.

- `isTouch === true` → build the touch UI (pads, in-hand bar, Build picker, minimap toggle, compact HUD, context interact button, tappable consumable chips).
- `isTouch === false` → build the desktop UI (current behavior, unchanged).

No runtime swap. No manual override. Hybrid devices (touch laptops, iPad with mouse) get whichever mode the detection returns; in practice that's "touch", which is fine — desktop users on those devices can still use mouse to tap the touch buttons.

The two branches share the same `GameScene` and event surface; only the UI scene differs.

## Context interact button

A small **E** button (~44 px circle) appears just **above the right pad** **only when the player is adjacent to a Shop NPC, Crafting Bench, Wood Door, or Iron Door tile**. Otherwise invisible.

Tapping the button calls the existing `gameScene.handleInteractPressed()` — same path as the keyboard E key.

The icon updates contextually: 💰 next to a shop, ⚒ next to a bench, 🚪 next to a door. Optional polish; the underlying behavior is one function call.

The current `interactPrompt` text floating above the player can stay (it's informational, doesn't conflict).

## Removed touch UI elements

- The two existing touch buttons (red attack circle, yellow interact circle) at the bottom-right are removed. The right pad and the new context interact button replace them.
- The "tap anywhere on the right half of the screen to use the active tool on that tile" behavior is removed. Right-half taps now do nothing unless they hit a UI element. This eliminates the confusion where a tap on the world tile sometimes fired and sometimes didn't.

## Testing

Vitest unit tests cover pure logic only:

- `tests/touchAim.test.ts` — given a stick `(x, y)` and player tile, verify the 8-way snap returns the correct adjacent tile. Verify dead-zone returns "no aim".
- `tests/buildPicker.test.ts` — verify the picker grid filters greyed cells correctly given a `GameState` with various inventories. Verify `TOUCH_INHAND_SLOTS` mapping equips the right `HOTBAR` index.
- `tests/inventoryChips.test.ts` — verify food / potion chip taps decrement counts and apply heals (same effects as the F / P keys).

UI rendering and Phaser pad gestures are not unit-tested (no DOM in vitest beyond happy-dom; touch gestures are integration-tested manually). A short manual test plan in the PR:

1. Open on a real phone in landscape; verify both pads are visible and stay put.
2. Mine a tree by pushing the right pad toward it. Verify continuous mining while held, stops on release.
3. Place a chain of 4 stone walls using Build picker → ✓ Place → walk → ✓ Place. Verify ghost preview, material deduction, sound.
4. Open the minimap modal; verify the game keeps running underneath.
5. Walk next to a crafting bench; verify the context E button appears; tap it; verify the crafting modal opens.
6. Tap the Food chip with food in inventory; verify HP increases and food count decrements.

## Out of scope

Captured here so future spec readers don't wonder why these aren't included:

- Customizable pad positions / sizes — fixed positions are fine.
- Customizable hotbar pin slots — Pickaxe and Sword are hardcoded in slots 0/1.
- Haptic feedback on tile breaks / hits — would be nice but adds platform variance.
- Gestures beyond two-thumb (pinch zoom, two-finger drag for camera) — game uses fixed camera zoom of 1.4.
- A separate tablet layout — tablets get the touch layout.
- Mobile-only achievements / tutorial — desktop and mobile share the same achievements and help overlay.
