/**
 * Furniture kit — our own models, built parametrically in code.
 *
 * Each builder returns a handful of merged geometries, one per material, so a
 * sofa costs three draw calls instead of eleven loose boxes. Everything uses
 * rounded boxes: hard cubes are what made the first interior read as cardboard.
 *
 * Origin convention: x/z centred on the footprint, y = 0 on the floor, the
 * piece faces +z. Sizes are parameters, so one builder covers a 1.4 m single
 * bed and a 2.0 m double.
 *
 * If you would rather model in Blender: see models.ts — a .glb dropped into
 * assets/v2/furniture/ takes precedence over the builder of the same name, so
 * both approaches can live side by side.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export type MatKey = 'wood' | 'fabric' | 'white' | 'steel' | 'dark' | 'stone' | 'glass'

export interface KitPiece {
  parts: Array<{ geo: THREE.BufferGeometry; mat: MatKey }>
  w: number
  d: number
  h: number
}

/** Rounded box — the whole reason the kit looks like furniture. */
export function rbox(w: number, h: number, d: number, r = 0.02): THREE.BufferGeometry {
  const radius = Math.max(0.004, Math.min(r, Math.min(w, h, d) / 2 - 0.002))
  return new RoundedBoxGeometry(w, h, d, 2, radius)
}

export function cyl(radius: number, h: number, seg = 10): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(radius, radius, h, seg)
}

function at(geo: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0): THREE.BufferGeometry {
  if (ry) geo.rotateY(ry)
  geo.translate(x, y, z)
  return geo
}

class Build {
  private buckets = new Map<MatKey, THREE.BufferGeometry[]>()
  add(mat: MatKey, geo: THREE.BufferGeometry, x = 0, y = 0, z = 0, ry = 0) {
    const list = this.buckets.get(mat) ?? []
    list.push(at(geo, x, y, z, ry))
    this.buckets.set(mat, list)
    return this
  }
  finish(w: number, d: number, h: number): KitPiece {
    const parts: KitPiece['parts'] = []
    for (const [mat, list] of this.buckets) {
      if (list.length === 1) { parts.push({ geo: list[0], mat }); continue }
      // mergeGeometries refuses to mix indexed and non-indexed input and just
      // returns null. RoundedBoxGeometry is non-indexed, cylinders are indexed,
      // so everything gets flattened first.
      const flat = list.map(g => {
        if (!g.index) return g
        const n = g.toNonIndexed()
        g.dispose()
        return n
      })
      const merged = mergeGeometries(flat, false)
      for (const g of flat) g.dispose()
      if (merged) parts.push({ geo: merged, mat })
    }
    return { parts, w, d, h }
  }
}

export type Builder = (rng: () => number, size?: number) => KitPiece

// --------------------------------------------------------------- living

export const sofa: Builder = (rng, seats = 3) => {
  const w = 0.78 * seats + 0.36, d = 0.92, seatH = 0.42
  const b = new Build()
  b.add('fabric', rbox(w, seatH - 0.1, d, 0.05), 0, (seatH - 0.1) / 2 + 0.1, 0)
  for (let i = 0; i < seats; i++) {
    const cw = (w - 0.36) / seats - 0.04
    b.add('fabric', rbox(cw, 0.14, d - 0.22, 0.06), -w / 2 + 0.18 + ((w - 0.36) / seats) * (i + 0.5), seatH + 0.03, 0.06)
  }
  b.add('fabric', rbox(w, 0.52, 0.18, 0.06), 0, seatH + 0.26, -d / 2 + 0.1)
  for (const s of [-1, 1]) b.add('fabric', rbox(0.18, 0.34, d, 0.06), s * (w / 2 - 0.09), seatH + 0.07, 0)
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    b.add('wood', cyl(0.028, 0.1, 6), sx * (w / 2 - 0.1), 0.05, sz * (d / 2 - 0.12))
  }
  void rng
  return b.finish(w, d, seatH + 0.52)
}

export const couchTable: Builder = (rng) => {
  const w = 1.05 + rng() * 0.25, d = 0.55
  const b = new Build()
  b.add('wood', rbox(w, 0.05, d, 0.02), 0, 0.4, 0)
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    b.add('steel', cyl(0.018, 0.4, 6), sx * (w / 2 - 0.08), 0.2, sz * (d / 2 - 0.08))
  }
  return b.finish(w, d, 0.45)
}

