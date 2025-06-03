import Phaser from 'phaser'
import { GameManager } from '../managers/GameManager'
import { Property, PropertyType, TimeSpeed, MarketTrend, GameTime } from '../types/GameTypes'
import { UILibraries } from '../utils/UILibraries'

export class GameScene extends Phaser.Scene {
  private gameManager!: GameManager
  private propertySprites: Map<string, Phaser.GameObjects.Container> = new Map()
  private selectedProperty: Property | null = null
  private uiElements!: Phaser.GameObjects.Group
  private timeText!: Phaser.GameObjects.Text
  private isPaused: boolean = false
  private timePanelContainer!: Phaser.GameObjects.Container
  private infoPanelContainer!: Phaser.GameObjects.Container
  private particleEmitters: Map<string, Phaser.GameObjects.Particles.ParticleEmitter> = new Map()

  constructor() {
    super({ key: 'GameScene' })
  }

  preload() {
    // Fallback: Erstelle einfache farbige Rechtecke als Texturen falls keine Bilder vorhanden
    this.createFallbackTextures()
    
    // Versuche echte Assets zu laden (falls vorhanden)
    this.load.on('filecomplete', (key: string) => {
      console.log(`Asset geladen: ${key}`)
    })
    
    this.load.on('loaderror', (file: any) => {
      console.log(`Asset nicht gefunden: ${file.key}, verwende Fallback`)
    })

    // Gebäude-Sprites (falls vorhanden)
    this.load.image('apartment', 'assets/buildings/apartment.png')
    this.load.image('house', 'assets/buildings/house.png')
    this.load.image('commercial', 'assets/buildings/commercial.png')
    this.load.image('office', 'assets/buildings/office.png')
    
    // Effekt-Sprites
    this.load.image('coin', 'assets/effects/coin.png')
    this.load.image('sparkle', 'assets/effects/sparkle.png')
    this.load.image('dust', 'assets/effects/dust.png')
    
    // UI-Elemente
    this.load.image('panel-bg', 'assets/ui/panel-bg.png')
    
    // Spritesheet für Animationen (falls vorhanden)
    this.load.spritesheet('money-animation', 'assets/effects/money-animation.png', {
      frameWidth: 32,
      frameHeight: 32
    })
  }

  private createFallbackTextures() {
    // Erstelle farbige Rechtecke als Fallback-Texturen
    const graphics = this.add.graphics()
    
    // Apartment - Blau
    graphics.fillStyle(0x3498db)
    graphics.fillRect(0, 0, 64, 64)
    graphics.generateTexture('apartment-fallback', 64, 64)
    
    // House - Grün
    graphics.clear()
    graphics.fillStyle(0x27ae60)
    graphics.fillRect(0, 0, 64, 64)
    graphics.generateTexture('house-fallback', 64, 64)
    
    // Commercial - Orange
    graphics.clear()
    graphics.fillStyle(0xf39c12)
    graphics.fillRect(0, 0, 64, 64)
    graphics.generateTexture('commercial-fallback', 64, 64)
    
    // Office - Lila
    graphics.clear()
    graphics.fillStyle(0x9b59b6)
    graphics.fillRect(0, 0, 64, 64)
    graphics.generateTexture('office-fallback', 64, 64)
    
    // Coin - Gold
    graphics.clear()
    graphics.fillStyle(0xf1c40f)
    graphics.fillCircle(8, 8, 8)
    graphics.generateTexture('coin-fallback', 16, 16)
    
    // Sparkle - Weiß (einfacher Kreis)
    graphics.clear()
    graphics.fillStyle(0xffffff)
    graphics.fillCircle(8, 8, 6)
    graphics.generateTexture('sparkle-fallback', 16, 16)
    
    graphics.destroy()
  }

  create() {
    this.gameManager = GameManager.getInstance()
    
    // Resize Event Listener hinzufügen
    this.scale.on('resize', this.handleResize, this)
    
    this.setupScene()
  }

  private setupScene() {
    const { width, height } = this.cameras.main

    // Hintergrund - Stadtansicht
    this.add.rectangle(width / 2, height / 2, width, height, 0x34495e)

    // Straßen zeichnen (einfache Linien)
    this.drawStreets()

    // UI Gruppe erstellen
    this.uiElements = this.add.group()

    // Immobilien auf der Karte anzeigen
    this.displayProperties()

    // UI Elemente erstellen
    this.createUI()

    // Event Listener
    this.setupEventListeners()

    // Keyboard Shortcuts
    this.setupKeyboardShortcuts()

    // Zeit-System starten und sicherstellen, dass es läuft
    this.startTimeSystem()
    
    // GameManager Zeit-System sicherstellen
    this.gameManager.resumeTimeSystem()
  }

  shutdown() {
    // Alle Popovers beim Verlassen der Szene entfernen
    UILibraries.removeAllPopovers()
  }

  private handleResize(gameSize: any) {
    const { width, height } = gameSize
    
    // Kamera anpassen
    this.cameras.main.setViewport(0, 0, width, height)
    
    // Szene komplett neu aufbauen
    this.children.removeAll(true)
    this.propertySprites.clear()
    this.setupScene()
  }

  private drawStreets() {
    const { width, height } = this.cameras.main
    
    // Dynamisches Straßenraster - angepasst für UI-Panels unten
    const cols = 5 // Weniger Spalten wegen größerer Sprites
    const rows = 4
    const marginX = width * 0.08
    const marginY = height * 0.08 // Weniger Abstand oben
    const bottomUISpace = 280 // Mehr Platz für UI-Panels unten
    const usableHeight = height - marginY - bottomUISpace
    const spacingX = (width - 2 * marginX) / (cols - 1)
    const spacingY = usableHeight / (rows - 1)
    
    // Horizontale Straßen
    for (let row = 0; row < rows; row++) {
      const y = marginY + row * spacingY - 50 // Mehr Platz für größere Sprites
      if (y > 0 && y < height - bottomUISpace) { // Nicht in UI-Bereich zeichnen
        const street = this.add.rectangle(width / 2, y, width, 20, 0x2c3e50) // Breitere Straßen
        street.setDepth(-1)
      }
    }

    // Vertikale Straßen
    for (let col = 0; col < cols; col++) {
      const x = marginX + col * spacingX
      if (x > 0 && x < width) {
        const streetHeight = height - bottomUISpace // Straßen nur bis UI-Bereich
        const street = this.add.rectangle(x, (marginY + streetHeight) / 2, 20, streetHeight, 0x2c3e50) // Breitere Straßen
        street.setDepth(-1)
      }
    }
  }

  private displayProperties() {
    const availableProperties = this.gameManager.getAvailableProperties()
    const playerProperties = this.gameManager.getPlayer().properties
    const { width, height } = this.cameras.main

    // Dynamische Positionierung berechnen - Platz für UI-Panels unten lassen
    const cols = 5 // Weniger Spalten
    const rows = Math.ceil(20 / cols)
    const marginX = width * 0.08
    const marginY = height * 0.08 // Weniger Abstand oben
    const bottomUISpace = 280 // Mehr Platz für UI-Panels unten
    const usableHeight = height - marginY - bottomUISpace
    const spacingX = (width - 2 * marginX) / (cols - 1)
    const spacingY = usableHeight / (rows - 1)

    // Verfügbare Immobilien (grün)
    availableProperties.forEach((property, index) => {
      const col = index % cols
      const row = Math.floor(index / cols)
      property.x = marginX + col * spacingX
      property.y = marginY + row * spacingY
      this.createPropertySprite(property, 0x27ae60, false)
    })

    // Eigene Immobilien (blau)
    playerProperties.forEach(property => {
      this.createPropertySprite(property, 0x3498db, true)
    })
  }

