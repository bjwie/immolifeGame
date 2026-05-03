import Phaser from 'phaser'

export type BuildingKind = 'house' | 'apartment' | 'office' | 'shop' | 'tower' | 'villa'

export interface BuildingStyle {
  kind: BuildingKind
  width: number
  height: number
  floors: number
  wallColor: number
  roofColor: number
  windowColor: number
  trimColor: number
  accentColor: number
  condition: number
  litWindows: boolean
  hasSign: boolean
  signColor?: number
}

const PALETTES: Record<BuildingKind, Array<Omit<BuildingStyle, 'kind' | 'width' | 'height' | 'floors' | 'condition' | 'litWindows' | 'hasSign' | 'signColor'>>> = {
  house: [
    { wallColor: 0xf2d7b6, roofColor: 0x8b3a2f, windowColor: 0x6ec6ff, trimColor: 0x5a3825, accentColor: 0x3d2418 },
    { wallColor: 0xe5c79a, roofColor: 0x6b2c20, windowColor: 0xfff3a6, trimColor: 0x4a3320, accentColor: 0x2a1810 },
    { wallColor: 0xfff1d6, roofColor: 0x4f7942, windowColor: 0x88d8ff, trimColor: 0x3a2f1c, accentColor: 0x1f1810 },
  ],
  apartment: [
    { wallColor: 0xc5b89a, roofColor: 0x4a4a4a, windowColor: 0xffd866, trimColor: 0x3a3a3a, accentColor: 0xa08562 },
    { wallColor: 0xd4c0a0, roofColor: 0x5a4a3a, windowColor: 0x88c8ff, trimColor: 0x6b5440, accentColor: 0xa48868 },
    { wallColor: 0xb89c7d, roofColor: 0x3d3530, windowColor: 0xffd84d, trimColor: 0x2c241e, accentColor: 0x8a6f54 },
  ],
  office: [
    { wallColor: 0x9aa6b0, roofColor: 0x5a6573, windowColor: 0x4eb4e0, trimColor: 0x3d4854, accentColor: 0x6e7a86 },
    { wallColor: 0xb0bcc8, roofColor: 0x6e7886, windowColor: 0x76d0f0, trimColor: 0x4a5460, accentColor: 0x8290a0 },
  ],
  shop: [
    { wallColor: 0xe8d5a0, roofColor: 0xa84020, windowColor: 0xffe888, trimColor: 0x6e3015, accentColor: 0xc05030 },
    { wallColor: 0xfff0c8, roofColor: 0x208860, windowColor: 0xffd24d, trimColor: 0x166040, accentColor: 0x2aa080 },
    { wallColor: 0xddc8a8, roofColor: 0x4060a8, windowColor: 0xfff088, trimColor: 0x2c4470, accentColor: 0x5070b8 },
  ],
  tower: [
    { wallColor: 0x4a5a72, roofColor: 0x2a3848, windowColor: 0x8acff0, trimColor: 0x1a2330, accentColor: 0x60708a },
    { wallColor: 0x6c7a8a, roofColor: 0x3a4858, windowColor: 0x9adcf2, trimColor: 0x222a36, accentColor: 0x88a0b8 },
  ],
  villa: [
    { wallColor: 0xfff6e0, roofColor: 0x9a3020, windowColor: 0x88d4f8, trimColor: 0x5a3424, accentColor: 0xc89060 },
    { wallColor: 0xf0e4c8, roofColor: 0x6a4a2a, windowColor: 0xffeea4, trimColor: 0x4a3320, accentColor: 0xb88660 },
  ],
}

const DAMAGE_TINT = 0x3a2820

export class BuildingRenderer {
  private static textureCache = new Map<string, true>()

  static rollStyle(kind: BuildingKind, seed: number, condition: number = 100): BuildingStyle {
    const rng = mulberry32(seed)
    const palette = PALETTES[kind]
    const p = palette[Math.floor(rng() * palette.length)]
    const sizeProfile = this.sizeFor(kind, rng)
    return {
      kind,
      ...p,
      ...sizeProfile,
      condition,
      litWindows: rng() > 0.4,
      hasSign: kind === 'shop' || (kind === 'office' && rng() > 0.6),
      signColor: kind === 'shop' ? [0xc02040, 0x208844, 0x2050a8, 0xc06820][Math.floor(rng() * 4)] : 0xc02040,
    }
  }