export const shelf: Builder = (rng, levels = 4) => {
  const w = 0.85, d = 0.32, h = 0.42 * levels
  const b = new Build()
  for (const s of [-1, 1]) b.add('wood', rbox(0.035, h, d, 0.01), s * (w / 2 - 0.02), h / 2, 0)
  for (let i = 0; i <= levels; i++) b.add('wood', rbox(w, 0.03, d, 0.01), 0, (h / levels) * i, 0)
  // a few books so it is not an empty rack
  for (let i = 0; i < levels * 3; i++) {
    const lvl = Math.floor(i / 3)
    const bw = 0.05 + rng() * 0.05
    b.add('fabric', rbox(bw, 0.2 + rng() * 0.07, d - 0.12, 0.005),
      -w / 2 + 0.12 + (i % 3) * 0.13 + rng() * 0.03, (h / levels) * lvl + 0.12, 0)
  }
  return b.finish(w, d, h)
}

// ---------------------------------------------------------------- sleep

export const bed: Builder = (rng, width = 1.6) => {
  const w = width, d = 2.05
  const b = new Build()
  b.add('wood', rbox(w, 0.28, d, 0.02), 0, 0.16, 0)
  b.add('white', rbox(w - 0.08, 0.22, d - 0.12, 0.05), 0, 0.41, 0)
  b.add('wood', rbox(w, 0.62, 0.07, 0.02), 0, 0.5, -d / 2 + 0.03)
  const pillows = w > 1.3 ? 2 : 1
  for (let i = 0; i < pillows; i++) {
    b.add('white', rbox(w / pillows - 0.16, 0.11, 0.38, 0.06),
      -w / 2 + (w / pillows) * (i + 0.5), 0.57, -d / 2 + 0.34)
  }
  b.add('fabric', rbox(w - 0.06, 0.06, d * 0.5, 0.03), 0, 0.55, d * 0.2)
  void rng
  return b.finish(w, d, 0.75)
}

export const wardrobe: Builder = (rng, width = 1.4) => {
  const w = width, d = 0.58, h = 2.05
  const b = new Build()
  b.add('wood', rbox(w, h, d, 0.015), 0, h / 2, 0)
  for (const s of [-1, 1]) {
    b.add('wood', rbox(w / 2 - 0.03, h - 0.1, 0.03, 0.01), s * w / 4, h / 2, d / 2 + 0.015)
    b.add('steel', cyl(0.012, 0.16, 6), s * 0.06, h / 2, d / 2 + 0.045)
  }
  void rng
  return b.finish(w, d, h)
}

// -------------------------------------------------------------- kitchen

export const kitchenRun: Builder = (rng, len = 3.0) => {
  const w = len, d = 0.62, h = 0.9
  const b = new Build()
  b.add('white', rbox(w, h - 0.1, d, 0.015), 0, (h - 0.1) / 2 + 0.1, 0)
  b.add('dark', rbox(w - 0.06, 0.1, d - 0.08, 0.01), 0, 0.05, 0)     // plinth
  b.add('stone', rbox(w + 0.04, 0.05, d + 0.04, 0.012), 0, h + 0.02, 0)
  const doors = Math.max(2, Math.round(w / 0.6))
  for (let i = 0; i < doors; i++) {
    const dw = w / doors - 0.03
    const x = -w / 2 + (w / doors) * (i + 0.5)
    b.add('white', rbox(dw, h - 0.22, 0.025, 0.008), x, (h - 0.1) / 2 + 0.12, d / 2 + 0.014)
    b.add('steel', rbox(dw * 0.5, 0.018, 0.018, 0.008), x, h - 0.14, d / 2 + 0.035)
  }
  // upper cabinets
  b.add('white', rbox(w * 0.72, 0.68, 0.34, 0.015), 0, 1.82, -d / 2 + 0.17)
  for (let i = 0; i < 2; i++) {
    b.add('steel', rbox(w * 0.16, 0.016, 0.016, 0.006), (i ? 1 : -1) * w * 0.17, 1.5, -d / 2 + 0.35)
  }
  // sink + hob on the worktop
  b.add('steel', rbox(0.46, 0.03, 0.36, 0.02), -w * 0.26, h + 0.04, 0)
  b.add('steel', cyl(0.016, 0.26, 8), -w * 0.26, h + 0.16, -0.13)
  for (let i = 0; i < 4; i++) {
    b.add('dark', cyl(0.075, 0.012, 12), w * 0.22 + (i % 2) * 0.2, h + 0.05, -0.11 + Math.floor(i / 2) * 0.22)
  }
  void rng
  return b.finish(w, d, 1.9)
}

