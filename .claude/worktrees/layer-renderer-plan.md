# Layer Renderer Plan

## Phase 1 — Layer-Architektur einziehen (Verhaltens-Parity, kein neues Visual)
- [x] 1.1 Lege src/v2/render/layers/ an. Definiere Layer-Interface in layers/Layer.ts:
       export interface PaintContext { kind, subtype?, district?, condition, ownedBadge, seed, style }
       export interface BakedLayer { key(ctx): string; paint(g, ctx): void }
       export interface RuntimeLayer { id: string; applies(ctx): boolean;
         mount(scene, ctx): Phaser.GameObjects.GameObject; }
- [x] 1.2 Extrahiere die 6 drawX-Methoden in layers/base/{House,Villa,Apartment,Shop,Office,Tower}Base.ts
       als BakedLayer. Jeder ruft die existierenden Primitives drawWindow/drawCracks/mixColor.
- [x] 1.3 Extrahiere drawCracks + condition mixColor in layers/ConditionPatinaLayer.ts als BakedLayer
       (vorerst noch baked, in Phase 2 wird daraus ein Runtime-Layer).
- [x] 1.4 Extrahiere drawOwnedBadge in layers/OwnedBadgeLayer.ts als BakedLayer (vorerst).
- [x] 1.5 BuildingRenderer.ensureTexture: ersetze switch durch Layer-Komposition.
       textureKey wird die Konkatenation der Layer.key()-Strings.
- [x] 1.6 `npm run build` muss gruen sein. Visuelle Parity: starte Dev-Server, oeffne mit ?skip=1,
       mache Screenshot via preview_screenshot. Keine sichtbaren Veraenderungen erwartet.
- [ ] 1.7 Commit: "Phase 1: extract BuildingRenderer into Layer pipeline (parity)"

## Phase 2 — Sprite-Stack: State-Layers werden Runtime
- [ ] 2.1 CityScene.spawnPropertySprite: erstelle einen Phaser.Container statt nackter Sprite.
       Container haelt: baseSprite (immer da) + Slot fuer ueberlay-Sprites.
       Click/Hover-Handler vom Container, nicht vom baseSprite.
- [ ] 2.2 OwnedBadgeLayer wird RuntimeLayer (kleiner gebackener Sprite ueberlay statt baked-in).
       textureKey verliert das 'O'-Suffix.
- [ ] 2.3 ConditionPatinaLayer wird RuntimeLayer (overlay-Sprite mit cracks + tint-rect).
       textureKey verliert die condition-Bucket-Zahl. Cache shrinkt drastisch.
- [ ] 2.4 CityScene.refreshProperties: bei `bought`/`sold`/`renovated`/`leaseSigned` Events
       NICHT mehr destroy+respawn. Nur Overlay-Sprites toggeln/re-mounten.
       Nur bei NEUEN listings spawnen, nur bei verschwundenen entfernen.
- [ ] 2.5 `npm run build` gruen. Dev-Server: kaufen/verkaufen/renovieren - Building bleibt stabil,
       Badge erscheint/verschwindet smooth, kein Flicker. Screenshot-Vergleich.
- [ ] 2.6 Commit: "Phase 2: runtime sprite-stack for state overlays"

## Phase 3 — DistrictSkinLayer
- [ ] 3.1 Erweitere PaintContext um district (mitte|prenzlauer|kreuzberg|charlottenburg|wedding|neukoelln).
       CityScene/CityRenderer reicht district mit, wenn Building gespawnt wird.
- [ ] 3.2 Lege layers/DistrictSkinLayer.ts an als BakedLayer. Pro District eine Skin-Definition:
       - mitte: clean, kuehl, weiss/grau-bias, mehr Glas
       - prenzlauer: Altbau-warmth, Erker-Hint, beige/sand
       - kreuzberg: Graffiti-Tags am Sockel (kleine Pixel-Glyphen), saturierter, gruen/orange-Akzente
       - charlottenburg: Stuck-Verzierung am Dachsims, gedeckte Pastelle, weiss-creme
       - wedding: utilitaer, kuehlgrau, weniger Akzentfarbe
       - neukoelln: warme Mid-tones, mehr Schilder/Markisen-Hint
       Skin moduliert die palette des base UND zeichnet 1-3 distinkte Motiv-Pixel-Glyphen.
