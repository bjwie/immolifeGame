# Rent Management Fix Plan

Ziel: Mietspiegel ist konsistent + sichtbar, Vermietung startet nicht
systematisch unter Mietspiegel, Mieterhoehung zeigt korrekte Lese-Richtung.

## Phase 1 — Mietspiegel an baseRent ankern
- [x] 1.1 Engine.genListing: `mietspiegelKalt = Math.round(finalBaseRent / 1.05)`
       statt mietspiegelFor(district, type). Damit ist eine Property bei
       baseRent automatisch +5% ueber Mietspiegel (legal, Mietpreisbremse OK).
       Annual maybeAdjustMietspiegel-Logik bleibt.
- [x] 1.2 Engine.tryLoad migration: re-derive `p.mietspiegelKalt = round(p.baseRent / 1.05)`
       fuer alle listings + owned beim Laden (in `migrateProperty`). Heilt
       vorhandene Spielstaende.
- [x] 1.3 Engine.mietspiegelKaltForUnit(p, u): Helper. Single-unit -> p.mietspiegelKalt.
       MFH -> proportional zu u.baseKalt/sum(baseKalt). Liefert die per-Unit-Referenz
       die UI + raiseRent verwenden.
- [x] 1.4 `npm run build` gruen. Eval: vorhandene Property zeigt baseRent ~ 1.05x mietspiegelKalt.
- [x] 1.5 Commit: "Phase 1: anchor Mietspiegel to baseRent"

## Phase 2 — RentalModal: korrekter Default + Mietspiegel-Hinweis
- [x] 2.1 RentalModal.open: default `askingRent = Math.max(u.baseKalt, Math.round(mietspiegelUnit * 1.05))`
       wobei mietspiegelUnit = Engine.mietspiegelKaltForUnit(p, u). Damit startet
       die Vermietung am legalen Top-of-Market.
- [x] 2.2 RentalModal Slider-Bereich: minRent bleibt 0.4x baseKalt, maxRent neu
       max(0.4x..1.6x baseKalt, mietspiegelUnit * 1.30) — erlaubt Mietpreisbremse-
       Verstoss bewusst. Sonst kann der Spieler nie ueber Mietspiegel asken.
- [x] 2.3 RentalModal rent-display: zusaetzliche Zeile zeigt
       "Mietspiegel: <X> EUR — du verlangst Y% darueber/darunter" (signiert), updates
       live mit dem Slider.
- [x] 2.4 `npm run build` gruen. Browser: Vermietung oeffnen, slider startet bei +5%
       ueber Mietspiegel, Hinweis live aktualisiert.
- [x] 2.5 Commit: "Phase 2: rental modal anchors on Mietspiegel"

## Phase 3 — Rent-Hike Modal + Tenant Tab Anzeige
- [ ] 3.1 Engine.rentHikeRisk akzeptiert optional unitId; nutzt mietspiegelKaltForUnit
       wenn vorhanden. raiseRent ebenso. UI-Vergleich wird per-Unit korrekt.
- [ ] 3.2 DealSheet.openRentHike: ersetze Anzeige
       "(${(r.ratio*100-100)}% ueber Mietspiegel)"
       durch signed-Variante: ueber/unter mit positiven Zahlen, Spiegel-Wert per-Unit.
- [ ] 3.3 DealSheet Tenant-Tab Kaltmiete-Anzeige: rechts daneben kleines Tag
       "X% vs Mietspiegel" (signiert, gruen wenn 100-110, gelb 110-120, rot >120
       oder <80).
- [ ] 3.4 `npm run build` gruen. Browser-Smoke-Test:
       - Single-Unit Property -> rent-hike-modal zeigt korrekte Mietspiegel-Ratio
       - MFH -> rent-hike fuer eine Einheit nutzt per-Unit-Mietspiegel
       - Tenant-Tab zeigt "5% ueber Mietspiegel" als Tag
- [ ] 3.5 Commit: "Phase 3: per-unit Mietspiegel in rent-hike + tenant display"

## Sicherheits-Regeln
- Nie src/_legacy/ oder tsconfig.json includes/excludes anfassen.
- Engine bleibt 0-Phaser-Imports.
- Save-Migration absichern: aelter Spielstaende laden ohne Datenverlust.
- Strings deutsch, ASCII-only (ae/oe/ue/ss).
- Browser-Verifikation per preview_screenshot, nicht User bitten.

## Iterations-Regel (kompakt)
1. Plan-Datei lesen, ersten `- [ ]` finden, ausfuehren, `- [x]`.
2. `npm run build` muss gruen sein.
3. Bei `X.5 Commit:`-Schritt committen.
4. Phase fertig+committed: STOP fuer diese Iteration.
5. Alle fertig: Abschluss-Zusammenfassung, kein ScheduleWakeup mehr.
