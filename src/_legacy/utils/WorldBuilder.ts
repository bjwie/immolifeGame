import { WorldConfig, WorldZone } from '../managers/WorldManager'

export interface WorldTemplate {
  name: string
  description: string
  config: WorldConfig
  previewImage?: string
}

export class WorldBuilder {
  /**
   * Predefined world templates for different city layouts
   */
  static getWorldTemplates(): WorldTemplate[] {
    return [
      {
        name: 'Big Grid City',
        description: 'Große gitterbasierte Stadt mit perfekter Grid-Ausrichtung',
        config: this.createBigGridCityConfig()
      },
      {
        name: 'Organic City',
        description: 'Natürlich gewachsene Stadt mit organischen Straßenverläufen',
        config: this.createOrganicCityConfig()
      },
      {
        name: 'Coastal City',
        description: 'Küstenstadt mit Hafen und Wasserflächen',
        config: this.createCoastalCityConfig()
      },
      {
        name: 'Mountain Town',
        description: 'Bergstadt mit verschiedenen Höhenlagen',
        config: this.createMountainTownConfig()
      },
      {
        name: 'Metropolitan',
        description: 'Große Metropole mit dichten Geschäftsvierteln',
        config: this.createMetropolitanConfig()
      }
    ]
  }

  private static createBigGridCityConfig(): WorldConfig {
    const tileSize = 64
    const gridWidth = 25  // Number of tiles horizontally
    const gridHeight = 16 // Number of tiles vertically
    const worldWidth = gridWidth * tileSize
    const worldHeight = gridHeight * tileSize
    
    // Create grid-aligned zones - each zone is perfectly aligned to grid boundaries
    const zones: WorldZone[] = [
      // Central Business District - perfectly centered
      {
        id: 'cbd',
        name: 'Zentraler Geschäftsbereich',
        type: 'commercial',
        color: 0xf39c12,
        density: 'high',
        bounds: { x: 8 * tileSize, y: 6 * tileSize, width: 6 * tileSize, height: 4 * tileSize },
        properties: { attractiveness: 95, noiseLevel: 80, accessibility: 100 }
      },
      
      // Office District - adjacent to CBD
      {
        id: 'office_district',
        name: 'Büroviertel',
        type: 'office',
        color: 0x3498db,
        density: 'high',
        bounds: { x: 15 * tileSize, y: 5 * tileSize, width: 7 * tileSize, height: 6 * tileSize },
        properties: { attractiveness: 85, noiseLevel: 70, accessibility: 95 }
      },
      
      // Residential Northwest
      {
        id: 'residential_nw',
        name: 'Wohngebiet Nordwest',
        type: 'residential',
        color: 0x27ae60,
        density: 'medium',
        bounds: { x: 1 * tileSize, y: 1 * tileSize, width: 6 * tileSize, height: 4 * tileSize },
        properties: { attractiveness: 80, noiseLevel: 25, accessibility: 75 }
      },
      
      // Residential Northeast
      {
        id: 'residential_ne',
        name: 'Wohngebiet Nordost',
        type: 'residential',
        color: 0x2ecc71,
        density: 'medium',
        bounds: { x: 16 * tileSize, y: 1 * tileSize, width: 7 * tileSize, height: 3 * tileSize },
        properties: { attractiveness: 85, noiseLevel: 20, accessibility: 80 }
      },
      
      // Residential Southwest
      {
        id: 'residential_sw',
        name: 'Wohngebiet Südwest',
        type: 'residential',
        color: 0x58d68d,
        density: 'low',
        bounds: { x: 2 * tileSize, y: 11 * tileSize, width: 5 * tileSize, height: 4 * tileSize },
        properties: { attractiveness: 75, noiseLevel: 30, accessibility: 70 }
      },
      
      // Residential Southeast
      {
        id: 'residential_se',
        name: 'Wohngebiet Südost',
        type: 'residential',
        color: 0x48c9b0,
        density: 'medium',
        bounds: { x: 16 * tileSize, y: 12 * tileSize, width: 6 * tileSize, height: 3 * tileSize },
        properties: { attractiveness: 80, noiseLevel: 35, accessibility: 75 }
      },
      
      // Central Park - Large and prominent
      {
        id: 'central_park',
        name: 'Großer Stadtpark',
        type: 'park',
        color: 0x76d7c4,
        density: 'none',
        bounds: { x: 9 * tileSize, y: 11 * tileSize, width: 6 * tileSize, height: 4 * tileSize },
        properties: { attractiveness: 100, noiseLevel: 10, accessibility: 90 }
      },
      
      // Industrial Zone - Edge of city
      {
        id: 'industrial',
        name: 'Industriegebiet',
        type: 'industrial',
        color: 0x9b59b6,
        density: 'low',
        bounds: { x: 1 * tileSize, y: 6 * tileSize, width: 6 * tileSize, height: 4 * tileSize },
        properties: { attractiveness: 35, noiseLevel: 90, accessibility: 65 }
      }
    ]

    return {
      width: worldWidth,
      height: worldHeight,
      tileSize,
      zones,
      streetPattern: 'grid',
      terrainVariation: false // Keep terrain uniform for cleaner grid appearance
    }
  }

