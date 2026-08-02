/**
 * World metrics: maps the logical tile grid onto realistic metres.
 *
 * The tile grid is uniform (the Engine only cares about tileX/tileY), but a
 * uniform metre size makes everything wrong at once: a 12 m sidewalk is a
 * plaza, and a 12 m lot cannot hold a 16 m building without overlapping its
 * neighbours. So columns and rows get *different* widths depending on what
 * they carry:
 *
 *   columns (period 6):  road | walk | build build build | walk
 *   rows    (period 4):  road | walk | build | walk
 *
 * Street width facade-to-facade becomes WALK + ROAD + WALK ~ 20 m, and a lot
 * is ~15 x 22 m — real Berlin Blockrand proportions.
 */
import type { CityLayout } from '../world/cityLayout'

export type AxisKind = 'road' | 'walk' | 'build'

/** Roadway width (2 lanes + parking). */
const W_ROAD = 11
/** Sidewalk width. */
const W_WALK = 4.5
/** Lot frontage along the street. */
const W_BUILD = 15
/** Lot depth (Vorderhaus + courtyard). */
const D_BUILD = 22

export interface Metrics {
  colKind: AxisKind[]
  rowKind: AxisKind[]
  colW: number[]
  rowD: number[]
  /** world x of the left edge of column i (length tilesW + 1) */
  colX: number[]
  /** world z of the top edge of row j (length tilesH + 1) */
  rowZ: number[]
  width: number
  depth: number
}

export function buildMetrics(layout: CityLayout): Metrics {
  const { tilesW, tilesH, tiles } = layout
  const at = (x: number, y: number) => tiles[y * tilesW + x]

  // A column carrying a vertical road is a road column; one that contains any
  // buildable/green tile is a build column; anything else is sidewalk.
  const colKind: AxisKind[] = []
  for (let x = 0; x < tilesW; x++) {
    let road = false, build = false
    for (let y = 0; y < tilesH; y++) {
      const t = at(x, y)
      if (t === 'road_v') road = true
      else if (t === 'grass' || t === 'park') build = true
    }
    colKind.push(road ? 'road' : build ? 'build' : 'walk')
  }

  const rowKind: AxisKind[] = []
  for (let y = 0; y < tilesH; y++) {
    let road = false, build = false
    for (let x = 0; x < tilesW; x++) {
      const t = at(x, y)
      if (t === 'road_h') road = true
      else if (t === 'grass' || t === 'park') build = true
    }
    rowKind.push(road ? 'road' : build ? 'build' : 'walk')
  }

  const colW = colKind.map(k => (k === 'road' ? W_ROAD : k === 'walk' ? W_WALK : W_BUILD))
  const rowD = rowKind.map(k => (k === 'road' ? W_ROAD : k === 'walk' ? W_WALK : D_BUILD))

  const colX = [0]
  for (let x = 0; x < tilesW; x++) colX.push(colX[x] + colW[x])
  const rowZ = [0]
  for (let y = 0; y < tilesH; y++) rowZ.push(rowZ[y] + rowD[y])

  return { colKind, rowKind, colW, rowD, colX, rowZ, width: colX[tilesW], depth: rowZ[tilesH] }
}

export function tileCenter(m: Metrics, tx: number, ty: number): { x: number; z: number } {
  return { x: m.colX[tx] + m.colW[tx] / 2, z: m.rowZ[ty] + m.rowD[ty] / 2 }
}

export function tileRect(m: Metrics, tx: number, ty: number) {
  return { x: m.colX[tx], z: m.rowZ[ty], w: m.colW[tx], d: m.rowD[ty] }
}

/** Tile containing a world point (clamped), for collision/district lookups. */
export function tileAtWorld(m: Metrics, x: number, z: number): { tx: number; ty: number } {
  return { tx: binarySearch(m.colX, x), ty: binarySearch(m.rowZ, z) }
}

function binarySearch(edges: number[], v: number): number {
  let lo = 0, hi = edges.length - 2
  if (v <= edges[0]) return 0
  if (v >= edges[hi + 1]) return hi
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (edges[mid] <= v) lo = mid
    else hi = mid - 1
  }
  return lo
}
