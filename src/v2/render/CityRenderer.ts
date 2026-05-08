import Phaser from 'phaser'

export type TileKind = 'grass' | 'road_h' | 'road_v' | 'road_x' | 'sidewalk' | 'plaza' | 'park' | 'water'
export type DistrictId =
  | 'mitte' | 'prenzlauer' | 'kreuzberg' | 'charlottenburg' | 'wedding' | 'neukoelln'
  | 'spandau' | 'steglitz' | 'lichtenberg' | 'marzahn'

export interface DistrictDef {
  id: DistrictId
  name: string
  desirability: number       // 0-100 — beauty / safety
  priceMultiplier: number
  rentMultiplier: number
  trend: number              // -2 .. +2 percentage points per year extra
  color: number              // banner color
  bounds: { x: number; y: number; w: number; h: number } // tile coordinates
  /** Locked districts are visible at the city edges but produce no listings,
   *  no buildings, and render with a dark overlay. They are a teaser for
   *  future expansion. */
  locked?: boolean
}

export interface CityLayout {
  tilesW: number
  tilesH: number
  tileSize: number
  tiles: TileKind[]          // tilesW * tilesH
  districts: DistrictDef[]
  buildableSpots: BuildSpot[]
}

export interface BuildSpot {
  tileX: number
  tileY: number
  district: DistrictId
}

export class CityRenderer {
  private scene: Phaser.Scene
  layout: CityLayout
  rng: () => number
  /** Per-district lock overlay graphics, kept so we can fade them out on unlock. */
  private lockOverlays = new Map<DistrictId, Phaser.GameObjects.Graphics>()
  /** Per-district banner pieces (bg + main label text + sub-text), kept so we can
   *  swap from "GESPERRT - Name" to plain name and update progress sub-text. */
  private banners = new Map<DistrictId, { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text; sub?: Phaser.GameObjects.Text }>()

  constructor(scene: Phaser.Scene, tileSize: number = 48, seed: number = 1234) {
    this.scene = scene
    this.rng = mulberry32(seed)
    this.layout = this.generate(tileSize)
  }

