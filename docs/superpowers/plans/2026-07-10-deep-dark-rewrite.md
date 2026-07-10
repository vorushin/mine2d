# mine2d II: The Deep Dark — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite mine2d into "mine2d II: The Deep Dark" — underground cave floors, mechanically distinct bosses ending in a beatable Zombie King fight with credits, meta-progression (Star Coins → companions/classes/world modifiers), music + dynamic lighting, and a pack of delight features — per `docs/superpowers/specs/2026-07-10-deep-dark-rewrite-design.md`.

**Architecture:** Keep the existing Phaser 3 scene/system layout. New pure-logic modules in `src/systems` + `src/world` carry all rules (tested with Vitest); GameScene stays the orchestrator and sheds weight into `SpawnDirector` and `LootTables` as twists land. Worlds become layered (surface + 3 cave floors) with one active rendered layer.

**Tech Stack:** TypeScript strict, Phaser 3.80, Vite, Vitest (happy-dom). No external assets — all art stays procedural Graphics textures, all audio stays WebAudio.

## Global Constraints

- Mobile-first: every new interaction reachable via tap / the Interact button (no keyboard-only features; keyboard is a bonus).
- No new dependencies, no binary assets.
- All new game rules live in pure modules with Vitest coverage; Phaser objects only in scenes/entities.
- The game must remain playable (npm test green + npm run build clean) after every Act.
- Save compatibility: old saves load with defaults for new fields (best-effort deserialization, existing pattern in `SaveLoad.ts`).
- Kid-friendly difficulty: new content is generous with loot and telegraphs danger clearly.
- Follow existing code style: focused classes, deps-object constructors, `TinyEmitter`/scene events for cross-system signals.

---

## Act A — Foundation & Atmosphere (Twist 0 + refactor groundwork)

### Task A1: MusicEngine

**Files:**
- Create: `src/systems/Music.ts`
- Test: `tests/music.test.ts`
- Modify: `src/scenes/GameScene.ts` (phase hooks), `src/scenes/MenuScene.ts` (menu theme + first-tap start), `src/ui/OverflowMenu.ts` (mute toggle), `src/systems/SaveStore.ts` (persist mute)

**Interfaces:**
- Produces: `type ThemeId = 'menu' | 'day' | 'night' | 'boss' | 'caves' | 'victory'`; `class MusicEngine { setTheme(t: ThemeId): void; setMuted(m: boolean): void; get muted(): boolean }` singleton `music`. Pure helper `buildTheme(id: ThemeId): ThemePattern` where `ThemePattern = { bpm: number; bass: number[]; lead: number[]; perc: ('k'|'h'|'s'|null)[] }` (note numbers are semitone offsets, -1 = rest).

- [ ] Test: `buildTheme` returns 16-step patterns for every ThemeId; all lead/bass notes within scale table; bpm in 70–160; day theme differs from night theme.
- [ ] Implement `buildTheme` (hand-authored patterns per theme; minor scale for night/boss, major for day/menu/victory, sparse pentatonic for caves).
- [ ] Implement `MusicEngine`: lazy AudioContext (share via `sounds.ensure()` pattern), 16-step lookahead scheduler (square lead, triangle bass, noise percussion), gain crossfade ~1.2 s between themes, `setMuted` persisted via localStorage key `mine2d.muted`.
- [ ] Wire: MenuScene → `music.setTheme('menu')` on first pointer; GameScene phase_changed → day/night; caves when `state.depth > 0` (Act B revisits); mute toggle row in OverflowMenu.
- [ ] Run `npm test`, manual `npm run dev` listen check. Commit.

### Task A2: LightingSystem (replaces flat night overlay)

**Files:**
- Create: `src/systems/Lighting.ts`
- Modify: `src/scenes/GameScene.ts` (create/update; remove `nightOverlay` uses), `src/gfx/textures.ts` (radial `light_glow` texture)

**Interfaces:**
- Produces: `class LightingSystem { constructor(scene, world); setDarkness(a: number): void; update(lights: LightSource[], cam: Camera): void; destroy(): void }` with `type LightSource = { x: number; y: number; radius: number; intensity?: number }`.
- Consumes: `World.forEachTileOfType` for torches/campfires/lava.