  private static createGridCityConfig(): WorldConfig {
    const zones: WorldZone[] = [
      {
        id: 'downtown',
        name: 'Innenstadt',
        type: 'commercial',
        color: 0xf39c12,
        density: 'high',
        bounds: { x: 300, y: 200, width: 400, height: 300 },
        properties: { attractiveness: 90, noiseLevel: 80, accessibility: 95 }
      },
      {
        id: 'business_district',
        name: 'Geschäftsviertel',
        type: 'office',
        color: 0x3498db,
        density: 'high',
        bounds: { x: 750, y: 150, width: 300, height: 400 },
        properties: { attractiveness: 85, noiseLevel: 70, accessibility: 90 }
      },
      {
        id: 'residential_north',
        name: 'Wohngebiet Nord',
        type: 'residential',
        color: 0x27ae60,
        density: 'medium',
        bounds: { x: 100, y: 50, width: 500, height: 200 },
        properties: { attractiveness: 75, noiseLevel: 30, accessibility: 80 }
      },
      {
        id: 'residential_south',
        name: 'Wohngebiet Süd',
        type: 'residential',
        color: 0x2ecc71,
        density: 'medium',
        bounds: { x: 200, y: 550, width: 600, height: 150 },
        properties: { attractiveness: 70, noiseLevel: 35, accessibility: 75 }
      },
      {
        id: 'central_park',
        name: 'Stadtpark',
        type: 'park',
        color: 0x58d68d,
        density: 'none',
        bounds: { x: 400, y: 350, width: 200, height: 150 },
        properties: { attractiveness: 95, noiseLevel: 15, accessibility: 85 }
      },
      {
        id: 'industrial',
        name: 'Industriegebiet',
        type: 'industrial',
        color: 0x9b59b6,
        density: 'low',
        bounds: { x: 50, y: 300, width: 200, height: 300 },
        properties: { attractiveness: 35, noiseLevel: 85, accessibility: 60 }
      }
    ]

    return {
      width: 1200,
      height: 800,
      tileSize: 64,
      zones,
      streetPattern: 'grid',
      terrainVariation: true
    }
  }

  private static createOrganicCityConfig(): WorldConfig {
    const zones: WorldZone[] = [
      {
        id: 'old_town',
        name: 'Altstadt',
        type: 'commercial',
        color: 0xe67e22,
        density: 'medium',
        bounds: { x: 400, y: 300, width: 200, height: 200 },
        properties: { attractiveness: 95, noiseLevel: 60, accessibility: 85 }
      },
      {
        id: 'riverside_residential',
        name: 'Flussufer Wohnen',
        type: 'residential',
        color: 0x3498db,
        density: 'low',
        bounds: { x: 100, y: 100, width: 300, height: 150 },
        properties: { attractiveness: 90, noiseLevel: 25, accessibility: 70 }
      },
      {
        id: 'hillside_villas',
        name: 'Villenviertel',
        type: 'residential',
        color: 0x27ae60,
        density: 'low',
        bounds: { x: 650, y: 150, width: 350, height: 200 },
        properties: { attractiveness: 95, noiseLevel: 20, accessibility: 65 }
      },
      {
        id: 'modern_offices',
        name: 'Moderne Büros',
        type: 'office',
        color: 0x2980b9,
        density: 'high',
        bounds: { x: 300, y: 550, width: 300, height: 150 },
        properties: { attractiveness: 80, noiseLevel: 65, accessibility: 90 }
      },
      {
        id: 'nature_preserve',
        name: 'Naturschutzgebiet',
        type: 'park',
        color: 0x27ae60,
        density: 'none',
        bounds: { x: 700, y: 400, width: 250, height: 300 },
        properties: { attractiveness: 100, noiseLevel: 10, accessibility: 50 }
      }
    ]

    return {
      width: 1200,
      height: 800,
      tileSize: 64,
      zones,
      streetPattern: 'organic',
      terrainVariation: true
    }
  }

