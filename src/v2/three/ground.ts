/**
 * Paints the city ground (roads, sidewalks, grass, parks, plaza) onto a canvas —
 * a direct port of the old Phaser tile art — and reports deterministic tree
 * spots so the 3D scene can plant real trees instead of painted ones.
 */
import type { CityLayout, TileKind } from '../world/cityLayout'

export interface TreeSpot {
  /** tile-pixel coords on the ground canvas (48 px per tile) */
  px: number
  py: number
  park: boolean
}

export interface GroundPaint {
  canvas: HTMLCanvasElement
  treeSpots: TreeSpot[]
}

const TILE = 48

function css(c: number, a = 1): string {
  const r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`
}

export function paintGround(layout: CityLayout): GroundPaint {
  const { tilesW, tilesH, tiles } = layout
  const canvas = document.createElement('canvas')
  canvas.width = tilesW * TILE
  canvas.height = tilesH * TILE
  const g = canvas.getContext('2d')!
  const treeSpots: TreeSpot[] = []

  const at = (x: number, y: number): TileKind | null => {
    if (x < 0 || x >= tilesW || y < 0 || y >= tilesH) return null
    return tiles[y * tilesW + x]
  }
  const isRoad = (k: TileKind | null) => k === 'road_h' || k === 'road_v' || k === 'road_x'

  for (let ty = 0; ty < tilesH; ty++) {
    for (let tx = 0; tx < tilesW; tx++) {
      const t = tiles[ty * tilesW + tx]
      const x = tx * TILE, y = ty * TILE, s = TILE
      const n = at(tx, ty - 1), sd = at(tx, ty + 1), w = at(tx - 1, ty), e = at(tx + 1, ty)

      switch (t) {
        case 'grass': {
          g.fillStyle = css(0x6abf52); g.fillRect(x, y, s, s)
          const seed = (tx * 91 + ty * 53) & 0xff
          for (let i = 0; i < 3; i++) {
            const ox = (((seed + i * 31) * 7) & 0x1f) % s
            const oy = (((seed + i * 17) * 11) & 0x1f) % s
            g.fillStyle = css(((seed + i) & 1) ? 0x5aa647 : 0x78cf64, 0.6)
            g.fillRect(x + ox, y + oy, 2, 2)
          }
          break
        }
        case 'sidewalk': {
          g.fillStyle = css(0xc8c4bc); g.fillRect(x, y, s, s)
          g.fillStyle = css(0xb0aca4, 0.8)
          g.fillRect(x, y, s, 1); g.fillRect(x, y + s - 1, s, 1)
          g.fillRect(x + s / 2 - 1, y, 1, s)
          g.fillStyle = css(0x6e6e72, 0.95)
          if (isRoad(n)) g.fillRect(x, y, s, 2)
          if (isRoad(sd)) g.fillRect(x, y + s - 2, s, 2)
          if (isRoad(w)) g.fillRect(x, y, 2, s)
          if (isRoad(e)) g.fillRect(x + s - 2, y, 2, s)
          // Berlin street trees: every few sidewalk tiles gets one at the curb,
          // with a painted tree pit. Recorded as 3D tree spots.
          const seed = (tx * 91 + ty * 53) & 0xff
          const roadN = isRoad(n), roadS = isRoad(sd), roadW = isRoad(w), roadE = isRoad(e)
          if ((roadN || roadS || roadW || roadE) && (seed % 3) === 0) {
            let cx = x + s / 2, cy = y + s / 2
            const edge = 10
            if (roadN) cy = y + edge
            else if (roadS) cy = y + s - edge
            else if (roadW) cx = x + edge
            else if (roadE) cx = x + s - edge
            // tree pit
            g.fillStyle = css(0x5a4632, 1)
            g.fillRect(cx - 5, cy - 5, 10, 10)
            g.fillStyle = css(0x3e3022, 1)
            g.fillRect(cx - 4, cy - 4, 8, 8)
            treeSpots.push({ px: cx, py: cy, park: false })
          }
          break
        }
        case 'road_h': {
          g.fillStyle = css(0x3a3a3e); g.fillRect(x, y, s, s)
          const aSeed = (tx * 13 + ty * 7) & 0xff
          for (let i = 0; i < 5; i++) {
            const ox = (((aSeed + i * 23) * 5) & 0x2f) % s
            const oy = (((aSeed + i * 11) * 3) & 0x2f) % s
            g.fillStyle = css((aSeed + i) & 1 ? 0x2c2c30 : 0x4a4a4e, 0.5)
            g.fillRect(x + ox, y + oy, 2, 1)
          }
          g.fillStyle = css(0xf2c94c)
          for (let dx = 4; dx < s; dx += 12) g.fillRect(x + dx, y + s / 2 - 1, 6, 2)
          break
        }
        case 'road_v': {
          g.fillStyle = css(0x3a3a3e); g.fillRect(x, y, s, s)
          const aSeed = (tx * 13 + ty * 7) & 0xff
          for (let i = 0; i < 5; i++) {
            const ox = (((aSeed + i * 23) * 5) & 0x2f) % s
            const oy = (((aSeed + i * 11) * 3) & 0x2f) % s
            g.fillStyle = css((aSeed + i) & 1 ? 0x2c2c30 : 0x4a4a4e, 0.5)
            g.fillRect(x + ox, y + oy, 2, 1)
          }
          g.fillStyle = css(0xf2c94c)
          for (let dy = 4; dy < s; dy += 12) g.fillRect(x + s / 2 - 1, y + dy, 2, 6)
          break
        }
        case 'road_x': {
          g.fillStyle = css(0x3a3a3e); g.fillRect(x, y, s, s)
          g.fillStyle = css(0xe8e4d8, 0.85)
          for (let dx = 2; dx < s; dx += 6) {
            g.fillRect(x + dx, y + 2, 2, 6)
            g.fillRect(x + dx, y + s - 8, 2, 6)
          }
          for (let dy = 2; dy < s; dy += 6) {
            g.fillRect(x + 2, y + dy, 6, 2)
            g.fillRect(x + s - 8, y + dy, 6, 2)
          }
          break
        }
        case 'park': {
          g.fillStyle = css(0x4f9d3a); g.fillRect(x, y, s, s)
          treeSpots.push({ px: x + s / 2, py: y + s / 2, park: true })
          break
        }
        case 'plaza': {
          g.fillStyle = css(0xe2dac4); g.fillRect(x, y, s, s)
          g.fillStyle = css(0xc8c0aa, 0.7)
          g.fillRect(x, y + s / 2 - 1, s, 1)
          g.fillRect(x + s / 2 - 1, y, 1, s)
          break
        }
        case 'water': {
          g.fillStyle = css(0x3b7ab0); g.fillRect(x, y, s, s)
          g.fillStyle = css(0x5a9bd0, 0.7); g.fillRect(x, y + s / 2 - 1, s, 1)
          break
        }
      }
    }
  }

  return { canvas, treeSpots }
}

/** Striped dark overlay texture for locked districts — same look as the old
 *  2D lock overlay (dark wash + diagonal dashes). */
export function paintLockOverlay(wPx: number, hPx: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
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