  private createPropertySprite(property: Property, color: number, isOwned: boolean) {
    // Container für alle Sprite-Elemente erstellen
    const container = this.add.container(property.x, property.y)
    
    // Sprite-Key bestimmen (mit Fallback)
    const spriteKey = this.textures.exists(property.type) ? property.type : `${property.type}-fallback`
    
    // Hauptgebäude-Sprite
    const buildingSprite = this.add.image(0, 0, spriteKey)
    buildingSprite.setScale(1.2) // Größer machen
    // buildingSprite.setTint(isOwned ? 0x3498db : 0x27ae60) // Farb-Tint für Status
    
    // Zustandsindikator
    const conditionColor = property.condition > 80 ? 0x2ecc71 : 
                          property.condition > 50 ? 0xf39c12 : 0xe74c3c
    const conditionBar = this.add.rectangle(-30, -35, 20, 4, conditionColor)
    
    // Eigentümer-Indikator
    if (isOwned) {
      const crownIcon = this.add.text(-40, -45, '👑', {
        fontSize: '16px'
      })
      container.add(crownIcon)
    }
    
    // Vermietungs-Status
    if (property.isRented) {
      const rentedIcon = this.add.text(25, -45, '👥', {
        fontSize: '16px'
      })
      container.add(rentedIcon)
    }
    
    // Preis/Miete Text
    const priceText = isOwned 
      ? `€${property.monthlyRent}/M`
      : `€${Math.round(property.price / 1000)}k`
    
    const price = this.add.text(0, 35, priceText, {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    })
    price.setOrigin(0.5)
    
    // Alle Elemente zum Container hinzufügen
    container.add([buildingSprite, conditionBar, price])
    
    // Interaktivität
    container.setSize(80, 80)
    container.setInteractive({ useHandCursor: true })

    // Click Event
    container.on('pointerdown', () => {
      this.selectProperty(property, isOwned)
    })

    // Hover Effekte mit Animationen und Tippy.js Popover
    let popoverInstance: any = null
    
    container.on('pointerover', () => {
      // Hover-Animation
      this.tweens.add({
        targets: container,
        scaleX: 1.1,
        scaleY: 1.1,
        duration: 200,
        ease: 'Back.easeOut'
      })
      
      this.input.setDefaultCursor('pointer')
      
      // Tippy.js Popover erstellen
      if (!popoverInstance) {
        popoverInstance = UILibraries.createPropertyPopover(
          this.sys.canvas, 
          property, 
          isOwned
        )
        
        // Position dynamisch setzen basierend auf Maus-Position
        popoverInstance.setProps({
          getReferenceClientRect: () => ({
            width: 0,
            height: 0,
            top: this.input.activePointer.worldY - 100,
            bottom: this.input.activePointer.worldY - 100,
            left: this.input.activePointer.worldX,
            right: this.input.activePointer.worldX,
          })
        })
        
        UILibraries.registerPopover(`property_${property.id}`, popoverInstance)
        popoverInstance.show()
      }
    })

    container.on('pointerout', () => {
      // Zurück zur normalen Größe
      this.tweens.add({
        targets: container,
        scaleX: 1.0,
        scaleY: 1.0,
        duration: 200,
        ease: 'Back.easeOut'
      })
      
      this.input.setDefaultCursor('default')
      
      // Popover entfernen
      if (popoverInstance) {
        popoverInstance.hide()
        popoverInstance.destroy()
        popoverInstance = null
        UILibraries.removePopover(`property_${property.id}`)
      }
    })

    this.propertySprites.set(property.id, container)
    
    return container
  }

  private getPropertyIcon(type: PropertyType): string {
    switch (type) {
      case PropertyType.APARTMENT:
        return '🏠'
      case PropertyType.HOUSE:
        return '🏡'
      case PropertyType.COMMERCIAL:
        return '🏢'
      case PropertyType.OFFICE:
        return '🏬'
      default:
        return '🏠'
    }
  }



  private async selectProperty(property: Property, isOwned: boolean) {
    this.selectedProperty = property
    
    // Verwende neue moderne UI Library
    const result = await UILibraries.showPropertyDialog(property, isOwned)
    
    switch (result) {
      case 'buy':
        if (this.gameManager.buyProperty(property.id)) {
          this.refreshPropertyDisplay()
          this.updatePortfolioDisplay()
        }
        break
      case 'sell':
        const confirmed = await UILibraries.showConfirmDialog(
          '💸 Immobilie verkaufen?',
          `Möchten Sie ${property.name} wirklich verkaufen? Sie erhalten ca. 90% des aktuellen Wertes.`,
          'Verkaufen',
          'Abbrechen'
        )
        if (confirmed && this.gameManager.sellProperty(property.id)) {
          this.refreshPropertyDisplay()
          this.updatePortfolioDisplay()
        }
        break
             case 'renovate':
         const renovations = this.gameManager.getRenovationOptions(property.id)
         const selectedRenovation = await UILibraries.showRenovationDialog(renovations)
         if (selectedRenovation && this.gameManager.renovateProperty(property.id, selectedRenovation)) {
           this.refreshPropertyDisplay()
         }
         break
      case 'tenant':
        const tenant = this.gameManager.findTenant(property.id)
        if (tenant) {
          this.gameManager.rentToTenant(property.id, tenant)
          this.refreshPropertyDisplay()
        } else {
          UILibraries.showToast('❌ Kein geeigneter Mieter gefunden', 'error')
        }
        break
    }
  }

  private showBuyPropertyDialog(property: Property) {
    const { width, height } = this.cameras.main

    // Dialog Overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
    overlay.setInteractive()
    overlay.setName('propertyDialog')
    overlay.setDepth(1000)

    // Dialog Box - größer
    const dialog = this.add.rectangle(width / 2, height / 2, 500, 400, 0x34495e) // Größer
    dialog.setStrokeStyle(4, 0x3498db) // Dickerer Rahmen
    dialog.setName('propertyDialogBox')
    dialog.setDepth(1001)

    // Dialog Content
    const title = this.add.text(width / 2, height / 2 - 150, property.name, {
      fontSize: '24px', // Größer
      color: '#ecf0f1',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    })
    title.setOrigin(0.5)
    title.setName('dialogTitle')
    title.setDepth(1002)

    const details = `Standort: ${property.location.district}
Typ: ${this.getPropertyTypeText(property.type)}
Preis: €${property.price.toLocaleString('de-DE')}
Monatliche Miete: €${property.monthlyRent.toLocaleString('de-DE')}
Zustand: ${Math.round(property.condition)}%
Wartungskosten: €${property.maintenanceCost}/Monat`

    const detailsText = this.add.text(width / 2, height / 2 - 40, details, {
      fontSize: '18px', // Größer
      color: '#bdc3c7',
      fontFamily: 'Arial, sans-serif',
      align: 'center'
    })
    detailsText.setOrigin(0.5)
    detailsText.setName('dialogDetails')
    detailsText.setDepth(1002)

    // Buttons - größer
    const canAfford = this.gameManager.getPlayer().money >= property.price
    
    const buyButton = this.add.rectangle(width / 2 - 100, height / 2 + 120, 150, 50, canAfford ? 0x27ae60 : 0x7f8c8d) // Größer
    buyButton.setInteractive({ useHandCursor: true })
    buyButton.setStrokeStyle(3, canAfford ? 0x2ecc71 : 0x95a5a6) // Dickerer Rahmen
    buyButton.setName('buyButton')
    buyButton.setDepth(1003)

    const buyText = this.add.text(width / 2 - 100, height / 2 + 120, 'Kaufen', {
      fontSize: '20px', // Größer
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    })
    buyText.setOrigin(0.5)
    buyText.setName('buyButtonText')
    buyText.setDepth(1004)

    const cancelButton = this.add.rectangle(width / 2 + 100, height / 2 + 120, 150, 50, 0xe74c3c) // Größer
    cancelButton.setInteractive({ useHandCursor: true })
    cancelButton.setStrokeStyle(3, 0xc0392b) // Dickerer Rahmen
    cancelButton.setName('cancelButton')
    cancelButton.setDepth(1003)

    const cancelText = this.add.text(width / 2 + 100, height / 2 + 120, 'Abbrechen', {
      fontSize: '20px', // Größer
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    })
    cancelText.setOrigin(0.5)
    cancelText.setName('cancelButtonText')
    cancelText.setDepth(1004)

    // Button Events mit Debug-Ausgabe
    if (canAfford) {
      buyButton.on('pointerdown', () => {
        console.log('Kaufen Button geklickt!')
        if (this.gameManager.buyProperty(property.id)) {
          this.closePropertyDialog()
          this.refreshPropertyDisplay()
        }
      })

      buyButton.on('pointerover', () => {
        buyButton.setFillStyle(0x2ecc71)
      })

      buyButton.on('pointerout', () => {
        buyButton.setFillStyle(0x27ae60)
      })
    } else {
      // Deaktivierter Button
      buyButton.removeInteractive()
    }

    cancelButton.on('pointerdown', () => {
      console.log('Abbrechen Button geklickt!')
      this.closePropertyDialog()
    })

    cancelButton.on('pointerover', () => {
      cancelButton.setFillStyle(0xc0392b)
    })

    cancelButton.on('pointerout', () => {
      cancelButton.setFillStyle(0xe74c3c)
    })

    // Overlay schließt Dialog
    overlay.on('pointerdown', () => {
      console.log('Overlay geklickt - Dialog schließen')
      this.closePropertyDialog()
    })
  }

