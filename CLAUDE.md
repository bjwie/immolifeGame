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

Append `?skip=1` to the dev URL (or set `window.__immolife_autostart = true`) to bypass the start screen and boot straight into the game — useful when iterating on `CityScene`.

## Critical: v1 vs v2 split

The repo contains two parallel implementations. **Only `src/v2/` is live.**

- `tsconfig.json` has `"include": ["src/v2/**/*"]` and `"exclude": ["src/_legacy", ...]` — anything under `src/_legacy/` is not compiled and not reachable. Do not import from it; do not "fix" it.
- `index.html` loads `/src/v2/main.ts` as the entry point.
- `README.md`, `WORLD_DESIGN_GUIDE.md`, and `POPOVER_EXAMPLES.md` describe the **legacy** v1 architecture (`GameManager`, `WorldManager`, `UILibraries`, tippy.js popovers, `src/scenes/GameScene.ts`, `src/managers/...`). None of that exists in v2. Treat those docs as historical.
- Several `package.json` deps (`tippy.js`, `chart.js`, `sweetalert2`, `toastify-js`, `lodash`) are leftover from v1 and are **not imported** by v2. The HUD's net-worth chart is a hand-rolled canvas (`ChartCanvas` in `HUD.ts`), not Chart.js.

When the user asks for game changes, always work in `src/v2/`.

## v2 architecture

### Layer overview
```
main.ts            boot, start screen, Phaser game construction
  └─ CityScene     single Phaser scene — owns camera, world, sprites
       ├─ CityRenderer       generates 36×24 tile grid + 6 districts (procedural)
       ├─ BuildingRenderer   procedural pixel-art building textures (cached by style key)
       └─ Engine             game state + simulation loop (no Phaser deps)
            ├─ HUD                 \
            ├─ DealSheet            \  DOM overlays mounted into
            ├─ NegotiationModal     /  window.__overlayRoot, NOT Phaser
            ├─ RentalModal         /
            └─ MenuModal          /
```

### Engine is the source of truth
`src/v2/sim/Engine.ts` owns all game state (`Engine.state: GameState`) and the simulation tick. UI never mutates state directly — it calls Engine methods (`buy`, `sell`, `signLease`, `renovate`, `setSpeed`, `hireBroker`, `submitSellerOffer`, etc.) and listens for events.

Engine is a tiny event bus with `on(name, fn)` / `emit(name, data)`. Known event names emitted from `Engine`:
`day`, `month`, `year`, `bought`, `sold`, `renovated`, `leaseSigned`, `speed`, `event`, `toast`, `achievement`, `financial`, `reset`, `brokerChanged`. Add a new event by emitting it in `Engine.ts` and subscribing wherever you need a UI refresh — never poll.

The Engine has zero Phaser imports — it only depends on `CityLayout` from `CityRenderer` for buildable tile coordinates. Keep it that way; the renderer/scene depends on Engine, not the reverse.

### Time loop
`Engine.tick()` runs on `setInterval` at `dayDurationMs (1200) / speed`. 30 days = 1 month → triggers `processMonth()` (degradation, rent, loans, market events, autosave). Speed `0` clears the interval (pause). Valid speeds: `[0, 1, 2, 4, 8]` from `SPEEDS` in `types.ts`.

### Save/load
Single localStorage key: `immolife_v2_save`, JSON of `{ state, v: 2, ts }`. `Engine` constructor auto-loads unless `{ freshStart: true }`. `processMonth()` calls `autoSave()` every in-game month. Market `events` carry function references (`apply`) so they are **wiped on load** — `tryLoad` clears them. When adding new fields to `GameState`, add a migration default in `tryLoad()` (see existing `negotiationSkill`, `bankRelations`, `brokerId` migrations) — old saves are common.

### Scene ↔ Engine sync (CityScene)
`CityScene.refreshProperties()` reconciles Phaser sprites with `engine.state.listings + engine.state.owned`. Triggered on `bought / sold / renovated / leaseSigned / month / reset`. When a property's owned-state flips, the sprite is destroyed and respawned because click/hover closures capture `isOwned` at spawn time — don't try to mutate the existing sprite in place.

