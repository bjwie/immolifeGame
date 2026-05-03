import Phaser from 'phaser'

export interface WorldTile {
  x: number
  y: number
  type: 'terrain' | 'road' | 'building' | 'infrastructure'
  subtype: string
  sprite?: Phaser.GameObjects.Image
  zone?: WorldZone
}

export interface WorldZone {
  id: string
  name: string
  type: 'residential' | 'commercial' | 'office' | 'industrial' | 'park'
  color: number
  density: 'low' | 'medium' | 'high' | 'none'
  bounds: { x: number, y: number, width: number, height: number }
  properties: {
    attractiveness: number
    noiseLevel: number
    accessibility: number
  }
}

export interface WorldConfig {
  width: number
  height: number
  tileSize: number
  zones: WorldZone[]
  streetPattern: 'grid' | 'organic' | 'mixed'
  terrainVariation: boolean
}

export class WorldManager {
  private scene: Phaser.Scene
  private config: WorldConfig
  private tiles: Map<string, WorldTile> = new Map()
  private zones: Map<string, WorldZone> = new Map()
  private layers: {
    terrain: Phaser.GameObjects.Group
    roads: Phaser.GameObjects.Group
    infrastructure: Phaser.GameObjects.Group
    buildings: Phaser.GameObjects.Group
    effects: Phaser.GameObjects.Group
  }

  constructor(scene: Phaser.Scene, config: WorldConfig) {
    this.scene = scene
    this.config = config
    
    // Create rendering layers
    this.layers = {
      terrain: scene.add.group(),
      roads: scene.add.group(),
      infrastructure: scene.add.group(),
      buildings: scene.add.group(),
      effects: scene.add.group()
    }

    // Set layer depths
    this.layers.terrain.setDepth(0)
    this.layers.roads.setDepth(10)
    this.layers.infrastructure.setDepth(20)
    this.layers.buildings.setDepth(30)
    this.layers.effects.setDepth(40)

    // Initialize zones
    config.zones.forEach(zone => {
      this.zones.set(zone.id, zone)
    })
  }

  /**
   * Generate the complete world
   */
  public generateWorld(): void {
    console.log('🌍 Generating world...')
    
    // 1. Generate terrain base
    this.generateTerrain()
    
    // 2. Create zones
    this.createZones()
    
    // 3. Generate road network
    this.generateRoadNetwork()
    
    // 4. Add infrastructure
    //this.addInfrastructure()
    
    // 5. Add environmental details
    this.addEnvironmentalDetails()
    
    console.log('✅ World generation complete!')
  }

  /**
   * Generate base terrain with clear grid
   */
  private generateTerrain(): void {
    const { width, height, tileSize } = this.config
    const tilesX = Math.floor(width / tileSize)
    const tilesY = Math.floor(height / tileSize)

    for (let x = 0; x < tilesX; x++) {
      for (let y = 0; y < tilesY; y++) {
        const worldX = x * tileSize + tileSize / 2
        const worldY = y * tileSize + tileSize / 2
        
        // Determine terrain type based on zone
        const zone = this.getZoneAt(worldX, worldY)
        let terrainType = 'grass'
        
        if (zone) {
          switch (zone.type) {
            case 'park':
              terrainType = 'park'
              break
            case 'commercial':
            case 'office':
              terrainType = 'concrete'
              break
            default:
              terrainType = 'grass'
          }
        }

        this.createTerrainTile(x, y, worldX, worldY, terrainType, true) // Enable grid mode
      }
    }
  }