  private static createCoastalCityConfig(): WorldConfig {
    const zones: WorldZone[] = [
      {
        id: 'harbor_district',
        name: 'Hafenviertel',
        type: 'commercial',
        color: 0x2980b9,
        density: 'high',
        bounds: { x: 50, y: 400, width: 300, height: 200 },
        properties: { attractiveness: 70, noiseLevel: 75, accessibility: 85 }
      },
      {
        id: 'beach_residential',
        name: 'Strandvillen',
        type: 'residential',
        color: 0xf1c40f,
        density: 'low',
        bounds: { x: 400, y: 500, width: 400, height: 150 },
        properties: { attractiveness: 100, noiseLevel: 30, accessibility: 70 }
      },
      {
        id: 'coastal_office',
        name: 'Küsten-Büros',
        type: 'office',
        color: 0x16a085,
        density: 'medium',
        bounds: { x: 500, y: 200, width: 300, height: 200 },
        properties: { attractiveness: 85, noiseLevel: 50, accessibility: 80 }
      },
      {
        id: 'marina',
        name: 'Marina & Park',
        type: 'park',
        color: 0x48c9b0,
        density: 'none',
        bounds: { x: 150, y: 150, width: 250, height: 200 },
        properties: { attractiveness: 90, noiseLevel: 20, accessibility: 75 }
      },
      {
        id: 'shipping_industrial',
        name: 'Frachthafen',
        type: 'industrial',
        color: 0x7f8c8d,
        density: 'medium',
        bounds: { x: 50, y: 650, width: 350, height: 100 },
        properties: { attractiveness: 30, noiseLevel: 90, accessibility: 85 }
      }
    ]

    return {
      width: 1200,
      height: 800,
      tileSize: 64,
      zones,
      streetPattern: 'mixed',
      terrainVariation: true
    }
  }

  private static createMountainTownConfig(): WorldConfig {
    const zones: WorldZone[] = [
      {
        id: 'valley_center',
        name: 'Tal-Zentrum',
        type: 'commercial',
        color: 0xe67e22,
        density: 'medium',
        bounds: { x: 400, y: 500, width: 300, height: 150 },
        properties: { attractiveness: 80, noiseLevel: 55, accessibility: 90 }
      },
      {
        id: 'mountainside_homes',
        name: 'Berghang-Wohnen',
        type: 'residential',
        color: 0x27ae60,
        density: 'low',
        bounds: { x: 200, y: 200, width: 400, height: 250 },
        properties: { attractiveness: 95, noiseLevel: 20, accessibility: 60 }
      },
      {
        id: 'ski_resort',
        name: 'Skigebiet',
        type: 'commercial',
        color: 0xecf0f1,
        density: 'low',
        bounds: { x: 750, y: 100, width: 200, height: 300 },
        properties: { attractiveness: 90, noiseLevel: 40, accessibility: 50 }
      },
      {
        id: 'nature_park',
        name: 'Naturpark',
        type: 'park',
        color: 0x2ecc71,
        density: 'none',
        bounds: { x: 100, y: 100, width: 500, height: 200 },
        properties: { attractiveness: 100, noiseLevel: 5, accessibility: 40 }
      }
    ]

    return {
      width: 1200,
      height: 800,
      tileSize: 64,
      zones,
      streetPattern: 'organic',
      terrainVariation: true
    }
  }