export const fridge: Builder = () => {
  const w = 0.6, d = 0.62, h = 1.72
  const b = new Build()
  b.add('white', rbox(w, h, d, 0.02), 0, h / 2, 0)
  b.add('dark', rbox(w - 0.05, 0.012, 0.02, 0.004), 0, h * 0.62, d / 2 + 0.005)
  b.add('steel', rbox(0.03, 0.5, 0.03, 0.012), w / 2 - 0.09, h * 0.78, d / 2 + 0.03)
  b.add('steel', rbox(0.03, 0.32, 0.03, 0.012), w / 2 - 0.09, h * 0.36, d / 2 + 0.03)
  return b.finish(w, d, h)
}

// ---------------------------------------------------------------- bath

export const bathtub: Builder = (rng, len = 1.7) => {
  const w = len, d = 0.75, h = 0.56
  const b = new Build()
  b.add('white', rbox(w, h, d, 0.05), 0, h / 2, 0)
  b.add('dark', rbox(w - 0.16, 0.06, d - 0.16, 0.05), 0, h - 0.02, 0)   // the water/void
  b.add('steel', cyl(0.018, 0.24, 8), -w / 2 + 0.14, h + 0.12, 0)
  void rng
  return b.finish(w, d, h)
}

export const basin: Builder = () => {
  const w = 0.6, d = 0.46
  const b = new Build()
  b.add('white', rbox(w, 0.16, d, 0.04), 0, 0.85, 0)
  b.add('white', rbox(0.16, 0.75, 0.16, 0.02), 0, 0.38, -0.08)
  b.add('steel', cyl(0.015, 0.2, 8), 0, 1.0, -d / 2 + 0.09)
  b.add('steel', rbox(0.02, 0.02, 0.12, 0.008), 0, 1.09, -d / 2 + 0.15)
  return b.finish(w, d, 1.1)
}

export const toilet: Builder = () => {
  const w = 0.38, d = 0.66
  const b = new Build()
  b.add('white', rbox(w, 0.4, d - 0.16, 0.06), 0, 0.2, 0.04)
  b.add('white', rbox(w + 0.02, 0.05, d - 0.18, 0.03), 0, 0.42, 0.04)
  b.add('white', rbox(w + 0.04, 0.52, 0.18, 0.03), 0, 0.62, -d / 2 + 0.09)
  return b.finish(w, d, 0.88)
}

export const mirror: Builder = () => {
  const b = new Build()
  b.add('white', rbox(0.66, 0.76, 0.035, 0.01), 0, 0, 0)
  b.add('glass', rbox(0.58, 0.68, 0.02, 0.008), 0, 0, 0.018)
  return b.finish(0.66, 0.04, 0.76)
}

// -------------------------------------------------------------- generic

export const desk: Builder = (rng) => {
  const w = 1.25 + rng() * 0.2, d = 0.62
  const b = new Build()
  b.add('wood', rbox(w, 0.04, d, 0.012), 0, 0.73, 0)
  for (const sx of [-1, 1]) {
    b.add('steel', rbox(0.04, 0.72, d - 0.1, 0.012), sx * (w / 2 - 0.06), 0.36, 0)
  }
  return b.finish(w, d, 0.77)
}

export const chair: Builder = () => {
  const b = new Build()
  b.add('wood', rbox(0.44, 0.05, 0.42, 0.015), 0, 0.45, 0)
  b.add('wood', rbox(0.42, 0.46, 0.045, 0.015), 0, 0.68, -0.19)
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    b.add('steel', cyl(0.015, 0.45, 6), sx * 0.18, 0.22, sz * 0.17)
  }
  return b.finish(0.46, 0.44, 0.9)
}

export const radiator: Builder = (rng, len = 1.2) => {
  const b = new Build()
  const fins = Math.max(6, Math.round(len / 0.09))
  b.add('white', rbox(len, 0.06, 0.09, 0.02), 0, 0.62, 0)
  b.add('white', rbox(len, 0.06, 0.09, 0.02), 0, 0.16, 0)
  for (let i = 0; i < fins; i++) {
    b.add('white', rbox(len / fins - 0.02, 0.5, 0.075, 0.015), -len / 2 + (len / fins) * (i + 0.5), 0.39, 0)
  }
  b.add('steel', cyl(0.012, 0.14, 6), -len / 2 + 0.04, 0.09, 0)
  void rng
  return b.finish(len, 0.1, 0.68)
}