  /**
   * Create terrain tile with optional grid lines
   */
  private createTerrainTile(gridX: number, gridY: number, worldX: number, worldY: number, type: string, showGrid: boolean = false): void {
    const tileKey = `${gridX},${gridY}`
    
    // Try to load real texture, fallback to colored rectangle with grid
    const textureKey = this.scene.textures.exists(`terrain-${type}`) ? `terrain-${type}` : null
    
    let sprite: Phaser.GameObjects.Image
    
    if (textureKey && !showGrid) {
      sprite = this.scene.add.image(worldX, worldY, textureKey)
    } else {
      // Create fallback colored rectangle with grid lines
      const graphics = this.scene.add.graphics()
      const color = this.getTerrainColor(type)
      
      // Fill base color
      graphics.fillStyle(color)
      graphics.fillRect(0, 0, this.config.tileSize, this.config.tileSize)
      
      if (showGrid) {
        // Add grid lines
        graphics.lineStyle(1, 0x000000, 0.2) // Subtle dark grid lines
        graphics.strokeRect(0, 0, this.config.tileSize, this.config.tileSize)
        
        // Add subtle inner grid for subdivisions
        graphics.lineStyle(1, 0x000000, 0.1)
        const halfTile = this.config.tileSize / 2
        graphics.moveTo(halfTile, 0)
        graphics.lineTo(halfTile, this.config.tileSize)
        graphics.moveTo(0, halfTile)
        graphics.lineTo(this.config.tileSize, halfTile)
        graphics.strokePath()
      }
      
      const textureId = showGrid ? `terrain-${type}-grid-fallback` : `terrain-${type}-fallback`
      graphics.generateTexture(textureId, this.config.tileSize, this.config.tileSize)
      graphics.destroy()
      
      sprite = this.scene.add.image(worldX, worldY, textureId)
    }

    sprite.setDisplaySize(this.config.tileSize, this.config.tileSize)
    this.layers.terrain.add(sprite)

    const tile: WorldTile = {
      x: gridX,
      y: gridY,
      type: 'terrain',
      subtype: type,
      sprite: sprite,
      zone: this.getZoneAt(worldX, worldY) || undefined
    }

    this.tiles.set(tileKey, tile)
  }

  /**
   * Get terrain color for fallback
   */
  private getTerrainColor(type: string): number {
    switch (type) {
      case 'grass': return 0x27ae60
      case 'concrete': return 0x7f8c8d
      case 'asphalt': return 0x2c3e50
      case 'water': return 0x3498db
      case 'park': return 0x2ecc71
      default: return 0x27ae60
    }
  }

  /**
   * Create zone backgrounds
   */
  private createZones(): void {
    this.zones.forEach(zone => {
      const { x, y, width, height } = zone.bounds
      
      // Create zone background with subtle tint
      const zoneBackground = this.scene.add.rectangle(
        x + width / 2, 
        y + height / 2, 
        width, 
        height, 
        zone.color, 
        0.1
      )
      
      zoneBackground.setStrokeStyle(2, zone.color, 0.3)
      this.layers.terrain.add(zoneBackground)

      // Add zone label
      const zoneLabel = this.scene.add.text(x + width / 2, y + 20, zone.name, {
        fontSize: '14px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        backgroundColor: '#000000',
        padding: { x: 8, y: 4 }
      })
      zoneLabel.setOrigin(0.5)
      zoneLabel.setAlpha(0.8)
      zoneLabel.setDepth(1000) // Bring zone labels to front
      this.layers.effects.add(zoneLabel) // Use effects layer (topmost)
    })
  }

  /**
   * Generate road network
   */
  private generateRoadNetwork(): void {
    switch (this.config.streetPattern) {
      case 'grid':
        this.generateGridRoads()
        break
      case 'organic':
        this.generateOrganicRoads()
        break
      case 'mixed':
        this.generateMixedRoads()
        break
    }
  }