- [ ] Add `light_glow` radial gradient texture (white center → transparent, 256 px) in textures.ts.
- [ ] Implement: screen-sized RenderTexture, scrollFactor 0, depth 100; per frame `fill(0x02020a, darkness)` then ERASE blend-draw glow images at `worldPoint - cam.scrollXY` for each light in view.
- [ ] GameScene: build light list per frame — player aura (radius 150 day-fade), torches (120), campfires (150), lava/volcano tiles in view (60, dim), reticle none. Darkness by phase: day 0, dusk 0.45·p, night 0.78, dawn fade; caves later. Delete `nightOverlay`; keep warm + blood overlays; stars now keyed off darkness value.
- [ ] `npm test` + visual check (torch pools at night). Commit.

### Task A3: Extract SpawnDirector + LootTables from GameScene

**Files:**
- Create: `src/systems/SpawnDirector.ts`, `src/systems/LootTables.ts`
- Test: `tests/spawnDirector.test.ts`, `tests/lootTables.test.ts`
- Modify: `src/scenes/GameScene.ts` (delegate)

**Interfaces:**
- Produces (LootTables, pure): `rollKillDrops(opts: { variant: ZombieVariant|undefined; night: number; combo: number; bloodMoon: boolean; lootMultiplier: number; rand?: () => number }): { m: MaterialId; c: number }[]`; `bossLoot(): {m,c}[]`; `crateLoot(): {m,c}[]`.
- Produces (SpawnDirector): owns nightTarget/nightSpawned/pacing/boss scheduling. `class SpawnDirector { beginNight(night: number, baseTarget: number, twist: NightTwist): number; update(deltaMs, phase, night): SpawnRequest[]; get remaining(): number; get allSpawned(): boolean }` where `SpawnRequest = { kind: 'zombie' | 'boss' }`; GameScene maps requests to `spawnZombie()/spawnBoss()`.

- [ ] Tests: kill-drop probabilities honored with injected rand (goblin always drops gold; multipliers raise counts); director pacing — beginNight returns modified target, update emits ≤ target zombie requests over simulated night, boss request exactly once on night%5===0 after 15 s.
- [ ] Implement both modules by moving existing GameScene logic verbatim (same constants), inject `Math.random` default.
- [ ] GameScene: replace inline fields (`nightSpawned/nightTarget/nightSpawnTimerMs/bossSpawned`) and `onZombieKilled` drop block with module calls. Behavior identical.
- [ ] `npm test`. Commit (bundle Act A).

---

## Act B — The Deep Dark (Twist 1)

### Task B1: New tiles + materials + textures

**Files:**
- Modify: `src/world/tileTypes.ts`, `src/gfx/textures.ts`, `src/config.ts` (colors), `src/ui/hotbarDef.ts` (obsidian wall), `src/ui/buildPickerData.ts`

**Interfaces:**
- Produces: `MaterialId` += `'crystal' | 'obsidian' | 'soul'`. `TileType` += `CaveRock, CaveFloor, CrystalOre, ObsidianOre, CaveEntrance, LadderUp, LadderDown, VaultChest, ThroneGate, WallObsidian, Gravestone, Crypt, Web` (graveyard/web tiles land now, used in Acts C/D). ToolTier stays 0–3; crystal ore needs tier 2, obsidian ore tier 3.
- Tile specs: CaveRock hp 14 drop stone; CaveFloor walkable dark ground; CrystalOre hp 26 drop crystal; ObsidianOre hp 40 drop obsidian; CaveEntrance/Ladder walkable, unbreakable (9999/tier3); VaultChest hp 10; ThroneGate unbreakable; WallObsidian hp 460 tier 3 drop obsidian; Gravestone hp 20; Crypt hp 260; Web walkable, hp 1, slows (handled in Act C).

- [ ] Add enum entries + specs + `isPlaceableGround` includes CaveFloor; `isBreakable` excludes CaveEntrance/Ladders/ThroneGate.
- [ ] Procedural textures for each new tile (pixel-art Graphics, existing style) + crystal/obsidian/soul pickup icons.
- [ ] Hotbar/build-picker: Obsidian Wall (cost 2 obsidian). `npm test` (buildPicker tests updated). Commit-ready.

