# District Unlock Plan

Ziel: Die 4 gesperrten Distrikte (Spandau, Steglitz, Lichtenberg, Marzahn) durch
Spielfortschritt freischalten. Nach Unlock verhalten sie sich wie normale Distrikte
(Listings spawnen, Banner-Stil normal, Overlay weg).

## Phase 1 — Data model + Save migration
- [x] 1.1 GameState in src/v2/sim/types.ts erweitern um
       `unlockedDistricts: DistrictId[]` (Liste der nicht-gesperrten oder bereits
       freigeschalteten Distrikte). Initial bei freshState: alle 6 nicht-gesperrten.
- [x] 1.2 Engine.tryLoad migration: bump SAVE-Version von 3 auf 4.
       Wenn data.v < 4, set state.unlockedDistricts = alle Layout-Distrikte mit !locked.
- [x] 1.3 Helper Engine.isDistrictUnlocked(id: DistrictId): boolean
       — !district.locked || state.unlockedDistricts.includes(id).
- [x] 1.4 Engine.genListing/buildableSpots-Pfad: spots dynamisch filtern auf
       isDistrictUnlocked(). NIE auf der gecachten layout.buildableSpots verlassen
       wenn ein neuer Distrikt freigeschaltet wird.
- [x] 1.5 `npm run build` gruen.
- [x] 1.6 Commit: "Phase 1: unlock state + save migration v3->v4"

## Phase 2 — Unlock conditions
- [x] 2.1 Neue Datei src/v2/sim/UnlockConditions.ts mit einem Record
       Record<DistrictId, UnlockCondition | null> wobei UnlockCondition =
         { type: 'ownedCount' | 'netWorth' | 'reputation', threshold: number, label: string }
       Default-Werte:
         spandau:     { type: 'ownedCount', threshold: 3, label: 'Besitze 3 Immobilien' }
         steglitz:    { type: 'netWorth', threshold: 500000, label: 'Vermoegen 500.000 EUR' }
         lichtenberg: { type: 'ownedCount', threshold: 7, label: 'Besitze 7 Immobilien' }
         marzahn:     { type: 'netWorth', threshold: 1500000, label: 'Vermoegen 1.500.000 EUR' }
       Alle anderen Districts: null (immer entsperrt).
- [x] 2.2 Engine.unlockProgress(id): { current, threshold, ratio, label } | null —
       null fuer bereits entsperrte oder Distrikte ohne Condition.
- [x] 2.3 Engine.checkDistrictUnlocks(): in processMonth() aufgerufen. Pruefe alle
       lockedDistricts. Erfuellt -> push in state.unlockedDistricts, emit
       'districtUnlocked' { id, name, label }.
- [x] 2.4 `npm run build` gruen. Eval-Test (preview_eval): cash hochsetzen,
       processMonth() rufen, sehen dass districtUnlocked emittet wird.
- [x] 2.5 Commit: "Phase 2: unlock conditions + monthly check"

## Phase 3 — Visual unlock + Toast
- [x] 3.1 CityRenderer-Refactor: das Lock-Overlay (dunkler Wash + Hatch) NICHT
       mehr in city-bg backen. Stattdessen pro locked district eine eigene
       Phaser.GameObjects.Graphics ueber dem bg, gespeichert in einer Map
       lockOverlays: Map<DistrictId, Phaser.GameObjects.Graphics> auf der
       CityRenderer-Instanz.
- [x] 3.2 Banner pro District ebenfalls in Map<DistrictId, {bg, text}> halten,
       damit Update moeglich.
- [x] 3.3 Methode CityRenderer.unlockDistrictVisual(id): Tween Overlay alpha 1->0
       (~600ms) dann destroy; Banner-Text auf normalen Namen ohne 'GESPERRT - '
       und Banner-Color auf district.color setzen; district.locked = false.
- [x] 3.4 CityScene auf engine 'districtUnlocked' hoeren: ruft city.unlockDistrictVisual(id),
       zeigt einen prominenten Toast ("<Name> ist jetzt freigeschaltet!", success-Stil),
       triggert refreshProperties (damit neue Listings erscheinen koennen).
