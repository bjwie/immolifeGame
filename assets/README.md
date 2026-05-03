# 🎨 2D World Assets Guide

> **v2 (current): only `assets/v2/buildings/` is used.** Drop optional PNGs there to override the procedural buildings. The legacy paths below describe the v1 build and are kept for historical reference.

## v2 Override Pack (optional)

The v2 renderer draws every building procedurally with shadows, varied roofs and rooftop details. You can override that on a per-kind basis by dropping PNG sprites into:

```
assets/v2/buildings/<kind>_NN.png
```

Where `<kind>` is one of `house`, `villa`, `apartment`, `shop`, `office`, `tower`, and `NN` is `01` through `04` (you can supply 1-4 variants per kind; the renderer picks deterministically by the property's `styleSeed`).

Examples that the renderer will pick up automatically:

```
assets/v2/buildings/house_01.png
assets/v2/buildings/house_02.png
assets/v2/buildings/apartment_01.png
assets/v2/buildings/tower_01.png
```

Missing files are silently ignored — the renderer falls back to procedural drawing for any kind that has no PNGs. You can mix: providing only `house_01.png` keeps every other building procedural.

### Recommended source: Kenney CC0 packs

- [Kenney – Tiny Town](https://kenney.nl/assets/tiny-town) — top-down 16×16
- [Kenney – City](https://kenney.nl/assets/city) — top-down buildings
- [Kenney – Toy Town](https://kenney.nl/assets/toy-town) — bigger isometric pieces

All Kenney packs are public domain (CC0) — no attribution required, no licence file needed. After downloading, pick sprites that fit the game's roughly **64-pixel-wide** silhouette and rename them into the `<kind>_NN.png` scheme above.

### Sprite anchoring

The renderer treats the bottom-center of the PNG as the ground anchor (origin 0.5, 0.85 in Phaser). For best results, keep your PNG's empty space at the top so taller buildings still align with the tile baseline.

## 📁 Asset Structure (legacy v1)

```
assets/
├── world/
│   ├── terrain/
│   │   ├── grass.png          # Gras-Textur
│   │   ├── concrete.png       # Beton/Gehweg
│   │   ├── asphalt.png        # Straßenbelag
│   │   ├── water.png          # Wasser-Textur
│   │   └── park.png           # Park-Bereiche
│   ├── roads/
│   │   ├── road-horizontal.png    # Horizontale Straße
│   │   ├── road-vertical.png      # Vertikale Straße
│   │   ├── road-cross.png         # Kreuzung
│   │   ├── road-corner-tl.png     # Ecke oben-links
│   │   ├── road-corner-tr.png     # Ecke oben-rechts
│   │   ├── road-corner-bl.png     # Ecke unten-links
│   │   └── road-corner-br.png     # Ecke unten-rechts
│   ├── infrastructure/
│   │   ├── streetlight.png    # Straßenlaternen
│   │   ├── traffic-light.png  # Ampeln
│   │   ├── bus-stop.png       # Bushaltestellen
│   │   ├── park-bench.png     # Parkbänke
│   │   ├── tree-small.png     # Kleine Bäume
│   │   ├── tree-large.png     # Große Bäume
│   │   ├── fountain.png       # Brunnen
│   │   └── statue.png         # Statuen
│   └── districts/
│       ├── residential-bg.png     # Wohngebiet-Hintergrund
│       ├── commercial-bg.png      # Gewerbegebiet-Hintergrund
│       ├── office-bg.png          # Bürogebiet-Hintergrund
│       └── industrial-bg.png      # Industriegebiet-Hintergrund
├── buildings/
│   ├── residential/
│   │   ├── house-small.png        # Einfamilienhaus
│   │   ├── house-large.png        # Villa
│   │   ├── apartment-small.png    # Kleines Mehrfamilienhaus
│   │   ├── apartment-large.png    # Großes Apartment-Komplex
│   │   └── townhouse.png          # Reihenhaus
│   ├── commercial/
│   │   ├── shop-small.png         # Kleiner Laden
│   │   ├── shop-large.png         # Großes Geschäft
│   │   ├── restaurant.png         # Restaurant
│   │   ├── hotel.png              # Hotel
│   │   └── mall.png               # Einkaufszentrum
│   ├── office/
│   │   ├── office-small.png       # Kleines Bürogebäude
│   │   ├── office-medium.png      # Mittleres Bürogebäude
│   │   ├── office-tower.png       # Büroturm
│   │   └── coworking.png          # Coworking Space
│   └── special/
│       ├── construction.png       # Baustelle
│       ├── demolished.png         # Abgerissenes Gebäude
│       └── for-sale.png           # Verkaufsschild
├── effects/
│   ├── particles/
│   │   ├── money.png              # Geld-Partikel
│   │   ├── sparkle.png            # Glitzer-Effekt
│   │   ├── dust.png               # Staub-Effekt
│   │   └── smoke.png              # Rauch-Effekt
│   ├── animations/
│   │   ├── construction-anim.png  # Bau-Animation
│   │   ├── money-flow.png         # Geld-Flow Animation
│   │   └── renovation.png         # Renovierungs-Animation
│   └── overlays/
│       ├── rain.png               # Regen-Overlay
│       ├── snow.png               # Schnee-Overlay
│       └── fog.png                # Nebel-Overlay
└── ui/
    ├── panels/
    │   ├── info-panel.png         # Info-Panel Hintergrund
    │   ├── time-panel.png         # Zeit-Panel Hintergrund
    │   └── bank-panel.png         # Bank-Panel Hintergrund
    ├── buttons/
    │   ├── button-normal.png      # Normaler Button
    │   ├── button-hover.png       # Hover-Zustand
    │   └── button-pressed.png     # Gedrückter Zustand
    └── icons/
        ├── money-icon.png         # Geld-Symbol
        ├── property-icon.png      # Immobilien-Symbol
        └── time-icon.png          # Zeit-Symbol
```

## 🎨 Design Guidelines

### Farbpalette
- **Wohngebiet**: Grüntöne (#27ae60, #2ecc71)  
- **Gewerbegebiet**: Orangetöne (#f39c12, #e67e22)
- **Bürogebiet**: Blautöne (#3498db, #2980b9)
- **Straßen**: Grautöne (#34495e, #2c3e50)
- **Parks**: Hellgrün (#58d68d, #82e0aa)

### Stilrichtung
- **Isometrisch** oder **Top-Down** Perspektive
- **Pixel Art** Stil (32x32, 64x64 oder 128x128)
- **Konsistente Lichtrichtung** (oben-links)
- **Einheitliche Auflösung** für alle Assets

### Gebäude-Design
- Verschiedene **Höhen** für Variation
- **Schatten** für Tiefe
- **Details** wie Fenster, Türen, Balkone
- **Zustandsanzeiger** (gut, mittel, schlecht)

## 📐 Technical Specifications

### Bildgrößen
- **Gebäude**: 64x64px bis 128x128px
- **Straßen**: 64x64px (Tiles)
- **Infrastruktur**: 32x32px bis 64x64px
- **Effekte**: 16x16px bis 32x32px

### Dateiformate
- **PNG** mit Transparenz
- **32-bit** für beste Qualität
- **Optimiert** für Web (unter 50KB pro Asset)

### Naming Convention
```
[category]-[type]-[size/variant].png

Beispiele:
- building-house-small.png
- road-horizontal-normal.png
- effect-money-particle.png
```

## 🗺️ World Layout System

### Grid-System
- **Tile-basiert**: 64x64px Grid
- **Koordinaten**: (x, y) System
- **Layers**: Terrain → Roads → Buildings → Effects

### Zoning System
```javascript
const zones = {
  residential: { color: 0x27ae60, density: 'medium' },
  commercial: { color: 0xf39c12, density: 'high' },
  office: { color: 0x3498db, density: 'high' },
  industrial: { color: 0x9b59b6, density: 'low' },
  park: { color: 0x2ecc71, density: 'none' }
}
```

## 🎮 Implementation Tips

1. **Layer Management**: Verwenden Sie `setDepth()` für korrekte Reihenfolge
2. **Asset Loading**: Laden Sie Assets asynchron mit Progress-Anzeige
3. **Memory Management**: Zerstören Sie nicht verwendete Sprites
4. **Performance**: Verwenden Sie Sprite Atlases für bessere Performance
5. **Responsive Design**: Skalieren Sie basierend auf Bildschirmgröße 