  private showOwnedPropertyDialog(property: Property) {
    const { width, height } = this.cameras.main

    // Dialog Overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
    overlay.setInteractive()
    overlay.setName('propertyDialog')
    overlay.setDepth(1000)

    // Dialog Box
    const dialog = this.add.rectangle(width / 2, height / 2, 400, 350, 0x34495e)
    dialog.setStrokeStyle(3, 0x3498db)
    dialog.setName('propertyDialogBox')
    dialog.setDepth(1001)

    // Dialog Content
    const title = this.add.text(width / 2, height / 2 - 120, property.name, {
      fontSize: '20px',
      color: '#ecf0f1',
      fontFamily: 'Arial, sans-serif'
    })
    title.setOrigin(0.5)
    title.setName('dialogTitle')
    title.setDepth(1002)

    const status = property.isRented ? 'Vermietet' : 'Leer'
    const tenant = property.tenant ? `an ${property.tenant.name}` : ''
    
    // Wertsteigerung berechnen
    const valueChange = property.price - property.originalPrice
    const valueChangePercent = ((valueChange / property.originalPrice) * 100).toFixed(1)
    const valueChangeText = valueChange >= 0 ? `+€${Math.round(valueChange)} (+${valueChangePercent}%)` : `-€${Math.round(Math.abs(valueChange))} (${valueChangePercent}%)`
    
    // Markttrend-Text
    const trendText = this.getMarketTrendText(property.marketTrend)
    
    const details = `Standort: ${property.location.district}
Status: ${status} ${tenant}
Aktueller Wert: €${Math.round(property.price).toLocaleString('de-DE')}
Wertsteigerung: ${valueChangeText}
Markttrend: ${trendText}
Monatliche Miete: €${property.monthlyRent.toLocaleString('de-DE')}
Zustand: ${Math.round(property.condition)}% (Baujahr ${property.yearBuilt})
Wartungskosten: €${property.maintenanceCost}/Monat
Netto-Einkommen: €${property.monthlyRent - property.maintenanceCost}/Monat`

    const detailsText = this.add.text(width / 2, height / 2 - 40, details, {
      fontSize: '14px',
      color: '#bdc3c7',
      fontFamily: 'Arial, sans-serif',
      align: 'center'
    })
    detailsText.setOrigin(0.5)
    detailsText.setName('dialogDetails')
    detailsText.setDepth(1002)

    // Buttons (3 in einer Reihe)
    const findTenantButton = this.add.rectangle(width / 2 - 100, height / 2 + 60, 90, 30, property.isRented ? 0x7f8c8d : 0xf39c12)
    findTenantButton.setInteractive({ useHandCursor: true })
    findTenantButton.setStrokeStyle(2, property.isRented ? 0x95a5a6 : 0xe67e22)
    findTenantButton.setName('findTenantButton')
    findTenantButton.setDepth(1003)

    const findTenantText = this.add.text(width / 2 - 100, height / 2 + 60, 'Mieter suchen', {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    })
    findTenantText.setOrigin(0.5)
    findTenantText.setName('findTenantButtonText')
    findTenantText.setDepth(1004)

    // Renovierungs-Button
    const renovateButton = this.add.rectangle(width / 2, height / 2 + 60, 90, 30, 0x9b59b6)
    renovateButton.setInteractive({ useHandCursor: true })
    renovateButton.setStrokeStyle(2, 0x8e44ad)
    renovateButton.setName('renovateButton')
    renovateButton.setDepth(1003)

    const renovateText = this.add.text(width / 2, height / 2 + 60, '🔨 Renovieren', {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    })
    renovateText.setOrigin(0.5)
    renovateText.setName('renovateButtonText')
    renovateText.setDepth(1004)

    const sellButton = this.add.rectangle(width / 2 + 100, height / 2 + 60, 90, 30, 0xe74c3c)
    sellButton.setInteractive({ useHandCursor: true })
    sellButton.setStrokeStyle(2, 0xc0392b)
    sellButton.setName('sellButton')
    sellButton.setDepth(1003)

    const sellText = this.add.text(width / 2 + 100, height / 2 + 60, 'Verkaufen', {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    })
    sellText.setOrigin(0.5)
    sellText.setName('sellButtonText')
    sellText.setDepth(1004)

    const closeButton = this.add.rectangle(width / 2, height / 2 + 110, 120, 35, 0x95a5a6)
    closeButton.setInteractive({ useHandCursor: true })
    closeButton.setStrokeStyle(2, 0x7f8c8d)
    closeButton.setName('closeButton')
    closeButton.setDepth(1003)

    const closeText = this.add.text(width / 2, height / 2 + 110, 'Schließen', {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    })
    closeText.setOrigin(0.5)
    closeText.setName('closeButtonText')
    closeText.setDepth(1004)

    // Button Events mit Debug-Ausgabe
    if (!property.isRented) {
      findTenantButton.on('pointerdown', () => {
        console.log('Mieter suchen Button geklickt!')
        const tenant = this.gameManager.findTenant(property.id)
        if (tenant) {
          this.gameManager.rentToTenant(property.id, tenant)
          this.closePropertyDialog()
          this.refreshPropertyDisplay()
        }
      })

      findTenantButton.on('pointerover', () => {
        findTenantButton.setFillStyle(0xe67e22)
      })

      findTenantButton.on('pointerout', () => {
        findTenantButton.setFillStyle(0xf39c12)
      })
    } else {
      // Deaktivierter Button für bereits vermietete Immobilien
      findTenantButton.removeInteractive()
    }

    sellButton.on('pointerdown', () => {
      console.log('Verkaufen Button geklickt!')
      if (this.gameManager.sellProperty(property.id)) {
        this.closePropertyDialog()
        this.refreshPropertyDisplay()
      }
    })

    sellButton.on('pointerover', () => {
      sellButton.setFillStyle(0xc0392b)
    })

    sellButton.on('pointerout', () => {
      sellButton.setFillStyle(0xe74c3c)
    })

    // Renovierungs-Button Events
    renovateButton.on('pointerdown', () => {
      console.log('Renovieren Button geklickt!')
      this.showRenovationDialog(property)
    })

    renovateButton.on('pointerover', () => {
      renovateButton.setFillStyle(0x8e44ad)
    })

    renovateButton.on('pointerout', () => {
      renovateButton.setFillStyle(0x9b59b6)
    })

    closeButton.on('pointerdown', () => {
      console.log('Schließen Button geklickt!')
      this.closePropertyDialog()
    })

    closeButton.on('pointerover', () => {
      closeButton.setFillStyle(0x7f8c8d)
    })

    closeButton.on('pointerout', () => {
      closeButton.setFillStyle(0x95a5a6)
    })

    overlay.on('pointerdown', () => {
      console.log('Overlay geklickt - Dialog schließen')
      this.closePropertyDialog()
    })
  }

  private getMarketTrendText(trend: MarketTrend): string {
    switch (trend) {
      case MarketTrend.DECLINING:
        return '📉 Fallend'
      case MarketTrend.STABLE:
        return '➡️ Stabil'
      case MarketTrend.GROWING:
        return '📈 Wachsend'
      case MarketTrend.BOOMING:
        return '🚀 Boomend'
      default:
        return '➡️ Stabil'
    }
  }