  private static createMetropolitanConfig(): WorldConfig {
    const zones: WorldZone[] = [
      {
        id: 'financial_district',
        name: 'Finanzviertel',
        type: 'office',
        color: 0x2c3e50,
        density: 'high',
        bounds: { x: 400, y: 250, width: 250, height: 300 },
        properties: { attractiveness: 85, noiseLevel: 75, accessibility: 100 }
      },
      {
        id: 'shopping_district',
        name: 'Einkaufsviertel',
        type: 'commercial',
        color: 0xe74c3c,
        density: 'high',
        bounds: { x: 700, y: 300, width: 200, height: 200 },
        properties: { attractiveness: 90, noiseLevel: 85, accessibility: 95 }
      },
      {
        id: 'tech_hub',
        name: 'Tech-Zentrum',
        type: 'office',
        color: 0x9b59b6,
        density: 'high',
        bounds: { x: 150, y: 300, width: 200, height: 250 },
        properties: { attractiveness: 80, noiseLevel: 60, accessibility: 85 }
      },
      {
        id: 'luxury_residential',
        name: 'Luxus-Wohnen',
        type: 'residential',
        color: 0xf39c12,
        density: 'medium',
        bounds: { x: 500, y: 100, width: 300, height: 150 },
        properties: { attractiveness: 95, noiseLevel: 40, accessibility: 80 }
      },
      {
        id: 'urban_residential',
        name: 'Stadt-Wohnen',
        type: 'residential',
        color: 0x27ae60,
        density: 'high',
        bounds: { x: 100, y: 600, width: 600, height: 150 },
        properties: { attractiveness: 65, noiseLevel: 70, accessibility: 90 }
      },
      {
        id: 'central_park_metro',
        name: 'Metro-Park',
        type: 'park',
        color: 0x2ecc71,
        density: 'none',
        bounds: { x: 750, y: 550, width: 200, height: 150 },
        properties: { attractiveness: 85, noiseLevel: 30, accessibility: 85 }
      }
    ]

    return {
      width: 1200,
      height: 800,
      tileSize: 64,
      zones,
      streetPattern: 'grid',
      terrainVariation: false
    }
  }

  /**
   * Generate simple colored placeholder assets
   */
  static generatePlaceholderAssets(scene: Phaser.Scene): void {
    console.log('🎨 Generating placeholder assets...')

    // Terrain assets
    this.createTerrainAsset(scene, 'grass', 0x27ae60)
    this.createTerrainAsset(scene, 'concrete', 0x7f8c8d)
    this.createTerrainAsset(scene, 'asphalt', 0x2c3e50)
    this.createTerrainAsset(scene, 'water', 0x3498db)
    this.createTerrainAsset(scene, 'park', 0x2ecc71)

    // Road assets
    this.createRoadAsset(scene, 'horizontal')
    this.createRoadAsset(scene, 'vertical')
    this.createRoadAsset(scene, 'cross')

    // Building assets
    this.createBuildingAsset(scene, 'house-small', 0x27ae60, '🏠')
    this.createBuildingAsset(scene, 'house-large', 0x2ecc71, '🏡')
    this.createBuildingAsset(scene, 'apartment-small', 0x3498db, '🏢')
    this.createBuildingAsset(scene, 'apartment-large', 0x2980b9, '🏬')
    this.createBuildingAsset(scene, 'shop-small', 0xf39c12, '🏪')
    this.createBuildingAsset(scene, 'shop-large', 0xe67e22, '🏬')
    this.createBuildingAsset(scene, 'office-small', 0x9b59b6, '🏢')
    this.createBuildingAsset(scene, 'office-tower', 0x8e44ad, '🏗️')

    console.log('✅ Placeholder assets generated!')
  }

  private static createTerrainAsset(scene: Phaser.Scene, type: string, color: number): void {
    const graphics = scene.add.graphics()
    graphics.fillStyle(color)
    graphics.fillRect(0, 0, 64, 64)
    
    // Add texture variation
    graphics.fillStyle(color + 0x111111) // Slightly lighter
    for (let i = 0; i < 5; i++) {
      graphics.fillCircle(
        Math.random() * 64,
        Math.random() * 64,
        Math.random() * 8 + 2
      )
    }
    
    graphics.generateTexture(`terrain-${type}`, 64, 64)
    graphics.destroy()
  }