  /**
   * Generate enhanced grid-based road network
   */
  private generateGridRoads(): void {
    const { width, height, tileSize } = this.config
    const roadSpacing = 4 // Every 4 tiles for denser grid
    const tilesX = Math.floor(width / tileSize)
    const tilesY = Math.floor(height / tileSize)

    // Create major roads (every 8 tiles)
    const majorRoadSpacing = 8
    
    // Major horizontal roads
    for (let y = majorRoadSpacing; y < tilesY; y += majorRoadSpacing) {
      for (let x = 0; x < tilesX; x++) {
        const worldX = x * tileSize + tileSize / 2
        const worldY = y * tileSize + tileSize / 2
        this.createRoadTile(x, y, worldX, worldY, 'horizontal', true) // Major road
      }
    }

    // Major vertical roads
    for (let x = majorRoadSpacing; x < tilesX; x += majorRoadSpacing) {
      for (let y = 0; y < tilesY; y++) {
        const worldX = x * tileSize + tileSize / 2
        const worldY = y * tileSize + tileSize / 2
        
        // Check if there's already a road here (intersection)
        if (this.tiles.has(`${x},${y}`) && this.tiles.get(`${x},${y}`)?.type === 'road') {
          this.updateRoadTile(x, y, 'cross', true) // Major intersection
        } else {
          this.createRoadTile(x, y, worldX, worldY, 'vertical', true) // Major road
        }
      }
    }

    // Minor roads (fill in between major roads)
    for (let y = roadSpacing; y < tilesY; y += roadSpacing) {
      if (y % majorRoadSpacing !== 0) { // Skip major road positions
        for (let x = 0; x < tilesX; x++) {
          const worldX = x * tileSize + tileSize / 2
          const worldY = y * tileSize + tileSize / 2
          this.createRoadTile(x, y, worldX, worldY, 'horizontal', false) // Minor road
        }
      }
    }

    for (let x = roadSpacing; x < tilesX; x += roadSpacing) {
      if (x % majorRoadSpacing !== 0) { // Skip major road positions
        for (let y = 0; y < tilesY; y++) {
          const worldX = x * tileSize + tileSize / 2
          const worldY = y * tileSize + tileSize / 2
          
          if (this.tiles.has(`${x},${y}`) && this.tiles.get(`${x},${y}`)?.type === 'road') {
            this.updateRoadTile(x, y, 'cross', false) // Minor intersection
          } else {
            this.createRoadTile(x, y, worldX, worldY, 'vertical', false) // Minor road
          }
        }
      }
    }
  }

  /**
   * Generate organic road network
   */
  private generateOrganicRoads(): void {
    // Implement curved, natural-looking roads
    // This would use pathfinding algorithms to create more realistic street layouts
    console.log('🌿 Generating organic road network...')
    
    // For now, create a simplified organic pattern
    this.generateGridRoads() // Fallback to grid
  }

  /**
   * Generate mixed road network
   */
  private generateMixedRoads(): void {
    // Combine grid and organic elements
    this.generateGridRoads()
    // Add some curved connector roads
  }

  /**
   * Create road tile
   */
  private createRoadTile(gridX: number, gridY: number, worldX: number, worldY: number, roadType: string, isMajor: boolean = false): void {
    const tileKey = `${gridX},${gridY}`
    
    // Try to load real road texture, fallback to colored rectangle
    const textureKey = this.scene.textures.exists(`road-${roadType}`) ? `road-${roadType}` : null
    
    let sprite: Phaser.GameObjects.Image
    
    if (textureKey && !isMajor) {
      sprite = this.scene.add.image(worldX, worldY, textureKey)
    } else {
      // Create fallback road texture with major/minor distinction
      const graphics = this.scene.add.graphics()
      const roadColor = isMajor ? 0x34495e : 0x2c3e50 // Lighter gray for major roads
      graphics.fillStyle(roadColor)
      graphics.fillRect(0, 0, this.config.tileSize, this.config.tileSize)
      
      // Add road markings - enhanced for major roads
      if (isMajor) {
        // Major roads get white lane markings
        graphics.fillStyle(0xffffff)
        if (roadType === 'horizontal') {
          graphics.fillRect(0, this.config.tileSize / 2 - 2, this.config.tileSize, 4)
        } else if (roadType === 'vertical') {
          graphics.fillRect(this.config.tileSize / 2 - 2, 0, 4, this.config.tileSize)
        } else if (roadType === 'cross') {
          graphics.fillRect(0, this.config.tileSize / 2 - 2, this.config.tileSize, 4)
          graphics.fillRect(this.config.tileSize / 2 - 2, 0, 4, this.config.tileSize)
        }
      } else {
        // Minor roads get yellow center line
        graphics.fillStyle(0xf1c40f)
        if (roadType === 'horizontal') {
          graphics.fillRect(0, this.config.tileSize / 2 - 1, this.config.tileSize, 2)
        } else if (roadType === 'vertical') {
          graphics.fillRect(this.config.tileSize / 2 - 1, 0, 2, this.config.tileSize)
        } else if (roadType === 'cross') {
          graphics.fillRect(0, this.config.tileSize / 2 - 1, this.config.tileSize, 2)
          graphics.fillRect(this.config.tileSize / 2 - 1, 0, 2, this.config.tileSize)
        }
      }
      
      const textureId = isMajor ? `road-${roadType}-major-fallback` : `road-${roadType}-fallback`
      graphics.generateTexture(textureId, this.config.tileSize, this.config.tileSize)
      graphics.destroy()
      
      sprite = this.scene.add.image(worldX, worldY, textureId)
    }

    sprite.setDisplaySize(this.config.tileSize, this.config.tileSize)
    this.layers.roads.add(sprite)

    const tile: WorldTile = {
      x: gridX,
      y: gridY,
      type: 'road',
      subtype: isMajor ? `${roadType}-major` : roadType,
      sprite: sprite
    }

    this.tiles.set(tileKey, tile)
  }