  private showRenovationDialog(property: Property) {
    const { width, height } = this.cameras.main
    const renovations = this.gameManager.getRenovationOptions(property.id)

    // Dialog Overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
    overlay.setInteractive()
    overlay.setName('renovationDialog')
    overlay.setDepth(1100)

    // Dialog Box (größer für Renovierungs-Optionen)
    const dialog = this.add.rectangle(width / 2, height / 2, 500, 400, 0x34495e)
    dialog.setStrokeStyle(3, 0x9b59b6)
    dialog.setName('renovationDialogBox')
    dialog.setDepth(1101)

    // Dialog Title
    const title = this.add.text(width / 2, height / 2 - 170, `🔨 Renovierung: ${property.name}`, {
      fontSize: '18px',
      color: '#ecf0f1',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    })
    title.setOrigin(0.5)
    title.setName('renovationTitle')
    title.setDepth(1102)

    // Aktueller Zustand
    const currentCondition = this.add.text(width / 2, height / 2 - 140, `Aktueller Zustand: ${Math.round(property.condition)}%`, {
      fontSize: '14px',
      color: '#bdc3c7',
      fontFamily: 'Arial, sans-serif'
    })
    currentCondition.setOrigin(0.5)
    currentCondition.setName('currentCondition')
    currentCondition.setDepth(1102)

    // Renovierungs-Optionen
    renovations.forEach((renovation, index) => {
      const yPos = height / 2 - 80 + index * 70
      const canAfford = this.gameManager.getPlayer().money >= renovation.cost

      // Renovierungs-Box
      const renovationBox = this.add.rectangle(width / 2, yPos, 450, 60, canAfford ? 0x2c3e50 : 0x34495e)
      renovationBox.setStrokeStyle(2, canAfford ? 0x9b59b6 : 0x7f8c8d)
      if (canAfford) {
        renovationBox.setInteractive({ useHandCursor: true })
      }
      renovationBox.setName(`renovationBox_${index}`)
      renovationBox.setDepth(1102)

      // Renovierungs-Info
      const renovationTitle = this.add.text(width / 2 - 200, yPos - 15, renovation.name, {
        fontSize: '14px',
        color: canAfford ? '#ecf0f1' : '#7f8c8d',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold'
      })
      renovationTitle.setOrigin(0, 0.5)
      renovationTitle.setName(`renovationTitle_${index}`)
      renovationTitle.setDepth(1103)

      const renovationDetails = this.add.text(width / 2 - 200, yPos + 5, 
        `€${renovation.cost.toLocaleString('de-DE')} | +${renovation.conditionImprovement}% Zustand | +${renovation.rentIncrease}% Miete`, {
        fontSize: '11px',
        color: canAfford ? '#bdc3c7' : '#7f8c8d',
        fontFamily: 'Arial, sans-serif'
      })
      renovationDetails.setOrigin(0, 0.5)
      renovationDetails.setName(`renovationDetails_${index}`)
      renovationDetails.setDepth(1103)

      const renovationDesc = this.add.text(width / 2 - 200, yPos + 20, renovation.description, {
        fontSize: '10px',
        color: canAfford ? '#95a5a6' : '#7f8c8d',
        fontFamily: 'Arial, sans-serif'
      })
      renovationDesc.setOrigin(0, 0.5)
      renovationDesc.setName(`renovationDesc_${index}`)
      renovationDesc.setDepth(1103)

      // Button Events
      if (canAfford) {
        renovationBox.on('pointerdown', () => {
          console.log(`Renovierung gewählt: ${renovation.name}`)
          if (this.gameManager.renovateProperty(property.id, renovation.id)) {
            this.closeRenovationDialog()
            this.closePropertyDialog()
            this.refreshPropertyDisplay()
          }
        })

        renovationBox.on('pointerover', () => {
          renovationBox.setFillStyle(0x9b59b6)
        })

        renovationBox.on('pointerout', () => {
          renovationBox.setFillStyle(0x2c3e50)
        })
      }
    })

    // Schließen Button
    const closeButton = this.add.rectangle(width / 2, height / 2 + 160, 120, 35, 0xe74c3c)
    closeButton.setInteractive({ useHandCursor: true })
    closeButton.setStrokeStyle(2, 0xc0392b)
    closeButton.setName('renovationCloseButton')
    closeButton.setDepth(1103)

    const closeText = this.add.text(width / 2, height / 2 + 160, 'Schließen', {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    })
    closeText.setOrigin(0.5)
    closeText.setName('renovationCloseText')
    closeText.setDepth(1104)

    closeButton.on('pointerdown', () => {
      this.closeRenovationDialog()
    })

    closeButton.on('pointerover', () => {
      closeButton.setFillStyle(0xc0392b)
    })

    closeButton.on('pointerout', () => {
      closeButton.setFillStyle(0xe74c3c)
    })

    overlay.on('pointerdown', () => {
      this.closeRenovationDialog()
    })
  }

  private closeRenovationDialog() {
    // Alle Renovierungs-Dialog Elemente entfernen
    const elementsToRemove = [
      'renovationDialog', 'renovationDialogBox', 'renovationTitle', 'currentCondition',
      'renovationCloseButton', 'renovationCloseText'
    ]

    // Dynamische Elemente (Renovierungs-Boxen)
    for (let i = 0; i < 10; i++) {
      elementsToRemove.push(
        `renovationBox_${i}`, `renovationTitle_${i}`, 
        `renovationDetails_${i}`, `renovationDesc_${i}`
      )
    }

    elementsToRemove.forEach(name => {
      const element = this.children.getByName(name)
      if (element) element.destroy()
    })
  }

  private closePropertyDialog() {
    const dialogElements = [
      'propertyDialog', 'propertyDialogBox', 'dialogTitle', 'dialogDetails',
      'buyButton', 'buyButtonText', 'cancelButton', 'cancelButtonText',
      'findTenantButton', 'findTenantButtonText', 'sellButton', 'sellButtonText',
      'renovateButton', 'renovateButtonText', 'closeButton', 'closeButtonText'
    ]

    dialogElements.forEach(name => {
      const element = this.children.getByName(name)
      if (element) element.destroy()
    })
  }

  private getPropertyTypeText(type: PropertyType): string {
    switch (type) {
      case PropertyType.APARTMENT:
        return 'Wohnung'
      case PropertyType.HOUSE:
        return 'Haus'
      case PropertyType.COMMERCIAL:
        return 'Gewerbe'
      case PropertyType.OFFICE:
        return 'Büro'
      default:
        return 'Immobilie'
    }
  }

  private createUI() {
    const { width, height } = this.cameras.main

    // Verschiebbare Info-Panel erstellen - unten links
    this.createInfoPanel(width, height)

    // Zeit-Steuerung Panel - unten mitte
    this.createTimeControlPanel(width, height)

    // Bank Button als separates Panel - unten rechts
    this.createBankPanel(width, height)

    // Menü Button - oben links bleibt
    const menuButton = this.add.rectangle(80, 40, 140, 35, 0x34495e)
    menuButton.setInteractive({ useHandCursor: true })
    menuButton.setStrokeStyle(2, 0x2c3e50)

    const menuText = this.add.text(80, 40, '🏠 Hauptmenü', {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    })
    menuText.setOrigin(0.5)

    menuButton.on('pointerdown', () => {
      this.scene.start('MenuScene')
    })

    menuButton.on('pointerover', () => {
      menuButton.setFillStyle(0x2c3e50)
      menuButton.setStrokeStyle(2, 0x3498db)
    })

    menuButton.on('pointerout', () => {
      menuButton.setFillStyle(0x34495e)
      menuButton.setStrokeStyle(2, 0x2c3e50)
    })
  }

  private createInfoPanel(width: number, height: number) {
    // Info-Panel Container erstellen - unten links
    this.infoPanelContainer = this.add.container(140, height - 160)
    
    // Panel Hintergrund - kompakter
    const panelBg = this.add.rectangle(0, 0, 260, 160, 0x000000, 0.85)
    panelBg.setStrokeStyle(2, 0x3498db)
    
    // Panel Titel
    const titleText = this.add.text(0, -65, '📊 Spiel-Info', {
      fontSize: '16px',
      color: '#ecf0f1',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    })
    titleText.setOrigin(0.5)
    
    // Zeit Text
    this.timeText = this.add.text(0, -40, this.gameManager.getFormattedDate(), {
      fontSize: '14px',
      color: '#ecf0f1',
      fontFamily: 'Arial, sans-serif'
    })
    this.timeText.setOrigin(0.5)

    // Geld anzeigen
    const player = this.gameManager.getPlayer()
    const moneyText = this.add.text(0, -20, `💰 €${Math.round(player.money).toLocaleString('de-DE')}`, {
      fontSize: '14px',
      color: '#f1c40f',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    })
    moneyText.setOrigin(0.5)
    moneyText.setName('moneyText')

    // Geschwindigkeit Text
    const speedText = this.add.text(0, 0, 'Geschwindigkeit: Normal', {
      fontSize: '12px',
      color: '#bdc3c7',
      fontFamily: 'Arial, sans-serif'
    })
    speedText.setOrigin(0.5)
    speedText.setName('speedText')

    // Portfolio-Wert Text
    const portfolioValue = this.calculatePortfolioValue()
    const portfolioText = this.add.text(0, 20, `🏠 Portfolio: €${Math.round(portfolioValue).toLocaleString('de-DE')}`, {
      fontSize: '12px',
      color: '#2ecc71',
      fontFamily: 'Arial, sans-serif'
    })
    portfolioText.setOrigin(0.5)
    portfolioText.setName('portfolioText')

    // Monatliches Einkommen
    const monthlyIncome = this.calculateMonthlyIncome()
    const incomeText = this.add.text(0, 40, `💵 Einkommen: €${Math.round(monthlyIncome).toLocaleString('de-DE')}/M`, {
      fontSize: '12px',
      color: monthlyIncome >= 0 ? '#2ecc71' : '#e74c3c',
      fontFamily: 'Arial, sans-serif'
    })
    incomeText.setOrigin(0.5)
    incomeText.setName('incomeText')

    // Markt-Info Text
    const availableCount = this.gameManager.getAvailableProperties().length
    const marketText = this.add.text(0, 60, `🏪 Markt: ${availableCount} Immobilien`, {
      fontSize: '12px',
      color: '#3498db',
      fontFamily: 'Arial, sans-serif'
    })
    marketText.setOrigin(0.5)
    marketText.setName('marketText')

    // Elemente zum Container hinzufügen
    this.infoPanelContainer.add([panelBg, titleText, this.timeText, moneyText, speedText, portfolioText, incomeText, marketText])
    
    // Drag & Drop aktivieren
    this.makeDraggable(this.infoPanelContainer, panelBg, '📊 Spiel-Info')
  }

  private calculateMonthlyIncome(): number {
    const player = this.gameManager.getPlayer()
    return player.properties.reduce((total, property) => {
      const rent = property.isRented ? property.monthlyRent : 0
      return total + rent - property.maintenanceCost
    }, 0)
  }

