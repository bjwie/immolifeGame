import Phaser from 'phaser'
import { BakedLayer, PaintContext, drawWindow, colorsFor, mixColor } from '../Layer'

export const ApartmentBase: BakedLayer = {
  id: 'base.apartment',
  applies(ctx) { return ctx.kind === 'apartment' },
  key(ctx) {
    const s = ctx.style
    const sub = s.subtype ?? 'neubau'
    return `ba.${sub}:${s.width}x${s.height}:${s.floors}:${s.wallColor.toString(16)}:${s.roofColor.toString(16)}:${s.windowColor.toString(16)}:${s.trimColor.toString(16)}:${s.accentColor.toString(16)}:${s.litWindows ? 'L' : 'D'}`
  },
  paint(g: Phaser.GameObjects.Graphics, ctx: PaintContext, ox: number, oy: number) {
    const sub = ctx.style.subtype ?? 'neubau'
    switch (sub) {
      case 'altbau': return paintAltbau(g, ctx, ox, oy)
      case 'plattenbau': return paintPlattenbau(g, ctx, ox, oy)
      case 'neubau': return paintNeubau(g, ctx, ox, oy)
    }
  },
}

function paintAltbau(g: Phaser.GameObjects.Graphics, ctx: PaintContext, ox: number, oy: number) {
  const s = ctx.style
  const c = colorsFor(s)
  const w = s.width, h = s.height
  // warm overlay over palette: tint the wall toward sandstone
  const wall = mixColor(c.wall, 0xf2dcb0, 0.25)
  const trim = mixColor(c.trim, 0x6b4830, 0.20)
  const accent = mixColor(c.accent, 0xc89060, 0.30)

  // body
  g.fillStyle(wall, 1)
  g.fillRect(ox, oy + 6, w, h - 6)
  // ornate cornice
  g.fillStyle(0xfff8e0, 0.95)
  g.fillRect(ox - 2, oy, w + 4, 4)
  g.fillStyle(mixColor(0xfff8e0, 0x000000, 0.3), 1)
  g.fillRect(ox - 2, oy + 4, w + 4, 2)
  g.fillStyle(0xc89060, 1)
  for (let dx = 4; dx < w; dx += 6) {
    g.fillRect(ox + dx, oy + 2, 2, 1)
  }
  // ground floor with door + decorative band
  g.fillStyle(accent, 1)
  g.fillRect(ox + w / 2 - 8, oy + h - 20, 16, 20)
  g.fillStyle(trim, 1)
  g.fillRect(ox + w / 2 - 8, oy + h - 20, 16, 2)
  g.fillStyle(0xfff8e0, 0.6)
  g.fillRect(ox + 1, oy + h - 22, w - 2, 1)
  // tall narrow windows (per floor)
  const cols = 3
  const winW = 8, winH = 14  // taller, narrower than neubau
  const padX = (w - cols * winW) / (cols + 1)
  for (let f = 0; f < s.floors; f++) {
    const fy = oy + 12 + f * 18
    for (let cIdx = 0; cIdx < cols; cIdx++) {
      const wx = ox + padX + cIdx * (winW + padX)
      const lit = s.litWindows && (((f * 7 + cIdx * 13) % 5) > 1)
      drawWindow(g, wx, fy, winW, winH, c.window, trim, lit)
      // window pediment (Stuck) — small triangle above each window
      g.fillStyle(0xfff8e0, 0.9)
      g.fillTriangle(wx - 1, fy - 1, wx + winW + 1, fy - 1, wx + winW / 2, fy - 4)
    }
  }
}