  /**
   * Update road tile type (e.g., for intersections)
   */
  private updateRoadTile(gridX: number, gridY: number, newRoadType: string, isMajor: boolean = false): void {
    const tileKey = `${gridX},${gridY}`
    const tile = this.tiles.get(tileKey)
    
    if (tile && tile.sprite) {
      tile.sprite.destroy()
      const worldX = gridX * this.config.tileSize + this.config.tileSize / 2
      const worldY = gridY * this.config.tileSize + this.config.tileSize / 2
      this.createRoadTile(gridX, gridY, worldX, worldY, newRoadType, isMajor)
    }
  }

  /**
   * Add infrastructure elements
   */
  private addInfrastructure(): void {
    console.log('🏗️ Adding infrastructure...')
    
    // Add street lights along roads
    this.addStreetLights()
    
    // Add trees in residential areas
    this.addTrees()
    
    // Add benches in parks
    this.addParkElements()
  }

  /**
   * Add street lights along roads
   */
  private addStreetLights(): void {
    this.tiles.forEach((tile, key) => {
      if (tile.type === 'road' && Math.random() < 0.3) { // 30% chance
        const worldX = tile.x * this.config.tileSize + this.config.tileSize / 2
        const worldY = tile.y * this.config.tileSize + this.config.tileSize / 2
        
        this.createInfrastructureElement(worldX + 20, worldY + 20, 'streetlight', '💡')
      }
    })
  }

  /**
   * Add trees in appropriate areas
   */
  private addTrees(): void {
    this.zones.forEach(zone => {
      if (zone.type === 'residential' || zone.type === 'park') {
        const treeCount = zone.type === 'park' ? 15 : 5
        
        for (let i = 0; i < treeCount; i++) {
          const x = zone.bounds.x + Math.random() * zone.bounds.width
          const y = zone.bounds.y + Math.random() * zone.bounds.height
          
          // Don't place trees on roads
          if (!this.isRoad(x, y)) {
            const treeType = Math.random() < 0.5 ? 'tree-small' : 'tree-large'
            const emoji = treeType === 'tree-small' ? '🌳' : '🌲'
            this.createInfrastructureElement(x, y, treeType, emoji)
          }
        }
      }
    })
  }

  /**
   * Add park elements
   */
  private addParkElements(): void {
    this.zones.forEach(zone => {
      if (zone.type === 'park') {
        // Add benches
        for (let i = 0; i < 3; i++) {
          const x = zone.bounds.x + Math.random() * zone.bounds.width
          const y = zone.bounds.y + Math.random() * zone.bounds.height
          this.createInfrastructureElement(x, y, 'bench', '🪑')
        }
        
        // Add fountain in center
        const centerX = zone.bounds.x + zone.bounds.width / 2
        const centerY = zone.bounds.y + zone.bounds.height / 2
        this.createInfrastructureElement(centerX, centerY, 'fountain', '⛲')
      }
    })
  }