  private static sizeFor(kind: BuildingKind, rng: () => number) {
    switch (kind) {
      case 'house': return { width: 56, height: 60, floors: 1 + Math.floor(rng() * 2) }
      case 'villa': return { width: 76, height: 72, floors: 2 }
      case 'apartment': return { width: 64, height: 90, floors: 3 + Math.floor(rng() * 3) }
      case 'shop': return { width: 64, height: 56, floors: 1 }
      case 'office': return { width: 64, height: 92, floors: 4 + Math.floor(rng() * 2) }
      case 'tower': return { width: 56, height: 130, floors: 7 + Math.floor(rng() * 4) }
    }
  }

  static textureKey(style: BuildingStyle, ownedBadge: boolean = false): string {
    return [
      'b', style.kind, style.width, style.height, style.floors,
      style.wallColor.toString(16), style.roofColor.toString(16),
      style.windowColor.toString(16), style.trimColor.toString(16),
      style.accentColor.toString(16),
      Math.round(style.condition / 10),
      style.litWindows ? 'L' : 'D',
      style.hasSign ? 'S' + (style.signColor?.toString(16) ?? '') : 'N',
      ownedBadge ? 'O' : '',
    ].join(':')
  }

  static ensureTexture(scene: Phaser.Scene, style: BuildingStyle, ownedBadge: boolean = false): string {
    const key = this.textureKey(style, ownedBadge)
    if (this.textureCache.has(key) && scene.textures.exists(key)) return key

    const padding = 6
    const totalW = style.width + padding * 2
    const totalH = style.height + padding * 2 + 14 // extra for ground shadow
    const g = scene.add.graphics({ x: 0, y: 0 })

    this.drawShadow(g, padding + style.width / 2, padding + style.height + 6, style.width * 0.55)
    this.drawBuilding(g, padding, padding, style)
    if (ownedBadge) this.drawOwnedBadge(g, totalW - 16, padding + 4)

    g.generateTexture(key, totalW, totalH)
    g.destroy()
    this.textureCache.set(key, true)
    return key
  }

  private static drawShadow(g: Phaser.GameObjects.Graphics, cx: number, cy: number, radius: number) {
    g.fillStyle(0x000000, 0.25)
    g.fillEllipse(cx, cy, radius * 2, radius * 0.55)
  }

  private static drawBuilding(g: Phaser.GameObjects.Graphics, ox: number, oy: number, s: BuildingStyle) {
    const condFactor = Math.max(0.4, s.condition / 100)
    const wall = mixColor(s.wallColor, DAMAGE_TINT, 1 - condFactor)
    const roof = mixColor(s.roofColor, DAMAGE_TINT, 1 - condFactor)
    const trim = mixColor(s.trimColor, DAMAGE_TINT, 1 - condFactor)
    const accent = mixColor(s.accentColor, DAMAGE_TINT, 1 - condFactor)
    const window = s.condition < 30 ? mixColor(s.windowColor, 0x102030, 0.6) : s.windowColor

    switch (s.kind) {
      case 'house': return this.drawHouse(g, ox, oy, s, wall, roof, trim, accent, window)
      case 'villa': return this.drawVilla(g, ox, oy, s, wall, roof, trim, accent, window)
      case 'apartment': return this.drawApartment(g, ox, oy, s, wall, roof, trim, accent, window)
      case 'shop': return this.drawShop(g, ox, oy, s, wall, roof, trim, accent, window)
      case 'office': return this.drawOffice(g, ox, oy, s, wall, roof, trim, accent, window)
      case 'tower': return this.drawTower(g, ox, oy, s, wall, roof, trim, accent, window)
    }
  }