  private generate(tileSize: number): CityLayout {
    const tilesW = 60
    const tilesH = 24
    const tiles: TileKind[] = new Array(tilesW * tilesH).fill('grass')

    // 10 districts in a 5x2 grid: 6 unlocked playable in the centre,
    // 2 locked teasers on the left and 2 on the right.
    const dw = Math.floor(tilesW / 5)
    const dh = Math.floor(tilesH / 2)
    const LOCKED_GREY = 0x586878
    const districtDefs: Omit<DistrictDef, 'bounds'>[] = [
      // row 0
      { id: 'spandau', name: 'Spandau', desirability: 50, priceMultiplier: 1.0, rentMultiplier: 1.0, trend: 0, color: LOCKED_GREY, locked: true },
      { id: 'mitte', name: 'Mitte', desirability: 92, priceMultiplier: 1.6, rentMultiplier: 1.5, trend: 1.5, color: 0xc0392b },
      { id: 'prenzlauer', name: 'Prenzlauer Berg', desirability: 84, priceMultiplier: 1.35, rentMultiplier: 1.3, trend: 1.0, color: 0x8e44ad },
      { id: 'charlottenburg', name: 'Charlottenburg', desirability: 78, priceMultiplier: 1.2, rentMultiplier: 1.15, trend: 0.4, color: 0x2980b9 },
      { id: 'lichtenberg', name: 'Lichtenberg', desirability: 50, priceMultiplier: 1.0, rentMultiplier: 1.0, trend: 0, color: LOCKED_GREY, locked: true },
      // row 1
      { id: 'steglitz', name: 'Steglitz', desirability: 50, priceMultiplier: 1.0, rentMultiplier: 1.0, trend: 0, color: LOCKED_GREY, locked: true },
      { id: 'kreuzberg', name: 'Kreuzberg', desirability: 80, priceMultiplier: 1.15, rentMultiplier: 1.2, trend: 1.2, color: 0xe67e22 },
      { id: 'neukoelln', name: 'Neukoelln', desirability: 66, priceMultiplier: 0.9, rentMultiplier: 0.95, trend: 1.4, color: 0x16a085 },
      { id: 'wedding', name: 'Wedding', desirability: 58, priceMultiplier: 0.78, rentMultiplier: 0.85, trend: 0.9, color: 0x7f8c8d },
      { id: 'marzahn', name: 'Marzahn', desirability: 50, priceMultiplier: 1.0, rentMultiplier: 1.0, trend: 0, color: LOCKED_GREY, locked: true },
    ]

    const districts: DistrictDef[] = districtDefs.map((d, i) => {
      const col = i % 5, row = Math.floor(i / 5)
      return { ...d, bounds: { x: col * dw, y: row * dh, w: dw, h: dh } }
    })

    // street pattern: vertical avenues every 6, horizontal every 4
    for (let y = 0; y < tilesH; y++) {
      for (let x = 0; x < tilesW; x++) {
        const onV = x % 6 === 0
        const onH = y % 4 === 0
        if (onV && onH) tiles[y * tilesW + x] = 'road_x'
        else if (onV) tiles[y * tilesW + x] = 'road_v'
        else if (onH) tiles[y * tilesW + x] = 'road_h'
      }
    }

    // sidewalks adjacent to roads
    const orig = tiles.slice()
    for (let y = 0; y < tilesH; y++) {
      for (let x = 0; x < tilesW; x++) {
        if (orig[y * tilesW + x] !== 'grass') continue
        const around = [orig[(y - 1) * tilesW + x], orig[(y + 1) * tilesW + x], orig[y * tilesW + x - 1], orig[y * tilesW + x + 1]]
        if (around.some(t => t === 'road_h' || t === 'road_v' || t === 'road_x')) {
          tiles[y * tilesW + x] = 'sidewalk'
        }
      }
    }

    // central plaza in mitte
    const mitte = districts.find(d => d.id === 'mitte')!
    const cx = mitte.bounds.x + Math.floor(mitte.bounds.w / 2)
    const cy = mitte.bounds.y + Math.floor(mitte.bounds.h / 2)
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const tx = cx + dx, ty = cy + dy
      if (tx >= 0 && tx < tilesW && ty >= 0 && ty < tilesH) tiles[ty * tilesW + tx] = 'plaza'
    }