  private createTimeControlPanel(width: number, height: number) {
    // Zeit-Panel Container erstellen - unten mitte
    this.timePanelContainer = this.add.container(width / 2, height - 120)
    
    const panelWidth = 260
    const panelHeight = 200

    // Panel Hintergrund
    const panelBg = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x000000, 0.85)
    panelBg.setStrokeStyle(2, 0xf39c12)

    // Panel Titel
    const titleText = this.add.text(0, -85, '⏰ Zeit-Steuerung', {
      fontSize: '16px',
      color: '#ecf0f1',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    })
    titleText.setOrigin(0.5)

    // Pause/Play Button - zentriert
    const pauseButton = this.add.rectangle(0, -55, 180, 30, 0xf39c12)
    pauseButton.setInteractive({ useHandCursor: true })
    pauseButton.setStrokeStyle(2, 0xe67e22)
    pauseButton.setName('pauseButton')

    const pauseText = this.add.text(0, -55, '⏸️ Pause', {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    })
    pauseText.setOrigin(0.5)
    pauseText.setName('pauseButtonText')

    // Geschwindigkeits-Label
    const speedLabel = this.add.text(0, -25, 'Geschwindigkeit wählen:', {
      fontSize: '12px',
      color: '#bdc3c7',
      fontFamily: 'Arial, sans-serif'
    })
    speedLabel.setOrigin(0.5)

    // Container für alle Elemente
    const elements = [panelBg, titleText, pauseButton, pauseText, speedLabel]

    // Geschwindigkeits-Buttons - 3x2 Grid Layout
    const speeds = [
      { speed: TimeSpeed.SLOW, label: '🐌 0.5x', x: -60, y: 5 },
      { speed: TimeSpeed.NORMAL, label: '🚶 1x', x: 0, y: 5 },
      { speed: TimeSpeed.FAST, label: '🏃 2x', x: 60, y: 5 },
      { speed: TimeSpeed.VERY_FAST, label: '🚀 4x', x: -30, y: 35 },
      { speed: TimeSpeed.ULTRA_FAST, label: '⚡ 8x', x: 30, y: 35 }
    ]

    speeds.forEach(({ speed, label, x, y }) => {
      const isRed = speed >= TimeSpeed.VERY_FAST
      const button = this.add.rectangle(x, y, 70, 22, isRed ? 0xe74c3c : 0x3498db)
      button.setInteractive({ useHandCursor: true })
      button.setStrokeStyle(1, isRed ? 0xc0392b : 0x2980b9)

      const text = this.add.text(x, y, label, {
        fontSize: '10px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold'
      })
      text.setOrigin(0.5)

      button.on('pointerdown', () => {
        this.gameManager.setTimeSpeed(speed)
      })

      button.on('pointerover', () => {
        button.setFillStyle(isRed ? 0xc0392b : 0x2980b9)
      })

      button.on('pointerout', () => {
        button.setFillStyle(isRed ? 0xe74c3c : 0x3498db)
      })

      elements.push(button, text)
    })

    // Pause Button Events
    pauseButton.on('pointerdown', () => {
      this.gameManager.togglePause()
    })

    pauseButton.on('pointerover', () => {
      pauseButton.setFillStyle(0xe67e22)
    })

    pauseButton.on('pointerout', () => {
      pauseButton.setFillStyle(0xf39c12)
    })

    // Alle Elemente zum Container hinzufügen
    this.timePanelContainer.add(elements)
    