  private static drawHouse(g: Phaser.GameObjects.Graphics, ox: number, oy: number, s: BuildingStyle, wall: number, roof: number, trim: number, accent: number, win: number) {
    const w = s.width, h = s.height
    const roofH = 18
    // body
    g.fillStyle(wall, 1)
    g.fillRect(ox, oy + roofH, w, h - roofH)
    // roof - triangular
    g.fillStyle(roof, 1)
    g.fillTriangle(ox - 2, oy + roofH + 2, ox + w + 2, oy + roofH + 2, ox + w / 2, oy)
    g.fillStyle(mixColor(roof, 0x000000, 0.3), 1)
    g.fillRect(ox - 3, oy + roofH, w + 6, 3)
    // door
    const doorW = 12, doorH = 18
    g.fillStyle(accent, 1)
    g.fillRect(ox + w / 2 - doorW / 2, oy + h - doorH, doorW, doorH)
    g.fillStyle(0xf1c40f, 0.9)
    g.fillRect(ox + w / 2 + doorW / 2 - 3, oy + h - doorH / 2, 1, 1)
    // windows
    const winY = oy + roofH + 8
    this.drawWindow(g, ox + 8, winY, 12, 10, win, trim, s.litWindows)
    this.drawWindow(g, ox + w - 20, winY, 12, 10, win, trim, s.litWindows)
    // upper floor windows if 2 floors
    if (s.floors > 1) {
      this.drawWindow(g, ox + 8, winY + 18, 10, 8, win, trim, s.litWindows)
      this.drawWindow(g, ox + w - 18, winY + 18, 10, 8, win, trim, s.litWindows)
    }
    // chimney
    g.fillStyle(trim, 1)
    g.fillRect(ox + w - 14, oy + 4, 6, 14)
    // damage cracks
    if (s.condition < 50) this.drawCracks(g, ox, oy + roofH, w, h - roofH, s.condition)
  }

  private static drawVilla(g: Phaser.GameObjects.Graphics, ox: number, oy: number, s: BuildingStyle, wall: number, roof: number, trim: number, accent: number, win: number) {
    const w = s.width, h = s.height
    const roofH = 20
    // wide base
    g.fillStyle(wall, 1)
    g.fillRect(ox, oy + roofH, w, h - roofH)
    // hip roof
    g.fillStyle(roof, 1)
    g.fillTriangle(ox - 3, oy + roofH + 1, ox + w * 0.35, oy + 4, ox + w * 0.35, oy + roofH + 1)
    g.fillTriangle(ox + w * 0.65, oy + roofH + 1, ox + w + 3, oy + roofH + 1, ox + w * 0.65, oy + 4)
    g.fillRect(ox + w * 0.35, oy + 4, w * 0.3, roofH - 4)
    // columns at entry
    g.fillStyle(0xffffff, 0.85)
    g.fillRect(ox + w / 2 - 14, oy + h - 30, 4, 30)
    g.fillRect(ox + w / 2 + 10, oy + h - 30, 4, 30)
    // door
    g.fillStyle(accent, 1)
    g.fillRect(ox + w / 2 - 8, oy + h - 28, 16, 28)
    // windows row
    const winY = oy + roofH + 10
    for (let i = 0; i < 4; i++) {
      const wx = ox + 6 + i * (w - 16) / 3
      this.drawWindow(g, wx, winY, 10, 12, win, trim, s.litWindows)
    }
    if (s.floors > 1) {
      for (let i = 0; i < 4; i++) {
        const wx = ox + 6 + i * (w - 16) / 3
        this.drawWindow(g, wx, winY + 22, 10, 10, win, trim, s.litWindows)
      }
    }
    if (s.condition < 50) this.drawCracks(g, ox, oy + roofH, w, h - roofH, s.condition)
  }

  private static drawApartment(g: Phaser.GameObjects.Graphics, ox: number, oy: number, s: BuildingStyle, wall: number, roof: number, trim: number, accent: number, win: number) {
    const w = s.width, h = s.height
    // body
    g.fillStyle(wall, 1)
    g.fillRect(ox, oy + 6, w, h - 6)
    // flat roof with cornice
    g.fillStyle(roof, 1)
    g.fillRect(ox - 2, oy, w + 4, 8)
    g.fillStyle(mixColor(roof, 0x000000, 0.4), 1)
    g.fillRect(ox - 2, oy + 8, w + 4, 2)
    // ground floor entry
    g.fillStyle(accent, 1)
    g.fillRect(ox + w / 2 - 10, oy + h - 18, 20, 18)
    g.fillStyle(trim, 1)
    g.fillRect(ox + w / 2 - 10, oy + h - 18, 20, 2)
    // window grid
    const cols = 3
    const winW = 10, winH = 10
    const padX = (w - cols * winW) / (cols + 1)
    for (let f = 0; f < s.floors; f++) {
      const fy = oy + 14 + f * 18
      for (let c = 0; c < cols; c++) {
        const wx = ox + padX + c * (winW + padX)
        const lit = s.litWindows && (((f * 7 + c * 13) % 5) > 1)
        this.drawWindow(g, wx, fy, winW, winH, win, trim, lit)
      }
    }
    // balcony bars
    g.fillStyle(trim, 1)
    for (let f = 1; f < s.floors; f++) {
      g.fillRect(ox + 3, oy + 12 + f * 18 + 11, w - 6, 1)
    }
    if (s.condition < 50) this.drawCracks(g, ox, oy + 6, w, h - 6, s.condition)
  }

