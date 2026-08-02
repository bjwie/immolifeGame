/**
 * Facade textures and massing for 3D buildings.
 *
 * Footprints come from the *lot*, never from the style, so neighbouring
 * buildings can share a party wall without intersecting. Facades are painted
 * storey by storey at true scale (pixels = metres x RES), porting the 2D
 * visual language: Altbau Stuck, Plattenbau panel seams, Neubau Bandfenster,
 * ground-floor Ladenlokal, condition patina and district skins.
 */
import * as THREE from 'three'
import type { BuildingStyle } from '../world/buildingStyle'
import { mixColor, bodyHeight } from '../world/buildingStyle'
import { mulberry32 } from '../world/cityLayout'

/** texture resolution: pixels per metre */
const RES = 16

export type Face = 'front' | 'back' | 'side' | 'firewall'

export interface Lot {
  /** extent along the facade (metres) */
  w: number
  /** extent perpendicular to the street (metres) */
  d: number
}

export interface BuildingDims {
  w: number
  d: number
  bodyH: number
  roof: 'gable' | 'hip' | 'flat'
  roofH: number
  /** how far the body is pushed back from the street edge of the lot */
  setback: number
}

/** Footprint from the lot: party-wall buildings fill their frontage exactly so
 *  they butt against their neighbours; detached ones keep gardens all round. */
export function dimsFor(style: BuildingStyle, lot: Lot): BuildingDims {
  const bodyH = bodyHeight(style)
  if (style.detached) {
    const w = Math.max(6, lot.w - 4.5)
    const d = Math.max(7, lot.d * 0.5)
    return { w, d, bodyH, roof: style.roof, roofH: Math.min(4.5, w * 0.32), setback: 1.5 }
  }
  // Blockrand: the body fills its lot completely, so it butts against both
  // neighbours and presents a flush facade to the street on either side.
  const w = lot.w
  const d = lot.d
  const roofH = style.roof === 'gable' ? Math.min(4.5, d * 0.18) : 0
  return { w, d, bodyH, roof: style.roof, roofH, setback: 0 }
}

// ---------------------------------------------------------------- textures

const textureCache = new Map<string, THREE.CanvasTexture>()
const MAX_CACHE = 320

function cacheKey(s: BuildingStyle, district: string | undefined, face: Face, condBucket: number, dims: BuildingDims): string {
  return [
    s.kind, s.subtype ?? '-', s.floors, s.floorHeight, s.groundHeight,
    s.wallColor.toString(16), s.roofColor.toString(16), s.windowColor.toString(16),
    s.trimColor.toString(16), s.accentColor.toString(16),
    s.litWindows ? 'L' : 'D', s.hasSign ? 'S' + (s.signColor?.toString(16) ?? '') : 'N',
    district ?? '-', condBucket, face,
    Math.round(dims.w * 10), Math.round(dims.d * 10),
  ].join('|')
}

export function facadeTexture(style: BuildingStyle, district: string | undefined, face: Face, dims: BuildingDims): THREE.CanvasTexture {
  const condBucket = Math.round(style.condition / 5) * 5
  const key = cacheKey(style, district, face, condBucket, dims)
  const hit = textureCache.get(key)
  if (hit) { textureCache.delete(key); textureCache.set(key, hit); return hit }

  // A Brandmauer is flat render — it needs no scale fidelity, so keep it tiny.
  const res = face === 'firewall' ? 6 : RES
  const wM = (face === 'front' || face === 'back') ? dims.w : dims.d
  const W = Math.max(32, Math.min(1024, Math.round(wM * res)))
  const H = Math.max(32, Math.min(2048, Math.round(dims.bodyH * res)))
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const g = canvas.getContext('2d')!

  paintFacade(g, W, H, style, face)
  paintCondition(g, W, H, condBucket)
  paintDistrictSkin(g, W, H, style, district, face)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  tex.magFilter = THREE.NearestFilter
  textureCache.set(key, tex)
  while (textureCache.size > MAX_CACHE) {
    const oldest = textureCache.keys().next().value
    if (!oldest) break
    textureCache.get(oldest)?.dispose()
    textureCache.delete(oldest)
  }
  return tex
}