- [x] 3.5 `npm run build` gruen. Eval-Test: districtUnlocked emittet,
       Overlay faded weg, Banner aendert sich.
- [x] 3.6 Commit: "Phase 3: unlock animation + toast"

## Phase 4 — Listings spawnen im neuen Distrikt
- [ ] 4.1 Engine.onDistrictUnlocked: nach dem Unlock-Event sofort 1-3 Initial-Listings
       fuer den neuen Distrikt generieren (nicht erst auf naechsten Monats-Roll warten).
       Nutzt genListing(rng, id).
- [ ] 4.2 Verifizieren dass das monatliche Listing-Replenish die neuen Distrikte
       jetzt mit einbezieht. Falls Engine eine hartkodierte Distrikt-Liste hat
       (siehe `Engine.ts:623`), aus state.unlockedDistricts ableiten statt hardcode.
- [ ] 4.3 `npm run build` gruen. Eval-Test: Distrikt freischalten -> Listings sind
       sofort sichtbar dort.
- [ ] 4.4 Commit: "Phase 4: spawn listings in newly-unlocked districts"

## Phase 5 — Live-Progress im Banner
- [ ] 5.1 CityRenderer-Banner fuer locked districts mit Sub-Text:
       "GESPERRT - SPANDAU" + 2. Zeile "2/3 Immobilien" (kleinerer Font).
       Methode updateLockBanner(id, current, threshold).
- [ ] 5.2 Initial-Render: nutze engine.unlockProgress(id) um Banner-Sub-Text zu setzen.
- [ ] 5.3 Engine emit 'unlockProgress' nach jedem relevanten State-Change
       ('bought', 'sold', 'financial'). Payload: { id, current, threshold, ratio }.
- [ ] 5.4 CityScene hoert auf 'unlockProgress', ruft city.updateLockBanner(id, ...).
- [ ] 5.5 `npm run build` gruen. Visuell: Immobilie kaufen, Spandau-Banner
       aktualisiert Zaehler live.
- [ ] 5.6 Commit: "Phase 5: live unlock progress in locked banners"

## Phase 6 — Polish + Klick-Hint + Smoke-Test
- [ ] 6.1 Klick auf gesperrte Distrikt-Tile (per CityScene Pointer-Handler ueber
       der Distrikt-Bounds): zeigt einen kleinen Hint-Toast mit der
       Unlock-Condition ("Freischalten: <label>").
- [ ] 6.2 Refactor-Pruefung: alle Magic-Numbers fuer Unlock-Thresholds nur in
       UnlockConditions.ts. Kein Drift in Engine.ts.
- [ ] 6.3 Vollstaendiger Smoke-Test:
       - Frisches Spiel
       - Cash auf 600k setzen, processMonth -> Steglitz wird freigeschaltet,
         Overlay faded, Banner aendert sich, Listings erscheinen.
       - 3 Immobilien kaufen -> Spandau-Banner Counter steigt -> nach 3/3
         processMonth() schaltet Spandau frei.
       - Final-Screenshots fuer beide Unlocks.
- [ ] 6.4 Commit: "Phase 6: click-hint + final polish"

## Sicherheits-Regeln
- Nie src/_legacy/ oder tsconfig.json includes/excludes anfassen.
- Engine bleibt 0-Phaser-Imports.
- Strings deutsch, ASCII-only (ae/oe/ue/ss).
- Browser-Verifikation per preview_screenshot, nicht User bitten.
- Bei Build-Bruch Schritt nicht abhaken, naechste Iteration neu versuchen.

## Iterations-Regel (kompakt)
1. Lies diese Plan-Datei.
2. Finde ERSTEN `- [ ]` Schritt.
3. Fuehre ihn aus, hake `- [x]`.
4. `npm run build` — wenn rot, fix bevor commit.
5. Bei `X.6 Commit:`-Schritt committen (oder X.5 wenn Plan das angibt).
6. Phase fertig+committed: STOP fuer diese Iteration (User soll pruefen).
7. Alle Phasen fertig: Abschluss-Zusammenfassung, KEIN ScheduleWakeup mehr.