  private static drawShop(g: Phaser.GameObjects.Graphics, ox: number, oy: number, s: BuildingStyle, wall: number, roof: number, trim: number, _accent: number, win: number) {
    const w = s.width, h = s.height
    // body
    g.fillStyle(wall, 1)
    g.fillRect(ox, oy + 18, w, h - 18)
    // awning
    g.fillStyle(roof, 1)
    g.fillTriangle(ox - 4, oy + 22, ox + w + 4, oy + 22, ox + w / 2, oy + 8)
    // alternating awning stripes
    g.fillStyle(0xffffff, 0.55)
    for (let i = 0; i < 4; i++) {
      const tx = ox + i * (w / 4)
      g.fillTriangle(tx, oy + 22, tx + w / 8, oy + 22, tx + w / 16, oy + 14)
    }
    // big window
    const bigWin = { x: ox + 4, y: oy + 26, w: w - 8, h: 22 }
    g.fillStyle(0x101820, 1)
    g.fillRect(bigWin.x, bigWin.y, bigWin.w, bigWin.h)
    g.fillStyle(win, 0.85)
    g.fillRect(bigWin.x + 1, bigWin.y + 1, bigWin.w - 2, bigWin.h - 2)
    g.fillStyle(0xffffff, 0.3)
    g.fillRect(bigWin.x + 2, bigWin.y + 2, bigWin.w - 4, 3)
    // door
    g.fillStyle(trim, 1)
    g.fillRect(ox + w / 2 - 8, oy + h - 8, 16, 8)
    // sign
    if (s.hasSign && s.signColor !== undefined) {
      g.fillStyle(s.signColor, 1)
      g.fillRect(ox + 2, oy + 2, w - 4, 8)
      g.fillStyle(0xffffff, 0.95)
      for (let i = 0; i < 5; i++) {
        g.fillRect(ox + 6 + i * 8, oy + 5, 4, 2)
      }
    }
    if (s.condition < 50) this.drawCracks(g, ox, oy + 18, w, h - 18, s.condition)
  }

  private static drawOffice(g: Phaser.GameObjects.Graphics, ox: number, oy: number, s: BuildingStyle, wall: number, roof: number, trim: number, _accent: number, win: number) {
    const w = s.width, h = s.height
    g.fillStyle(wall, 1)
    g.fillRect(ox, oy + 6, w, h - 6)
    g.fillStyle(roof, 1)
    g.fillRect(ox - 2, oy, w + 4, 8)
    // glass facade - big rows
    const cols = 4
    const winW = 10, winH = 12
    const padX = (w - cols * winW) / (cols + 1)
    for (let f = 0; f < s.floors; f++) {
      const fy = oy + 12 + f * 18
      for (let c = 0; c < cols; c++) {
        const wx = ox + padX + c * (winW + padX)
        const lit = s.litWindows && (((f * 11 + c * 7) % 4) > 0)
        this.drawWindow(g, wx, fy, winW, winH, win, trim, lit)
      }
    }
    // entrance double doors
    g.fillStyle(0x101820, 1)
    g.fillRect(ox + w / 2 - 12, oy + h - 14, 24, 14)
    g.fillStyle(win, 0.6)
    g.fillRect(ox + w / 2 - 11, oy + h - 13, 22, 12)
    // sign
    if (s.hasSign) {
      g.fillStyle(trim, 1)
      g.fillRect(ox, oy, w, 5)
      g.fillStyle(0xffffff, 0.9)
      g.fillRect(ox + 6, oy + 1, 12, 3)
    }
    if (s.condition < 50) this.drawCracks(g, ox, oy + 6, w, h - 6, s.condition)
  }

