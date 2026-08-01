/**
 * Facade textures for 3D buildings — ports the visual language of the old 2D
 * base layers (Altbau-Stuck, Plattenbau-Fugen, Neubau-Bandfenster, Shop-Schild,
 * Office-Raster, Tower-Glas) plus condition patina and district skins onto
 * canvas textures that wrap the building boxes.
 */
import * as THREE from 'three'
import type { BuildingStyle } from '../world/buildingStyle'
import { mixColor, cssColor } from '../world/buildingStyle'
import { mulberry32 } from '../world/cityLayout'

/** px (2D elevation) -> meters */
export const PX2M = 0.25
/** texture resolution: px per meter */
const RES = 16

export interface BuildingDims {
  w: number       // footprint width (m)
  d: number       // footprint depth (m)
  bodyH: number   // wall height (m)
  roof: 'pyramid' | 'hip' | 'flat'
  roofH: number   // extra roof height (m)
}

export function dimsFor(style: BuildingStyle): BuildingDims {
  const w = style.width * PX2M * 1.15
  const d = w * 0.85
  switch (style.kind) {
    case 'house': return { w, d, bodyH: style.floors * 3.0, roof: 'pyramid', roofH: 2.6 }
    case 'villa': return { w, d, bodyH: 2 * 3.2, roof: 'hip', roofH: 3.0 }
    case 'apartment': {
      const flat = style.subtype === 'plattenbau' || style.subtype === 'neubau'
      return { w, d, bodyH: style.floors * 3.0, roof: flat ? 'flat' : 'hip', roofH: flat ? 0 : 2.2 }
    }
    case 'shop': return { w, d, bodyH: 4.6, roof: 'flat', roofH: 0 }
    case 'office': return { w, d, bodyH: style.floors * 3.2, roof: 'flat', roofH: 0 }
    case 'tower': return { w: w * 0.95, d: w * 0.95, bodyH: style.floors * 3.2, roof: 'flat', roofH: 0 }
  }
}

const textureCache = new Map<string, THREE.CanvasTexture>()
const MAX_CACHE = 300

function cacheKey(style: BuildingStyle, district: string | undefined, face: 'front' | 'side', condBucket: number): string {
  const s = style
  return [
    s.kind, s.subtype ?? '-', s.width, s.floors,
    s.wallColor.toString(16), s.roofColor.toString(16), s.windowColor.toString(16),
    s.trimColor.toString(16), s.accentColor.toString(16),
    s.litWindows ? 'L' : 'D', s.hasSign ? 'S' + (s.signColor?.toString(16) ?? '') : 'N',
    district ?? '-', condBucket, face,
  ].join('|')
}

