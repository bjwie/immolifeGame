# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # one-time setup
npm run dev          # Vite dev server on http://localhost:3000 (auto-opens)
npm run build        # tsc (typecheck) && vite build — strict, will fail on unused locals/params
npm run preview      # serve the production build locally
```

There is no test runner, linter, or formatter configured. `npm run build` is the only correctness gate — `tsconfig.json` has `strict`, `noUnusedLocals`, and `noUnusedParameters` enabled, so dead code breaks the build.

Append `?skip=1` to the dev URL (or set `window.__immolife_autostart = true`) to bypass the start screen and boot straight into the game — useful when iterating on `CityScene3D`.

## Critical: v1 vs v2 split

The repo contains two parallel implementations. **Only `src/v2/` is live.**

- `tsconfig.json` has `"include": ["src/v2/**/*"]` and `"exclude": ["src/_legacy", ...]` — anything under `src/_legacy/` is not compiled and not reachable. Do not import from it; do not "fix" it.
- `index.html` loads `/src/v2/main.ts` as the entry point.
- `README.md`, `WORLD_DESIGN_GUIDE.md`, and `POPOVER_EXAMPLES.md` describe the **legacy** v1 architecture (`GameManager`, `WorldManager`, `UILibraries`, tippy.js popovers, `src/scenes/GameScene.ts`, `src/managers/...`). None of that exists in v2. Treat those docs as historical.
- Several `package.json` deps (`tippy.js`, `chart.js`, `sweetalert2`, `toastify-js`, `lodash`) are leftover from v1 and are **not imported** by v2. The HUD's net-worth chart is a hand-rolled canvas (`ChartCanvas` in `HUD.ts`), not Chart.js.
- v2 was originally a 2D top-down Phaser game; it is now a **first-person 3D city built on Three.js**. Phaser is gone from `package.json`. Any doc or commit message mentioning Phaser sprites/scenes for v2 is historical.

When the user asks for game changes, always work in `src/v2/`.

## v2 architecture

### Layer overview
```
main.ts              boot, start screen, CityScene3D construction
  └─ three/CityScene3D   first-person Three.js scene — camera, world, input, engine wiring
       ├─ world/cityLayout     pure 60×24 tile grid + 10 districts (6 playable + 4 locked)
       ├─ world/buildingStyle  pure deterministic style rolls (palette, storeys, roof, subtype)
       ├─ three/metrics        tile grid → metres (variable column/row widths)
       ├─ three/ground         paints the tile art onto the ground canvas at true scale
       ├─ three/facade         lot-fitted massing + canvas facade textures (cached by style key)
       ├─ three/ambient        instanced cars + pedestrians
       └─ Engine               game state + simulation loop (no renderer deps)
            ├─ HUD                 \
            ├─ DealSheet            \  DOM overlays mounted into
            ├─ NegotiationModal     /  window.__overlayRoot, NOT the WebGL canvas
            ├─ RentalModal         /
            └─ MenuModal          /