// ---------------------------------------------------------------- painting

interface Cols { wall: number; roof: number; trim: number; accent: number; window: number }

function fill(g: CanvasRenderingContext2D, c: number, a = 1) {
  g.fillStyle = a >= 1
    ? `rgb(${(c >> 16) & 0xff},${(c >> 8) & 0xff},${c & 0xff})`
    : `rgba(${(c >> 16) & 0xff},${(c >> 8) & 0xff},${c & 0xff},${a})`
}

function drawWindow(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: number, trim: number, lit: boolean) {
  fill(g, trim); g.fillRect(x - 2, y - 2, w + 4, h + 4)
  fill(g, lit ? color : mixColor(color, 0x101830, 0.6)); g.fillRect(x, y, w, h)
  fill(g, trim, 0.75)
  g.fillRect(x + Math.floor(w / 2) - 1, y, 2, h)
  g.fillRect(x, y + Math.floor(h * 0.45), w, 2)
  fill(g, 0xffffff, lit ? 0.5 : 0.16)
  g.fillRect(x + 2, y + 2, Math.max(3, Math.floor(w / 3)), 2)
}

/** y (canvas, top-down) of the floor band for storey index f (0 = ground). */
function floorTop(H: number, s: BuildingStyle, f: number): number {
  const groundPx = s.groundHeight * RES
  const upperPx = s.floorHeight * RES
  return H - groundPx - f * upperPx
}

function paintFacade(g: CanvasRenderingContext2D, W: number, H: number, s: BuildingStyle, face: Face) {
  const c: Cols = { wall: s.wallColor, roof: s.roofColor, trim: s.trimColor, accent: s.accentColor, window: s.windowColor }

  if (face === 'firewall') return paintFirewall(g, W, H, c)

  const sub = s.kind === 'apartment' ? (s.subtype ?? 'neubau') : null
  let wall = c.wall
  let trim = c.trim
  if (sub === 'altbau') { wall = mixColor(c.wall, 0xf2dcb0, 0.25); trim = mixColor(c.trim, 0x6b4830, 0.2) }
  else if (sub === 'plattenbau') { wall = mixColor(c.wall, 0x9aa0a8, 0.55); trim = mixColor(c.trim, 0x40464e, 0.4) }
  else if (sub === 'neubau') { wall = mixColor(c.wall, 0xfafcfe, 0.4); trim = mixColor(c.trim, 0x202830, 0.3) }

  fill(g, wall); g.fillRect(0, 0, W, H)

  // --- cornice / parapet cap
  if (sub === 'altbau') {
    fill(g, 0xfff8e0, 0.95); g.fillRect(0, 0, W, 7)
    fill(g, mixColor(0xfff8e0, 0x000000, 0.3)); g.fillRect(0, 7, W, 3)
    fill(g, 0xc89060)
    for (let dx = 6; dx < W; dx += 14) g.fillRect(dx, 2, 4, 3)
  } else if (sub === 'plattenbau') {
    fill(g, 0x60686e); g.fillRect(0, 0, W, 6)
    fill(g, 0x404850); g.fillRect(0, 6, W, 2)
  } else if (s.kind === 'tower' || s.kind === 'office') {
    fill(g, mixColor(c.roof, 0x000000, 0.15)); g.fillRect(0, 0, W, 6)
  } else {
    fill(g, 0x2a2e36); g.fillRect(0, 0, W, 6)
    fill(g, 0x4a5560); g.fillRect(0, 6, W, 2)
  }

  // --- upper storeys
  const upperPx = s.floorHeight * RES
  for (let f = 1; f < s.floors; f++) {
    const top = floorTop(H, s, f)
    if (top + upperPx < 0) break
    paintUpperFloor(g, W, top, upperPx, s, sub, c, trim, face, f)
  }

  // --- storey separator lines (Plattenbau panel seams / Altbau bands)
  if (sub === 'plattenbau') {
    fill(g, 0x707880, 0.55)
    for (let f = 1; f < s.floors; f++) g.fillRect(0, floorTop(H, s, f), W, 2)
    fill(g, 0x707880, 0.35)
    for (let dx = W / 4; dx < W - 2; dx += W / 4) g.fillRect(Math.round(dx), 8, 2, H - 8)
  } else if (sub === 'altbau') {
    fill(g, 0xfff8e0, 0.5)
    g.fillRect(0, floorTop(H, s, 1) - 2, W, 2)
  }

  // --- ground floor
  paintGroundFloor(g, W, H, s, sub, c, trim, face)
}