The hover tooltip is a **DOM div** positioned in screen space using the camera transform (`(worldX - cam.scrollX) * cam.zoom`). It's hidden during pan/zoom because re-projecting fast feels worse than dropping it.

### Camera input
Pan: right-click drag, middle-click drag, or Shift+left-drag. Wheel = zoom (clamped 0.5–2.5). The browser context menu is suppressed in `setupInput()` so right-click works. Left-click on a building opens the DealSheet — but only if the pointer hasn't moved >6px (otherwise it was a pan).

### Districts and types
The 6 Berlin districts are defined in `CityRenderer.generate()` with `priceMultiplier` / `rentMultiplier` / `trend`. IDs are ASCII: `mitte | prenzlauer | kreuzberg | charlottenburg | wedding | neukoelln` (note: `neukoelln`, not `neukölln`). Building kinds: `house | apartment | office | shop | tower | villa` — the `BuildingKind` type from `BuildingRenderer.ts` is re-exported via `types.ts` as `PropertyType`.

### Procedural rendering
`BuildingRenderer.ensureTexture(scene, style, isOwned)` produces a deterministic texture key and caches generated textures globally (`textureCache`). Two builds with the same `style` + `isOwned` reuse the same texture — never regenerate textures per-frame. `BuildingRenderer.rollStyle(kind, seed, condition)` is deterministic given seed; condition is bucketed (`Math.round(p.condition / 5) * 5`) so minor wear doesn't churn textures.

### DOM overlay
`window.__overlayRoot` is created in `main.ts` and is the mount point for HUD and all modals. They live as siblings of the Phaser canvas, styled by `src/v2/ui/styles.css`. CSS variables (`--bg`, `--accent`, `--muted`, etc.) defined there drive the whole UI palette — prefer them over hardcoded colors.

### Modal stack (`ModalManager`)
All modals (`DealSheet`, `MenuModal`, `NegotiationModal`, `RentalModal`) go through `src/v2/ui/ModalManager.ts` (singleton via `ModalManager.get()`). Rules to follow when adding a new modal:

- Don't set `style.display`, `style.opacity`, or `style.visibility` from JS — visibility is owned by the manager via the `.show` class. CSS pattern is `#my-modal { display: none } #my-modal.show { display: flex }`.
- Don't attach your own backdrop click handler — the manager wires one on first `push` and only fires it for the top modal. Inner `[data-close]` / `[data-cancel]` buttons attach their own listeners as normal (clicks on inner elements bypass the backdrop check via `e.target !== modal.el`).
- Provide a `ManagedModal` descriptor with an `onCancel` that performs cleanup and ends in `pop`. ESC and backdrop click both route through `onCancel`. If your modal has callbacks to a parent (like `NegotiationModal`'s `onAccepted` / `onCancelled`), capture them into locals before calling `close()` — `close()` clears state.
- Only the top modal is shown; lower modals lose `.show` to keep their state but stop painting (no compounding backdrops). They're restored when the top is popped.

ESC handling: the manager listens on `document` in capture phase and `stopPropagation`s when the stack is non-empty, so the Phaser ESC key handler in `CityScene` only fires when no modal is open (and uses that to open the main menu).

## Conventions

- Strings shown to the user are German and use ASCII transliteration (`ae/oe/ue/ss`) — match this style. Existing strings like `"Kreditrate verpasst!"` and `"Eigenkapital reicht nicht"` set the tone.
- Money: always render via `formatEuro()` exported from `Engine.ts` (no ad-hoc `toLocaleString`).
- New gameplay numbers (rents, multipliers, thresholds) live as inline constants in `Engine.ts` — there is no central config file, and that's intentional for a game this size.
- Random generation inside Engine uses `this.rng(salt)` (mulberry32 seeded by `rngSeed + time.total`) so monthly rolls are reproducible per save. Don't reach for `Math.random()` inside Engine logic.
