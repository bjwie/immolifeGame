# 🌍 2D World Design Guide

## Übersicht

Ihr Immobilien-Spiel verfügt jetzt über ein vollständig anpassbares 2D-Weltsystem! Diese Anleitung zeigt Ihnen, wie Sie Ihre eigene Spielwelt erstellen und designen können.

## 🎮 Sofort loslegen

Das Spiel funktioniert **ohne zusätzliche Assets** - es generiert automatisch Placeholder-Grafiken:

```bash
npm run dev
```

Sie sehen jetzt:
- ✅ **Zonierte Stadtgebiete** (Wohnen, Gewerbe, Büros, Parks)
- ✅ **Automatisches Straßennetz** (Grid-basiert)
- ✅ **Intelligente Gebäude-Positionierung** (nach Zonen)
- ✅ **Infrastruktur** (Straßenlaternen, Bäume, Brunnen)
- ✅ **Animierte Umgebung** (bewegte Wolken)

## 🏗️ Weltarchitektur

### Layer-System
```
Depth 40: Effects (Wolken, Partikel)
Depth 30: Buildings (Ihre Immobilien)
Depth 20: Infrastructure (Bäume, Laternen)
Depth 10: Roads (Straßennetz)
Depth 0:  Terrain (Boden, Gras)
```

### Zonen-System
Jede Zone hat Eigenschaften:
- **Attractiveness**: Wie attraktiv ist die Gegend? (0-100)
- **Noise Level**: Lärmpegel (0-100)
- **Accessibility**: Verkehrsanbindung (0-100)

## 🎨 Welt-Templates

### 1. Grid City (Standard)
```typescript
const gridCity = WorldBuilder.getWorldTemplates()[0]
// Klassisches Raster-Layout mit klaren Zonentrennung
```

### 2. Organic City
```typescript
const organicCity = WorldBuilder.getWorldTemplates()[1]
// Natürlich gewachsene Stadt mit organischen Straßenverläufen
```

### 3. Coastal City
```typescript
const coastalCity = WorldBuilder.getWorldTemplates()[2] 
// Küstenstadt mit Hafen und Wasserflächen
```

### 4. Mountain Town
```typescript
const mountainTown = WorldBuilder.getWorldTemplates()[3]
// Bergstadt mit verschiedenen Höhenlagen
```

### 5. Metropolitan
```typescript
const metropolitan = WorldBuilder.getWorldTemplates()[4]
// Große Metropole mit dichten Geschäftsvierteln
```

## 🛠️ Eigene Welt erstellen

### Schritt 1: Zone definieren
```typescript
const myZone: WorldZone = {
  id: 'luxury_district',
  name: 'Luxusviertel',
  type: 'residential',
  color: 0xf1c40f, // Gold
  density: 'low',
  bounds: { x: 100, y: 100, width: 300, height: 200 },
  properties: {
    attractiveness: 95,
    noiseLevel: 20,
    accessibility: 85
  }
}
```

### Schritt 2: Welt-Konfiguration
```typescript
const myWorldConfig = WorldBuilder.createCustomWorld(
  'Meine Stadt',
  1200, // Breite
  800,  // Höhe
  [myZone, otherZone], // Zonen-Array
  'grid' // Straßenmuster
)
```

### Schritt 3: In GameScene verwenden
```typescript
// In src/scenes/GameScene.ts, initializeWorldManager() Methode:
const selectedTemplate = templates[1] // Organic City verwenden
// oder
const worldConfig = myWorldConfig // Eigene Konfiguration
```

## 🎯 Template wechseln

In `src/scenes/GameScene.ts`, Zeile ~150:

```typescript
private initializeWorldManager() {
  // ...
  const templates = WorldBuilder.getWorldTemplates()
  const selectedTemplate = templates[2] // 0-4 für verschiedene Templates
  // ...
}
```

**Template-Indices:**
- `0` = Grid City
- `1` = Organic City  
- `2` = Coastal City
- `3` = Mountain Town
- `4` = Metropolitan

## 📁 Assets hinzufügen

### Automatische Ordnerstruktur
Das System hat bereits alle Ordner erstellt:

```
assets/
├── world/
│   ├── terrain/     # Boden-Texturen
│   ├── roads/       # Straßen-Tiles
│   └── infrastructure/ # Bäume, Laternen
├── buildings/
│   ├── residential/ # Wohngebäude
│   ├── commercial/  # Geschäfte
│   └── office/      # Bürogebäude
```

### Echte Assets verwenden

1. **PNG-Dateien hinzufügen** (64x64px empfohlen):
```
assets/world/terrain/grass.png
assets/world/roads/road-horizontal.png
assets/buildings/residential/house-small.png
```

2. **Automatische Erkennung**: Das Spiel lädt automatisch echte Assets, falls vorhanden

3. **Fallback-System**: Ohne Assets werden farbige Platzhalter verwendet