```

### Engine is the source of truth
`src/v2/sim/Engine.ts` owns all game state (`Engine.state: GameState`) and the simulation tick. UI never mutates state directly — it calls Engine methods (`buy`, `sell`, `signLease`, `renovate`, `setSpeed`, `hireBroker`, `submitSellerOffer`, etc.) and listens for events.

Engine is a tiny event bus with `on(name, fn)` / `emit(name, data)`. Known event names emitted from `Engine`:
`day`, `month`, `year`, `bought`, `sold`, `renovated`, `leaseSigned`, `speed`, `event`, `toast`, `achievement`, `financial`, `reset`, `brokerChanged`. Add a new event by emitting it in `Engine.ts` and subscribing wherever you need a UI refresh — never poll.

The Engine has zero renderer imports — it only depends on `CityLayout` from `src/v2/world/cityLayout.ts` for buildable tile coordinates. Keep it that way; the 3D scene depends on Engine, not the reverse. (`world/` modules are pure: no Three.js, no DOM beyond canvas-free logic.)

### Time loop
`Engine.tick()` runs on `setInterval` at `dayDurationMs (1200) / speed`. 30 days = 1 month → triggers `processMonth()` (degradation, rent, loans, market events, autosave). Speed `0` clears the interval (pause). Valid speeds: `[0, 1, 2, 4, 8]` from `SPEEDS` in `types.ts`.

### Save/load
Single localStorage key: `immolife_v2_save`, JSON of `{ state, v: 2, ts }`. `Engine` constructor auto-loads unless `{ freshStart: true }`. `processMonth()` calls `autoSave()` every in-game month. Market `events` carry function references (`apply`) so they are **wiped on load** — `tryLoad` clears them. When adding new fields to `GameState`, add a migration default in `tryLoad()` (see existing `negotiationSkill`, `bankRelations`, `brokerId` migrations) — old saves are common.

### Scene ↔ Engine sync (CityScene3D)
`CityScene3D.refreshProperties()` reconciles building groups with `engine.state.listings + engine.state.owned`. Triggered on `bought / sold / renovated / renovationStart / renovationDone / leaseSigned / month / reset`. Each active property has a `snapshotKey` (condition bucket, owned, renovation, vacancy, nomad-outed) — when it changes, the whole group is disposed and respawned (facade textures are cached, so this is cheap). Price-tag text is updated in place.

**Filler city:** every `buildableSpot` without an active property carries an instanced backdrop building (`buildFillers()`), so the city always looks fully built. Fillers are batched `InstancedMesh`es keyed by style, deterministic per tile, non-purchasable — clicking one shows an info toast. When the engine spawns a listing on a filled tile, the reconcile swap happens automatically via the occupied-tile key.

### First-person input
Click the canvas → pointer lock (mouse look + WASD/arrows, Shift sprint, crosshair raycast; click = open DealSheet / locked-district info). If pointer lock is unavailable (some embeds), the scene falls back to **drag-to-look + cursor picking** with 2D-style hover tooltips — don't remove this path, it's what makes the game testable in embedded browsers. Space toggles pause; ESC opens the menu when no modal is open (`ModalManager` eats ESC in capture phase otherwise; while pointer-locked the browser consumes ESC to exit the lock). Movement collides with building footprints (axis-separated slide), the plaza fountain, world bounds, and locked districts (bump → progress toast).

### Districts and types
The 10 Berlin districts (6 playable + 4 locked edge teasers) are defined in `world/cityLayout.ts` with `priceMultiplier` / `rentMultiplier` / `trend`. IDs are ASCII: `mitte | prenzlauer | kreuzberg | charlottenburg | wedding | neukoelln` + locked `spandau | steglitz | lichtenberg | marzahn`. Building kinds: `house | apartment | office | shop | tower | villa` — the `BuildingKind` type from `world/buildingStyle.ts` is re-exported via `types.ts` as `PropertyType`.

### World scale (`three/metrics.ts`) — read this before touching geometry
The tile grid is uniform, but **metres are not**. A uniform tile size makes a sidewalk as wide as a boulevard and forces buildings to overlap their neighbours, which is exactly what `metrics.ts` exists to prevent. Columns and rows get widths by what they carry:

```
columns (period 6):  road 11m | walk 4.5m | build 15m ×3 | walk 4.5m
rows    (period 4):  road 11m | walk 4.5m | build 22m | walk 4.5m
```

That yields a ~20 m facade-to-facade street and a 15 × 22 m lot — Berlin Blockrand proportions. Never convert tiles to metres by multiplying; always go through `tileCenter` / `tileRect` / `tileAtWorld`. World size is ~661 × 270 m.

**Footprints come from the lot, never from the style.** `dimsFor(style, lot)` sizes the body from the lot it stands on: party-wall kinds fill their lot exactly (so neighbours butt together and both streets get a flush facade), detached kinds (house/villa) keep gardens. Buildings therefore *cannot* interpenetrate, whatever the style rolls. `BuildingStyle` carries storeys + storey height, not pixel dimensions; total height is `bodyHeight(style)`.

Party-wall flanks render as blank Brandmauern (`facadeTexture(..., 'firewall', ...)`), which is what you see where a neighbour is shorter. Faces are `front` (+z, street), `back` (−z), `side`/`firewall` (±x).

**The sun must stay on the +z side.** Every lot fronts +z, so a sun with a negative z component puts every street facade in the city in permanent shade.

### Rendering only what's in view
- Filler buildings are batched per **(block, style)** so each `InstancedMesh` has a small bounding sphere; `computeBoundingSphere()` is called after filling the matrices, otherwise the frustum can't cull them.
- `camera.far` (380 m) is the cheap occlusion budget — the frustum drops whole blocks past it and the fog (70–350 m) hides the cut. Raising `far` re-adds those draw calls.
- The directional light's shadow camera is deliberately tiny (±48 m): shadow casting ignores the view frustum, so every metre of that box costs draw calls every frame.
- Sanity check: looking at the ground should cost far fewer draw calls than looking down a street (~190 vs ~600). If they're equal, culling has regressed.

### CSS2D labels
Price tags / chips / district banners are `CSS2DObject`s. Two rules:
- **Never animate `transform` in CSS on the mounted element** — `CSS2DRenderer` writes `transform` to position it, and a CSS animation silently overrides that, parking every label in the screen corner. Animate an inner element instead (see `.price-tag-3d .ptg-inner`).
- They have no depth test, so `fadeLabelsByDistance()` distance-fades them, hides them off-screen, and raycasts for occlusion (ignoring hits on the label's own building). Labels hang over the street-facing eave, not the roof centre, or the sight line passes through their own building.

### Procedural rendering
`three/facade.ts` paints per-style canvas facade textures that wrap `BoxGeometry` buildings, storey by storey at true scale (`RES` px per metre); cached by a deterministic style key, `NearestFilter` for the crisp pixel look. It ports the old 2D visual language: Altbau (Stuck pediments, cornice, balcony rails), Plattenbau (panel seams), Neubau (Bandfenster, anthracite cap), ground-floor Ladenlokal with sign band and awning, office/tower lobbies, **condition patina** (tint, cracks <50, boarded windows <25, bucketed by 5), and **district skins** (Kreuzberg graffiti, Prenzlauer drainpipes, Neukoelln awnings, ...). `rollStyle(kind, seed, condition, district)` in `world/buildingStyle.ts` is deterministic given seed, so styles are save-stable.

Roofs come from `roofPieces()`: gable (a flat-shaded prism with its ridge along the street), hip (pyramid, freestanding kinds), or a parapet band for flat roofs. Both market buildings and instanced fillers go through it, so they always match.

State markers on buildings: gold sprite badge = owned, CSS2D chips = price tag / `ZU VERMIETEN` / nomad warning, 3D scaffold group = active renovation. CSS2D labels distance-fade (`fadeLabelsByDistance`) so the horizon doesn't pile up with banners.

### DOM overlay
`window.__overlayRoot` is created in `main.ts` and is the mount point for HUD and all modals. They live as siblings of the WebGL canvas (plus a `CSS2DRenderer` layer for world-anchored labels), styled by `src/v2/ui/styles.css`. CSS variables (`--bg`, `--accent`, `--muted`, etc.) defined there drive the whole UI palette — prefer them over hardcoded colors.

### Modal stack (`ModalManager`)
All modals (`DealSheet`, `MenuModal`, `NegotiationModal`, `RentalModal`) go through `src/v2/ui/ModalManager.ts` (singleton via `ModalManager.get()`). Rules to follow when adding a new modal:

- Don't set `style.display`, `style.opacity`, or `style.visibility` from JS — visibility is owned by the manager via the `.show` class. CSS pattern is `#my-modal { display: none } #my-modal.show { display: flex }`.
- Don't attach your own backdrop click handler — the manager wires one on first `push` and only fires it for the top modal. Inner `[data-close]` / `[data-cancel]` buttons attach their own listeners as normal (clicks on inner elements bypass the backdrop check via `e.target !== modal.el`).
- Provide a `ManagedModal` descriptor with an `onCancel` that performs cleanup and ends in `pop`. ESC and backdrop click both route through `onCancel`. If your modal has callbacks to a parent (like `NegotiationModal`'s `onAccepted` / `onCancelled`), capture them into locals before calling `close()` — `close()` clears state.
- Only the top modal is shown; lower modals lose `.show` to keep their state but stop painting (no compounding backdrops). They're restored when the top is popped.

ESC handling: the manager listens on `document` in capture phase and `stopPropagation`s when the stack is non-empty, so the ESC key handler in `CityScene3D` only fires when no modal is open (and uses that to open the main menu).

## Conventions

- Strings shown to the user are German and use ASCII transliteration (`ae/oe/ue/ss`) — match this style. Existing strings like `"Kreditrate verpasst!"` and `"Eigenkapital reicht nicht"` set the tone.
- Money: always render via `formatEuro()` exported from `Engine.ts` (no ad-hoc `toLocaleString`).
- New gameplay numbers (rents, multipliers, thresholds) live as inline constants in `Engine.ts` — there is no central config file, and that's intentional for a game this size.
- Random generation inside Engine uses `this.rng(salt)` (mulberry32 seeded by `rngSeed + time.total`) so monthly rolls are reproducible per save. Don't reach for `Math.random()` inside Engine logic.