    // parks scattered: one per unlocked district, 2x2
    for (const d of districts) {
      if (d.locked) continue
      const px = d.bounds.x + 1 + Math.floor(this.rng() * (d.bounds.w - 4))
      const py = d.bounds.y + 1 + Math.floor(this.rng() * (d.bounds.h - 4))
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const tx = px + dx, ty = py + dy
        if (tx >= 0 && tx < tilesW && ty >= 0 && ty < tilesH && tiles[ty * tilesW + tx] === 'grass') {
          tiles[ty * tilesW + tx] = 'park'
        }
      }
    }

    // buildable spots: grass tiles in UNLOCKED districts adjacent to a sidewalk/road
    const buildableSpots: BuildSpot[] = []
    for (let y = 0; y < tilesH; y++) {
      for (let x = 0; x < tilesW; x++) {
        if (tiles[y * tilesW + x] !== 'grass') continue
        const around = [tiles[(y - 1) * tilesW + x], tiles[(y + 1) * tilesW + x], tiles[y * tilesW + x - 1], tiles[y * tilesW + x + 1]]
        if (around.some(t => t === 'sidewalk' || t === 'road_h' || t === 'road_v' || t === 'road_x')) {
          const d = districts.find(dd => x >= dd.bounds.x && x < dd.bounds.x + dd.bounds.w && y >= dd.bounds.y && y < dd.bounds.y + dd.bounds.h)
          if (d && !d.locked) buildableSpots.push({ tileX: x, tileY: y, district: d.id })
        }
      }
    }

    return { tilesW, tilesH, tileSize, tiles, districts, buildableSpots }
  }

  /** Render all background tiles into a single texture for performance */
  renderToContainer(container: Phaser.GameObjects.Container) {
    const { tilesW, tilesH, tileSize, tiles, districts } = this.layout
    const g = this.scene.add.graphics()

    const neighborAt = (x: number, y: number): TileKind | null => {
      if (x < 0 || x >= tilesW || y < 0 || y >= tilesH) return null
      return tiles[y * tilesW + x]
    }

    // base layer + per-tile detail
    for (let y = 0; y < tilesH; y++) {
      for (let x = 0; x < tilesW; x++) {
        const t = tiles[y * tilesW + x]
        const px = x * tileSize, py = y * tileSize
        const n = neighborAt(x, y - 1), s = neighborAt(x, y + 1)
        const w = neighborAt(x - 1, y), e = neighborAt(x + 1, y)
        this.drawTile(g, t, px, py, tileSize, x, y, n, s, e, w)
      }
    }

    g.generateTexture('city-bg', tilesW * tileSize, tilesH * tileSize)
    g.destroy()

    const bg = this.scene.add.image(0, 0, 'city-bg').setOrigin(0)
    container.add(bg)

    // Locked-district overlays: NOT baked into city-bg so we can fade them
    // out on unlock without re-baking the whole world texture.
    for (const d of districts) {
      if (!d.locked) continue
      const overlay = this.buildLockOverlay(d, tileSize)
      this.lockOverlays.set(d.id, overlay)
      container.add(overlay)
    }

    // Banners: kept in a Map so we can update them on unlock.
    for (const d of districts) {
      this.mountBanner(d, tileSize, container)
    }
  }

  private buildLockOverlay(d: DistrictDef, tileSize: number): Phaser.GameObjects.Graphics {
    const dx = d.bounds.x * tileSize
    const dy = d.bounds.y * tileSize
    const dw = d.bounds.w * tileSize
    const dh = d.bounds.h * tileSize
    const g = this.scene.add.graphics()
    g.fillStyle(0x0a1018, 0.55)
    g.fillRect(dx, dy, dw, dh)
    g.fillStyle(0x404a58, 0.35)
    const stripeStep = 16
    for (let off = -dh; off < dw; off += stripeStep) {
      for (let s2 = 0; s2 < dh; s2 += 2) {
        const sx = dx + off + s2
        if (sx < dx || sx >= dx + dw) continue
        g.fillRect(sx, dy + s2, 4, 1)
      }
    }
    return g
  }

  private mountBanner(d: DistrictDef, tileSize: number, container: Phaser.GameObjects.Container) {
    const lx = d.bounds.x * tileSize + 6
    const ly = d.bounds.y * tileSize + 4
    const display = d.locked ? `GESPERRT - ${d.name}` : d.name
    const labelText = this.scene.add.text(lx + 6, ly + 1, display.toUpperCase(), {
      fontFamily: 'monospace', fontSize: '10px',
      color: d.locked ? '#cfd6df' : '#ffffff',
      fontStyle: 'bold',
    })
    const w = labelText.width + 12
    const banner = this.scene.add.rectangle(lx, ly, w, 14, d.color, d.locked ? 0.7 : 0.9).setOrigin(0)
    banner.setStrokeStyle(1, 0x000000, d.locked ? 0.6 : 0.4)
    container.add(banner)
    container.add(labelText)
    this.banners.set(d.id, { bg: banner, text: labelText })
  }

  /** Fade out the lock overlay for the given district, swap the banner styling
   *  to the unlocked look, and mark the layout DistrictDef as unlocked.
   *  Idempotent — repeated calls are safe (early-out if already unlocked). */
  unlockDistrictVisual(id: DistrictId) {
    const d = this.layout.districts.find(dd => dd.id === id)
    if (!d || !d.locked) return
    d.locked = false

    const overlay = this.lockOverlays.get(id)
    if (overlay) {
      this.scene.tweens.add({
        targets: overlay,
        alpha: 0,
        duration: 600,
        ease: 'Sine.out',
        onComplete: () => { overlay.destroy() },
      })
      this.lockOverlays.delete(id)
    }

    const banner = this.banners.get(id)
    if (banner) {
      banner.text.setText(d.name.toUpperCase())
      banner.text.setColor('#ffffff')
      const w = banner.text.width + 12
      banner.bg.setSize(w, 14)
      banner.bg.setFillStyle(d.color, 0.9)
      banner.bg.setStrokeStyle(1, 0x000000, 0.4)
      if (banner.sub) { banner.sub.destroy(); banner.sub = undefined }
    }
  }

  private drawTile(g: Phaser.GameObjects.Graphics, t: TileKind, x: number, y: number, s: number, tx: number, ty: number, n?: TileKind | null, sd?: TileKind | null, e?: TileKind | null, w?: TileKind | null) {
    const isRoad = (k: TileKind | null | undefined) => k === 'road_h' || k === 'road_v' || k === 'road_x'
    switch (t) {
      case 'grass': {
        g.fillStyle(0x6abf52, 1); g.fillRect(x, y, s, s)
        // subtle noise dots
        const seed = (tx * 91 + ty * 53) & 0xff
        for (let i = 0; i < 3; i++) {
          const ox = (((seed + i * 31) * 7) & 0x1f) % s
          const oy = (((seed + i * 17) * 11) & 0x1f) % s
          g.fillStyle(((seed + i) & 1) ? 0x5aa647 : 0x78cf64, 0.6)
          g.fillRect(x + ox, y + oy, 2, 2)
        }
        // Trees: ~30% of grass tiles bordering a sidewalk (= urban-edge), deterministic
        const adjSidewalk = n === 'sidewalk' || sd === 'sidewalk' || e === 'sidewalk' || w === 'sidewalk'
        if (adjSidewalk && (seed & 7) < 2) {
          const cx = x + s / 2 + ((seed >> 3) & 7) - 4
          const cy = y + s / 2 + ((seed >> 5) & 7) - 4
          // shadow
          g.fillStyle(0x000000, 0.18); g.fillEllipse(cx + 2, cy + 4, 14, 5)
          // trunk
          g.fillStyle(0x6b4226, 1); g.fillRect(cx - 1, cy + 1, 2, 5)
          // crown
          g.fillStyle(0x2e7a26, 1); g.fillCircle(cx, cy, 7)
          g.fillStyle(0x46b042, 1); g.fillCircle(cx - 2, cy - 2, 4)
          g.fillStyle(0x78cf64, 0.8); g.fillCircle(cx + 2, cy - 1, 2)
        }
        break
      }
      case 'sidewalk':
        g.fillStyle(0xc8c4bc, 1); g.fillRect(x, y, s, s)
        // pavement seams
        g.fillStyle(0xb0aca4, 0.8)
        g.fillRect(x, y, s, 1); g.fillRect(x, y + s - 1, s, 1)
        g.fillRect(x + s / 2 - 1, y, 1, s)
        // Curb: stronger dark stripe along edges that touch a road
        g.fillStyle(0x6e6e72, 0.95)
        if (isRoad(n)) g.fillRect(x, y, s, 2)
        if (isRoad(sd)) g.fillRect(x, y + s - 2, s, 2)
        if (isRoad(w)) g.fillRect(x, y, 2, s)
        if (isRoad(e)) g.fillRect(x + s - 2, y, 2, s)
        break
      case 'road_h': {
        g.fillStyle(0x3a3a3e, 1); g.fillRect(x, y, s, s)
        // asphalt grit
        const aSeed = (tx * 13 + ty * 7) & 0xff
        for (let i = 0; i < 5; i++) {
          const ox = (((aSeed + i * 23) * 5) & 0x2f) % s
          const oy = (((aSeed + i * 11) * 3) & 0x2f) % s
          g.fillStyle((aSeed + i) & 1 ? 0x2c2c30 : 0x4a4a4e, 0.5)
          g.fillRect(x + ox, y + oy, 2, 1)
        }
        g.fillStyle(0xf2c94c, 1)
        for (let dx = 4; dx < s; dx += 12) g.fillRect(x + dx, y + s / 2 - 1, 6, 2)
        break
      }
      case 'road_v': {
        g.fillStyle(0x3a3a3e, 1); g.fillRect(x, y, s, s)
        const aSeed = (tx * 13 + ty * 7) & 0xff
        for (let i = 0; i < 5; i++) {
          const ox = (((aSeed + i * 23) * 5) & 0x2f) % s
          const oy = (((aSeed + i * 11) * 3) & 0x2f) % s
          g.fillStyle((aSeed + i) & 1 ? 0x2c2c30 : 0x4a4a4e, 0.5)
          g.fillRect(x + ox, y + oy, 2, 1)
        }
        g.fillStyle(0xf2c94c, 1)
        for (let dy = 4; dy < s; dy += 12) g.fillRect(x + s / 2 - 1, y + dy, 2, 6)
        break
      }
      case 'road_x':
        g.fillStyle(0x3a3a3e, 1); g.fillRect(x, y, s, s)
        // crosswalk bars
        g.fillStyle(0xe8e4d8, 0.85)
        for (let dx = 2; dx < s; dx += 6) {
          g.fillRect(x + dx, y + 2, 2, 6)
          g.fillRect(x + dx, y + s - 8, 2, 6)
        }
        for (let dy = 2; dy < s; dy += 6) {
          g.fillRect(x + 2, y + dy, 6, 2)
          g.fillRect(x + s - 8, y + dy, 6, 2)
        }
        break
      case 'park':
        g.fillStyle(0x4f9d3a, 1); g.fillRect(x, y, s, s)
        // tree
        g.fillStyle(0x6b4226, 1); g.fillRect(x + s / 2 - 2, y + s / 2 + 4, 3, 6)
        g.fillStyle(0x2e7a26, 1); g.fillCircle(x + s / 2, y + s / 2, 8)
        g.fillStyle(0x46b042, 1); g.fillCircle(x + s / 2 - 2, y + s / 2 - 2, 4)
        break
      case 'plaza':
        g.fillStyle(0xe2dac4, 1); g.fillRect(x, y, s, s)
        // tile pattern
        g.fillStyle(0xc8c0aa, 0.7)
        g.fillRect(x, y + s / 2 - 1, s, 1)
        g.fillRect(x + s / 2 - 1, y, 1, s)
        // fountain center if at plaza center: handled by caller
        g.fillStyle(0x82b3d9, 0.8); g.fillCircle(x + s / 2, y + s / 2, 6)
        g.fillStyle(0xffffff, 0.6); g.fillCircle(x + s / 2, y + s / 2, 3)
        break
      case 'water':
        g.fillStyle(0x3b7ab0, 1); g.fillRect(x, y, s, s)
        g.fillStyle(0x5a9bd0, 0.7); g.fillRect(x, y + s / 2 - 1, s, 1)
        break
    }
  }

  /** Convert tile to world coords (center of tile) */
  tileToWorld(tx: number, ty: number): { x: number; y: number } {
    return { x: tx * this.layout.tileSize + this.layout.tileSize / 2, y: ty * this.layout.tileSize + this.layout.tileSize / 2 }
  }

  pixelWidth() { return this.layout.tilesW * this.layout.tileSize }
  pixelHeight() { return this.layout.tilesH * this.layout.tileSize }
}

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