### Task B2: Cave generation (pure)

**Files:**
- Create: `src/world/generateCave.ts`
- Test: `tests/caveGen.test.ts`

**Interfaces:**
- Produces: `CAVE_W = 60`, `CAVE_H = 60`; `generateCave(seed: number, floor: 1|2|3): GeneratedCave` where `GeneratedCave = { tiles: Tile[][]; entry: {x,y}; ladderDown: {x,y} | null; throneGate: {x,y} | null }`. Deterministic per (seed, floor).

- [ ] Tests: determinism (two calls equal); all borders solid CaveRock; entry has LadderUp, floors 1–2 have LadderDown, floor 3 has throne gate + arena instead; BFS from entry reaches ladderDown/gate over walkable tiles; ore counts within ranges (floor2 crystal 8–30, floor3 obsidian 6–20); ≥2 vault chests per floor.
- [ ] Implement: fill solid CaveRock; drunkard-walk carve ~34% floor from center; entry = first carved near center (LadderUp); ladderDown = farthest carved tile (BFS max-dist); rooms: stamp 3–4 elliptical chambers; vaults: small rooms ringed by rock with VaultChest + torch; sprinkle ores by floor on rock adjacent to floor; lava pools floor 2+ (small blobs); floor 3: carve 11×9 throne arena at far end, seal with ThroneGate row, place gate coords.
- [ ] `npm test`. Commit-ready.

### Task B3: Layered worlds + descend/ascend

**Files:**
- Modify: `src/state/GameState.ts` (`depth: 0|1|2|3`), `src/world/World.ts` (`swapTiles`, size awareness), `src/scenes/GameScene.ts` (layer store + transition + interact), `src/systems/SaveLoad.ts` (v2 snapshot: caves + depth), `src/systems/WorldEvents.ts` (surface-only guard), `src/ui/Minimap.ts` (active-layer size)

**Interfaces:**
- Produces: GameScene `layers: { tiles: Tile[][]; w: number; h: number; pickups: SavedPickup[] }[]` indexed by depth (0 = surface); `descendTo(depth)` / `ascendTo(depth)` swap: clear zombies/projectiles/turret barrels, stash pickups, `world.swapTiles(tiles, w, h)`, reposition player at ladder, rebuild turret instances from tiles, camera bounds to layer size, lighting darkness (surface by phase / caves 0.94), music theme.
- `World.swapTiles(tiles: Tile[][], w: number, h: number): void` destroys all tile images and redraws; `World.width/height` become instance values (default config) — Minimap + spawn edges read them.

- [ ] GameState: add `depth: 0` default. SaveLoad v2: `{ surface, caves: (Tile[][]|null)[], depth }`, loader defaults old saves to depth 0 / caves null.
- [ ] World: instance `w/h`; replace module-level `WORLD_WIDTH/HEIGHT` reads in hot paths (isWalkable bounds, minimap, spawn edges, worldEvents scans) with `world.w/h`.
- [ ] GameScene: interact on CaveEntrance/LadderDown → depth+1 (generate cave lazily from run seed: `caveSeed = worldSeed ^ (floor*7919)`); LadderUp → depth-1. Persist run seed in state/save. Chickens/dog rules: chickens surface-only (hidden/frozen while underground — skip update+hide sprites), Rex + companion teleport along.
- [ ] WorldEvents.update/onDayStart no-op while `depth > 0`; zombie surface spawns skip while underground (SpawnDirector holds pressure — see B4).
- [ ] Worldgen: seed 2–3 CaveEntrance in rocky biome + 1 guaranteed within 20 tiles of spawn.
- [ ] Save/load round-trip test with a visited cave (tests/saveload additions). Manual: descend, mine, ascend, save, reload. Commit-ready.

### Task B4: Cave monsters + ambient spawns

**Files:**
- Modify: `src/entities/Zombie.ts` (variants bat/spider/skeleton + textures + behavior flags), `src/entities/Projectile.ts` (`bone` kind, owner 'enemy' hurts player), `src/systems/SpawnDirector.ts` (cave ambient spawner), `src/scenes/GameScene.ts` (enemy projectile handling)
- Test: `tests/caveMonsters.test.ts`