export function facadeTexture(style: BuildingStyle, district: string | undefined, face: 'front' | 'side'): THREE.CanvasTexture {
  const condBucket = Math.round(style.condition / 5) * 5
  const key = cacheKey(style, district, face, condBucket)
  const hit = textureCache.get(key)
  if (hit) { textureCache.delete(key); textureCache.set(key, hit); return hit }

  const dims = dimsFor(style)
  const wM = face === 'front' ? dims.w : dims.d
  const W = Math.max(32, Math.round(wM * RES))
  const H = Math.max(32, Math.round(dims.bodyH * RES))
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

// ------------------------------------------------------------------ painting

interface Palette { wall: number; roof: number; trim: number; accent: number; window: number }

function pal(s: BuildingStyle): Palette {
  return { wall: s.wallColor, roof: s.roofColor, trim: s.trimColor, accent: s.accentColor, window: s.windowColor }
}

function fill(g: CanvasRenderingContext2D, c: number, a = 1) {
  g.fillStyle = a >= 1 ? cssColor(c) : cssColor(c).replace('#', '#') && `rgba(${(c >> 16) & 0xff},${(c >> 8) & 0xff},${c & 0xff},${a})`
}

function drawWindow(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: number, trim: number, lit: boolean) {
  fill(g, trim); g.fillRect(x - 2, y - 2, w + 4, h + 4)
  fill(g, lit ? color : mixColor(color, 0x101830, 0.55)); g.fillRect(x, y, w, h)
  fill(g, trim, 0.7)
  g.fillRect(x + Math.floor(w / 2), y, 2, h)
  g.fillRect(x, y + Math.floor(h / 2), w, 2)
  fill(g, 0xffffff, lit ? 0.55 : 0.18)
  g.fillRect(x + 2, y + 2, Math.max(4, Math.floor(w / 3)), 2)
}

function paintFacade(g: CanvasRenderingContext2D, W: number, H: number, s: BuildingStyle, face: 'front' | 'side') {
  const c = pal(s)
  switch (s.kind) {
    case 'house': return paintHouse(g, W, H, s, c, face)
    case 'villa': return paintVilla(g, W, H, s, c, face)
    case 'apartment':
      switch (s.subtype ?? 'neubau') {
        case 'altbau': return paintAltbau(g, W, H, s, c, face)
        case 'plattenbau': return paintPlattenbau(g, W, H, s, c, face)
        case 'neubau': return paintNeubau(g, W, H, s, c, face)
      }
      return
    case 'shop': return paintShop(g, W, H, s, c, face)
    case 'office': return paintOffice(g, W, H, s, c, face)
    case 'tower': return paintTower(g, W, H, s, c, face)
  }
}

const FLOOR_PX = 3.0 * RES      // 3m floors
const FLOOR_PX_32 = 3.2 * RES   // 3.2m floors (office/tower/villa)

function paintDoor(g: CanvasRenderingContext2D, W: number, H: number, c: Palette, doorW: number, doorH: number) {
  fill(g, c.accent); g.fillRect(W / 2 - doorW / 2, H - doorH, doorW, doorH)
  fill(g, c.trim); g.fillRect(W / 2 - doorW / 2, H - doorH, doorW, 3)
  fill(g, 0xf1c40f, 0.9); g.fillRect(W / 2 + doorW / 2 - 6, H - doorH / 2, 3, 3)
}

function paintHouse(g: CanvasRenderingContext2D, W: number, H: number, s: BuildingStyle, c: Palette, face: 'front' | 'side') {
  fill(g, c.wall); g.fillRect(0, 0, W, H)
  for (let f = 0; f < s.floors; f++) {
    const fy = H - (f + 1) * FLOOR_PX + 14
    const winW = 20, winH = 18
    drawWindow(g, W * 0.22 - winW / 2, fy, winW, winH, c.window, c.trim, s.litWindows)
    drawWindow(g, W * 0.78 - winW / 2, fy, winW, winH, c.window, c.trim, s.litWindows)
  }
  if (face === 'front') paintDoor(g, W, H, c, 22, 34)
  // base skirt
  fill(g, mixColor(c.wall, 0x000000, 0.25)); g.fillRect(0, H - 5, W, 5)
}

function paintVilla(g: CanvasRenderingContext2D, W: number, H: number, s: BuildingStyle, c: Palette, face: 'front' | 'side') {
  fill(g, c.wall); g.fillRect(0, 0, W, H)
  for (let f = 0; f < 2; f++) {
    const fy = H - (f + 1) * FLOOR_PX_32 + 16
    for (let i = 0; i < 4; i++) {
      const wx = W * (0.14 + i * 0.24) - 9
      drawWindow(g, wx, fy, 18, 22, c.window, c.trim, s.litWindows)
    }
  }
  if (face === 'front') {
    // white columns flanking an accent door
    fill(g, 0xffffff, 0.85)
    g.fillRect(W / 2 - 26, H - 52, 7, 52)
    g.fillRect(W / 2 + 19, H - 52, 7, 52)
    paintDoor(g, W, H, c, 28, 48)
  }
  fill(g, mixColor(c.wall, 0x000000, 0.2)); g.fillRect(0, H - 5, W, 5)
}

function paintAltbau(g: CanvasRenderingContext2D, W: number, H: number, s: BuildingStyle, c: Palette, face: 'front' | 'side') {
  const wall = mixColor(c.wall, 0xf2dcb0, 0.25)
  const trim = mixColor(c.trim, 0x6b4830, 0.20)
  fill(g, wall); g.fillRect(0, 0, W, H)
  // ornate cornice
  fill(g, 0xfff8e0, 0.95); g.fillRect(0, 0, W, 8)
  fill(g, mixColor(0xfff8e0, 0x000000, 0.3)); g.fillRect(0, 8, W, 3)
  fill(g, 0xc89060)
  for (let dx = 8; dx < W; dx += 12) g.fillRect(dx, 3, 4, 2)
  // floors: tall narrow windows with Stuck pediments
  const cols = 3
  const winW = 14, winH = 26
  for (let f = 0; f < s.floors; f++) {
    const fy = H - (f + 1) * FLOOR_PX + 12
    for (let ci = 0; ci < cols; ci++) {
      const wx = W * ((ci + 1) / (cols + 1)) - winW / 2
      const lit = s.litWindows && (((f * 7 + ci * 13) % 5) > 1)
      drawWindow(g, wx, fy, winW, winH, c.window, trim, lit)
      fill(g, 0xfff8e0, 0.9)
      g.beginPath()
      g.moveTo(wx - 3, fy - 3); g.lineTo(wx + winW + 3, fy - 3); g.lineTo(wx + winW / 2, fy - 9)
      g.closePath(); g.fill()
    }
  }
  // decorative band above ground floor
  fill(g, 0xfff8e0, 0.6); g.fillRect(0, H - FLOOR_PX - 2, W, 2)
  if (face === 'front') paintDoor(g, W, H, c, 26, 36)
}

function paintPlattenbau(g: CanvasRenderingContext2D, W: number, H: number, s: BuildingStyle, c: Palette, face: 'front' | 'side') {
  const wall = mixColor(c.wall, 0x9aa0a8, 0.55)
  const trim = mixColor(c.trim, 0x40464e, 0.40)
  fill(g, wall); g.fillRect(0, 0, W, H)
  // horizontal panel seams per floor
  fill(g, 0x707880, 0.6)
  for (let f = 1; f < s.floors; f++) g.fillRect(0, H - f * FLOOR_PX, W, 2)
  // vertical panel seams
  fill(g, 0x707880, 0.4)
  for (let dx = W / 4; dx < W - 2; dx += W / 4) g.fillRect(Math.round(dx), 0, 2, H)
  // identical raster windows: wide and short
  const cols = 3
  const winW = 20, winH = 14
  for (let f = 0; f < s.floors; f++) {
    const fy = H - (f + 1) * FLOOR_PX + 16
    for (let ci = 0; ci < cols; ci++) {
      const wx = W * ((ci + 1) / (cols + 1)) - winW / 2
      const lit = s.litWindows && (((f + ci) % 3) === 0)
      drawWindow(g, wx, fy, winW, winH, c.window, trim, lit)
    }
  }
  if (face === 'front') {
    const doorW = 32, doorH = 28
    fill(g, mixColor(c.accent, 0x6b7480, 0.40)); g.fillRect(W / 2 - doorW / 2, H - doorH, doorW, doorH)
    fill(g, trim); g.fillRect(W / 2 - doorW / 2, H - doorH, doorW, 3)
  }
}

function paintNeubau(g: CanvasRenderingContext2D, W: number, H: number, s: BuildingStyle, c: Palette, face: 'front' | 'side') {
  const wall = mixColor(c.wall, 0xfafcfe, 0.40)
  const trim = mixColor(c.trim, 0x202830, 0.30)
  fill(g, wall); g.fillRect(0, 0, W, H)
  // anthracite cap
  fill(g, 0x2a2e36); g.fillRect(0, 0, W, 8)
  fill(g, 0x4a5560); g.fillRect(0, 8, W, 2)
  // band windows with continuous dark strip
  const cols = 4
  const winW = 16, winH = 18
  for (let f = 0; f < s.floors; f++) {
    const fy = H - (f + 1) * FLOOR_PX + 16
    fill(g, 0x1a2028, 0.85); g.fillRect(4, fy - 2, W - 8, winH + 4)
    for (let ci = 0; ci < cols; ci++) {
      const wx = W * ((ci + 1) / (cols + 1)) - winW / 2
      const lit = s.litWindows && (((f * 11 + ci * 7) % 3) === 0)
      drawWindow(g, wx, fy, winW, winH, c.window, trim, lit)
    }
  }
  if (face === 'front') {
    // large glass entrance
    const doorW = 48, doorH = 30
    fill(g, 0x1a2028); g.fillRect(W / 2 - doorW / 2, H - doorH, doorW, doorH)
    fill(g, c.window, 0.7); g.fillRect(W / 2 - doorW / 2 + 2, H - doorH + 2, doorW - 4, doorH - 4)
    fill(g, 0xffffff, 0.4); g.fillRect(W / 2 - doorW / 2 + 4, H - doorH + 4, 10, 3)
  }
  // accent vertical line
  fill(g, 0x4a5560, 0.7); g.fillRect(W - 6, 12, 2, H - 24)
}

function paintShop(g: CanvasRenderingContext2D, W: number, H: number, s: BuildingStyle, c: Palette, face: 'front' | 'side') {
  fill(g, c.wall); g.fillRect(0, 0, W, H)
  if (face === 'front') {
    // sign band
    if (s.hasSign && s.signColor !== undefined) {
      fill(g, s.signColor); g.fillRect(3, 3, W - 6, 14)
      fill(g, 0xffffff, 0.95)
      for (let i = 0; i < 5; i++) g.fillRect(10 + i * 14, 8, 8, 4)
    }
    // big shopfront window
    const bw = { x: 6, y: 24, w: W - 12, h: 34 }
    fill(g, 0x101820); g.fillRect(bw.x, bw.y, bw.w, bw.h)
    fill(g, c.window, 0.85); g.fillRect(bw.x + 2, bw.y + 2, bw.w - 4, bw.h - 4)
    fill(g, 0xffffff, 0.3); g.fillRect(bw.x + 4, bw.y + 4, bw.w - 8, 5)
    // door
    fill(g, c.trim); g.fillRect(W / 2 - 12, H - 14, 24, 14)
  } else {
    const winW = 16, winH = 14
    for (let i = 0; i < 3; i++) {
      const wx = W * ((i + 1) / 4) - winW / 2
      drawWindow(g, wx, 26, winW, winH, c.window, c.trim, s.litWindows)
    }
  }
  fill(g, mixColor(c.wall, 0x000000, 0.25)); g.fillRect(0, H - 4, W, 4)
}

function paintOffice(g: CanvasRenderingContext2D, W: number, H: number, s: BuildingStyle, c: Palette, face: 'front' | 'side') {
  fill(g, c.wall); g.fillRect(0, 0, W, H)
  if (s.hasSign) {
    fill(g, c.trim); g.fillRect(0, 0, W, 8)
    fill(g, 0xffffff, 0.9); g.fillRect(10, 2, 22, 4)
  }
  const cols = 4
  const winW = 16, winH = 20
  const floorPx = FLOOR_PX_32
  for (let f = 0; f < s.floors; f++) {
    const fy = H - (f + 1) * floorPx + 16
    for (let ci = 0; ci < cols; ci++) {
      const wx = W * ((ci + 1) / (cols + 1)) - winW / 2
      const lit = s.litWindows && (((f * 11 + ci * 7) % 4) > 0)
      drawWindow(g, wx, fy, winW, winH, c.window, c.trim, lit)
    }
  }
  if (face === 'front') {
    // glass lobby
    const doorW = 42, doorH = 24
    fill(g, 0x101820); g.fillRect(W / 2 - doorW / 2, H - doorH, doorW, doorH)
    fill(g, c.window, 0.6); g.fillRect(W / 2 - doorW / 2 + 2, H - doorH + 2, doorW - 4, doorH - 4)
  }
}

function paintTower(g: CanvasRenderingContext2D, W: number, H: number, s: BuildingStyle, c: Palette, face: 'front' | 'side') {
  fill(g, c.wall); g.fillRect(0, 0, W, H)
  const cols = 3
  const winW = 14, winH = 18
  const floorPx = FLOOR_PX_32
  for (let f = 0; f < s.floors; f++) {
    const fy = H - (f + 1) * floorPx + 16
    for (let ci = 0; ci < cols; ci++) {
      const wx = W * ((ci + 1) / (cols + 1)) - winW / 2
      const lit = s.litWindows && (((f * 17 + ci * 11) % 5) > 1)
      drawWindow(g, wx, fy, winW, winH, c.window, c.trim, lit)
    }
  }
  if (face === 'front') {
    const doorW = 36, doorH = 22
    fill(g, 0x101820); g.fillRect(W / 2 - doorW / 2, H - doorH, doorW, doorH)
    fill(g, c.window, 0.7); g.fillRect(W / 2 - doorW / 2 + 2, H - doorH + 2, doorW - 4, doorH - 4)
  }
}

// ------------------------------------------------- condition patina (parity)

function paintCondition(g: CanvasRenderingContext2D, W: number, H: number, condBucket: number) {
  if (condBucket >= 95) return
  const condFactor = Math.max(0.4, condBucket / 100)
  const tintAlpha = Math.min(0.6, 1 - condFactor)
  if (tintAlpha > 0.01) {
    fill(g, 0x3a2820, tintAlpha)
    g.fillRect(0, 0, W, H)
  }
  if (condBucket < 30) {
    fill(g, 0x102030, 0.35)
    g.fillRect(0, 0, W, H)
  }
  if (condBucket < 50) {
    const intensity = Math.max(0, (50 - condBucket) / 50)
    g.strokeStyle = `rgba(42,24,16,${0.4 + intensity * 0.5})`
    g.lineWidth = 2
    const cracks = Math.round(2 + intensity * 5)
    const rng = mulberry32(W * 31 + H * 17 + condBucket)
    for (let i = 0; i < cracks; i++) {
      let cx = rng() * W
      let cy = rng() * H * 0.7
      g.beginPath()
      g.moveTo(cx, cy)
      const steps = 3 + Math.floor(rng() * 3)
      for (let st = 0; st < steps; st++) {
        cx += (rng() - 0.3) * 16
        cy += rng() * 12
        g.lineTo(cx, cy)
      }
      g.stroke()
    }
  }
  if (condBucket < 25) {
    fill(g, 0x4a3320, 0.7)
    g.fillRect(W * 0.2, H * 0.3, 12, 3)
    g.fillRect(W * 0.6, H * 0.5, 12, 3)
  }
}

// ------------------------------------------------- district skins (parity)

function paintDistrictSkin(g: CanvasRenderingContext2D, W: number, H: number, s: BuildingStyle, district: string | undefined, face: 'front' | 'side') {
  switch (district) {
    case 'mitte':
      fill(g, 0xe8f0f8, 0.10); g.fillRect(0, 0, W, H)
      fill(g, 0x9ed4ff, 0.18); g.fillRect(3, 2, W - 6, 4)
      break
    case 'prenzlauer':
      fill(g, 0xf2e0c4, 0.15); g.fillRect(0, 0, W, H)
      if (s.kind === 'apartment' || s.kind === 'house') {
        // drainpipe
        fill(g, 0xc89060); g.fillRect(W - 12, 10, 6, H - 20)
        fill(g, 0x8b3a2f); g.fillRect(W - 14, 10, 10, 4)
      }
      break
    case 'kreuzberg': {
      fill(g, 0xffd066, 0.06); g.fillRect(0, 0, W, H)
      // graffiti tags at street level
      const rng = mulberry32(s.width * 7 + s.height * 13 + s.kind.length + (face === 'front' ? 0 : 5))
      const palette = [0xff4080, 0x40d080, 0xffaa20, 0x40a0ff]
      const tagCount = 2 + Math.floor(rng() * 2)
      for (let i = 0; i < tagCount; i++) {
        const tx = 8 + rng() * (W - 40)
        const ty = H - 14 - rng() * 12
        const len = 12 + rng() * 16
        fill(g, palette[Math.floor(rng() * palette.length)], 0.85)
        for (let k = 0; k < 3; k++) g.fillRect(tx + k * 2, ty - (k & 1) * 2, len - k * 3, 3)
      }
      break
    }
    case 'charlottenburg':
      fill(g, 0xfff0e0, 0.10); g.fillRect(0, 0, W, H)
      fill(g, 0xfff8e8, 0.85); g.fillRect(0, 0, W, 4)
      fill(g, 0xc0a868)
      for (let dx = 8; dx < W; dx += 16) g.fillRect(dx, 3, 4, 2)
      break
    case 'wedding':
      fill(g, 0x8a96a0, 0.18); g.fillRect(0, 0, W, H)
      fill(g, 0x6b7480, 0.5); g.fillRect(0, H - 8, W, 8)
      fill(g, 0x40484e, 0.4); g.fillRect(0, 0, W, 2)
      break
    case 'neukoelln':
      fill(g, 0xffc080, 0.10); g.fillRect(0, 0, W, H)
      if (face === 'front' && (s.kind === 'shop' || s.kind === 'apartment' || s.kind === 'house')) {
        // awning over the entrance
        fill(g, 0xc04030, 0.95)
        g.beginPath()
        g.moveTo(W / 2 - 26, H - 40); g.lineTo(W / 2 + 26, H - 40); g.lineTo(W / 2 + 20, H - 32); g.lineTo(W / 2 - 20, H - 32)
        g.closePath(); g.fill()
        fill(g, 0xfff0c0, 0.6); g.fillRect(W / 2 - 20, H - 38, 8, 3)
      }
      break
  }
}

// ------------------------------------------------- marker sprite textures

let ownedBadgeTex: THREE.CanvasTexture | null = null

/** Gold circle badge with a little house glyph — the 3D version of the old
 *  owned-badge overlay sprite. */
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