  private static createRoadAsset(scene: Phaser.Scene, type: string): void {
    const graphics = scene.add.graphics()
    graphics.fillStyle(0x2c3e50) // Dark road
    graphics.fillRect(0, 0, 64, 64)
    
    // Add road markings
    graphics.fillStyle(0xf1c40f) // Yellow lines
    
    switch (type) {
      case 'horizontal':
        graphics.fillRect(0, 30, 64, 4)
        break
      case 'vertical':
        graphics.fillRect(30, 0, 4, 64)
        break
      case 'cross':
        graphics.fillRect(0, 30, 64, 4)
        graphics.fillRect(30, 0, 4, 64)
        break
    }
    
    graphics.generateTexture(`road-${type}`, 64, 64)
    graphics.destroy()
  }

  private static createBuildingAsset(scene: Phaser.Scene, type: string, color: number, emoji: string): void {
    const graphics = scene.add.graphics()
    graphics.fillStyle(color)
    graphics.fillRect(8, 16, 48, 40)
    
    // Add roof
    graphics.fillStyle(color - 0x222222) // Darker roof
    graphics.fillTriangle(8, 16, 32, 4, 56, 16)
    
    // Add windows
    graphics.fillStyle(0xecf0f1) // Light windows
    graphics.fillRect(16, 24, 8, 8)
    graphics.fillRect(40, 24, 8, 8)
    graphics.fillRect(16, 40, 8, 8)
    graphics.fillRect(40, 40, 8, 8)
    
    // Add door
    graphics.fillStyle(0x8e44ad) // Purple door
    graphics.fillRect(28, 44, 8, 12)
    
    graphics.generateTexture(type, 64, 64)
    graphics.destroy()
  }

  /**
   * Create a custom world configuration
   */
  static createCustomWorld(
    name: string,
    width: number,
    height: number,
    zones: WorldZone[],
    streetPattern: 'grid' | 'organic' | 'mixed' = 'grid'
  ): WorldConfig {
    return {
      width,
      height,
      tileSize: 64,
      zones,
      streetPattern,
      terrainVariation: true
    }
  }

  /**
   * Validate world configuration
   */
  static validateWorldConfig(config: WorldConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check minimum size
    if (config.width < 400 || config.height < 300) {
      errors.push('World size too small (minimum 400x300)')
    }

    // Check tile size
    if (config.tileSize < 32 || config.tileSize > 128) {
      errors.push('Tile size must be between 32 and 128 pixels')
    }

    // Check zones
    if (config.zones.length === 0) {
      errors.push('At least one zone is required')
    }

    // Check zone overlaps
    for (let i = 0; i < config.zones.length; i++) {
      for (let j = i + 1; j < config.zones.length; j++) {
        const zoneA = config.zones[i]
        const zoneB = config.zones[j]
        
        if (this.zonesOverlap(zoneA, zoneB)) {
          errors.push(`Zones ${zoneA.name} and ${zoneB.name} overlap`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  private static zonesOverlap(zoneA: WorldZone, zoneB: WorldZone): boolean {
    const a = zoneA.bounds
    const b = zoneB.bounds
    
    return !(a.x + a.width < b.x || 
             b.x + b.width < a.x || 
             a.y + a.height < b.y || 
             b.y + b.height < a.y)
  }

  /**
   * Export world configuration as JSON
   */
  static exportWorldConfig(config: WorldConfig): string {
    return JSON.stringify(config, null, 2)
  }

  /**
   * Import world configuration from JSON
   */
  static importWorldConfig(json: string): WorldConfig | null {
    try {
      const config = JSON.parse(json) as WorldConfig
      const validation = this.validateWorldConfig(config)
      
      if (validation.valid) {
        return config
      } else {
        console.error('Invalid world config:', validation.errors)
        return null
      }
    } catch (error) {
      console.error('Failed to parse world config JSON:', error)
      return null
    }
  }
} 