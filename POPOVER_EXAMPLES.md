# 🎯 Tippy.js Popovers für ImmoLife

## 🚀 **Installation & Setup** ✅

```bash
npm install tippy.js
```

Die Library ist jetzt integriert und einsatzbereit!

## 📋 **Verfügbare Popover-Typen**

### 1. **Property-Popovers** 🏠
Detaillierte Immobilien-Informationen beim Hover

```typescript
// In GameScene.ts - bei Property-Sprites
const element = container.getChildAt(0) as Phaser.GameObjects.Image
const domElement = element.scene.canvas // Oder spezifisches DOM Element

const popover = UILibraries.createPropertyPopover(domElement, property, isOwned)
UILibraries.registerPopover(`property_${property.id}`, popover)
```

**Features:**
- ✅ ROI-Berechnung automatisch
- ✅ Netto-Einkommen Anzeige  
- ✅ Markt-Verfügbarkeit
- ✅ Zustand & Wartungskosten
- ✅ Unterschiedliche Ansicht für eigene vs. verfügbare Immobilien

### 2. **Info-Popovers** ℹ️
Einfache Hilfe-Texte für UI-Elemente

```typescript
// Button-Hilfe
const saveButton = document.querySelector('#save-button')
UILibraries.createInfoPopover(
  saveButton,
  '💾 Speichern',
  'Speichert den aktuellen Spielstand in einem freien Slot.',
  'success'
)

// Themes: 'success', 'warning', 'info', 'game'
```

### 3. **Interaktive Popovers** 🎮
Popovers mit Buttons für schnelle Aktionen

```typescript
const quickActionsPopover = UILibraries.createInteractivePopover(
  element,
  '⚡ Schnellaktionen',
  'Was möchten Sie tun?',
  [
    { 
      text: '💾 Speichern', 
      action: () => gameManager.quickSave(),
      color: '#27ae60'
    },
    { 
      text: '📊 Chart', 
      action: () => UILibraries.updatePortfolioChart(player, month),
      color: '#3498db'
    },
    { 
      text: '⏸️ Pause', 
      action: () => gameManager.togglePause(),
      color: '#f39c12'
    }
  ]
)
```

### 4. **Einfache Tooltips** 💡
Kurze Erklärungen für Buttons und Icons

```typescript
// Für alle UI-Buttons
UILibraries.createTooltip(
  document.querySelector('#pause-button'),
  'Pausiert oder startet das Spiel',
  'bottom'
)
```

## 🎨 **Verfügbare Themes**

| Theme | Verwendung | Farbe |
|-------|------------|--------|
| `property` | Immobilien-Details | Blau-Lila Gradient |
| `success` | Erfolg/Bestätigung | Grün Gradient |
| `warning` | Warnungen | Orange Gradient |
| `info` | Informationen | Blau Gradient |
| `game` | Spiel-UI Elemente | Lila Gradient |

## 🔧 **Integration Beispiele für ImmoLife**

### Bank-Button mit Info-Popover
```typescript
// In GameScene.ts createBankPanel()
const bankButtonElement = // DOM-Referenz des Bank-Buttons
UILibraries.createInfoPopover(
  bankButtonElement,
  '🏦 Bank System',
  'Kredit-System wird bald verfügbar sein. Hier können Sie später Kredite aufnehmen.',
  'info'
)
```

### Property-Sprites mit Rich Popovers
```typescript
// In GameScene.ts createPropertySprite()
container.on('pointerover', () => {
  // Phaser Canvas Element als DOM-Referenz
  const canvas = this.scene.canvas
  
  const popover = UILibraries.createPropertyPopover(canvas, property, isOwned)
  
  // Position anpassen basierend auf Maus-Position
  popover.setProps({
    getReferenceClientRect: () => ({
      width: 0,
      height: 0,
      top: this.input.activePointer.y,
      bottom: this.input.activePointer.y,
      left: this.input.activePointer.x,
      right: this.input.activePointer.x,
    })
  })
  
  popover.show()
})

container.on('pointerout', () => {
  UILibraries.removePopover(`property_${property.id}`)
})
```

### Zeit-Buttons mit Tooltips
```typescript
// In GameScene.ts createTimeControlPanel()
const speedButtons = [
  { element: slowButton, text: 'Verlangsamt die Zeit auf 50%' },
  { element: normalButton, text: 'Normale Spielgeschwindigkeit' },
  { element: fastButton, text: 'Doppelte Geschwindigkeit' },
  { element: veryFastButton, text: '4x Geschwindigkeit (Achtung: Schnell!)' },
  { element: ultraFastButton, text: '8x Geschwindigkeit (Sehr schnell!)' }
]

speedButtons.forEach(({ element, text }) => {
  UILibraries.createTooltip(element, text, 'top')
})
```

### Interaktive Property-Aktionen
```typescript
// Bei Property Click - Alternative zu großem Dialog
const propertyActionsPopover = UILibraries.createInteractivePopover(
  canvas,
  `🏠 ${property.name}`,
  `${property.location.district} • €${property.price.toLocaleString('de-DE')}`,
  [
    {
      text: '👁️ Details',
      action: () => this.showPropertyDialog(property),
      color: '#3498db'
    },
    {
      text: isOwned ? '💰 Verkaufen' : '🛒 Kaufen',
      action: () => isOwned ? this.sellProperty(property) : this.buyProperty(property),
      color: isOwned ? '#e74c3c' : '#27ae60'
    },
    ...(isOwned ? [{
      text: '🔨 Renovieren',
      action: () => this.showRenovationOptions(property),
      color: '#9b59b6'
    }] : [])
  ]
)
```

## 🎯 **Best Practices**

### ✅ **DO:**
- Property-Popovers für detaillierte Immobilien-Infos
- Info-Popovers für Erklärungen von UI-Elementen
- Interaktive Popovers für häufige Aktionen
- Tooltips für Icons und Buttons
- Konsistente Themes verwenden

### ❌ **DON'T:**
- Popovers für kritische Bestätigungen (nutze Dialoge)
- Zu viele interaktive Popovers gleichzeitig
- Popovers die andere wichtige UI-Elemente verdecken
- Vergessen Popovers zu entfernen (Memory Leaks)

## 🧹 **Cleanup**

```typescript
// Beim Verlassen einer Szene
destroy() {
  UILibraries.removeAllPopovers()
}

// Einzelne Popovers entfernen
UILibraries.removePopover('property_123')
```

## 🔄 **Dynamic Content Updates**

```typescript
// Popover-Inhalt aktualisieren
const popover = UILibraries.activePopovers.get('property_123')
if (popover) {
  popover.setContent(UILibraries.createPropertyContent(updatedProperty))
}
```

## 🚀 **Fazit**

**Tippy.js** ist perfekt für ImmoLife weil:
- 🎨 **Schöne Animationen** - Professioneller Look
- ⚡ **Performance** - Keine FPS-Drops
- 🔧 **Flexibel** - Themes, Placement, Trigger
- 📱 **Responsive** - Funktioniert auf allen Geräten
- 🎯 **TypeScript** - Type-Safe

**Verwendung im Spiel:**
1. **Property-Tooltips** → Schnelle Immobilien-Infos
2. **UI-Hilfen** → Erklärungen für neue Spieler  
3. **Quick-Actions** → Schnelle Aktionen ohne Dialoge
4. **Status-Infos** → Bank, Zeit, Portfolio Details 