export const ceilingLamp: Builder = () => {
  const b = new Build()
  b.add('steel', cyl(0.008, 0.22, 6), 0, 0.11, 0)
  const shade = new THREE.ConeGeometry(0.22, 0.18, 14, 1, true)
  b.add('white', shade, 0, -0.09, 0)
  return b.finish(0.44, 0.44, 0.3)
}

export const doorLeaf: Builder = () => {
  const b = new Build()
  b.add('white', rbox(1.0, 2.0, 0.045, 0.008), 0, 1.0, 0)
  b.add('white', rbox(0.72, 0.72, 0.012, 0.006), 0, 1.42, 0.028)
  b.add('white', rbox(0.72, 0.52, 0.012, 0.006), 0, 0.66, 0.028)
  b.add('steel', cyl(0.016, 0.12, 8), 0.4, 1.05, 0.05)
  return b.finish(1.0, 0.05, 2.0)
}

export const boiler: Builder = () => {
  const b = new Build()
  b.add('white', rbox(0.72, 1.05, 0.42, 0.03), 0, 1.05, 0)
  b.add('dark', rbox(0.4, 0.16, 0.02, 0.01), 0, 1.2, 0.22)
  for (const sx of [-1, 1]) b.add('steel', cyl(0.028, 0.5, 8), sx * 0.24, 0.28, 0)
  b.add('steel', cyl(0.05, 0.45, 8), 0, 1.8, 0)
  return b.finish(0.72, 0.42, 2.0)
}

export const meterBoard: Builder = () => {
  const b = new Build()
  b.add('dark', rbox(1.3, 0.85, 0.1, 0.01), 0, 0, 0)
  for (let i = 0; i < 3; i++) {
    b.add('white', rbox(0.3, 0.36, 0.04, 0.01), -0.42 + i * 0.42, 0.1, 0.06)
  }
  b.add('steel', rbox(1.1, 0.08, 0.03, 0.01), 0, -0.3, 0.06)
  return b.finish(1.3, 0.1, 0.85)
}

/** A standing person — the agent or owner showing you round. */
export const person: Builder = (rng) => {
  const b = new Build()
  const scale = 0.97 + rng() * 0.08
  // proportions off a 1.75 m adult: legs to 0.86, torso to 1.44, head on top
  b.add('dark', cyl(0.085, 0.86, 8), -0.095, 0.43, 0)                    // legs
  b.add('dark', cyl(0.085, 0.86, 8), 0.095, 0.43, 0)
  b.add('dark', rbox(0.3, 0.16, 0.22, 0.05), 0, 0.9, 0)                  // hips
  b.add('fabric', rbox(0.4, 0.5, 0.23, 0.07), 0, 1.2, 0)                 // jacket
  b.add('fabric', rbox(0.46, 0.1, 0.24, 0.05), 0, 1.4, 0)                // shoulders
  b.add('fabric', cyl(0.052, 0.48, 8), -0.235, 1.16, 0.015)              // arms
  b.add('fabric', cyl(0.052, 0.48, 8), 0.235, 1.16, 0.015)
  b.add('white', rbox(0.11, 0.3, 0.16, 0.03), 0, 1.26, 0.075)            // shirt front
  b.add('wood', cyl(0.052, 0.1, 8), 0, 1.49, 0)                          // neck
  b.add('wood', rbox(0.17, 0.22, 0.19, 0.07), 0, 1.64, 0)                // head
  b.add('dark', rbox(0.18, 0.08, 0.2, 0.05), 0, 1.73, -0.005)            // hair
  b.add('dark', rbox(0.24, 0.31, 0.05, 0.015), 0.29, 1.05, 0.04)         // document folder
  const piece = b.finish(0.5, 0.3, 1.78)
  for (const part of piece.parts) part.geo.scale(scale, scale, scale)
  return piece
}

export const cartonBox: Builder = (rng) => {
  const s = 0.32 + rng() * 0.34
  const b = new Build()
  b.add('wood', rbox(s, s * 0.8, s * 0.9, 0.012), 0, s * 0.4, 0)
  b.add('dark', rbox(s * 0.9, 0.012, 0.05, 0.004), 0, s * 0.8, 0)
  return b.finish(s, s, s)
}