function paintUpperFloor(
  g: CanvasRenderingContext2D, W: number, top: number, floorPx: number,
  s: BuildingStyle, sub: string | null, c: Cols, trim: number, face: Face, f: number,
) {
  const narrow = face === 'side'
  const cols = narrow ? 2 : sub === 'neubau' ? 4 : sub === 'altbau' ? 3 : s.kind === 'office' || s.kind === 'tower' ? 4 : 3
  const winH = Math.round(floorPx * (sub === 'altbau' ? 0.58 : sub === 'plattenbau' ? 0.42 : 0.5))
  const winW = Math.round(Math.min(W / (cols + 1.4), winH * (sub === 'plattenbau' ? 1.5 : 0.8)))
  const y = Math.round(top + floorPx * 0.24)

  if (sub === 'neubau' || s.kind === 'office' || s.kind === 'tower') {
    // continuous dark band behind the strip windows
    fill(g, 0x1a2028, 0.8)
    g.fillRect(4, y - 3, W - 8, winH + 6)
  }

  for (let i = 0; i < cols; i++) {
    const wx = Math.round(W * ((i + 1) / (cols + 1)) - winW / 2)
    const lit = s.litWindows && (((f * 11 + i * 7) % (sub === 'plattenbau' ? 3 : 4)) > 0)
    drawWindow(g, wx, y, winW, winH, c.window, trim, lit)
    if (sub === 'altbau') {
      // Stuck pediment above each window
      fill(g, 0xfff8e0, 0.9)
      g.beginPath()
      g.moveTo(wx - 3, y - 3); g.lineTo(wx + winW + 3, y - 3); g.lineTo(wx + winW / 2, y - 9)
      g.closePath(); g.fill()
      // small balcony rail on the first upper floor
      if (f === 1 && !narrow) {
        fill(g, mixColor(c.accent, 0x000000, 0.25), 0.9)
        g.fillRect(wx - 4, y + winH + 1, winW + 8, 3)
      }
    }
  }
}

