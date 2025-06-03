# ImmoLife - Real Estate Simulation Game

Ein browserbasiertes Immobilien-Simulationsspiel, entwickelt mit Phaser.js und TypeScript. Kaufe Immobilien, verwalte Mieter, renoviere Objekte und baue dein Immobilien-Portfolio auf!

## 🎮 Spielfeatures

### Immobilien-Management
- **Immobilien kaufen und verkaufen** in verschiedenen Berliner Stadtteilen
- **4 Immobilientypen**: Wohnungen, Häuser, Gewerbe, Büros
- **Dynamischer Immobilienmarkt** mit wechselnden Angeboten
- **Realistische Preisgestaltung** basierend auf Lage und Zustand

### Mieter-System
- **Automatische Mietersuche** für leere Immobilien
- **Zuverlässigkeitssystem** für Mieter
- **Monatliche Mieteinnahmen** basierend auf Immobilienzustand

### Renovierungs-System
- **4 Renovierungsarten**: Grundwartung, Modernisierung, Luxus-Ausbau, Energetische Sanierung
- **Zustandssystem** mit natürlicher Abnutzung über Zeit
- **Wertsteigerung** durch Renovierungen und Markttrends

### Zeit-Management
- **Flexibles Zeitsystem** mit 5 Geschwindigkeitsstufen (0.5x bis 8x)
- **Pause-Funktion** für strategische Planung
- **Monatliche Ereignisse** und Einnahmen

### Markt-Dynamik
- **Wechselnde Markttrends**: Fallend, Stabil, Wachsend, Boomend
- **Automatische Markt-Updates** alle 1-3 Monate
- **Immobilien verschwinden** nach 1-6 Monaten vom Markt

### Speicher-System
- **8 Speicherplätze** mit Zeitstempel
- **Automatisches Speichern** alle 5 Minuten
- **Quick Save/Load** mit F5/F9
- **Neues Spiel** jederzeit möglich

## 🎯 Spielziel

Baue ein erfolgreiches Immobilien-Portfolio auf! Kaufe günstig, renoviere strategisch und maximiere deine monatlichen Mieteinnahmen. Beobachte Markttrends und nutze die besten Gelegenheiten.

## 🎮 Steuerung

### Tastatur-Shortcuts
- **F5**: Quick Save
- **F9**: Quick Load (letzter QuickSave)
- **Ctrl+S**: Speichern-Dialog öffnen
- **Leertaste**: Pause/Resume
- **ESC**: Alle Dialoge schließen

### Maus-Steuerung
- **Klick auf Immobilie**: Kaufen/Verwalten
- **Hover über Immobilie**: Tooltip mit Details
- **Drag & Drop**: UI-Panels verschieben

## 🛠️ Technische Details

### Technologie-Stack
- **Phaser.js 3.70+**: Game Engine
- **TypeScript**: Typsichere Entwicklung
- **Vite**: Build-Tool und Dev-Server
- **LocalStorage**: Persistente Speicherung

### Architektur
- **Singleton GameManager**: Zentrale Spiellogik
- **Event-System**: Lose gekoppelte Kommunikation
- **Modulare Szenen**: Menu und Game Scene
- **Responsive Design**: Automatische Größenanpassung

## 🚀 Installation & Start

### Voraussetzungen
- Node.js (Version 16 oder höher)
- npm oder yarn

### Setup
```bash
# Repository klonen
git clone https://github.com/yourusername/immolifeGame.git
cd immolifeGame

# Dependencies installieren
npm install

# Development Server starten
npm run dev

# Für Production Build
npm run build
```

### Verfügbare Scripts
- `npm run dev`: Development Server starten
- `npm run build`: Production Build erstellen
- `npm run preview`: Production Build lokal testen

## 🏗️ Projektstruktur

```
immolifeGame/
├── src/
│   ├── managers/
│   │   └── GameManager.ts      # Zentrale Spiellogik
│   ├── scenes/
│   │   ├── MenuScene.ts        # Hauptmenü
│   │   └── GameScene.ts        # Hauptspiel
│   ├── types/
│   │   └── GameTypes.ts        # TypeScript Interfaces
│   └── utils/                  # Hilfsfunktionen
├── index.html                  # HTML Entry Point
├── package.json               # Dependencies & Scripts
├── tsconfig.json              # TypeScript Konfiguration
├── vite.config.ts             # Vite Konfiguration
└── README.md                  # Diese Datei
```

## 🎨 Spielmechaniken im Detail

### Immobilien-Bewertung
- **Grundpreis** basierend auf Immobilientyp
- **Lage-Multiplikator** je nach Stadtteil
- **Zustandsfaktor** beeinflusst Miete und Wert
- **Markttrend** beeinflusst Wertsteigerung

### Wirtschaftssystem
- **Startkapital**: €500.000
- **Monatliche Einnahmen**: Miete minus Wartungskosten
- **Wertsteigerung**: Automatisch basierend auf Markt und Zustand
- **Renovierungskosten**: 2,5% bis 17,5% des ursprünglichen Preises

### Berliner Stadtteile
- **Mitte**: Premium-Lage (1.5x Preismultiplikator)
- **Prenzlauer Berg**: Sehr begehrt (1.3x)
- **Kreuzberg**: Beliebt (1.2x)
- **Charlottenburg**: Etabliert (1.1x)
- **Wedding**: Aufstrebend (0.8x)
- **Neukölln**: Günstig (0.9x)

## 🐛 Bekannte Features
- Vollständig funktionsfähiges Speicher-/Ladesystem
- Responsive UI mit verschiebbaren Panels
- Realistische Immobilien-Simulation
- Ausbalancierte Spielmechaniken

## 🤝 Beitragen

Contributions sind willkommen! Bitte erstelle einen Pull Request oder öffne ein Issue für Verbesserungsvorschläge.

## 📄 Lizenz

Dieses Projekt steht unter der MIT Lizenz.

## 🎯 Roadmap

### Geplante Features
- [ ] Bank-System mit Krediten
- [ ] Mehr Immobilientypen
- [ ] Erweiterte Mieter-Interaktionen
- [ ] Statistiken und Achievements
- [ ] Multiplayer-Modus
- [ ] Mobile Unterstützung

---

**Viel Spaß beim Spielen! 🏠💰** 