## 🎨 Asset-Quellen

### Kostenlose Quellen:
1. **[Kenney.nl](https://kenney.nl/assets)** - CC0 License
   - "Modular Buildings" Pack
   - "Topdown Towers" Pack

2. **[OpenGameArt.org](https://opengameart.org)**
   - Suche: "top down buildings"
   - Verschiedene Lizenzen

3. **[Itch.io Asset Packs](https://itch.io/game-assets/free)**
   - Viele kostenlose Pixel-Art Assets

### Asset-Anforderungen:
- **Format**: PNG mit Transparenz
- **Größe**: 64x64px (empfohlen)
- **Stil**: Top-Down Ansicht
- **Dateigröße**: Unter 50KB pro Asset

## 🔧 Erweiterte Anpassung

### Straßenmuster ändern
```typescript
const worldConfig = {
  // ...
  streetPattern: 'organic', // 'grid', 'organic', 'mixed'
  terrainVariation: true
}
```

### Zone-Eigenschaften verstehen
```typescript
// Beeinflusst Immobilienpreise und Mieter-Präferenzen
properties: {
  attractiveness: 90,  // Höhere Preise bei >80
  noiseLevel: 30,      // Niedrigere Mieten bei >60
  accessibility: 85    // Bessere Verkaufsgeschwindigkeit bei >80
}
```

### Welt-Validierung
```typescript
const validation = WorldBuilder.validateWorldConfig(worldConfig)
if (!validation.valid) {
  console.log('Fehler:', validation.errors)
}
```

## 📊 Performance-Tipps

1. **Optimale Weltgröße**: 1200x800px
2. **Zone-Anzahl**: 4-8 Zonen für beste Performance
3. **Asset-Größe**: Unter 50KB pro Datei
4. **Tile-Größe**: 64x64px Standard

## 🎮 Spielmechanik-Integration

### Zone-basierte Immobilienpreise
- **Residential Zones**: Häuser und Apartments
- **Commercial Zones**: Geschäfte und Restaurants  
- **Office Zones**: Bürogebäude
- **Industrial Zones**: Lagerhallen und Fabriken
- **Parks**: Erhöhen Attraktivität der Umgebung

### Intelligente Positionierung
```typescript
// Immobilien werden automatisch in passenden Zonen platziert
const position = worldManager.getRandomBuildingPosition('residential')
if (position) {
  property.x = position.x
  property.y = position.y
  // Zone-Informationen verfügbar in position.zone
}
```

## 🚀 Nächste Schritte

1. **Template testen**: Probieren Sie verschiedene Templates aus
2. **Assets hinzufügen**: Laden Sie kostenlose Assets herunter
3. **Eigene Zonen**: Erstellen Sie Ihre eigene Weltkonfiguration
4. **Erweitern**: Fügen Sie neue Zone-Typen hinzu

## 💡 Tipps & Tricks

### Realistische Städte
- **Mixed-Use**: Kombinieren Sie verschiedene Zone-Typen
- **Transport**: Platzieren Sie Büros nahe Wohngegenden
- **Parks**: Erhöhen Attraktivität aller umliegenden Zonen

### Performance optimieren
- **Große Tiles**: 64x64px oder größer
- **Weniger Zonen**: 6-8 Zonen sind optimal
- **Sprite Atlases**: Kombinieren Sie Assets in Atlas-Dateien

### Visueller Stil
- **Konsistente Palette**: Verwenden Sie einheitliche Farben
- **Lichtrichtung**: Alle Schatten in gleiche Richtung
- **Auflösung**: Alle Assets in gleicher Pixeldichte

## 🎯 Beispiel: Eigene Küstenstadt

```typescript
// In GameScene.ts
private initializeWorldManager() {
  // Eigene Küstenstadt-Konfiguration
  const coastalZones: WorldZone[] = [
    {
      id: 'beach_resort',
      name: 'Strand-Resort',
      type: 'commercial',
      color: 0xf1c40f,
      density: 'medium',
      bounds: { x: 50, y: 400, width: 300, height: 150 },
      properties: { attractiveness: 95, noiseLevel: 40, accessibility: 70 }
    },
    {
      id: 'marina_homes',
      name: 'Marina-Villen', 
      type: 'residential',
      color: 0x3498db,
      density: 'low',
      bounds: { x: 400, y: 350, width: 250, height: 200 },
      properties: { attractiveness: 90, noiseLevel: 25, accessibility: 75 }
    }
    // Weitere Zonen...
  ]

  const myCoastalCity = WorldBuilder.createCustomWorld(
    'Meine Küstenstadt',
    1000,
    700,
    coastalZones,
    'organic'
  )

  this.worldManager = new WorldManager(this, myCoastalCity)
  this.worldManager.generateWorld()
}
```

---

**Viel Spaß beim Gestalten Ihrer eigenen Immobilien-Welt! 🏗️🌆** 