**Interfaces:**
- Produces: `ZombieVariant` += `'bat' | 'spider' | 'skeleton' | 'spiderling' | 'king'` (king used Act C). `specForCave(floor, night, rand): ZombieSpec`; Zombie gains optional `behavior: { erratic?: boolean; noWallAttack?: boolean; ranged?: { kind: 'bone'; range: number; cooldownMs: number }; layWebs?: boolean }` on spec.
- SpawnDirector: `updateCave(deltaMs, floor, phase, night): SpawnRequest[]` (kind 'cave'), density: base 1 per 6 s, ×1.6 at night, ×(1+0.3·floor), cap ~10+4·floor alive.

- [ ] Tests: `specForCave` returns bat/spider on floor 1, adds skeleton floor 2+ with injected rand; stats scale with night; director cave pacing respects cap.
- [ ] Zombie: erratic movement (bat: sin-wobble steering, ignores walls→noWallAttack skips wall targets, flies over water? no — caves only), skeleton ranged: when player within 6 tiles + LoS, throw bone (Projectile kind 'bone', damage spec.damage, speed 240, hurts player on hit), else approach; spider: on move, 8% per tile chance leave Web tile (TTL 6 s — GameScene tracks and clears).
- [ ] GameScene: enemy projectiles damage player (owner 'enemy' collision with player radius 14). Web tiles slow player ×0.55 while standing (check in Player.update via world tile, same pattern as lava).
- [ ] Spawn burst effect + spawn at carved tiles ≥ 7 tiles from player. `npm test`. Commit-ready.

### Task B5: Cave tech: vaults, recipes, tiers

**Files:**
- Modify: `src/systems/Crafting.ts` (crystal pickaxe/sword, obsidian wall handled via material, wands come Act F), `src/state/GameState.ts` (`pickaxeTier: 0|1|2|3`, `swordTier: 0|1|2`), `src/systems/LootTables.ts` (`vaultLoot(floor)`), `src/scenes/GameScene.ts` (VaultChest break → loot), `src/ui/hotbarDef.ts` descriptions, `src/ui/HelpOverlay.ts`
- Test: extend `tests/crafting.test.ts`

**Interfaces:**
- Produces: recipes `crystal_pickaxe` (3 crystal + 2 iron → pickaxe_upgrade toTier 3), `crystal_sword` (2 crystal + 1 iron → sword_upgrade toTier 2, melee dmg 24), `obsidian_wall_x2` — not needed (place costs raw obsidian). `vaultLoot(floor)`: gold 3+floor, crystal floor≥2, arrows, bomb chance.
- `CraftAction` pickaxe toTier widens to `1|2|3`; sword `1|2`.

