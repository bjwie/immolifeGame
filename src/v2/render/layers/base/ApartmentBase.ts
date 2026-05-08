import Phaser from 'phaser'
import { BakedLayer, PaintContext, drawWindow, colorsFor, mixColor } from '../Layer'

export const ApartmentBase: BakedLayer = {
  id: 'base.apartment',
  applies(ctx) { return ctx.kind === 'apartment' },
  key(ctx) {
    const s = ctx.style
    return `ba:${s.width}x${s.height}:${s.floors}:${s.wallColor.toString(16)}:${s.roofColor.toString(16)}:${s.windowColor.toString(16)}:${s.trimColor.toString(16)}:${s.accentColor.toString(16)}:${s.litWindows ? 'L' : 'D'}`
  },
  paint(g: Phaser.GameObjects.Graphics, ctx: PaintContext, ox: number, oy: number) {
    const s = ctx.style
    const c = colorsFor(s)
    const w = s.width, h = s.height
    g.fillStyle(c.wall, 1)
    g.fillRect(ox, oy + 6, w, h - 6)
    g.fillStyle(c.roof, 1)
    g.fillRect(ox - 2, oy, w + 4, 8)
    g.fillStyle(mixColor(c.roof, 0x000000, 0.4), 1)
    g.fillRect(ox - 2, oy + 8, w + 4, 2)
    g.fillStyle(c.accent, 1)
    g.fillRect(ox + w / 2 - 10, oy + h - 18, 20, 18)
    g.fillStyle(c.trim, 1)
    g.fillRect(ox + w / 2 - 10, oy + h - 18, 20, 2)
    const cols = 3
    const winW = 10, winH = 10
    const padX = (w - cols * winW) / (cols + 1)
    for (let f = 0; f < s.floors; f++) {
      const fy = oy + 14 + f * 18
      for (let cIdx = 0; cIdx < cols; cIdx++) {
        const wx = ox + padX + cIdx * (winW + padX)
        const lit = s.litWindows && (((f * 7 + cIdx * 13) % 5) > 1)
        drawWindow(g, wx, fy, winW, winH, c.window, c.trim, lit)
      }
    }
    g.fillStyle(c.trim, 1)
    for (let f = 1; f < s.floors; f++) {
      g.fillRect(ox + 3, oy + 12 + f * 18 + 11, w - 6, 1)
    }
  },
}