function paintGroundFloor(
  g: CanvasRenderingContext2D, W: number, H: number,
  s: BuildingStyle, sub: string | null, c: Cols, trim: number, face: Face,
) {
  const groundPx = s.groundHeight * RES
  const top = H - groundPx
  const isStreet = face === 'front'

  // plinth
  fill(g, mixColor(c.wall, 0x000000, 0.28)); g.fillRect(0, H - Math.round(0.7 * RES), W, Math.round(0.7 * RES))

  if (s.kind === 'shop' && isStreet) {
    // Ladenlokal: sign band, big shopfront, recessed door
    if (s.hasSign && s.signColor !== undefined) {
      fill(g, s.signColor); g.fillRect(3, top + 4, W - 6, Math.round(groundPx * 0.22))
      fill(g, 0xffffff, 0.95)
      const by = top + 4 + Math.round(groundPx * 0.08)
      for (let i = 0; i < 5; i++) g.fillRect(12 + i * 16, by, 9, 4)
    }
    const wy = top + Math.round(groundPx * 0.32)
    const wh = Math.round(groundPx * 0.48)
    fill(g, 0x101820); g.fillRect(5, wy, W - 10, wh)
    fill(g, c.window, 0.85); g.fillRect(8, wy + 3, W - 16, wh - 6)
    fill(g, 0xffffff, 0.28); g.fillRect(10, wy + 5, W - 20, 5)
    // awning
    fill(g, mixColor(c.accent, 0xc04030, 0.4), 0.95)
    g.fillRect(2, wy - 5, W - 4, 5)
    fill(g, c.trim); g.fillRect(W / 2 - 14, H - Math.round(groundPx * 0.2), 28, Math.round(groundPx * 0.2))
    return
  }

  if (s.kind === 'office' || s.kind === 'tower') {
    if (isStreet) {
      const dw = Math.min(W - 14, Math.round(3.6 * RES))
      const dh = Math.round(groundPx * 0.72)
      fill(g, 0x101820); g.fillRect(W / 2 - dw / 2, H - dh, dw, dh)
      fill(g, c.window, 0.65); g.fillRect(W / 2 - dw / 2 + 3, H - dh + 3, dw - 6, dh - 6)
      fill(g, 0xffffff, 0.35); g.fillRect(W / 2 - dw / 2 + 6, H - dh + 6, 12, 3)
      if (s.hasSign) { fill(g, c.trim); g.fillRect(W / 2 - dw / 2, H - dh - 7, dw, 5) }
    } else {
      // flank/rear: stone plinth with a row of small windows, not a glass wall
      const winH = Math.round(groundPx * 0.36)
      const winW = Math.round(Math.min(W / 4.4, winH * 0.9))
      const wy = top + Math.round(groundPx * 0.26)
      for (let i = 0; i < 3; i++) {
        const wx = Math.round(W * ((i + 1) / 4) - winW / 2)
        drawWindow(g, wx, wy, winW, winH, c.window, c.trim, s.litWindows && i === 1)
      }
    }
    return
  }

  // residential ground floor: windows + entrance door
  const cols = face === 'side' ? 2 : 3
  const winH = Math.round(groundPx * 0.42)
  const winW = Math.round(Math.min(W / (cols + 1.4), winH * 0.85))
  const wy = top + Math.round(groundPx * 0.2)
  for (let i = 0; i < cols; i++) {
    if (isStreet && i === Math.floor(cols / 2)) continue // door goes here
    const wx = Math.round(W * ((i + 1) / (cols + 1)) - winW / 2)
    drawWindow(g, wx, wy, winW, winH, c.window, trim, s.litWindows && i % 2 === 0)
  }
  if (isStreet) {
    const dw = Math.round(Math.min(W * 0.22, 2.2 * RES))
    const dh = Math.round(groundPx * 0.66)
    fill(g, c.accent); g.fillRect(W / 2 - dw / 2, H - dh, dw, dh)
    fill(g, trim); g.fillRect(W / 2 - dw / 2, H - dh, dw, 4)
    if (sub === 'altbau') {
      // portal surround
      fill(g, 0xfff8e0, 0.85)
      g.fillRect(W / 2 - dw / 2 - 4, H - dh - 5, dw + 8, 5)
      g.fillRect(W / 2 - dw / 2 - 4, H - dh, 4, dh)
      g.fillRect(W / 2 + dw / 2, H - dh, 4, dh)
    }
    fill(g, 0xf1c40f, 0.9); g.fillRect(W / 2 + dw / 2 - 5, H - dh / 2, 3, 3)
  }
}