  private static drawTower(g: Phaser.GameObjects.Graphics, ox: number, oy: number, s: BuildingStyle, wall: number, roof: number, trim: number, accent: number, win: number) {
    const w = s.width, h = s.height
    // tapered tower
    const tipNarrow = 6
    g.fillStyle(wall, 1)
    g.beginPath()
    g.moveTo(ox + tipNarrow, oy + 4)
    g.lineTo(ox + w - tipNarrow, oy + 4)
    g.lineTo(ox + w, oy + h)
    g.lineTo(ox, oy + h)
    g.closePath()
    g.fillPath()
    // crown
    g.fillStyle(roof, 1)
    g.fillRect(ox + tipNarrow - 1, oy, w - tipNarrow * 2 + 2, 4)
    g.fillStyle(accent, 1)
    g.fillRect(ox + w / 2 - 1, oy - 6, 2, 6)
    // windows
    const cols = 3
    const winW = 8, winH = 10
    for (let f = 0; f < s.floors; f++) {
      const fy = oy + 10 + f * 14
      const innerW = w - tipNarrow * 2 + (f / s.floors) * tipNarrow * 1.4
      const startX = ox + (w - innerW) / 2
      const padX = (innerW - cols * winW) / (cols + 1)
      for (let c = 0; c < cols; c++) {
        const wx = startX + padX + c * (winW + padX)
        const lit = s.litWindows && (((f * 17 + c * 11) % 5) > 1)
        this.drawWindow(g, wx, fy, winW, winH, win, trim, lit)
      }
    }
    // base entrance
    g.fillStyle(0x101820, 1)
    g.fillRect(ox + w / 2 - 10, oy + h - 12, 20, 12)
    g.fillStyle(win, 0.7)
    g.fillRect(ox + w / 2 - 9, oy + h - 11, 18, 10)
    if (s.condition < 50) this.drawCracks(g, ox, oy + 4, w, h - 4, s.condition)
  }

  private static drawWindow(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, trim: number, lit: boolean) {
    g.fillStyle(trim, 1)
    g.fillRect(x - 1, y - 1, w + 2, h + 2)
    g.fillStyle(lit ? color : mixColor(color, 0x101830, 0.55), 1)
    g.fillRect(x, y, w, h)
    // mullions
    g.fillStyle(trim, 0.7)
    g.fillRect(x + Math.floor(w / 2), y, 1, h)
    g.fillRect(x, y + Math.floor(h / 2), w, 1)
    // highlight
    g.fillStyle(0xffffff, lit ? 0.55 : 0.18)
    g.fillRect(x + 1, y + 1, Math.max(2, Math.floor(w / 3)), 1)
  }

  private static drawCracks(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, condition: number) {
    const intensity = Math.max(0, (50 - condition) / 50)
    g.lineStyle(1, 0x2a1810, 0.4 + intensity * 0.5)
    const cracks = Math.round(2 + intensity * 5)
    const seedRng = mulberry32(x * 31 + y * 17 + Math.floor(condition))
    for (let i = 0; i < cracks; i++) {
      const sx = x + seedRng() * w
      const sy = y + seedRng() * (h * 0.7)
      g.beginPath()
      g.moveTo(sx, sy)
      let cx = sx, cy = sy
      const steps = 3 + Math.floor(seedRng() * 3)
      for (let s = 0; s < steps; s++) {
        cx += (seedRng() - 0.3) * 8
        cy += seedRng() * 6
        g.lineTo(cx, cy)
      }
      g.strokePath()
    }
    if (condition < 25) {
      // boarded windows mark
      g.fillStyle(0x4a3320, 0.7)
      g.fillRect(x + w * 0.2, y + h * 0.3, 6, 1)
      g.fillRect(x + w * 0.6, y + h * 0.5, 6, 1)
    }
  }

  private static drawOwnedBadge(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x000000, 0.4)
    g.fillCircle(x + 1, y + 1, 8)
    g.fillStyle(0xf1c40f, 1)
    g.fillCircle(x, y, 8)
    g.lineStyle(1.5, 0xb8870a, 1)
    g.strokeCircle(x, y, 8)
    // crown shape
    g.fillStyle(0xfff4c8, 1)
    g.fillTriangle(x - 4, y + 2, x + 4, y + 2, x, y - 3)
    g.fillRect(x - 4, y + 2, 8, 2)
  }
}

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function mixColor(a: number, b: number, t: number): number {
  t = Math.max(0, Math.min(1, t))
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return (r << 16) | (g << 8) | bl
}