- [ ] Tests: new recipes craft/gate correctly (can't re-craft, inputs consumed); Player.meleeAttackDamage tier table 6/14/24.
- [ ] VaultChest broken → `vaultLoot` pickups + sparkle + sound.
- [ ] Help overlay: "The Deep Dark" tab (entrances, darkness, crystal/obsidian, vaults). `npm test`. **Commit Act B.**

---

## Act C — Bosses with brains + the Zombie King ending (Twists 2+3)

### Task C1: Boss rotation + mechanics

**Files:**
- Create: `src/systems/Bosses.ts`
- Test: `tests/bosses.test.ts`
- Modify: `src/entities/Zombie.ts` (mechanic hooks), `src/scenes/GameScene.ts` (fallen log, channel visuals, web/spiderling handling, golem immunity), `src/systems/SpawnDirector.ts` (boss kind pass-through)

**Interfaces:**
- Produces: `type BossKind = 'necromancer' | 'spiderQueen' | 'golem' | 'king'`; `bossKindForNight(night): BossKind` (5→necro, 10→queen, 15→golem, then cycle 20/25/30…); `specForBossKind(kind, night): ZombieSpec & { kind: BossKind }`; `BOSS_INTROS: Record<BossKind, { title: string; tip: string }>`.
- GameScene keeps `fallenThisNight: { x, y, spec, raised: boolean }[]` (cap 40, cleared at dawn).

- [ ] Tests: rotation mapping incl. cycling; specs scale with night; necro re-raise selects only `raised === false` entries and marks them.
- [ ] Necromancer: every 12 s begins 2.5 s channel (purple beam tween + banner tick); if it takes ≥1 damage during channel, cancel; on completion raise up to 3 fallen (spawn at their death spots, raised=true, 60% hp).
- [ ] Spider Queen: every 9 s spawn 2 spiderlings (tiny fast 6 hp); leaves Web tiles under herself every ~2 s (reuse B4 web system).
- [ ] Golem: `projectileResistant` flag on spec → arrow/bullet/flame damage becomes 1 (popNumber grey "resist"); melee/bomb/spike/lava/wand full. Intro tips explain each ("Break his ritual!", "Clear the webs!", "Arrows bounce off — get creative!").
- [ ] Mechanic bosses drop 1 `soul` material + regular boss loot. Boss intro card: banner title + tip line + boss theme music. `npm test`. Commit-ready.

### Task C2: Crystal Key, throne room, Zombie King, credits

**Files:**
- Create: `src/scenes/CreditsScene.ts`
- Modify: `src/systems/Crafting.ts` (key recipe), `src/state/GameState.ts` (`hasCrystalKey`, `victory`, `kingDefeated`, `endlessPlus`), `src/systems/Bosses.ts` (king phases pure helper), `src/scenes/GameScene.ts` (gate interact, fight orchestration), `src/scenes/UIScene.ts` (king HP bar), `src/systems/SaveLoad.ts` (new fields), `src/main.ts` (register scene)
- Test: extend `tests/bosses.test.ts`, `tests/crafting.test.ts`

**Interfaces:**
- Produces: recipe `crystal_key` (2 soul + 3 crystal → `unlock_key` CraftAction). `kingPhase(hpPct): 1|2|3` (>0.5→1, >0.25→2, else 3); `KING_PHASES` tuning `{ summonEveryMs, summonCount, speedMult, smashesTiles }`.
- CreditsScene launched with `{ stats, night }`; scrolling lines ("MINE2D II … A game made for Robert … YOU BEAT THE ZOMBIE KING on night N", stats, "Endless+ unlocked"), then buttons Continue (Endless+) / Menu.

- [ ] Tests: key recipe consumes souls; `kingPhase` thresholds; phase table sane.
- [ ] ThroneGate interact: without key → hint "Sealed… (craft a Crystal Key: 2 souls + 3 crystal)"; with key → gate tiles crumble, camera shake, King spawns in arena (spec `king`: hp 40·base·(1+night/10), dmg 2.6×, speed 0.65×; phases via `kingPhase` each frame: summon timer spawns minions at arena edge; phase 2 speed×1.5 + smashes breakable tiles in path (damageTile on contact); phase 3 summon×2 + speed×1.8).
- [ ] UIScene: top boss HP bar while king alive ("THE ZOMBIE KING").
- [ ] On king death: fireworks + cake-rain emitter + `victory=kingDefeated=true`, +Star bonus (Act E hooks in later — store pending), banner, 2.5 s later launch CreditsScene (Game pauses). Continue → `endlessPlus=true` (SpawnDirector target ×1.5, hp ×1.25), resume.
- [ ] GameOver + Menu show "👑 beat the game on night N" when victorious. Save fields round-trip. `npm test`. **Commit Act C.**

---

## Act D — Graveyard Raids (Twist 4)

### Task D1: Graveyards

**Files:**
- Create: `src/systems/Graveyards.ts`
- Test: `tests/graveyards.test.ts`
- Modify: `src/world/generate.ts` (seed graveyards), `src/scenes/GameScene.ts` (guardians, crypt-destroyed handling, night banner), `src/systems/SpawnDirector.ts` (target bonus), `src/ui/Minimap.ts` (skull markers)

**Interfaces:**
- Produces: `findCrypts(tiles): {x,y}[]` (scan for Crypt tiles); `graveyardNightBonus(intactCount, baseTarget): number` (+25% each, ceil); worldgen places 2–3 graveyards (Crypt core + 6–9 Gravestone ring + dirt patch) ≥ 25 tiles from spawn.

- [ ] Tests: bonus math (0/1/2/3 intact); worldgen seeds 2–3 crypts far from spawn (extend worldgen test).
- [ ] SpawnDirector.beginNight takes `graveyardBonus` param; night banner shows `+N from graveyards` when > 0.
- [ ] Day guardians: at day start spawn 2 persistent zombies near each intact crypt (flag `persistent: true` — skip dawn despawn, don't count vs night target); they aggro within ~8 tiles (idle wander near crypt otherwise: reuse pathing toward crypt anchor).
- [ ] Crypt destroyed → big loot burst (`LootTables.cryptLoot()`: gold 6, iron 4, soulless bonus arrows), +banner "GRAVEYARD CLEANSED — nights get easier", pending star coins +2, remove guardians' anchor (they roam/despawn at dawn like normal).
- [ ] Minimap: skull dot per intact crypt. `npm test`. **Commit Act D.**

---

## Act E — Companions & the Hero's Hut (Twists 5+6)

### Task E1: Companion framework (Rex refactor) + Whiskers/Ember/Bolt

**Files:**
- Create: `src/entities/Companion.ts` (chassis + behaviors), textures in `src/gfx/textures.ts`
- Modify: `src/entities/Dog.ts` → thin Rex wrapper or fold in, `src/scenes/GameScene.ts` (second companion slot), `src/systems/SaveLoad.ts` (companions array)
- Test: `tests/companions.test.ts`

**Interfaces:**
- Produces: `type CompanionId = 'rex' | 'whiskers' | 'ember' | 'bolt'`; `COMPANION_SPECS: Record<CompanionId, { name, maxHp, speed, color, ability: 'bite'|'treasure'|'firespit'|'repair', abilityCooldownMs }>`; `class Companion` (movement/HP/pet/level chassis from Dog + behavior switch). GameScene: `companions: Companion[]` (Rex always; +1 chosen).
- Abilities: bite = current Rex; treasure = every 90 s mark a random walkable tile 6–14 tiles away with sparkle + minimap dot; mining it yields `LootTables.treasureDigLoot()`; firespit = every 2.5 s flame projectile (pierce 1, dmg 7) at nearest enemy ≤ 5 tiles; repair = every 4 s restore 10 hp to the most damaged player structure within 4 tiles (free, sparkle).

- [ ] Tests: spec table sane; treasure marker cadence + dig loot; repair picks most-damaged-in-range (pure helpers with fake world).
- [ ] Refactor Dog → Companion with `ability: 'bite'`; keep petting hearts + dawn revive + level-ups for all companions; saves store array `{ id, hp, level, kills, x, y, alive }`.
- [ ] `npm test`. Commit-ready.

### Task E2: MetaStore + Star Coins

**Files:**
- Create: `src/systems/MetaStore.ts`
- Test: `tests/metaStore.test.ts`
- Modify: `src/scenes/GameScene.ts` (track run meta: bossKills, maxDepth, graveyardsCleared, pending awards), `src/scenes/GameOverScene.ts` (+coins earned line), `src/state/GameState.ts` (runMeta fields)

**Interfaces:**
- Produces: `starCoinsForRun(r: { nights: number; bossKills: number; maxDepth: number; graveyardsCleared: number; victory: boolean }): number` = `nights*2 + bossKills*5 + maxDepth*3 + graveyardsCleared*2 + (victory ? 25 : 0)`; `MetaStore.get(): Meta`, `MetaStore.addCoins(n)`, `MetaStore.unlock(kind: 'companion'|'class'|'modifier', id): boolean` (spends), `MetaStore.isUnlocked(kind, id)`; `Meta = { coins: number; companions: CompanionId[]; classes: ClassId[]; modifiers: ModifierId[]; victories: number }` under localStorage `mine2d.meta.v1`.
- Prices: `UNLOCK_PRICES` — whiskers 30, ember 60, bolt 90, classes 40 each, modifiers 50 each.

- [ ] Tests: coin math incl. victory; unlock spends + rejects insufficient/duplicate; storage round-trip with corrupt-json fallback.
- [ ] GameState.runMeta `{ bossKills, maxDepth, graveyardsCleared }` updated at events; on death AND on victory award coins once (`coinsAwarded` guard); GameOver shows "★ +N Star Coins (total M)".
- [ ] `npm test`. Commit-ready.

### Task E3: Classes + world modifiers + Hero's Hut + Menu v2

**Files:**
- Create: `src/systems/Classes.ts`, `src/scenes/HeroHutScene.ts`
- Test: `tests/classes.test.ts`
- Modify: `src/scenes/MenuScene.ts` (rebrand + pickers + Hut button), `src/world/generate.ts` (modifier presets), `src/scenes/GameScene.ts` (apply class kit/passives + modifier), `src/main.ts` (scene), `src/entities/Player.ts` (mine-speed passive hook)

**Interfaces:**
- Produces: `type ClassId = 'adventurer' | 'knight' | 'ranger' | 'engineer' | 'miner'`; `CLASS_SPECS: Record<ClassId, { name, blurb, kit: {m: MaterialId; c: number}[]; melee?: number; bowBonus?: number; mineMult?: number; startPickaxe?: 1; startSword?: 1; startBow?: boolean; startHammer?: boolean; startTurret?: boolean }>`; `applyClassStart(state, id)` pure. `type ModifierId = 'winter' | 'island' | 'lava'`; `generateWorld(seed, modifier?: ModifierId)` — winter: water→Ice walkable tile (new tile, slight slide? no — just walkable + pale palette + snow particles + ice-zombie tint stats ×{speed 0.8, hp 1.25}); island: biome threshold shift (water < 0.34); lava: 3 volcanoes + gold ×2.
- Run config passed via `scene.start('Game', { runConfig: { classId, companionId, modifierId } })`.

- [ ] Tests: `applyClassStart` kits/gates (miner starts pickaxeTier 1, engineer hasHammer + turret token, knight melee 10/18/28 table via meleeBonus, ranger bow dmg +6 & 20 arrows); modifier worldgen (island water fraction > default; lava has 3 volcanoes; winter has zero Water tiles, Ice instead).
- [ ] Hero's Hut scene: coins header; three sections (Companions/Classes/Modifiers) with unlock buttons (grey when owned/can't afford) + blurbs; back button. Simple rect/text UI matching Menu style; tap-friendly (≥44 px rows).
- [ ] Menu v2: title "MINE2D II", subtitle "THE DEEP DARK", "🎂 made for Robert", coins line, New Run opens a compact picker panel (class row, companion row, modifier row — locked entries show 🔒 price) → Start; Hero's Hut button; credits-replay button once `meta.victories > 0`.
- [ ] GameScene: apply runConfig (class start, spawn chosen companion, modifier to worldgen + ice-zombie tinting at spawn time). Mine-speed passive: `mineTile(..., damage * mineMult)`.
- [ ] `npm test` + manual flows. **Commit Act E.**

---

## Act F — Wonder & Chaos pack (Twist 7, priority order)

### Task F1: Chicken Army + Wands + Treasure maps

**Files:**
- Modify: `src/entities/Chicken.ts` (recruit + follow + peck), `src/scenes/GameScene.ts` (recruit tap, wand actions, treasure hunt), `src/ui/hotbarDef.ts` (+`kind:'wand'` entries), `src/systems/Crafting.ts` (wand + rod recipes), `src/state/GameState.ts` (`hasFreezeWand`, `hasStormWand`, `treasureHunt`), `src/entities/Zombie.ts` (slow debuff support `slowUntilMs`)
- Test: `tests/wonderPack.test.ts`

**Interfaces:**
- Produces: Chicken `recruited: boolean`, `recruit()`; pecks: nearest enemy ≤ 3 tiles, 1.5 s cooldown, 2 dmg. Hotbar wand action `{ kind: 'wand'; wand: 'freeze' | 'storm' }` — freeze: all enemies within 3 tiles of tap slowed ×0.45 for 4 s (blue burst); storm: chain lightning from nearest enemy to tap, jumps to 3 more within 3 tiles, 18 dmg each; both 5 s shared-per-wand cooldown, no ammo. Recipes: `freeze_wand` (3 crystal + 1 gold → unlock), `storm_wand` (3 crystal + 2 iron → unlock). Treasure map: goblin 18% drop material `map` auto-consumed on pickup → `treasureHunt = {x,y}` random walkable ≥ 20 tiles away; sparkle emitter + minimap ✕; mining that tile (any ground: allow damageTile on ground? instead: spawn a `VaultChest` at the spot when hunt starts) → `treasureDigLoot` + clear hunt.
- Zombie slow: `speedNow = speed * (slowUntilMs > now ? slowFactor : 1)` — also reused by webs/frost.

- [ ] Tests: recruit cap 3 + peck cooldown math (pure helpers); wand cooldown gating + freeze radius selection with fake enemies; storm chain picks ≤ 4 distinct targets; treasure spot ≥ 20 tiles away + loot table.
- [ ] Implement + wire mobile taps (tap chicken to recruit — enlarge hit area; wands fire at tap point like ranged). Help overlay “Wonders” notes. `npm test`. Commit-ready.

### Task F2: Fishing + new night twists

**Files:**
- Modify: `src/systems/Crafting.ts` (rod), `src/ui/hotbarDef.ts` (`kind:'fish'`), `src/scenes/GameScene.ts` (cast/bite/reel state machine), `src/systems/NightTwists.ts` (fog/meteorNight/frost), `src/systems/Lighting.ts` consumers (fog darkness), `src/systems/WorldEvents.ts` (night meteors when twist active), `src/state/GameState.ts` (`hasRod`)
- Test: extend `tests/nightTwists.test.ts`, `tests/wonderPack.test.ts`

**Interfaces:**
- Produces: recipe `fishing_rod` (3 wood + 1 iron → unlock). Fishing: with rod slot, tap water in reach → bobber sprite + random 1.5–4 s wait → “!” 900 ms window → tap anywhere to reel: rolls `fishingLoot(rand)`: 45% fish (+10 hp instant, popNumber), 25% gold 1–2, 20% junk wood 1, 10% treasure (crystal 1 or gold 3). Moving cancels.
- NightTwists += `{ fog: { label 'Fog Night', darkness +0.1 & light radii ×0.55 }, meteorNight: { label 'Meteor Night', meteors during night via WorldEvents.scheduleNightMeteors() }, frost: { label 'Frost Night', enemy speed ×0.7 hp ×1.3 } }` — extend `NightTwist` with `fog?: boolean; nightMeteors?: boolean; speedMult?: number; hpMult?: number`; chooser gains them at nights ≥ 4 with small weights.

- [ ] Tests: `fishingLoot` distribution with injected rand; twist chooser can return new kinds; frost multipliers applied in `specForSpawn` (pure test via spec fn param).
- [ ] Implement fishing state machine (idle→waiting→bite→resolved, timers in GameScene update; bobber + “!” visuals; sounds). Fog: SpawnDirector unchanged, lighting radius multiplier + darkness bump while twist active at night. Meteor Night: WorldEvents gains `nightMeteorsActive` flag (schedule 1 meteor / 12 s at night). Frost: multiplier hooks in specForSpawn.
- [ ] `npm test`. **Commit Act F.**

---

## Act G — Polish & ship

- [ ] Help overlay: new tabs/entries (Deep Dark, Bosses & the King, Graveyards, Companions, Hero's Hut, Wonders) — concise kid-readable lines.
- [ ] Balance pass constants in `config.ts` (cave spawn caps, boss hp, wand numbers) — one place.
- [ ] Full `npm test` + `npm run build`; fix all TS strict issues.
- [ ] Browser smoke test via dev server: menu v2 → new run (class picker) → mine → descend → cave fight → ascend → night siege with lighting → save/reload → game over coins. Screenshot key beats.
- [ ] Update `MEMORY.md`? no — project docs only. Final bundled commit (per user preference: bundle work into few commits, one per act already done; final polish commit).

## Execution notes

- Inline execution (executing-plans) in this session; user pre-approved ("go ahead").
- Commit cadence: one commit per Act (A–G) — matches user's "bundle, not per-task" preference while keeping checkpoints for context safety.
- If context runs low: this plan + committed acts are the resume points; tasks are ordered so the game ships whole after any act boundary.