/** Blank Berlin Brandmauer — what you see where a taller neighbour steps back. */
function paintFirewall(g: CanvasRenderingContext2D, W: number, H: number, c: Cols) {
  const wall = mixColor(c.wall, 0x9a9186, 0.45)
  fill(g, wall); g.fillRect(0, 0, W, H)
  // faint render patches so it isn't a flat slab
  const rng = mulberry32(W * 31 + H * 17)
  for (let i = 0; i < 12; i++) {
    const x = rng() * W, y = rng() * H
    fill(g, mixColor(wall, rng() > 0.5 ? 0xffffff : 0x000000, 0.06 + rng() * 0.05))
    g.fillRect(x, y, 18 + rng() * 40, 12 + rng() * 30)
  }
  fill(g, mixColor(wall, 0x000000, 0.25)); g.fillRect(0, H - 6, W, 6)
  fill(g, mixColor(wall, 0x000000, 0.12)); g.fillRect(0, 0, W, 4)
}

// ------------------------------------------------- condition patina (parity)

function paintCondition(g: CanvasRenderingContext2D, W: number, H: number, condBucket: number) {
  if (condBucket >= 95) return
  const condFactor = Math.max(0.4, condBucket / 100)
  const tintAlpha = Math.min(0.6, 1 - condFactor)
  if (tintAlpha > 0.01) { fill(g, 0x3a2820, tintAlpha); g.fillRect(0, 0, W, H) }
  if (condBucket < 30) { fill(g, 0x102030, 0.35); g.fillRect(0, 0, W, H) }
  if (condBucket < 50) {
    const intensity = Math.max(0, (50 - condBucket) / 50)
    g.strokeStyle = `rgba(42,24,16,${0.4 + intensity * 0.5})`
    g.lineWidth = 2
    const cracks = Math.round(2 + intensity * 6)
    const rng = mulberry32(W * 31 + H * 17 + condBucket)
    for (let i = 0; i < cracks; i++) {
      let cx = rng() * W
      let cy = rng() * H * 0.8
      g.beginPath()
      g.moveTo(cx, cy)
      const steps = 3 + Math.floor(rng() * 4)
      for (let st = 0; st < steps; st++) {
        cx += (rng() - 0.3) * 18
        cy += rng() * 16
        g.lineTo(cx, cy)
      }
      g.stroke()
    }
    // damp staining under the windows
    fill(g, 0x2e2418, 0.25 * intensity + 0.1)
    for (let i = 0; i < 3; i++) g.fillRect(rng() * W, rng() * H, 6, 20 + rng() * 40)
  }
  if (condBucket < 25) {
    // boarded-up openings
    fill(g, 0x4a3320, 0.85)
    const rng = mulberry32(W + H)
    for (let i = 0; i < 3; i++) {
      const x = rng() * (W - 30), y = rng() * (H - 30)
      g.fillRect(x, y, 26, 20)
      fill(g, 0x3a2718, 0.9); g.fillRect(x, y + 8, 26, 3)
      fill(g, 0x4a3320, 0.85)
    }
  }
}

// ------------------------------------------------- district skins (parity)