- [ ] 3.3 Wire district in BuildingRenderer.ensureTexture und in textureKey ein.
- [ ] 3.4 `npm run build` gruen. Dev: Stadtansicht zeigt sichtbar verschiedene Distrikte.
       Screenshot mit weit rausgezoomter Kamera (preview_eval kann camera.zoom setzen),
       6 Distrikte erkennbar unterschiedlich.
- [ ] 3.5 Commit: "Phase 3: per-district visual skins"

## Phase 4 — RenovationScaffoldLayer + OccupancyMarkerLayer
- [ ] 4.1 layers/RenovationScaffoldLayer.ts als RuntimeLayer:
       applies(ctx) = ctx.engineProperty.renovation?.activeUntil > now
       mount: gelbe Geruest-Pixel-Sprites entlang einer Wand, optional kleines Kran-Element oben.
- [ ] 4.2 layers/OccupancyMarkerLayer.ts als RuntimeLayer mit 3 Sub-Sprites:
       - vacant: kleines "ZU VERMIETEN" Schild (rot-weiss) wenn unit leer
       - nomad: kleines Warn-Icon wenn Tenant.isNomad
       - forSale: Preis-Tag (existiert evtl schon — falls ja, hier integrieren)
- [ ] 4.3 CityScene reagiert auf engine-events (renovated, leaseSigned, month) und ruft
       refreshOverlays(propertyId) — geht alle RuntimeLayer durch und mounted/entfernt.
- [ ] 4.4 `npm run build` gruen. Dev: Renovation starten -> Geruest erscheint. Mietnomade
       erkannt -> Marker erscheint. Verkauf -> alle Overlays sauber abgebaut.
       Screenshots dokumentieren jeden State.
- [ ] 4.5 Commit: "Phase 4: scaffold + occupancy state overlays"

## Phase 5 — Apartment-Subtypen (Altbau/Plattenbau/Neubau)
- [ ] 5.1 Erweitere BuildingStyle um optional subtype: 'altbau' | 'plattenbau' | 'neubau' (nur fuer apartment).
       BuildingRenderer.rollStyle: subtype seed-deterministisch rollen, optional district-gewichtet
       (Plattenbau wahrscheinlicher in wedding/neukoelln, Altbau in prenzlauer/charlottenburg).
- [ ] 5.2 Splitte ApartmentBase.ts in 3 Varianten mit klar verschiedener Optik:
       - altbau: Erker, Stuck am Sims, hohe schmale Fenster, warme Palette
       - plattenbau: Raster-Fenster gleichmaessig, kuehl-grau, repetitiv, Beton-Akzent
       - neubau: grosse Glasflaechen, klare Linien, weiss/anthrazit
- [ ] 5.3 textureKey enthaelt subtype.
- [ ] 5.4 `npm run build` gruen. Dev: mehrere Apartments nebeneinander zeigen 3 unterscheidbare Subtypen.
- [ ] 5.5 Commit: "Phase 5: apartment subtypes (altbau/plattenbau/neubau)"

## Phase 6 — Polish + Cleanup
- [ ] 6.1 PNG-Asset-Override (preloadAssets) narrowen: Asset-Texture ersetzt nur die BASE,
       alle RuntimeLayer (badge, patina, scaffold, occupancy) laufen weiterhin drueber.
- [ ] 6.2 LRU-Cache MAX_CACHE Cap pruefen — sollte mit Phase 2 deutlich kleiner werden, ggf. auf 200 senken.
- [ ] 6.3 BuildingRenderer-Klasse final pruefen: ist sie jetzt deep (kleines Interface,
       viel Verhalten)? ensureTexture+rollStyle sollten die einzigen oeffentlichen Methoden bleiben.
       Alles drawX, drawWindow etc. sind Layer-intern.
- [ ] 6.4 Lese den finalen Renderer + Layer-Verzeichnis durch. Tote Methoden loeschen
       (CLAUDE.md sagt: keine backwards-compat Hacks).
- [ ] 6.5 `npm run build` gruen, Dev-Server: vollstaendiger Smoke-Test (kaufen, vermieten,
       renovieren, verkaufen) ohne visuelle Glitches. Final-Screenshots vom Stadtbild.
- [ ] 6.6 Commit: "Phase 6: polish, narrow asset override, cleanup"
