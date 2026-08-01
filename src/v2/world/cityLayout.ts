/**
 * Pure city-layout generation — no renderer dependencies.
 * Extracted from the old Phaser CityRenderer so both the Engine and the
 * Three.js scene can share it.
 */

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

export function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function generateCityLayout(tileSize: number = 48, seed: number = 1234): CityLayout {
  const rng = mulberry32(seed)
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
    const px = d.bounds.x + 1 + Math.floor(rng() * (d.bounds.w - 4))
    const py = d.bounds.y + 1 + Math.floor(rng() * (d.bounds.h - 4))
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const tx = px + dx, ty = py + dy
      if (tx >= 0 && tx < tilesW && ty >= 0 && ty < tilesH && tiles[ty * tilesW + tx] === 'grass') {
        tiles[ty * tilesW + tx] = 'park'
      }
    }
  }

  // buildable spots: grass tiles adjacent to a sidewalk/road, in ANY district.
  // Locked districts also get spots so newly-unlocked districts have inventory
  // available immediately. Engine.availableBuildableSpots() does the runtime
  // filter against state.unlockedDistricts.
  const buildableSpots: BuildSpot[] = []
  for (let y = 0; y < tilesH; y++) {
    for (let x = 0; x < tilesW; x++) {
      if (tiles[y * tilesW + x] !== 'grass') continue
      const around = [tiles[(y - 1) * tilesW + x], tiles[(y + 1) * tilesW + x], tiles[y * tilesW + x - 1], tiles[y * tilesW + x + 1]]
      if (around.some(t => t === 'sidewalk' || t === 'road_h' || t === 'road_v' || t === 'road_x')) {
        const d = districts.find(dd => x >= dd.bounds.x && x < dd.bounds.x + dd.bounds.w && y >= dd.bounds.y && y < dd.bounds.y + dd.bounds.h)
        if (d) buildableSpots.push({ tileX: x, tileY: y, district: d.id })
      }
    }
  }

  return { tilesW, tilesH, tileSize, tiles, districts, buildableSpots }
}

export function formatProgress(current: number, threshold: number): string {
  // Big numbers ('Vermoegen 500.000 EUR') get k-suffix; small (counts) stay raw.
  if (threshold >= 10_000) {
    return `${formatBigNum(current)} / ${formatBigNum(threshold)}`
  }
  return `${current} / ${threshold}`
}

function formatBigNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return Math.round(n / 1_000) + 'k'
  return String(n)
}
