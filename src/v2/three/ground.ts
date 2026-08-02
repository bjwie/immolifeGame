/**
 * Paints the city ground (roads, sidewalks, courtyards, parks, plaza) onto a
 * canvas at true scale (pixels = metres x PPM) using the world metrics, and
 * reports street-tree spots in world metres so the scene can plant real trees.
 */
import type { CityLayout, TileKind } from '../world/cityLayout'
import type { Metrics } from './metrics'
import { tileRect } from './metrics'

/** ground canvas resolution */
export const PPM = 4

export interface TreeSpot {
  /** world metres */
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

  // base fill so no seams show through
  g.fillStyle = css(0x6abf52)
  g.fillRect(0, 0, canvas.width, canvas.height)

  for (let ty = 0; ty < tilesH; ty++) {
    for (let tx = 0; tx < tilesW; tx++) {
      const t = tiles[ty * tilesW + tx]
      const r = tileRect(m, tx, ty)
      const x = r.x * PPM, y = r.z * PPM, w = r.w * PPM, h = r.d * PPM
      const n = at(tx, ty - 1), sd = at(tx, ty + 1), wq = at(tx - 1, ty), e = at(tx + 1, ty)

      switch (t) {
        case 'grass': {
          // Building lot: mostly hidden by the building itself. Paint as a
          // packed-earth courtyard so the strip behind the house reads right.
          g.fillStyle = css(0x6f7a52); g.fillRect(x, y, w, h)
          const seed = (tx * 91 + ty * 53) & 0xff
          g.fillStyle = css(0x5f6a46, 0.7)
          for (let i = 0; i < 8; i++) {
            const ox = (((seed + i * 31) * 7) & 0x3f) / 0x3f * w
            const oy = (((seed + i * 17) * 11) & 0x3f) / 0x3f * h
            g.fillRect(x + ox, y + oy, 3, 3)
          }
          break
        }
        case 'sidewalk': {
          g.fillStyle = css(0xc8c4bc); g.fillRect(x, y, w, h)
          // paving slabs
          g.strokeStyle = css(0xb0aca4, 0.75)
          g.lineWidth = 1
          const slab = 1.2 * PPM
          for (let sx = x + slab; sx < x + w; sx += slab) {
            g.beginPath(); g.moveTo(sx, y); g.lineTo(sx, y + h); g.stroke()
          }
          for (let sy = y + slab; sy < y + h; sy += slab) {
            g.beginPath(); g.moveTo(x, sy); g.lineTo(x + w, sy); g.stroke()
          }
          // granite curb on the road edges
          const curb = 0.35 * PPM
          g.fillStyle = css(0x8b8b90)
          if (isRoad(n)) g.fillRect(x, y, w, curb)
          if (isRoad(sd)) g.fillRect(x, y + h - curb, w, curb)
          if (isRoad(wq)) g.fillRect(x, y, curb, h)
          if (isRoad(e)) g.fillRect(x + w - curb, y, curb, h)

          // Street trees at the curb, every other tile along the street.
          const seed = (tx * 91 + ty * 53) & 0xff
          if ((seed % 3) === 0) {
            const inset = 1.5 * PPM
            let cx = x + w / 2, cy = y + h / 2
            if (isRoad(n)) cy = y + inset
            else if (isRoad(sd)) cy = y + h - inset
            else if (isRoad(wq)) cx = x + inset
            else if (isRoad(e)) cx = x + w - inset
            else break
            const pit = 0.9 * PPM
            g.fillStyle = css(0x5a4632); g.fillRect(cx - pit, cy - pit, pit * 2, pit * 2)
            g.fillStyle = css(0x3e3022); g.fillRect(cx - pit * 0.75, cy - pit * 0.75, pit * 1.5, pit * 1.5)
            treeSpots.push({ x: cx / PPM, z: cy / PPM, park: false })
          }
          break
        }
        case 'road_h':
        case 'road_v':
        case 'road_x': {
          g.fillStyle = css(0x3a3a3e); g.fillRect(x, y, w, h)
          // asphalt grain
          const aSeed = (tx * 13 + ty * 7) & 0xff
          for (let i = 0; i < 14; i++) {
            const ox = (((aSeed + i * 23) * 5) & 0x3f) / 0x3f * w
            const oy = (((aSeed + i * 11) * 3) & 0x3f) / 0x3f * h
            g.fillStyle = css((aSeed + i) & 1 ? 0x2c2c30 : 0x46464a, 0.45)
            g.fillRect(x + ox, y + oy, 4, 2)
          }
          if (t === 'road_x') {
            // zebra crossings on each arm
            g.fillStyle = css(0xe8e4d8, 0.9)
            const barW = 0.5 * PPM, gap = 0.9 * PPM, depth = 2.6 * PPM
            for (let sx = x + gap; sx < x + w - barW; sx += gap + barW) {
              g.fillRect(sx, y + 0.6 * PPM, barW, depth)
              g.fillRect(sx, y + h - 0.6 * PPM - depth, barW, depth)
            }
            for (let sy = y + gap; sy < y + h - barW; sy += gap + barW) {
              g.fillRect(x + 0.6 * PPM, sy, depth, barW)
              g.fillRect(x + w - 0.6 * PPM - depth, sy, depth, barW)
            }
          } else if (t === 'road_h') {
            // dashed centre line + solid edge lines
            g.fillStyle = css(0xf2f0e4, 0.85)
            const dash = 2.5 * PPM, gap = 2.5 * PPM
            for (let sx = x; sx < x + w; sx += dash + gap) {
              g.fillRect(sx, y + h / 2 - 0.1 * PPM, Math.min(dash, x + w - sx), 0.2 * PPM)
            }
            g.fillStyle = css(0xdcd8cc, 0.4)
            g.fillRect(x, y + 1.6 * PPM, w, 0.14 * PPM)
            g.fillRect(x, y + h - 1.6 * PPM, w, 0.14 * PPM)
          } else {
            g.fillStyle = css(0xf2f0e4, 0.85)
            const dash = 2.5 * PPM, gap = 2.5 * PPM
            for (let sy = y; sy < y + h; sy += dash + gap) {
              g.fillRect(x + w / 2 - 0.1 * PPM, sy, 0.2 * PPM, Math.min(dash, y + h - sy))
            }
            g.fillStyle = css(0xdcd8cc, 0.4)
            g.fillRect(x + 1.6 * PPM, y, 0.14 * PPM, h)
            g.fillRect(x + w - 1.6 * PPM, y, 0.14 * PPM, h)
          }
          break
        }
        case 'park': {
          g.fillStyle = css(0x4f9d3a); g.fillRect(x, y, w, h)
          // mown stripes
          g.fillStyle = css(0x58ab41, 0.5)
          for (let sy = y; sy < y + h; sy += 2.5 * PPM) g.fillRect(x, sy, w, 1.2 * PPM)
          // gravel path across
          g.fillStyle = css(0xc2b79a, 0.85)
          g.fillRect(x, y + h / 2 - 0.7 * PPM, w, 1.4 * PPM)
          treeSpots.push({ x: (x + w * 0.3) / PPM, z: (y + h * 0.28) / PPM, park: true })
          treeSpots.push({ x: (x + w * 0.72) / PPM, z: (y + h * 0.75) / PPM, park: true })
          break
        }
        case 'plaza': {
          g.fillStyle = css(0xe2dac4); g.fillRect(x, y, w, h)
          // radial-ish paving pattern
          g.strokeStyle = css(0xc8c0aa, 0.8)
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