  /**
   * Create infrastructure element
   */
  private createInfrastructureElement(x: number, y: number, type: string, fallbackEmoji: string): void {
    const textureKey = this.scene.textures.exists(`infrastructure-${type}`) ? `infrastructure-${type}` : null
    
    let element: Phaser.GameObjects.GameObject
    
    if (textureKey) {
      element = this.scene.add.image(x, y, textureKey)
      ;(element as Phaser.GameObjects.Image).setScale(0.5)
    } else {
      // Fallback to emoji
      element = this.scene.add.text(x, y, fallbackEmoji, {
        fontSize: '20px'
      })
      ;(element as Phaser.GameObjects.Text).setOrigin(0.5)
    }

    this.layers.infrastructure.add(element)
  }

  /**
   * Add environmental details
   */
  private addEnvironmentalDetails(): void {
    // Add ambient effects like moving clouds, birds, etc.
    this.addAmbientEffects()
  }

  /**
   * Add ambient effects
   */
  private addAmbientEffects(): void {
    // Create moving clouds
    for (let i = 0; i < 3; i++) {
      const cloud = this.scene.add.text(
        Math.random() * this.config.width,
        50 + Math.random() * 100,
        '☁️',
        { fontSize: '30px' }
      )
      cloud.setAlpha(0.7)
      this.layers.effects.add(cloud)
      
      // Animate cloud movement
      this.scene.tweens.add({
        targets: cloud,
        x: this.config.width + 100,
        duration: 30000 + Math.random() * 20000,
        repeat: -1,
        ease: 'Linear'
      })
    }
  }

  /**
   * Utility methods
   */
  public getZoneAt(x: number, y: number): WorldZone | null {
    for (const zone of this.zones.values()) {
      const { bounds } = zone
      if (x >= bounds.x && x <= bounds.x + bounds.width &&
          y >= bounds.y && y <= bounds.y + bounds.height) {
        return zone
      }
    }
    return null
  }

  public isRoad(x: number, y: number): boolean {
    const gridX = Math.floor(x / this.config.tileSize)
    const gridY = Math.floor(y / this.config.tileSize)
    const tile = this.tiles.get(`${gridX},${gridY}`)
    return tile?.type === 'road'
  }

  public getTileAt(x: number, y: number): WorldTile | null {
    const gridX = Math.floor(x / this.config.tileSize)
    const gridY = Math.floor(y / this.config.tileSize)
    return this.tiles.get(`${gridX},${gridY}`) || null
  }

  public getRandomBuildingPosition(zoneType?: string): { x: number, y: number, zone: WorldZone } | null {
    const availableZones = zoneType 
      ? Array.from(this.zones.values()).filter(z => z.type === zoneType)
      : Array.from(this.zones.values()).filter(z => z.type !== 'park')
    
    if (availableZones.length === 0) return null
    
    const zone = availableZones[Math.floor(Math.random() * availableZones.length)]
    
    // Find a position that's not on a road
    let attempts = 0
    let position: { x: number, y: number } | null = null
    
    while (attempts < 20) {
      const x = zone.bounds.x + Math.random() * zone.bounds.width
      const y = zone.bounds.y + Math.random() * zone.bounds.height
      
      if (!this.isRoad(x, y)) {
        position = { x, y }
        break
      }
      attempts++
    }
    
    return position ? { ...position, zone } : null
  }

  /**
   * Get zones map for external access
   */
  public getZones(): Map<string, WorldZone> {
    return this.zones
  }

  /**
   * Get tiles map for external access  
   */
  public getTiles(): Map<string, WorldTile> {
    return this.tiles
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    Object.values(this.layers).forEach(layer => {
      layer.clear(true, true)
    })
    this.tiles.clear()
    this.zones.clear()
  }
} 