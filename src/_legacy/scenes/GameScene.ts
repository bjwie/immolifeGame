import Phaser from 'phaser'
import { GameManager } from '../managers/GameManager'
import { WorldManager, WorldConfig, WorldZone } from '../managers/WorldManager'
import { WorldBuilder } from '../utils/WorldBuilder'
import { PropertyType, TimeSpeed, MarketTrend, GameTime } from '../types/GameTypes'
import { Property } from '../objects/Property'
import { UILibraries } from '../utils/UILibraries'

export class GameScene extends Phaser.Scene {
  private gameManager!: GameManager
  private worldManager!: WorldManager
  private propertySprites: Map<string, Phaser.GameObjects.Container> = new Map()
  private selectedProperty: Property | null = null
  private uiElements!: Phaser.GameObjects.Group
  private timeText!: Phaser.GameObjects.Text
  private isPaused: boolean = false
  private timePanelContainer!: Phaser.GameObjects.Container
  private infoPanelContainer!: Phaser.GameObjects.Container
  private particleEmitters: Map<string, Phaser.GameObjects.Particles.ParticleEmitter> = new Map()
  private occupiedPositions: Set<string> = new Set() // Track occupied building positions
  private bankManager: any

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

    // === WORLD ASSETS ===
    // Terrain
    this.load.image('terrain-grass', 'assets/world/terrain/grass.png')
    this.load.image('terrain-concrete', 'assets/world/terrain/concrete.png')
    this.load.image('terrain-asphalt', 'assets/world/terrain/asphalt.png')
    this.load.image('terrain-water', 'assets/world/terrain/water.png')
    this.load.image('terrain-park', 'assets/world/terrain/park.png')
    
    // Roads
    this.load.image('road-horizontal', 'assets/world/roads/road-horizontal.png')
    this.load.image('road-vertical', 'assets/world/roads/road-vertical.png')
    this.load.image('road-cross', 'assets/world/roads/road-cross.png')
    this.load.image('road-corner-tl', 'assets/world/roads/road-corner-tl.png')
    this.load.image('road-corner-tr', 'assets/world/roads/road-corner-tr.png')
    this.load.image('road-corner-bl', 'assets/world/roads/road-corner-bl.png')
    this.load.image('road-corner-br', 'assets/world/roads/road-corner-br.png')
    
    // Infrastructure
    this.load.image('infrastructure-streetlight', 'assets/world/infrastructure/streetlight.png')
    this.load.image('infrastructure-traffic-light', 'assets/world/infrastructure/traffic-light.png')
    this.load.image('infrastructure-bus-stop', 'assets/world/infrastructure/bus-stop.png')
    this.load.image('infrastructure-bench', 'assets/world/infrastructure/park-bench.png')
    this.load.image('infrastructure-tree-small', 'assets/world/infrastructure/tree-small.png')
    this.load.image('infrastructure-tree-large', 'assets/world/infrastructure/tree-large.png')
    this.load.image('infrastructure-fountain', 'assets/world/infrastructure/fountain.png')
    this.load.image('infrastructure-statue', 'assets/world/infrastructure/statue.png')

    // Gebäude-Sprites (erweitert)
    this.load.image('apartment', 'assets/buildings/apartment.png')
    this.load.image('house', 'assets/buildings/house.png')
    this.load.image('commercial', 'assets/buildings/commercial.png')
    this.load.image('office', 'assets/buildings/office.png')
    
    // Zusätzliche Gebäude-Varianten
    this.load.image('house-small', 'assets/buildings/residential/house-small.png')
    this.load.image('house-large', 'assets/buildings/residential/house-large.png')
    this.load.image('apartment-small', 'assets/buildings/residential/apartment-small.png')
    this.load.image('apartment-large', 'assets/buildings/residential/apartment-large.png')
    this.load.image('shop-small', 'assets/buildings/commercial/shop-small.png')
    this.load.image('shop-large', 'assets/buildings/commercial/shop-large.png')
    this.load.image('office-small', 'assets/buildings/office/office-small.png')
    this.load.image('office-tower', 'assets/buildings/office/office-tower.png')
    
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
    
    // Initialize popover cleanup system
    UILibraries.startPopoverCleanup()
    
    // Initialize WorldManager with advanced world configuration
    this.initializeWorldManager()
    
    // Resize Event Listener hinzufügen
    this.scale.on('resize', this.handleResize, this)
    