function paintDistrictSkin(g: CanvasRenderingContext2D, W: number, H: number, s: BuildingStyle, district: string | undefined, face: Face) {
  const street = face === 'front'
  switch (district) {
    case 'mitte':
      fill(g, 0xe8f0f8, 0.08); g.fillRect(0, 0, W, H)
      break
    case 'prenzlauer':
      fill(g, 0xf2e0c4, 0.12); g.fillRect(0, 0, W, H)
      if (face !== 'firewall') {
        fill(g, 0xc89060); g.fillRect(W - 11, 12, 5, H - 24)
        fill(g, 0x8b3a2f); g.fillRect(W - 13, 12, 9, 4)
      }
      break
    case 'kreuzberg': {
      fill(g, 0xffd066, 0.05); g.fillRect(0, 0, W, H)
      // graffiti at street level (and all over firewalls)
      const rng = mulberry32(s.floors * 7 + s.kind.length * 13 + face.length * 5)
      const palette = [0xff4080, 0x40d080, 0xffaa20, 0x40a0ff]
      const tags = face === 'firewall' ? 5 : 2 + Math.floor(rng() * 2)
      for (let i = 0; i < tags; i++) {
        const tx = 8 + rng() * Math.max(1, W - 50)
        const ty = face === 'firewall' ? 20 + rng() * (H - 40) : H - 16 - rng() * 26
        const len = 14 + rng() * 22
        fill(g, palette[Math.floor(rng() * palette.length)], 0.8)
        for (let k = 0; k < 3; k++) g.fillRect(tx + k * 2, ty - (k & 1) * 3, len - k * 3, 4)
      }
      break
    }
    case 'charlottenburg':
      fill(g, 0xfff0e0, 0.09); g.fillRect(0, 0, W, H)
      if (face !== 'firewall') {
        fill(g, 0xfff8e8, 0.8); g.fillRect(0, 0, W, 4)
        fill(g, 0xc0a868)
        for (let dx = 8; dx < W; dx += 18) g.fillRect(dx, 3, 5, 2)
      }
      break
    case 'wedding':
      fill(g, 0x8a96a0, 0.15); g.fillRect(0, 0, W, H)
      fill(g, 0x6b7480, 0.4); g.fillRect(0, H - 10, W, 10)
      break
    case 'neukoelln':
      fill(g, 0xffc080, 0.08); g.fillRect(0, 0, W, H)
      if (street && s.kind !== 'shop') {
        // Spaeti awning over the entrance
        fill(g, 0xc04030, 0.9)
        const gy = H - s.groundHeight * RES
        g.fillRect(W / 2 - 22, gy + 8, 44, 6)
        fill(g, 0xfff0c0, 0.55); g.fillRect(W / 2 - 18, gy + 10, 10, 3)
      }
      break
  }
}

// ------------------------------------------------- roof geometry

/** Triangular prism with the ridge running along local X (parallel to the
 *  street), flat-shaded. Used for Altbau/house pitched roofs. */
export function gableGeometry(w: number, d: number, h: number): THREE.BufferGeometry {
  const hw = w / 2, hd = d / 2
  const pos = [
    -hw, 0, -hd, hw, 0, -hd, hw, 0, hd, -hw, 0, hd,
    -hw, h, 0, hw, h, 0,
  ]
  const idx = [
    3, 2, 5, 3, 5, 4,   // front slope (+z)
    1, 0, 4, 1, 4, 5,   // back slope (-z)
    0, 3, 4,            // left gable end
    2, 1, 5,            // right gable end
    0, 1, 2, 0, 2, 3,   // underside
  ]
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setIndex(idx)
  const flat = geo.toNonIndexed()
  geo.dispose()
  flat.computeVertexNormals()
  return flat
}

// ------------------------------------------------- marker sprite textures

let blobTex: THREE.CanvasTexture | null = null

/** Soft radial contact-shadow blob laid under buildings. */
export function contactShadowTexture(): THREE.CanvasTexture {
  if (blobTex) return blobTex
  const c = document.createElement('canvas')
  c.width = 64; c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 6, 32, 32, 32)
  grad.addColorStop(0, 'rgba(0,0,0,0.34)')
  grad.addColorStop(0.7, 'rgba(0,0,0,0.18)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(c)
  blobTex = tex
  return tex
}

let ownedBadgeTex: THREE.CanvasTexture | null = null

/** Gold circle badge with a little house glyph. */
export function ownedBadgeTexture(): THREE.CanvasTexture {
  if (ownedBadgeTex) return ownedBadgeTex
  const c = document.createElement('canvas')
  c.width = 64; c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = 'rgba(0,0,0,0.4)'
  g.beginPath(); g.arc(34, 34, 28, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#f1c40f'
  g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.fill()
  g.strokeStyle = '#b8870a'; g.lineWidth = 5
  g.beginPath(); g.arc(32, 32, 26, 0, Math.PI * 2); g.stroke()
  g.fillStyle = '#fff4c8'
  g.beginPath(); g.moveTo(18, 34); g.lineTo(46, 34); g.lineTo(32, 18); g.closePath(); g.fill()
  g.fillRect(22, 34, 20, 12)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  ownedBadgeTex = tex
  return tex
}