function paintPlattenbau(g: Phaser.GameObjects.Graphics, ctx: PaintContext, ox: number, oy: number) {
  const s = ctx.style
  const c = colorsFor(s)
  const w = s.width, h = s.height
  // cool grey wash over palette
  const wall = mixColor(c.wall, 0x9aa0a8, 0.55)
  const trim = mixColor(c.trim, 0x40464e, 0.40)
  const accent = mixColor(c.accent, 0x6b7480, 0.40)

  // body
  g.fillStyle(wall, 1)
  g.fillRect(ox, oy + 6, w, h - 6)
  // flat raw concrete roof
  g.fillStyle(0x60686e, 1)
  g.fillRect(ox - 2, oy, w + 4, 6)
  g.fillStyle(0x404850, 1)
  g.fillRect(ox - 2, oy + 6, w + 4, 2)

  // horizontal panel seams every 18px (Plattenbau-Element-Linien)
  g.fillStyle(0x707880, 0.6)
  for (let f = 1; f < s.floors; f++) {
    g.fillRect(ox, oy + 12 + f * 18 - 2, w, 1)
  }
  // vertical panel seams
  g.fillStyle(0x707880, 0.4)
  for (let dx = w / 4; dx < w; dx += w / 4) {
    g.fillRect(ox + Math.round(dx), oy + 8, 1, h - 8)
  }

  // ground floor entry
  g.fillStyle(accent, 1)
  g.fillRect(ox + w / 2 - 10, oy + h - 16, 20, 16)
  g.fillStyle(trim, 1)
  g.fillRect(ox + w / 2 - 10, oy + h - 16, 20, 2)

  // identical raster windows: 3 cols, equal sizes
  const cols = 3
  const winW = 12, winH = 8  // wide and short, Plattenbau ratio
  const padX = (w - cols * winW) / (cols + 1)
  for (let f = 0; f < s.floors; f++) {
    const fy = oy + 14 + f * 18
    for (let cIdx = 0; cIdx < cols; cIdx++) {
      const wx = ox + padX + cIdx * (winW + padX)
      // far less variation in lit pattern → repetitive
      const lit = s.litWindows && (((f + cIdx) % 3) === 0)
      drawWindow(g, wx, fy, winW, winH, c.window, trim, lit)
    }
  }
}

function paintNeubau(g: Phaser.GameObjects.Graphics, ctx: PaintContext, ox: number, oy: number) {
  const s = ctx.style
  const c = colorsFor(s)
  const w = s.width, h = s.height
  // crisp light wall
  const wall = mixColor(c.wall, 0xfafcfe, 0.40)
  const trim = mixColor(c.trim, 0x202830, 0.30)

  // body
  g.fillStyle(wall, 1)
  g.fillRect(ox, oy + 6, w, h - 6)
  // dark anthracite cornice/cap
  g.fillStyle(0x2a2e36, 1)
  g.fillRect(ox - 2, oy, w + 4, 6)
  g.fillStyle(0x4a5560, 1)
  g.fillRect(ox - 2, oy + 6, w + 4, 1)

  // entrance: large glass element
  g.fillStyle(0x1a2028, 1)
  g.fillRect(ox + w / 2 - 14, oy + h - 18, 28, 18)
  g.fillStyle(c.window, 0.7)
  g.fillRect(ox + w / 2 - 13, oy + h - 17, 26, 16)
  g.fillStyle(0xffffff, 0.4)
  g.fillRect(ox + w / 2 - 12, oy + h - 16, 6, 2)

  // big horizontal strip windows ("Bandfenster")
  const cols = 4  // more columns, wider strips
  const winW = 10, winH = 11
  const padX = (w - cols * winW) / (cols + 1)
  for (let f = 0; f < s.floors; f++) {
    const fy = oy + 14 + f * 18
    // continuous dark band behind windows
    g.fillStyle(0x1a2028, 0.85)
    g.fillRect(ox + 2, fy - 1, w - 4, winH + 2)
    for (let cIdx = 0; cIdx < cols; cIdx++) {
      const wx = ox + padX + cIdx * (winW + padX)
      const lit = s.litWindows && (((f * 11 + cIdx * 7) % 3) === 0)
      drawWindow(g, wx, fy, winW, winH, c.window, trim, lit)
    }
  }
  // accent vertical line (ein modernes Element)
  g.fillStyle(0x4a5560, 0.7)
  g.fillRect(ox + w - 4, oy + 8, 1, h - 16)
}