    this.setupScene()
  }

  private initializeWorldManager() {
    const { width, height } = this.cameras.main
    
    // Generate placeholder assets first
    WorldBuilder.generatePlaceholderAssets(this)
    
    // Get a world template (you can change this to any template)
    const templates = WorldBuilder.getWorldTemplates()
    const selectedTemplate = templates[0] // Grid City fixed
    
    // Adapt the template to current screen size
    const worldConfig: WorldConfig = {
      ...selectedTemplate.config,
      width: Math.min(width, selectedTemplate.config.width),
      height: Math.min(height - 280, selectedTemplate.config.height) // Reserve space for UI panels
    }
    
    // Validate the configuration
    const validation = WorldBuilder.validateWorldConfig(worldConfig)
    if (!validation.valid) {
      console.warn('⚠️ World configuration issues:', validation.errors)
    }

    // Initialize WorldManager
    this.worldManager = new WorldManager(this, worldConfig)
    
    // Generate the world
    this.worldManager.generateWorld()
    
    console.log('🌍 Advanced world system initialized with template:', selectedTemplate.name)
    console.log('📊 World stats:', {
      zones: worldConfig.zones.length,
      size: `${worldConfig.width}x${worldConfig.height}`,
      pattern: worldConfig.streetPattern
    })
  }

  private setupScene() {
    // Note: Background and roads are now handled by WorldManager
    // The world is already generated in initializeWorldManager()

    // UI Gruppe erstellen
    this.uiElements = this.add.group()

    // Immobilien auf der Karte anzeigen (now uses WorldManager positioning)
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
    UILibraries.stopPopoverCleanup()
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

  private displayProperties() {
    const availableProperties = this.gameManager.getAvailableProperties()
    const playerProperties = this.gameManager.getPlayer().properties

    // Use WorldManager for intelligent property positioning
    this.positionPropertiesInWorld(availableProperties, false)
    this.positionPropertiesInWorld(playerProperties, true)
  }

  private positionPropertiesInWorld(properties: Property[], isOwned: boolean) {
    properties.forEach(property => {
      // If property doesn't have a position yet, find one using WorldManager
      if (!property.x || !property.y) {
        const zoneType = this.getZoneTypeForProperty(property.type)
        const position = this.findStreetAlignedPosition(zoneType)
        
        if (position) {
          property.x = position.x
          property.y = position.y
        } else {
          // Fallback to zone-based positioning
          this.positionPropertyFallback(property)
          // Mark fallback position as occupied too
          if (property.x && property.y) {
            this.markPositionAsOccupied(property.x, property.y)
          }
        }
      } else {
        // Validiere, ob bestehende Position in einer Zone ist
        const isInAnyZone = this.validatePropertyInZone(property)
        if (!isInAnyZone) {
          console.log(`Repositioning property ${property.name} to stay within zones`)
          this.positionPropertyFallback(property)
          if (property.x && property.y) {
            this.markPositionAsOccupied(property.x, property.y)
          }
        } else {
          // Mark existing valid position as occupied
          this.markPositionAsOccupied(property.x, property.y)
        }
      }
      
      this.createPropertySprite(property, this.getPropertyColor(property.type), isOwned)
    })
  }

  private validatePropertyInZone(property: Property): boolean {
    const zones = Array.from(this.worldManager.getZones().values())
    
    for (const zone of zones) {
      const { bounds } = zone
      if (property.x >= bounds.x && property.x <= bounds.x + bounds.width &&
          property.y >= bounds.y && property.y <= bounds.y + bounds.height) {
        return true
      }
    }
    
    return false
  }

  private findStreetAlignedPosition(zoneType: string): { x: number, y: number } | null {
    const zone = Array.from(this.worldManager.getZones().values()).find(z => z.type === zoneType)
    if (!zone) return null

    const { bounds } = zone
    const tileSize = 64
    const buildingSpacing = tileSize // Minimum distance between buildings
    
    // Berechne Grid-Grenzen innerhalb der Zone (snap to center of tiles)
    const margin = tileSize / 2
    const startGridX = Math.ceil((bounds.x + margin) / tileSize)
    const startGridY = Math.ceil((bounds.y + margin) / tileSize)
    const endGridX = Math.floor((bounds.x + bounds.width - margin) / tileSize)
    const endGridY = Math.floor((bounds.y + bounds.height - margin) / tileSize)

    // Grid-basierte Suche nach verfügbaren Positionen mit Abstandsprüfung
    const availablePositions: { x: number, y: number }[] = []
    
    for (let gridX = startGridX; gridX <= endGridX; gridX++) {
      for (let gridY = startGridY; gridY <= endGridY; gridY++) {
        // Center the position within the grid tile
        const worldX = gridX * tileSize + tileSize / 2
        const worldY = gridY * tileSize + tileSize / 2
        
        // Prüfen ob Position innerhalb der Zone und nicht auf Straße ist
        if (worldX >= bounds.x + margin && 
            worldX <= bounds.x + bounds.width - margin &&
            worldY >= bounds.y + margin && 
            worldY <= bounds.y + bounds.height - margin &&
            !this.worldManager.isRoad(worldX, worldY) &&
            this.hasMinimumBuildingDistance(worldX, worldY, buildingSpacing)) {
          
          availablePositions.push({ x: worldX, y: worldY })
        }
      }
    }
    
    // Zufällige Position aus verfügbaren Grid-Positionen wählen
    if (availablePositions.length > 0) {
      const randomIndex = Math.floor(Math.random() * availablePositions.length)
      const selectedPosition = availablePositions[randomIndex]
      
      // Position als belegt markieren
      this.markPositionAsOccupied(selectedPosition.x, selectedPosition.y)
      return selectedPosition
    }

    // Fallback: Grid-basierte Spiral-Suche um das Zonenzentrum mit Tile-Center-Alignment
    const centerGridX = Math.round((bounds.x + bounds.width / 2) / tileSize)
    const centerGridY = Math.round((bounds.y + bounds.height / 2) / tileSize)
    
    for (let radius = 1; radius <= 15; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) === radius || Math.abs(dy) === radius) { // Only check perimeter
            const gridX = centerGridX + dx
            const gridY = centerGridY + dy
            // Center the position within the grid tile
            const worldX = gridX * tileSize + tileSize / 2
            const worldY = gridY * tileSize + tileSize / 2
            
            // Prüfen ob in Zone, nicht auf Straße und mit Mindestabstand
            if (worldX >= bounds.x && worldX <= bounds.x + bounds.width &&
                worldY >= bounds.y && worldY <= bounds.y + bounds.height &&
                !this.worldManager.isRoad(worldX, worldY) &&
                this.hasMinimumBuildingDistance(worldX, worldY, Math.max(buildingSpacing / 2, 32))) {
              
              this.markPositionAsOccupied(worldX, worldY)
              return { x: worldX, y: worldY }
            }
          }
        }
      }
    }

    // Absolute Fallback: Grid-aligned center of zone
    const centerX = Math.round((bounds.x + bounds.width / 2) / tileSize) * tileSize + tileSize / 2
    const centerY = Math.round((bounds.y + bounds.height / 2) / tileSize) * tileSize + tileSize / 2
    
    if (this.hasMinimumBuildingDistance(centerX, centerY, 32)) {
      this.markPositionAsOccupied(centerX, centerY)
      return { x: centerX, y: centerY }
    }
    
    return null // Keine verfügbare Position gefunden
  }

  private getZoneTypeForProperty(propertyType: PropertyType): string {
    switch (propertyType) {
      case PropertyType.APARTMENT:
      case PropertyType.HOUSE:
        return 'residential'
      case PropertyType.COMMERCIAL:
        return 'commercial'
      case PropertyType.OFFICE:
        return 'office'
      default:
        return 'residential'
    }
  }

  /**
   * Check if a position has minimum distance to existing buildings
   */
  private hasMinimumBuildingDistance(x: number, y: number, minDistance: number): boolean {
    const tileSize = 64
    const gridX = Math.round((x - tileSize / 2) / tileSize) // Convert world pos back to grid coords
    const gridY = Math.round((y - tileSize / 2) / tileSize)
    const searchRadius = Math.ceil(minDistance / tileSize)
    
    // Check grid positions around the target position
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      for (let dy = -searchRadius; dy <= searchRadius; dy++) {
        const checkGridX = gridX + dx
        const checkGridY = gridY + dy
        const positionKey = `${checkGridX},${checkGridY}`
        
        if (this.occupiedPositions.has(positionKey)) {
          // Calculate actual distance
          const checkWorldX = checkGridX * tileSize + tileSize / 2
          const checkWorldY = checkGridY * tileSize + tileSize / 2
          const distance = Math.sqrt(Math.pow(x - checkWorldX, 2) + Math.pow(y - checkWorldY, 2))
          
          if (distance < minDistance) {
            return false
          }
        }
      }
    }
    
    return true
  }

  /**
   * Mark a position as occupied in the grid system
   */
  private markPositionAsOccupied(x: number, y: number): void {
    const tileSize = 64
    const gridX = Math.round((x - tileSize / 2) / tileSize)
    const gridY = Math.round((y - tileSize / 2) / tileSize)
    const positionKey = `${gridX},${gridY}`
    this.occupiedPositions.add(positionKey)
  }

  /**
   * Unmark a position as occupied in the grid system
   */
  private unmarkPositionAsOccupied(x: number, y: number): void {
    const tileSize = 64
    const gridX = Math.round((x - tileSize / 2) / tileSize)
    const gridY = Math.round((y - tileSize / 2) / tileSize)
    const positionKey = `${gridX},${gridY}`
    this.occupiedPositions.delete(positionKey)
  }

  private getPropertyColor(propertyType: PropertyType): number {
    switch (propertyType) {
      case PropertyType.APARTMENT:
      case PropertyType.HOUSE:
        return 0x27ae60 // Green for residential
      case PropertyType.COMMERCIAL:
        return 0xf39c12 // Orange for commercial
      case PropertyType.OFFICE:
        return 0x3498db // Blue for office
      default:
        return 0x27ae60
    }
  }

  private positionPropertyFallback(property: Property) {
    const { width, height } = this.cameras.main
    const tileSize = 64
    const margin = 100
    
    // Create grid-based positions within the camera bounds (UI is now at bottom)
    const gridStartX = Math.ceil((margin) / tileSize)
    const gridStartY = Math.ceil((margin) / tileSize) // No extra space needed at top
    const gridEndX = Math.floor((width - margin) / tileSize)
    const gridEndY = Math.floor((height - 200 - margin) / tileSize) // Leave space for bottom UI
    
    for (let attempts = 0; attempts < 100; attempts++) {
      const gridX = gridStartX + Math.floor(Math.random() * (gridEndX - gridStartX))
      const gridY = gridStartY + Math.floor(Math.random() * (gridEndY - gridStartY))
      
      // Convert grid coordinates to world coordinates (center of tile)
      const x = gridX * tileSize + tileSize / 2
      const y = gridY * tileSize + tileSize / 2
      
      if (this.hasMinimumBuildingDistance(x, y, tileSize)) {
        property.x = x
        property.y = y
        console.log(`Property ${property.name} positioned at grid (${gridX}, ${gridY}) -> world (${x}, ${y})`)
        return
      }
    }
    
    // Absolute fallback - place at a grid-aligned position regardless
    const fallbackGridX = gridStartX + Math.floor(Math.random() * (gridEndX - gridStartX))
    const fallbackGridY = gridStartY + Math.floor(Math.random() * (gridEndY - gridStartY))
    property.x = fallbackGridX * tileSize + tileSize / 2
    property.y = fallbackGridY * tileSize + tileSize / 2
    console.log(`Property ${property.name} fallback positioned at grid (${fallbackGridX}, ${fallbackGridY}) -> world (${property.x}, ${property.y})`)
  }

  private createPropertySprite(property: Property, color: number, isOwned: boolean) {
    const container = this.add.container(property.x, property.y)
    container.setSize(64, 64)
    
    // Background
    const background = this.add.rectangle(0, 0, 64, 64, color, 0.5)
    container.add(background)
    
    // Property Icon - use a simple fallback if no specific icon exists
    let icon: Phaser.GameObjects.Image
    if (this.textures.exists('property-icon')) {
      icon = this.add.image(0, 0, 'property-icon')
    } else {
      // Create a simple building icon using graphics
      const graphics = this.add.graphics()
      graphics.fillStyle(0xffffff)
      graphics.fillRect(-16, -16, 32, 32)
      graphics.fillStyle(0x2c3e50)
      graphics.fillRect(-12, -12, 24, 24)
      graphics.generateTexture('building-icon', 32, 32)
      graphics.destroy()
      icon = this.add.image(0, 0, 'building-icon')
    }
    
    icon.setScale(0.6)
    container.add(icon)
    
    // Property name text
    const nameText = this.add.text(0, 25, property.name, {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: { x: 4, y: 2 }
    })
    nameText.setOrigin(0.5)
    container.add(nameText)
    
    // Price text
    const priceText = this.add.text(0, -25, `€${property.price.toLocaleString('de-DE')}`, {
      fontSize: '9px',
      color: '#f1c40f',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    })
    priceText.setOrigin(0.5)
    container.add(priceText)
    
    // Ownership indicator
    if (isOwned) {
      const ownershipIndicator = this.add.circle(20, -20, 8, 0x27ae60)
      ownershipIndicator.setStrokeStyle(2, 0xffffff)
      container.add(ownershipIndicator)
      
      const checkmark = this.add.text(20, -20, '✓', {
        fontSize: '12px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif'
      })
      checkmark.setOrigin(0.5)
      container.add(checkmark)
    }
    
    // Interactive behavior
    container.setInteractive(new Phaser.Geom.Rectangle(-32, -32, 64, 64), Phaser.Geom.Rectangle.Contains)
    
    // Hover Effekte mit Animationen und Tippy.js Popover
    let popoverInstance: any = null
    
    container.on('pointerover', () => {
      // Hover-Animation - angepasst für kleinere Sprites
      this.tweens.add({
        targets: container,
        scaleX: 1.15,
        scaleY: 1.15,
        duration: 200,
        ease: 'Back.easeOut'
      })
      
      this.input.setDefaultCursor('pointer')
      
      // Existing popover cleanup first
      const existingPopoverId = `property_${property.id}`
      UILibraries.removePopover(existingPopoverId)
      
      // Tippy.js Popover erstellen
      if (!popoverInstance) {
        const cashFlow = isOwned ? this.gameManager.calculatePropertyCashFlow(property.id) : undefined
        
        // Add delay to prevent race conditions with rapid hover events
        setTimeout(() => {
          if (container.scene) { // Check if container is still valid
                         popoverInstance = UILibraries.createPropertyPopover(
               this.game.canvas,
               property,
               isOwned,
               cashFlow
             )
            
            // Register with UILibraries for cleanup
            UILibraries.registerPopover(existingPopoverId, popoverInstance)
          }
        }, 100)
      }
    })
    
    container.on('pointerout', () => {
      // Hover-Animation zurücksetzen
      this.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        duration: 150,
        ease: 'Power1'
      })
      
      this.input.setDefaultCursor('default')
      
      // Popover entfernen mit Verzögerung
      if (popoverInstance) {
        setTimeout(() => {
          if (popoverInstance && !popoverInstance.state.isDestroyed) {
            popoverInstance.hide()
            popoverInstance.destroy()
          }
          popoverInstance = null
        }, 200)
      }
    })
    
    // Click Event
    container.on('pointerdown', () => {
      this.selectedProperty = property
      this.showPropertyDialog(property, isOwned)
    })
    
    // Sprite-Map aktualisieren
    this.propertySprites.set(property.id, container)
  }

  private estimateMonthlyPayment(principal: number, annualRate: number, months: number): number {
    const monthlyRate = annualRate / 100 / 12
    if (monthlyRate === 0) return principal / months
    
    return (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / 
           (Math.pow(1 + monthlyRate, months) - 1)
  }

  private async showLoanManagement() {
    try {
      // Temporärer Fix - verwende BankManager direkt
      const activeLoans = this.bankManager?.getActiveLoans() || []
      
      const action = await UILibraries.showLoanManagementDialog(activeLoans)
      
      if (action === 'early_payment') {
        UILibraries.showToast('💰 Sondertilgung-Feature kommt bald!', 'info')
      }
      
    } catch (error) {
      console.error('Error in loan management:', error)
      UILibraries.showToast('❌ Fehler beim Kredit-Management', 'error')
    }
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
      
      // Position wieder freigeben
      if (property.x && property.y) {
        this.unmarkPositionAsOccupied(property.x, property.y)
      }
      
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
        let activeSpeed = 1
        switch (speed) {
          case TimeSpeed.SLOW:
            speedLabel = 'Langsam (0.5x)'
            activeSpeed = 0.5
            break
          case TimeSpeed.NORMAL:
            speedLabel = 'Normal (1x)'
            activeSpeed = 1
            break
          case TimeSpeed.FAST:
            speedLabel = 'Schnell (2x)'
            activeSpeed = 2
            break
          case TimeSpeed.VERY_FAST:
            speedLabel = 'Sehr schnell (4x)'
            activeSpeed = 4
            break
          case TimeSpeed.ULTRA_FAST:
            speedLabel = 'Ultra schnell (8x)'
            activeSpeed = 8
            break
        }
        speedText.setText(`Geschwindigkeit: ${speedLabel}`)
        
        // Highlight the active speed button
        this.highlightActiveSpeedButton(activeSpeed)
      }
    }

    if (pauseButtonText) {
      pauseButtonText.setText(isPaused ? '▶️ Play' : '⏸️ Pause')
    }
  }

  private refreshPropertyDisplay() {
    // Clean up all active popovers first to prevent lingering tooltips
    UILibraries.removeAllPopovers()
    
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

    // Belegte Positionen zurücksetzen
    this.occupiedPositions.clear()

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

  private createUI() {
    const { width, height } = this.cameras.main
    
    // Zeit-Panel (unten links)
    this.timePanelContainer = this.add.container(20, height - 120)
    
    const timePanel = this.add.rectangle(0, 0, 400, 100, 0x2c3e50, 0.9)
    timePanel.setStrokeStyle(2, 0x3498db)
    timePanel.setOrigin(0, 0)
    
    this.timeText = this.add.text(10, 10, this.gameManager.getFormattedDate(), {
      fontSize: '16px',
      color: '#ecf0f1',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    })
    
    // Zeit-Kontrollen Zeile 1
    // Pause/Resume Button
    const pauseButton = this.add.rectangle(10, 35, 80, 25, 0x27ae60)
    pauseButton.setInteractive({ useHandCursor: true })
    pauseButton.setStrokeStyle(1, 0x2ecc71)
    pauseButton.setOrigin(0, 0)
    
    const pauseButtonText = this.add.text(50, 47.5, '⏸️ Pause', {
      fontSize: '11px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    })
    pauseButtonText.setOrigin(0.5)
    pauseButtonText.setName('pauseButtonText')
    
    pauseButton.on('pointerdown', () => {
      this.gameManager.togglePause()
    })
    
    // Nächster Monat Button
    const nextMonthButton = this.add.rectangle(100, 35, 90, 25, 0xe74c3c)
    nextMonthButton.setInteractive({ useHandCursor: true })
    nextMonthButton.setStrokeStyle(1, 0xc0392b)
    nextMonthButton.setOrigin(0, 0)
    
    const nextMonthText = this.add.text(145, 47.5, '⏭️ Nächster Monat', {
      fontSize: '9px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    })
    nextMonthText.setOrigin(0.5)
    
    nextMonthButton.on('pointerdown', () => {
      this.gameManager.advanceMonth()
      this.updatePortfolioDisplay()
    })
    
    // Geschwindigkeits-Label
    const speedLabel = this.add.text(200, 37, 'Geschwindigkeit:', {
      fontSize: '11px',
      color: '#ecf0f1',
      fontFamily: 'Arial, sans-serif'
    })
    speedLabel.setOrigin(0, 0)
    
    // Zeit-Kontrollen Zeile 2 - Geschwindigkeits-Buttons
    const speeds = [
      { label: '0.5x', speed: 0.5, color: 0x95a5a6 },
      { label: '1x', speed: 1, color: 0x3498db },
      { label: '2x', speed: 2, color: 0xf39c12 },
      { label: '4x', speed: 4, color: 0xe74c3c },
      { label: '8x', speed: 8, color: 0x9b59b6 }
    ]
    
    speeds.forEach((speedOption, index) => {
      const speedButton = this.add.rectangle(10 + index * 75, 65, 70, 25, speedOption.color)
      speedButton.setInteractive({ useHandCursor: true })
      speedButton.setStrokeStyle(2, 0xffffff)
      speedButton.setOrigin(0, 0)
      speedButton.setName(`speedButton_${speedOption.speed}`)
      
      const speedText = this.add.text(45 + index * 75, 77.5, speedOption.label, {
        fontSize: '11px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold'
      })
      speedText.setOrigin(0.5)
      
      speedButton.on('pointerdown', () => {
        this.gameManager.setTimeSpeed(speedOption.speed as any)
        this.highlightActiveSpeedButton(speedOption.speed)
      })
      
      // Hover-Effekte
      speedButton.on('pointerover', () => {
        speedButton.setAlpha(0.8)
      })
      speedButton.on('pointerout', () => {
        speedButton.setAlpha(1.0)
      })
      
      this.timePanelContainer.add([speedButton, speedText])
    })
    
    this.timePanelContainer.add([timePanel, this.timeText, pauseButton, pauseButtonText, nextMonthButton, nextMonthText, speedLabel])
    
    // Info-Panel (unten rechts)
    this.infoPanelContainer = this.add.container(width - 320, height - 170)
    
    const infoPanel = this.add.rectangle(0, 0, 300, 150, 0x2c3e50, 0.9)
    infoPanel.setStrokeStyle(2, 0x3498db)
    infoPanel.setOrigin(0, 0)
    
    const player = this.gameManager.getPlayer()
    
    const moneyText = this.add.text(10, 10, `💰 €${Math.round(player.money).toLocaleString('de-DE')}`, {
      fontSize: '14px',
      color: '#ecf0f1',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    })
    moneyText.setName('moneyText')
    
    const portfolioValue = this.calculatePortfolioValue()
    const portfolioText = this.add.text(10, 30, `🏠 Portfolio: €${Math.round(portfolioValue).toLocaleString('de-DE')}`, {
      fontSize: '12px',
      color: '#ecf0f1',
      fontFamily: 'Arial, sans-serif'
    })
    portfolioText.setName('portfolioText')
    
    const monthlyIncome = this.calculateMonthlyIncome()
    const incomeText = this.add.text(10, 50, `💵 Einkommen: €${Math.round(monthlyIncome).toLocaleString('de-DE')}/M`, {
      fontSize: '12px',
      color: monthlyIncome >= 0 ? '#2ecc71' : '#e74c3c',
      fontFamily: 'Arial, sans-serif'
    })
    incomeText.setName('incomeText')
    
    const availableCount = this.gameManager.getAvailableProperties().length
    const marketText = this.add.text(10, 70, `🏪 Markt: ${availableCount} Immobilien`, {
      fontSize: '12px',
      color: '#ecf0f1',
      fontFamily: 'Arial, sans-serif'
    })
    marketText.setName('marketText')
    
    const speedText = this.add.text(10, 90, 'Geschwindigkeit: Normal (1x)', {
      fontSize: '12px',
      color: '#ecf0f1',
      fontFamily: 'Arial, sans-serif'
    })
    speedText.setName('speedText')
    
    // Action Buttons Row 1
    const saveLoadButton = this.add.rectangle(10, 110, 90, 25, 0x95a5a6)
    saveLoadButton.setInteractive({ useHandCursor: true })
    saveLoadButton.setStrokeStyle(1, 0x7f8c8d)
    saveLoadButton.setOrigin(0, 0)
    
    const saveLoadText = this.add.text(55, 122.5, 'Speichern', {
      fontSize: '9px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    })
    saveLoadText.setOrigin(0.5)
    
    saveLoadButton.on('pointerdown', () => {
      this.showSaveLoadDialog()
    })
    
    // Portfolio Button
    const portfolioButton = this.add.rectangle(110, 110, 90, 25, 0x3498db)
    portfolioButton.setInteractive({ useHandCursor: true })
    portfolioButton.setStrokeStyle(1, 0x2980b9)
    portfolioButton.setOrigin(0, 0)
    
    const portfolioButtonText = this.add.text(155, 122.5, 'Portfolio', {
      fontSize: '9px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    })
    portfolioButtonText.setOrigin(0.5)
    
    portfolioButton.on('pointerdown', () => {
      this.showPortfolioDialog()
    })
    
    // Market Button
    const marketButton = this.add.rectangle(210, 110, 80, 25, 0xf39c12)
    marketButton.setInteractive({ useHandCursor: true })
    marketButton.setStrokeStyle(1, 0xe67e22)
    marketButton.setOrigin(0, 0)
    
    const marketButtonText = this.add.text(250, 122.5, 'Markt', {
      fontSize: '9px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    })
    marketButtonText.setOrigin(0.5)
    
    marketButton.on('pointerdown', () => {
      this.showMarketDialog()
    })
    
    this.infoPanelContainer.add([
      infoPanel, moneyText, portfolioText, incomeText, marketText, speedText, 
      saveLoadButton, saveLoadText, portfolioButton, portfolioButtonText, 
      marketButton, marketButtonText
    ])
    
    this.uiElements.addMultiple([this.timePanelContainer, this.infoPanelContainer])
    
    // Initial speed button highlight
    this.highlightActiveSpeedButton(1)
  }

  private highlightActiveSpeedButton(activeSpeed: number) {
    // Reset all speed buttons
    const speeds = [0.5, 1, 2, 4, 8]
    speeds.forEach(speed => {
      const button = this.timePanelContainer?.list.find(child => 
        child.name === `speedButton_${speed}`
      ) as Phaser.GameObjects.Rectangle
      
      if (button) {
        if (speed === activeSpeed) {
          button.setStrokeStyle(3, 0xffffff) // Highlight active button
          button.setAlpha(1.0)
        } else {
          button.setStrokeStyle(1, 0xbdc3c7) // Dim inactive buttons
          button.setAlpha(0.7)
        }
      }
    })
  }

  private calculateMonthlyIncome(): number {
    const player = this.gameManager.getPlayer()
    let totalIncome = 0
    
    player.properties.forEach(property => {
      const cashFlow = this.gameManager.calculatePropertyCashFlow(property.id)
      if (cashFlow) {
        totalIncome += cashFlow.netCashFlow
      }
    })
    
    return totalIncome
  }

  private async showPropertyDialog(property: Property, isOwned: boolean) {
    try {
      const action = await UILibraries.showPropertyDialog(property, isOwned)
      
      switch (action) {
        case 'buy':
          await this.handlePropertyPurchase(property)
          break
        case 'sell':
          await this.handlePropertySale(property)
          break
        case 'renovate':
          await this.handlePropertyRenovation(property)
          break
        case 'tenant':
          await this.handleTenantManagement(property)
          break
        case 'cancel':
          // Do nothing
          break
      }
    } catch (error) {
      console.error('Error in property dialog:', error)
      UILibraries.showToast('❌ Fehler beim Anzeigen der Immobilie', 'error')
    }
  }

  private async handlePropertyPurchase(property: Property) {
    const player = this.gameManager.getPlayer()
    
    if (player.money < property.price) {
      // Show loan application dialog
      const needsLoan = await UILibraries.showConfirmDialog(
        '💰 Nicht genug Geld',
        `Sie benötigen €${(property.price - player.money).toLocaleString('de-DE')} mehr. Möchten Sie einen Kredit beantragen?`,
        'Kredit beantragen',
        'Abbrechen'
      )
      
      if (needsLoan) {
        await this.showLoanApplication()
      }
      return
    }
    
    // Direct purchase
    if (this.gameManager.buyProperty(property.id)) {
      UILibraries.showToast(`🏠 ${property.name} erfolgreich gekauft!`, 'success')
      this.updatePortfolioDisplay()
    } else {
      UILibraries.showToast('❌ Kauf fehlgeschlagen', 'error')
    }
  }

  private async handlePropertySale(property: Property) {
    const sellPrice = Math.round(property.price * 0.9) // 10% loss on sale
    
    const confirmed = await UILibraries.showConfirmDialog(
      '💸 Immobilie verkaufen',
      `Möchten Sie ${property.name} für €${sellPrice.toLocaleString('de-DE')} verkaufen? (10% Verlust)`,
      'Verkaufen',
      'Abbrechen'
    )
    
    if (confirmed && this.gameManager.sellProperty(property.id)) {
      UILibraries.showToast(`💰 ${property.name} verkauft für €${sellPrice.toLocaleString('de-DE')}`, 'success')
      this.updatePortfolioDisplay()
    }
  }

  private async handlePropertyRenovation(property: Property) {
    // Simplified renovation - just show a toast for now
    UILibraries.showToast('🔨 Renovierung-Feature kommt bald!', 'info')
  }

  private async handleTenantManagement(property: Property) {
    if (property.isRented) {
      UILibraries.showToast(`👥 Mieter-Management für ${property.name} kommt bald!`, 'info')
    } else {
      UILibraries.showToast(`🔍 Mietersuche für ${property.name} kommt bald!`, 'info')
    }
  }

  private async showLoanApplication() {
    UILibraries.showToast('💰 Kredit-System kommt bald!', 'info')
  }

  private showPortfolioDialog() {
    const player = this.gameManager.getPlayer()
    const properties = player.properties
    
    if (properties.length === 0) {
      UILibraries.showToast('📊 Sie besitzen noch keine Immobilien', 'info')
      return
    }
    
    let portfolioInfo = `📊 **Portfolio Übersicht**\n\n`
    portfolioInfo += `💰 **Gesamtwert:** €${this.calculatePortfolioValue().toLocaleString('de-DE')}\n`
    portfolioInfo += `💵 **Monatseinkommen:** €${this.calculateMonthlyIncome().toLocaleString('de-DE')}\n`
    portfolioInfo += `🏠 **Anzahl Immobilien:** ${properties.length}\n\n`
    
    properties.forEach((property, index) => {
      const cashFlow = this.gameManager.calculatePropertyCashFlow(property.id)
      portfolioInfo += `${index + 1}. **${property.name}**\n`
      portfolioInfo += `   💰 Wert: €${property.price.toLocaleString('de-DE')}\n`
      portfolioInfo += `   🏠 Miete: €${property.monthlyRent.toLocaleString('de-DE')}/M\n`
      portfolioInfo += `   ${property.isRented ? '👥 Vermietet' : '🔍 Leer'}\n`
      if (cashFlow) {
        portfolioInfo += `   📈 Cash Flow: €${cashFlow.netCashFlow.toLocaleString('de-DE')}/M\n`
      }
      portfolioInfo += `\n`
    })
    
    UILibraries.showToast('📊 Portfolio-Details in der Konsole', 'info')
    console.log(portfolioInfo)
  }

  private showMarketDialog() {
    const availableProperties = this.gameManager.getAvailableProperties()
    
    if (availableProperties.length === 0) {
      UILibraries.showToast('🏪 Keine Immobilien am Markt verfügbar', 'warning')
      return
    }
    
    let marketInfo = `🏪 **Immobilienmarkt**\n\n`
    marketInfo += `📈 **Verfügbare Immobilien:** ${availableProperties.length}\n\n`
    
    // Show first 5 properties
    const displayProperties = availableProperties.slice(0, 5)
    displayProperties.forEach((property, index) => {
      const roi = ((property.monthlyRent * 12) / property.price * 100).toFixed(1)
      marketInfo += `${index + 1}. **${property.name}**\n`
      marketInfo += `   💰 Preis: €${property.price.toLocaleString('de-DE')}\n`
      marketInfo += `   🏠 Miete: €${property.monthlyRent.toLocaleString('de-DE')}/M\n`
      marketInfo += `   📊 ROI: ${roi}%\n`
      marketInfo += `   📍 ${property.location.district}\n\n`
    })
    
    if (availableProperties.length > 5) {
      marketInfo += `... und ${availableProperties.length - 5} weitere\n`
    }
    
    UILibraries.showToast('🏪 Markt-Details in der Konsole', 'info')
    console.log(marketInfo)
  }

  private closePropertyDialog() {
    // Remove any property dialog elements
    const dialogElements = ['propertyDialog', 'propertyDialogBox', 'propertyDialogTitle']
    dialogElements.forEach(name => {
      const element = this.children.getByName(name)
      if (element) element.destroy()
    })
  }

  private closeRenovationDialog() {
    // Remove any renovation dialog elements
    const dialogElements = ['renovationDialog', 'renovationDialogBox', 'renovationDialogTitle']
    dialogElements.forEach(name => {
      const element = this.children.getByName(name)
      if (element) element.destroy()
    })
  }
}