    // Drag & Drop aktivieren
    this.makeDraggable(this.timePanelContainer, panelBg, '⏰ Zeit-Steuerung')
  }

  private createBankPanel(width: number, height: number) {
    // Bank-Panel Container - unten rechts
    const bankContainer = this.add.container(width - 140, height - 100)
    
    // Panel Hintergrund - kompakter
    const panelBg = this.add.rectangle(0, 0, 260, 140, 0x000000, 0.85)
    panelBg.setStrokeStyle(2, 0x8e44ad)
    
    // Panel Titel
    const titleText = this.add.text(0, -55, '🏦 Aktionen', {
      fontSize: '16px',
      color: '#ecf0f1',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    })
    titleText.setOrigin(0.5)
    
    // Bank Button
    const bankButton = this.add.rectangle(0, -25, 200, 25, 0x8e44ad)
    bankButton.setInteractive({ useHandCursor: true })
    bankButton.setStrokeStyle(1, 0x9b59b6)

    const bankText = this.add.text(0, -25, '🏦 Bank (Bald verfügbar)', {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    })
    bankText.setOrigin(0.5)

    // Save/Load Button
    const saveButton = this.add.rectangle(0, 5, 200, 25, 0x27ae60)
    saveButton.setInteractive({ useHandCursor: true })
    saveButton.setStrokeStyle(1, 0x2ecc71)

    const saveText = this.add.text(0, 5, '💾 Speichern & Laden', {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    })
    saveText.setOrigin(0.5)

    // Quick Save Button
    const quickSaveButton = this.add.rectangle(-60, 35, 90, 25, 0xf39c12)
    quickSaveButton.setInteractive({ useHandCursor: true })
    quickSaveButton.setStrokeStyle(1, 0xe67e22)

    const quickSaveText = this.add.text(-60, 35, '⚡ Quick Save', {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    })
    quickSaveText.setOrigin(0.5)

    // Chart Toggle Button
    const chartButton = this.add.rectangle(60, 35, 90, 25, 0x3498db)
    chartButton.setInteractive({ useHandCursor: true })
    chartButton.setStrokeStyle(1, 0x2980b9)

    const chartText = this.add.text(60, 35, '📊 Chart', {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    })
    chartText.setOrigin(0.5)

    // Events
    bankButton.on('pointerdown', () => {
      this.showBankDialog()
    })

    bankButton.on('pointerover', () => {
      bankButton.setFillStyle(0x9b59b6)
    })

    bankButton.on('pointerout', () => {
      bankButton.setFillStyle(0x8e44ad)
    })

    saveButton.on('pointerdown', () => {
      this.showSaveLoadDialog()
    })

    saveButton.on('pointerover', () => {
      saveButton.setFillStyle(0x2ecc71)
    })

    saveButton.on('pointerout', () => {
      saveButton.setFillStyle(0x27ae60)
    })

    quickSaveButton.on('pointerdown', () => {
      if (this.gameManager.quickSave()) {
        UILibraries.showToast('💾 Spiel gespeichert!', 'success')
      } else {
        UILibraries.showToast('❌ Fehler beim Speichern!', 'error')
      }
    })

    quickSaveButton.on('pointerover', () => {
      quickSaveButton.setFillStyle(0xe67e22)
    })

    quickSaveButton.on('pointerout', () => {
      quickSaveButton.setFillStyle(0xf39c12)
    })

    chartButton.on('pointerdown', () => {
      // Chart anzeigen/verstecken
      const container = document.getElementById('portfolio-chart-container') as HTMLElement
      if (container) {
        if (container.style.display === 'none' || container.style.display === '') {
          const player = this.gameManager.getPlayer()
          const currentMonth = this.gameManager.getCurrentMonth()
          UILibraries.updatePortfolioChart(player, currentMonth)
          UILibraries.showToast('📊 Portfolio Chart angezeigt', 'info')
        } else {
          UILibraries.hidePortfolioChart()
          UILibraries.showToast('📊 Portfolio Chart versteckt', 'info')
        }
      }
    })

    chartButton.on('pointerover', () => {
      chartButton.setFillStyle(0x2980b9)
    })

    chartButton.on('pointerout', () => {
      chartButton.setFillStyle(0x3498db)
    })

    // Elemente zum Container hinzufügen
    bankContainer.add([panelBg, titleText, bankButton, bankText, saveButton, saveText, quickSaveButton, quickSaveText, chartButton, chartText])
    
    // Drag & Drop aktivieren
    this.makeDraggable(bankContainer, panelBg, '🏦 Aktionen')
  }

  private makeDraggable(container: Phaser.GameObjects.Container, dragHandle: Phaser.GameObjects.Rectangle, title: string) {
    // Drag-Handle interaktiv machen
    dragHandle.setInteractive({ draggable: true, useHandCursor: true })
    
    // Drag-Variablen
    let isDragging = false
    let dragStartX = 0
    let dragStartY = 0
    
    // Drag Start
    dragHandle.on('dragstart', (pointer: Phaser.Input.Pointer) => {
      isDragging = true
      dragStartX = pointer.x - container.x
      dragStartY = pointer.y - container.y
      container.setDepth(1000) // Über andere Elemente bringen
      
      // Visuelles Feedback
      dragHandle.setStrokeStyle(2, 0x2ecc71)
      this.input.setDefaultCursor('grabbing')
    })
    
    // Drag
    dragHandle.on('drag', (pointer: Phaser.Input.Pointer) => {
      if (isDragging) {
        const newX = pointer.x - dragStartX
        const newY = pointer.y - dragStartY
        
        // Grenzen des Bildschirms beachten
        const { width, height } = this.cameras.main
        const containerBounds = container.getBounds()
        
        const clampedX = Phaser.Math.Clamp(newX, containerBounds.width / 2, width - containerBounds.width / 2)
        const clampedY = Phaser.Math.Clamp(newY, containerBounds.height / 2, height - containerBounds.height / 2)
        
        container.setPosition(clampedX, clampedY)
      }
    })
    
    // Drag End
    dragHandle.on('dragend', () => {
      isDragging = false
      container.setDepth(100) // Normale Tiefe
      
      // Visuelles Feedback zurücksetzen
      dragHandle.setStrokeStyle(1, 0x3498db)
      this.input.setDefaultCursor('default')
    })
    
    // Hover-Effekte für bessere UX
    dragHandle.on('pointerover', () => {
      if (!isDragging) {
        dragHandle.setStrokeStyle(2, 0x5dade2)
        this.input.setDefaultCursor('grab')
      }
    })
    
    dragHandle.on('pointerout', () => {
      if (!isDragging) {
        dragHandle.setStrokeStyle(1, 0x3498db)
        this.input.setDefaultCursor('default')
      }
    })
  }

  private togglePause() {
    // Entfernt - wird jetzt vom GameManager verwaltet
    this.gameManager.togglePause()
  }

  private showBankDialog() {
    // Vereinfachter Bank Dialog - kann später erweitert werden
    const { width, height } = this.cameras.main
    
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
    overlay.setInteractive()
    overlay.setName('bankDialog')

    const dialog = this.add.rectangle(width / 2, height / 2, 300, 200, 0x34495e)
    dialog.setStrokeStyle(3, 0x8e44ad)
    dialog.setName('bankDialogBox')

    const title = this.add.text(width / 2, height / 2 - 60, 'Bank', {
      fontSize: '24px',
      color: '#ecf0f1',
      fontFamily: 'Arial, sans-serif'
    })
    title.setOrigin(0.5)
    title.setName('bankTitle')

    const info = this.add.text(width / 2, height / 2, 'Kredit-System\nkommt bald!', {
      fontSize: '16px',
      color: '#bdc3c7',
      fontFamily: 'Arial, sans-serif',
      align: 'center'
    })
    info.setOrigin(0.5)
    info.setName('bankInfo')

    const closeButton = this.add.rectangle(width / 2, height / 2 + 60, 100, 35, 0xe74c3c)
    closeButton.setInteractive()
    closeButton.setStrokeStyle(2, 0xc0392b)
    closeButton.setName('bankCloseButton')

    const closeText = this.add.text(width / 2, height / 2 + 60, 'Schließen', {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    })
    closeText.setOrigin(0.5)
    closeText.setName('bankCloseText')

    closeButton.on('pointerdown', () => {
      const bankDialogElements = ['bankDialog', 'bankDialogBox', 'bankTitle', 'bankInfo', 'bankCloseButton', 'bankCloseText']
      bankDialogElements.forEach(name => {
        const element = this.children.getByName(name)
        if (element) element.destroy()
      })
    })

    overlay.on('pointerdown', () => {
      const bankDialogElements = ['bankDialog', 'bankDialogBox', 'bankTitle', 'bankInfo', 'bankCloseButton', 'bankCloseText']
      bankDialogElements.forEach(name => {
        const element = this.children.getByName(name)
        if (element) element.destroy()
      })
    })
  }

  private setupEventListeners() {
    // GameManager Events
    this.gameManager.on('dayAdvanced', (data: any) => {
      this.timeText.setText(this.gameManager.getFormattedDate())
    })

    // Speed und Pause Events hinzufügen
    this.gameManager.on('timeSpeedChanged', (data: any) => {
      this.updateSpeedDisplay(data.speed, data.isPaused)
    })

    this.gameManager.on('monthAdvanced', (data: any) => {
      this.updatePortfolioDisplay()
      this.showMoneyEffect() // Geld-Effekt bei Monatsende
      
      // Portfolio Chart aktualisieren
      const player = this.gameManager.getPlayer()
      const currentMonth = this.gameManager.getCurrentMonth()
      UILibraries.updatePortfolioChart(player, currentMonth)
    })

    this.gameManager.on('propertyBought', (property: Property) => {
      UILibraries.showToast(`🏠 ${property.name} gekauft!`, 'success')
      this.showPurchaseEffect(property) // Kauf-Effekt
      this.refreshPropertyDisplay()
      this.updatePortfolioDisplay()
    })

    this.gameManager.on('propertySold', (property: Property) => {
      UILibraries.showToast(`💰 ${property.name} verkauft!`, 'info')
      this.showSaleEffect(property) // Verkaufs-Effekt
      this.refreshPropertyDisplay()
      this.updatePortfolioDisplay()
    })

    this.gameManager.on('propertyRenovated', (data: any) => {
      UILibraries.showToast(`🔨 ${data.property.name} renoviert!`, 'success')
      this.showRenovationEffect(data.property) // Renovierungs-Effekt
      this.refreshPropertyDisplay()
    })

    this.gameManager.on('propertyRented', (data: any) => {
      UILibraries.showToast(`👥 Neuer Mieter in ${data.property.name}`, 'success')
      this.showTenantEffect(data.property, true)
      this.refreshPropertyDisplay()
    })

    this.gameManager.on('newPropertiesAdded', (data: any) => {
      UILibraries.showToast(`📈 ${data.count} neue Immobilien am Markt`, 'info')
      this.refreshPropertyDisplay()
    })

    this.gameManager.on('propertiesRemoved', (data: any) => {
      UILibraries.showToast(`📤 ${data.count} Immobilien vom Markt genommen`, 'warning')
      this.refreshPropertyDisplay()
    })

    // Spiel-Events
    this.gameManager.on('newGameStarted', () => {
      this.refreshPropertyDisplay()
      this.updatePortfolioDisplay()
    })

    this.gameManager.on('gameLoaded', () => {
      this.refreshPropertyDisplay()
      this.updatePortfolioDisplay()
    })
  }

  // ===== EFFEKT-METHODEN =====

  private showMoneyEffect() {
    const { width, height } = this.cameras.main
    
    // Münzen-Partikel vom Info-Panel
    const emitter = this.add.particles(width - 150, 150, 'coin-fallback', {
      speed: { min: 50, max: 150 },
      scale: { start: 0.3, end: 0 },
      lifespan: 1000,
      quantity: 5,
      alpha: { start: 1, end: 0 },
      gravityY: 100
    })
    
    // Automatisch nach 2 Sekunden stoppen
    this.time.delayedCall(2000, () => {
      emitter.destroy()
    })
  }

  private showPurchaseEffect(property: Property) {
    const container = this.propertySprites.get(property.id)
    if (!container) return
    
    // Funkeln-Effekt
    const sparkleEmitter = this.add.particles(container.x, container.y, 'sparkle-fallback', {
      speed: { min: 20, max: 80 },
      scale: { start: 0.5, end: 0 },
      lifespan: 800,
      quantity: 3,
      alpha: { start: 1, end: 0 },
      emitZone: { type: 'edge', source: new Phaser.Geom.Circle(0, 0, 40), quantity: 8 }
    })
    
    // Kauf-Animation
    this.tweens.add({
      targets: container,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 300,
      yoyo: true,
      ease: 'Back.easeOut'
    })
    
    this.time.delayedCall(1500, () => {
      sparkleEmitter.destroy()
    })
  }

  private showSaleEffect(property: Property) {
    const container = this.propertySprites.get(property.id)
    if (!container) return
    
    // Geld-Effekt
    const coinEmitter = this.add.particles(container.x, container.y, 'coin-fallback', {
      speed: { min: 100, max: 200 },
      scale: { start: 0.4, end: 0 },
      lifespan: 1200,
      quantity: 8,
      alpha: { start: 1, end: 0 },
      gravityY: 50,
      emitZone: { type: 'edge', source: new Phaser.Geom.Circle(0, 0, 30), quantity: 12 }
    })
    
    this.time.delayedCall(2000, () => {
      coinEmitter.destroy()
    })
  }

  private showRenovationEffect(property: Property) {
    const container = this.propertySprites.get(property.id)
    if (!container) return
    
    // Staub/Bau-Effekt
    const dustEmitter = this.add.particles(container.x, container.y, 'sparkle-fallback', {
      speed: { min: 30, max: 100 },
      scale: { start: 0.2, end: 0 },
      lifespan: 1500,
      quantity: 2,
      alpha: { start: 0.7, end: 0 },
      tint: 0x8e44ad, // Lila für Renovierung
      x: { min: -40, max: 40 },
      y: { min: -40, max: 40 }
    })
    
    // Renovierungs-Animation (Schütteln)
    this.tweens.add({
      targets: container,
      x: container.x + 5,
      duration: 100,
      yoyo: true,
      repeat: 5,
      ease: 'Power2'
    })
    
    this.time.delayedCall(2000, () => {
      dustEmitter.destroy()
    })
  }

  private showTenantEffect(property: Property, moveIn: boolean) {
    const container = this.propertySprites.get(property.id)
    if (!container) return
    
    if (moveIn) {
      // Einzugs-Effekt (grüne Herzen)
      const heartEmitter = this.add.particles(container.x, container.y, 'sparkle-fallback', {
        speed: { min: 20, max: 60 },
        scale: { start: 0.3, end: 0 },
        lifespan: 1000,
        quantity: 3,
        alpha: { start: 1, end: 0 },
        tint: 0x2ecc71, // Grün für Einzug
        emitZone: { type: 'edge', source: new Phaser.Geom.Circle(0, 0, 25), quantity: 6 }
      })
      
      this.time.delayedCall(1500, () => {
        heartEmitter.destroy()
      })
    } else {
      // Auszugs-Effekt (rote Partikel)
      const sadEmitter = this.add.particles(container.x, container.y, 'sparkle-fallback', {
        speed: { min: 40, max: 80 },
        scale: { start: 0.2, end: 0 },
        lifespan: 800,
        quantity: 2,
        alpha: { start: 0.8, end: 0 },
        tint: 0xe74c3c, // Rot für Auszug
        gravityY: 100
      })
      
      this.time.delayedCall(1200, () => {
        sadEmitter.destroy()
      })
    }
  }

  private updateSpeedDisplay(speed: TimeSpeed, isPaused: boolean) {
    // Suche nach speedText im Info-Panel Container
    const speedText = this.infoPanelContainer?.list.find(child => 
      child instanceof Phaser.GameObjects.Text && child.name === 'speedText'
    ) as Phaser.GameObjects.Text
    
    // Suche nach pauseButtonText im Zeit-Panel Container
    const pauseButtonText = this.timePanelContainer?.list.find(child => 
      child instanceof Phaser.GameObjects.Text && child.name === 'pauseButtonText'
    ) as Phaser.GameObjects.Text
    
    if (speedText) {
      if (isPaused) {
        speedText.setText('Geschwindigkeit: Pausiert')
      } else {
        let speedLabel = 'Normal (1x)'
        switch (speed) {
          case TimeSpeed.SLOW:
            speedLabel = 'Langsam (0.5x)'
            break
          case TimeSpeed.NORMAL:
            speedLabel = 'Normal (1x)'
            break
          case TimeSpeed.FAST:
            speedLabel = 'Schnell (2x)'
            break
          case TimeSpeed.VERY_FAST:
            speedLabel = 'Sehr schnell (4x)'
            break
          case TimeSpeed.ULTRA_FAST:
            speedLabel = 'Ultra schnell (8x)'
            break
        }
        speedText.setText(`Geschwindigkeit: ${speedLabel}`)
      }
    }

    if (pauseButtonText) {
      pauseButtonText.setText(isPaused ? '▶️ Play' : '⏸️ Pause')
    }
  }

  private refreshPropertyDisplay() {
    // Alle Property Sprites entfernen
    this.propertySprites.forEach(sprite => {
      sprite.destroy()
    })
    this.propertySprites.clear()

    // Alle Property-bezogenen Texte entfernen
    this.children.list.forEach(child => {
      if (child.name && child.name.includes('property')) {
        child.destroy()
      }
    })

    // Properties neu anzeigen
    this.displayProperties()
  }

  private calculatePortfolioValue(): number {
    const player = this.gameManager.getPlayer()
    return player.properties.reduce((total, property) => total + property.price, 0)
  }

  private updatePortfolioDisplay(): void {
    // Geld-Text im Info-Panel aktualisieren
    const moneyText = this.infoPanelContainer?.list.find(child => 
      child instanceof Phaser.GameObjects.Text && child.name === 'moneyText'
    ) as Phaser.GameObjects.Text
    
    if (moneyText) {
      const player = this.gameManager.getPlayer()
      moneyText.setText(`💰 €${Math.round(player.money).toLocaleString('de-DE')}`)
    }

    // Portfolio-Text im Info-Panel aktualisieren
    const portfolioText = this.infoPanelContainer?.list.find(child => 
      child instanceof Phaser.GameObjects.Text && child.name === 'portfolioText'
    ) as Phaser.GameObjects.Text
    
    if (portfolioText) {
      const portfolioValue = this.calculatePortfolioValue()
      portfolioText.setText(`🏠 Portfolio: €${Math.round(portfolioValue).toLocaleString('de-DE')}`)
    }

    // Einkommen-Text aktualisieren
    const incomeText = this.infoPanelContainer?.list.find(child => 
      child instanceof Phaser.GameObjects.Text && child.name === 'incomeText'
    ) as Phaser.GameObjects.Text
    
    if (incomeText) {
      const monthlyIncome = this.calculateMonthlyIncome()
      incomeText.setText(`💵 Einkommen: €${Math.round(monthlyIncome).toLocaleString('de-DE')}/M`)
      incomeText.setColor(monthlyIncome >= 0 ? '#2ecc71' : '#e74c3c')
    }

    // Markt-Text aktualisieren
    const marketText = this.infoPanelContainer?.list.find(child => 
      child instanceof Phaser.GameObjects.Text && child.name === 'marketText'
    ) as Phaser.GameObjects.Text
    
    if (marketText) {
      const availableCount = this.gameManager.getAvailableProperties().length
      marketText.setText(`🏪 Markt: ${availableCount} Immobilien`)
    }
  }

  private showSaveLoadDialog() {
    const { width, height } = this.cameras.main
    const saveSlots = this.gameManager.getSaveSlots()

    // Dialog Overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
    overlay.setInteractive()
    overlay.setName('saveLoadDialog')
    overlay.setDepth(1200)

    // Dialog Box
    const dialog = this.add.rectangle(width / 2, height / 2, 600, 500, 0x34495e)
    dialog.setStrokeStyle(3, 0x27ae60)
    dialog.setName('saveLoadDialogBox')
    dialog.setDepth(1201)

    // Dialog Title
    const title = this.add.text(width / 2, height / 2 - 220, '💾 Speichern & Laden', {
      fontSize: '20px',
      color: '#ecf0f1',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    })
    title.setOrigin(0.5)
    title.setName('saveLoadTitle')
    title.setDepth(1202)

    // Neues Spiel Button
    const newGameButton = this.add.rectangle(width / 2 - 150, height / 2 - 180, 120, 35, 0xe74c3c)
    newGameButton.setInteractive({ useHandCursor: true })
    newGameButton.setStrokeStyle(2, 0xc0392b)
    newGameButton.setName('newGameButton')
    newGameButton.setDepth(1203)

    const newGameText = this.add.text(width / 2 - 150, height / 2 - 180, '🆕 Neues Spiel', {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    })
    newGameText.setOrigin(0.5)
    newGameText.setName('newGameText')
    newGameText.setDepth(1204)

    // Manuell Speichern Button
    const manualSaveButton = this.add.rectangle(width / 2 + 150, height / 2 - 180, 120, 35, 0x27ae60)
    manualSaveButton.setInteractive({ useHandCursor: true })
    manualSaveButton.setStrokeStyle(2, 0x2ecc71)
    manualSaveButton.setName('manualSaveButton')
    manualSaveButton.setDepth(1203)

    const manualSaveText = this.add.text(width / 2 + 150, height / 2 - 180, '💾 Jetzt speichern', {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    })
    manualSaveText.setOrigin(0.5)
    manualSaveText.setName('manualSaveText')
    manualSaveText.setDepth(1204)

    // Save Slots anzeigen
    const maxSlots = 8
    const slotsPerRow = 2
    const slotWidth = 250
    const slotHeight = 60

    for (let i = 0; i < maxSlots; i++) {
      const row = Math.floor(i / slotsPerRow)
      const col = i % slotsPerRow
      const x = width / 2 - 130 + col * 260
      const y = height / 2 - 120 + row * 70

      const slot = saveSlots[i]
      const isEmpty = !slot

      // Slot Box
      const slotBox = this.add.rectangle(x, y, slotWidth, slotHeight, isEmpty ? 0x2c3e50 : 0x34495e)
      slotBox.setStrokeStyle(2, isEmpty ? 0x7f8c8d : 0x3498db)
      slotBox.setInteractive({ useHandCursor: true })
      slotBox.setName(`saveSlot_${i}`)
      slotBox.setDepth(1202)

      if (isEmpty) {
        // Leerer Slot
        const emptyText = this.add.text(x, y, `Slot ${i + 1}\nLeer`, {
          fontSize: '14px',
          color: '#7f8c8d',
          fontFamily: 'Arial, sans-serif',
          align: 'center'
        })
        emptyText.setOrigin(0.5)
        emptyText.setName(`emptySlotText_${i}`)
        emptyText.setDepth(1203)

        // Click zum Speichern
        slotBox.on('pointerdown', () => {
          const slotName = `save_${i + 1}`
          if (this.gameManager.saveGame(slotName)) {
            UILibraries.showToast(`💾 Gespeichert in Slot ${i + 1}!`, 'success')
            this.closeSaveLoadDialog()
          }
        })
      } else {
        // Belegter Slot
        const slotText = this.add.text(x, y - 15, `Slot ${i + 1}: ${slot.name}`, {
          fontSize: '12px',
          color: '#ecf0f1',
          fontFamily: 'Arial, sans-serif',
          fontStyle: 'bold'
        })
        slotText.setOrigin(0.5)
        slotText.setName(`slotText_${i}`)
        slotText.setDepth(1203)

        const dateText = this.add.text(x, y + 5, slot.formattedDate, {
          fontSize: '10px',
          color: '#bdc3c7',
          fontFamily: 'Arial, sans-serif'
        })
        dateText.setOrigin(0.5)
        dateText.setName(`dateText_${i}`)
        dateText.setDepth(1203)

        // Load/Delete Buttons
        const loadBtn = this.add.rectangle(x - 60, y + 20, 50, 20, 0x3498db)
        loadBtn.setInteractive({ useHandCursor: true })
        loadBtn.setStrokeStyle(1, 0x2980b9)
        loadBtn.setName(`loadBtn_${i}`)
        loadBtn.setDepth(1203)

        const loadText = this.add.text(x - 60, y + 20, 'Laden', {
          fontSize: '9px',
          color: '#ffffff',
          fontFamily: 'Arial, sans-serif'
        })
        loadText.setOrigin(0.5)
        loadText.setName(`loadText_${i}`)
        loadText.setDepth(1204)

        const deleteBtn = this.add.rectangle(x + 60, y + 20, 50, 20, 0xe74c3c)
        deleteBtn.setInteractive({ useHandCursor: true })
        deleteBtn.setStrokeStyle(1, 0xc0392b)
        deleteBtn.setName(`deleteBtn_${i}`)
        deleteBtn.setDepth(1203)

        const deleteText = this.add.text(x + 60, y + 20, 'Löschen', {
          fontSize: '9px',
          color: '#ffffff',
          fontFamily: 'Arial, sans-serif'
        })
        deleteText.setOrigin(0.5)
        deleteText.setName(`deleteText_${i}`)
        deleteText.setDepth(1204)

        // Events
        loadBtn.on('pointerdown', () => {
          if (this.gameManager.loadGame(slot.name)) {
            UILibraries.showToast('📂 Spiel geladen!', 'success')
            this.closeSaveLoadDialog()
            this.refreshPropertyDisplay()
          }
        })

        deleteBtn.on('pointerdown', () => {
          if (this.gameManager.deleteSave(slot.name)) {
            UILibraries.showToast('🗑️ Spielstand gelöscht!', 'info')
            this.closeSaveLoadDialog()
            this.showSaveLoadDialog() // Dialog neu öffnen
          }
        })

        // Hover effects
        loadBtn.on('pointerover', () => loadBtn.setFillStyle(0x2980b9))
        loadBtn.on('pointerout', () => loadBtn.setFillStyle(0x3498db))
        deleteBtn.on('pointerover', () => deleteBtn.setFillStyle(0xc0392b))
        deleteBtn.on('pointerout', () => deleteBtn.setFillStyle(0xe74c3c))
      }

      // Slot hover effects
      slotBox.on('pointerover', () => {
        slotBox.setStrokeStyle(2, isEmpty ? 0x95a5a6 : 0x5dade2)
      })

      slotBox.on('pointerout', () => {
        slotBox.setStrokeStyle(2, isEmpty ? 0x7f8c8d : 0x3498db)
      })
    }

    // Button Events
    newGameButton.on('pointerdown', () => {
      // Neues Spiel starten
      this.gameManager.startNewGame()
      UILibraries.showToast('🆕 Neues Spiel gestartet!', 'success')
      this.closeSaveLoadDialog()
      this.refreshPropertyDisplay()
      this.updatePortfolioDisplay()
    })

    manualSaveButton.on('pointerdown', () => {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
      if (this.gameManager.saveGame(`manual_${timestamp}`)) {
        UILibraries.showToast('💾 Manuell gespeichert!', 'success')
        this.closeSaveLoadDialog()
      }
    })

    // Schließen Button
    const closeButton = this.add.rectangle(width / 2, height / 2 + 210, 120, 35, 0x95a5a6)
    closeButton.setInteractive({ useHandCursor: true })
    closeButton.setStrokeStyle(2, 0x7f8c8d)
    closeButton.setName('saveLoadCloseButton')
    closeButton.setDepth(1203)

    const closeText = this.add.text(width / 2, height / 2 + 210, 'Schließen', {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    })
    closeText.setOrigin(0.5)
    closeText.setName('saveLoadCloseText')
    closeText.setDepth(1204)

    closeButton.on('pointerdown', () => {
      this.closeSaveLoadDialog()
    })

    // Hover effects
    newGameButton.on('pointerover', () => newGameButton.setFillStyle(0xc0392b))
    newGameButton.on('pointerout', () => newGameButton.setFillStyle(0xe74c3c))
    manualSaveButton.on('pointerover', () => manualSaveButton.setFillStyle(0x2ecc71))
    manualSaveButton.on('pointerout', () => manualSaveButton.setFillStyle(0x27ae60))
    closeButton.on('pointerover', () => closeButton.setFillStyle(0x7f8c8d))
    closeButton.on('pointerout', () => closeButton.setFillStyle(0x95a5a6))

    overlay.on('pointerdown', () => {
      this.closeSaveLoadDialog()
    })
  }

  private closeSaveLoadDialog() {
    // Alle Save/Load Dialog Elemente entfernen
    const elementsToRemove = [
      'saveLoadDialog', 'saveLoadDialogBox', 'saveLoadTitle',
      'newGameButton', 'newGameText', 'manualSaveButton', 'manualSaveText',
      'saveLoadCloseButton', 'saveLoadCloseText'
    ]

    // Dynamische Slot-Elemente
    for (let i = 0; i < 8; i++) {
      elementsToRemove.push(
        `saveSlot_${i}`, `emptySlotText_${i}`, `slotText_${i}`, `dateText_${i}`,
        `loadBtn_${i}`, `loadText_${i}`, `deleteBtn_${i}`, `deleteText_${i}`
      )
    }

    elementsToRemove.forEach(name => {
      const element = this.children.getByName(name)
      if (element) element.destroy()
    })
  }

  private showNotification(message: string, color: number = 0x3498db) {
    const { width, height } = this.cameras.main

    // Notification Box
    const notificationBox = this.add.rectangle(width / 2, 100, 300, 50, color, 0.9)
    notificationBox.setStrokeStyle(2, 0xffffff)
    notificationBox.setName('notification')
    notificationBox.setDepth(2000)

    // Notification Text
    const notificationText = this.add.text(width / 2, 100, message, {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    })
    notificationText.setOrigin(0.5)
    notificationText.setName('notificationText')
    notificationText.setDepth(2001)

    // Auto-remove nach 3 Sekunden
    this.time.delayedCall(3000, () => {
      if (notificationBox) notificationBox.destroy()
      if (notificationText) notificationText.destroy()
    })
  }

  private setupKeyboardShortcuts() {
    // F5 - Quick Save
    this.input.keyboard?.on('keydown-F5', () => {
      if (this.gameManager.quickSave()) {
        UILibraries.showToast('⚡ Quick Save erstellt!', 'success')
      }
    })

    // F9 - Quick Load (letzter QuickSave)
    this.input.keyboard?.on('keydown-F9', () => {
      const saveSlots = this.gameManager.getSaveSlots()
      const quickSave = saveSlots.find(slot => slot.name.startsWith('quicksave_'))
      
      if (quickSave && this.gameManager.loadGame(quickSave.name)) {
        UILibraries.showToast('⚡ Quick Load erfolgreich!', 'success')
        this.refreshPropertyDisplay()
      } else {
        UILibraries.showToast('❌ Kein Quick Save gefunden!', 'error')
      }
    })

    // Ctrl+S - Save Dialog öffnen
    this.input.keyboard?.on('keydown-S', (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        this.showSaveLoadDialog()
      }
    })

    // ESC - Alle Dialoge schließen
    this.input.keyboard?.on('keydown-ESC', () => {
      this.closePropertyDialog()
      this.closeRenovationDialog()
      this.closeSaveLoadDialog()
    })

    // Space - Pause/Resume
    this.input.keyboard?.on('keydown-SPACE', () => {
      this.gameManager.togglePause()
    })
  }

  private startTimeSystem() {
    // Zeit-System wird jetzt vom GameManager verwaltet
    // Sicherstellen, dass es läuft
    const timeSettings = this.gameManager.getTimeSettings()
    
    // Initiale UI-Updates
    this.updateSpeedDisplay(timeSettings.speed, timeSettings.isPaused)
    this.timeText.setText(this.gameManager.getFormattedDate())
    this.updatePortfolioDisplay()
    
    console.log('Zeit-System gestartet:', timeSettings)
  }
}