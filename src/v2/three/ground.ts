/**
 * Paints the city ground at true scale (pixels = metres x PPM) from the world
 * metrics, and reports street-tree spots in world metres.
 *
 * Surface detail comes from repeating CanvasPatterns rather than per-slab
 * fills: a Berlin pavement is 0.5 m slabs, which at city scale would be
 * hundreds of thousands of fillRect calls. Patterns are anchored to the canvas
 * origin, so paving runs continuously across tile borders.
 *
 * Cross sections (see metrics.ts for the widths):
 *   sidewalk 4.5 m:  kerb 0.35 | Radweg 1.3 | Gehweg rest
 *   road    11.0 m:  parking 2.0 | lane 3.5 | lane 3.5 | parking 2.0
 */
import type { CityLayout, TileKind } from '../world/cityLayout'
import type { Metrics } from './metrics'
import { tileRect } from './metrics'

/** ground canvas resolution */
export const PPM = 8

const KERB_W = 0.35
const BIKE_W = 1.3
const PARK_W = 2.0

export interface TreeSpot {
  x: number
  z: number
  park: boolean
}

export interface GroundPaint {
  canvas: HTMLCanvasElement
  treeSpots: TreeSpot[]
}

function css(c: number, a = 1): string {
  const r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`
}

/** deterministic 0..1 from two ints */
function hash2(a: number, b: number): number {
  let h = (a * 73856093) ^ (b * 19349663)
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function makePattern(g: CanvasRenderingContext2D, size: number, draw: (c: CanvasRenderingContext2D, s: number) => void): CanvasPattern {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  draw(c.getContext('2d')!, size)
  return g.createPattern(c, 'repeat')!
}

export function paintGround(layout: CityLayout, m: Metrics): GroundPaint {
  const { tilesW, tilesH, tiles } = layout
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(m.width * PPM)
  canvas.height = Math.round(m.depth * PPM)
  const g = canvas.getContext('2d')!
  const treeSpots: TreeSpot[] = []

  const at = (x: number, y: number): TileKind | null => {
    if (x < 0 || x >= tilesW || y < 0 || y >= tilesH) return null
    return tiles[y * tilesW + x]
  }
  const isRoad = (k: TileKind | null) => k === 'road_h' || k === 'road_v' || k === 'road_x'

  // ---- surface patterns (one-off, then reused for the whole city)

  // Berlin Gehwegplatten: 0.5 m slabs with a per-slab tone jitter
  const slabPx = 0.5 * PPM
  const pavement = makePattern(g, slabPx * 8, (c, s) => {
    c.fillStyle = css(0x9c9890)
    c.fillRect(0, 0, s, s)
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const t = hash2(x, y)
        c.fillStyle = css(t > 0.66 ? 0xa5a199 : t > 0.33 ? 0x999590 : 0x928e87)
        c.fillRect(x * slabPx, y * slabPx, slabPx - 1, slabPx - 1)
      }
    }
  })

  // Radweg: terracotta slabs, the classic red Berlin bike strip
  const bike = makePattern(g, slabPx * 6, (c, s) => {
    c.fillStyle = css(0x94604e)
    c.fillRect(0, 0, s, s)
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 6; x++) {
        const t = hash2(x + 31, y + 17)
        c.fillStyle = css(t > 0.5 ? 0x9b6653 : 0x8c5a49)
        c.fillRect(x * slabPx, y * slabPx, slabPx - 1, slabPx - 1)
      }
    }
  })

  // asphalt with grain and the odd patch
  const asphalt = makePattern(g, 64, (c, s) => {
    c.fillStyle = css(0x46464c)
    c.fillRect(0, 0, s, s)
    for (let i = 0; i < 220; i++) {
      const t = hash2(i, 7)
      const u = hash2(i, 13)
      c.fillStyle = css(t > 0.5 ? 0x3f3f45 : 0x4d4d53, 0.7)
      c.fillRect(u * s, t * s, 2, 2)
    }
    // tar seam
    c.fillStyle = css(0x3a3a40, 0.6)
    c.fillRect(0, s * 0.62, s, 2)
  })

  const cobble = makePattern(g, 0.6 * PPM * 6, (c, s) => {
    const stone = 0.6 * PPM
    c.fillStyle = css(0x53535a)
    c.fillRect(0, 0, s, s)
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 6; x++) {
        const t = hash2(x + 5, y + 11)
        c.fillStyle = css(t > 0.7 ? 0x5e5e66 : t > 0.4 ? 0x565660 : 0x4c4c54)
        const off = (y % 2) * stone * 0.5
        c.beginPath()
        c.roundRect(x * stone + off, y * stone, stone - 1.2, stone - 1.2, 2)
        c.fill()
      }
    }
  })

  g.fillStyle = css(0x6abf52)
  g.fillRect(0, 0, canvas.width, canvas.height)

  // ---- tiles

  for (let ty = 0; ty < tilesH; ty++) {
    for (let tx = 0; tx < tilesW; tx++) {
      const t = tiles[ty * tilesW + tx]
      const r = tileRect(m, tx, ty)
      const x = r.x * PPM, y = r.z * PPM, w = r.w * PPM, h = r.d * PPM
      const n = at(tx, ty - 1), sd = at(tx, ty + 1), wq = at(tx - 1, ty), e = at(tx + 1, ty)

      switch (t) {
        case 'grass': {
          // building lot — mostly hidden by the building; reads as courtyard
          g.fillStyle = css(0x6f7a52); g.fillRect(x, y, w, h)
          g.fillStyle = css(0x5f6a46, 0.7)
          for (let i = 0; i < 8; i++) {
            const ox = hash2(tx * 8 + i, ty) * w
            const oy = hash2(ty * 8 + i, tx) * h
            g.fillRect(x + ox, y + oy, 3, 3)
          }
          break
        }

        case 'sidewalk': {
          const roadN = isRoad(n), roadS = isRoad(sd), roadW = isRoad(wq), roadE = isRoad(e)
          g.fillStyle = pavement
          g.fillRect(x, y, w, h)

          // Radweg + kerb hugging whichever edge faces the carriageway
          const kerbPx = KERB_W * PPM, bikePx = BIKE_W * PPM
          const strip = (sx: number, sy: number, sw: number, sh: number, horizontal: boolean) => {
            g.fillStyle = bike
            g.fillRect(sx, sy, sw, sh)
            // white edge line between Radweg and Gehweg
            g.fillStyle = css(0xd8d4c8, 0.5)
            if (horizontal) g.fillRect(sx, sy + (sh > 0 ? sh - 1 : 0), sw, 1)
            else g.fillRect(sx + sw - 1, sy, 1, sh)
          }
          g.fillStyle = css(0x6e6e73)
          if (roadN) {
            g.fillRect(x, y, w, kerbPx)
            strip(x, y + kerbPx, w, bikePx, true)
          } else if (roadS) {
            g.fillRect(x, y + h - kerbPx, w, kerbPx)
            g.fillStyle = bike; g.fillRect(x, y + h - kerbPx - bikePx, w, bikePx)
            g.fillStyle = css(0xd8d4c8, 0.5); g.fillRect(x, y + h - kerbPx - bikePx, w, 1)
          } else if (roadW) {
            g.fillRect(x, y, kerbPx, h)
            strip(x + kerbPx, y, bikePx, h, false)
          } else if (roadE) {
            g.fillRect(x + w - kerbPx, y, kerbPx, h)
            g.fillStyle = bike; g.fillRect(x + w - kerbPx - bikePx, y, bikePx, h)
            g.fillStyle = css(0xd8d4c8, 0.5); g.fillRect(x + w - kerbPx - bikePx, y, 1, h)
          }

          // street trees at the kerb, with a planting pit
          if (((tx * 91 + ty * 53) & 0xff) % 3 === 0) {
            const inset = (KERB_W + BIKE_W + 0.9) * PPM
            let cx = x + w / 2, cy = y + h / 2
            if (roadN) cy = y + inset
            else if (roadS) cy = y + h - inset
            else if (roadW) cx = x + inset
            else if (roadE) cx = x + w - inset
            else break
            const pit = 0.55 * PPM
            g.fillStyle = css(0x4a3a28); g.fillRect(cx - pit, cy - pit, pit * 2, pit * 2)
            g.fillStyle = css(0x33281c); g.fillRect(cx - pit * 0.7, cy - pit * 0.7, pit * 1.4, pit * 1.4)
            treeSpots.push({ x: cx / PPM, z: cy / PPM, park: false })
          }
          break
        }

        case 'road_h':
        case 'road_v': {
          const horizontal = t === 'road_h'
          // every third avenue keeps its old Kopfsteinpflaster
          const cobbled = (horizontal ? ty : tx) % 3 === 1
          g.fillStyle = cobbled ? cobble : asphalt
          g.fillRect(x, y, w, h)

          const parkPx = PARK_W * PPM
          g.fillStyle = css(0xe8e4d4, 0.75)
          if (horizontal) {
            // parking bays hugging both kerbs
            g.fillRect(x, y + parkPx, w, 1.5)
            g.fillRect(x, y + h - parkPx - 1.5, w, 1.5)
            for (let sx = x; sx < x + w; sx += 5.5 * PPM) {
              g.fillRect(sx, y, 1.5, parkPx)
              g.fillRect(sx, y + h - parkPx, 1.5, parkPx)
            }
            // centre dashes
            g.fillStyle = css(0xf2f0e4, 0.85)
            for (let sx = x; sx < x + w; sx += 5 * PPM) {
              g.fillRect(sx, y + h / 2 - 1.5, Math.min(2.5 * PPM, x + w - sx), 3)
            }
          } else {
            g.fillRect(x + parkPx, y, 1.5, h)
            g.fillRect(x + w - parkPx - 1.5, y, 1.5, h)
            for (let sy = y; sy < y + h; sy += 5.5 * PPM) {
              g.fillRect(x, sy, parkPx, 1.5)
              g.fillRect(x + w - parkPx, sy, parkPx, 1.5)
            }
            g.fillStyle = css(0xf2f0e4, 0.85)
            for (let sy = y; sy < y + h; sy += 5 * PPM) {
              g.fillRect(x + w / 2 - 1.5, sy, 3, Math.min(2.5 * PPM, y + h - sy))
            }
          }

          // gully at the kerb + the odd manhole
          g.fillStyle = css(0x2e2e33)
          if (horizontal) {
            g.fillRect(x + w * 0.3, y + 2, 0.7 * PPM, 0.45 * PPM)
            g.fillRect(x + w * 0.7, y + h - 2 - 0.45 * PPM, 0.7 * PPM, 0.45 * PPM)
          } else {
            g.fillRect(x + 2, y + h * 0.3, 0.45 * PPM, 0.7 * PPM)
            g.fillRect(x + w - 2 - 0.45 * PPM, y + h * 0.7, 0.45 * PPM, 0.7 * PPM)
          }
          if (hash2(tx, ty) > 0.6) {
            g.fillStyle = css(0x3c3c42)
            g.beginPath()
            g.arc(x + w * 0.5, y + h * (horizontal ? 0.32 : 0.5), 0.35 * PPM, 0, Math.PI * 2)
            g.fill()
          }
          break
        }

        case 'road_x': {
          g.fillStyle = asphalt
          g.fillRect(x, y, w, h)
          // zebra crossings on each arm + stop lines
          const barW = 0.45 * PPM, gap = 0.5 * PPM, depth = 2.6 * PPM, edge = 0.5 * PPM
          g.fillStyle = css(0xe8e4d8, 0.92)
          for (let sx = x + gap; sx < x + w - barW; sx += gap + barW) {
            g.fillRect(sx, y + edge, barW, depth)
            g.fillRect(sx, y + h - edge - depth, barW, depth)
          }
          for (let sy = y + gap; sy < y + h - barW; sy += gap + barW) {
            g.fillRect(x + edge, sy, depth, barW)
            g.fillRect(x + w - edge - depth, sy, depth, barW)
          }
          g.fillStyle = css(0xf2f0e4, 0.8)
          g.fillRect(x + edge + depth + 3, y + h / 2, w / 2 - depth, 3)
          g.fillRect(x + w / 2, y + edge + depth + 3, 3, h / 2 - depth)
          break
        }

        case 'park': {
          g.fillStyle = css(0x4f9d3a); g.fillRect(x, y, w, h)
          g.fillStyle = css(0x58ab41, 0.5)
          for (let sy = y; sy < y + h; sy += 2.5 * PPM) g.fillRect(x, sy, w, 1.2 * PPM)
          g.fillStyle = css(0xc2b79a, 0.85)
          g.fillRect(x, y + h / 2 - 0.7 * PPM, w, 1.4 * PPM)
          treeSpots.push({ x: (x + w * 0.3) / PPM, z: (y + h * 0.28) / PPM, park: true })
          treeSpots.push({ x: (x + w * 0.72) / PPM, z: (y + h * 0.75) / PPM, park: true })
          break
        }

        case 'plaza': {
          g.fillStyle = css(0xbdb69f); g.fillRect(x, y, w, h)
          g.strokeStyle = css(0xa9a28c, 0.8)
          g.lineWidth = 1
          const slab = 1.6 * PPM
          for (let sx = x; sx < x + w; sx += slab) { g.beginPath(); g.moveTo(sx, y); g.lineTo(sx, y + h); g.stroke() }
          for (let sy = y; sy < y + h; sy += slab) { g.beginPath(); g.moveTo(x, sy); g.lineTo(x + w, sy); g.stroke() }
          break
        }

        case 'water': {
          g.fillStyle = css(0x3b7ab0); g.fillRect(x, y, w, h)
          g.fillStyle = css(0x5a9bd0, 0.7); g.fillRect(x, y + h / 2, w, 1 * PPM)
          break
        }
      }
    }
  }

  return { canvas, treeSpots }
}

/** Striped dark overlay texture for locked districts. */
export function paintLockOverlay(wM: number, hM: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const wPx = Math.max(8, Math.round(wM * 2))
  const hPx = Math.max(8, Math.round(hM * 2))
  canvas.width = wPx
  canvas.height = hPx
  const g = canvas.getContext('2d')!
  g.fillStyle = css(0x0a1018, 0.55)
  g.fillRect(0, 0, wPx, hPx)
  g.fillStyle = css(0x404a58, 0.35)
  const stripeStep = 16
  for (let off = -hPx; off < wPx; off += stripeStep) {
    for (let s2 = 0; s2 < hPx; s2 += 2) {
      const sx = off + s2
      if (sx < 0 || sx >= wPx) continue
      g.fillRect(sx, s2, 4, 1)
    }
  }
  return canvas
}
