import Phaser from 'phaser'
import { BakedLayer, PaintContext, drawWindow, colorsFor } from '../Layer'

export const OfficeBase: BakedLayer = {
  id: 'base.office',
  applies(ctx) { return ctx.kind === 'office' },
  key(ctx) {
    const s = ctx.style
    return `bo:${s.width}x${s.height}:${s.floors}:${s.wallColor.toString(16)}:${s.roofColor.toString(16)}:${s.windowColor.toString(16)}:${s.trimColor.toString(16)}:${s.accentColor.toString(16)}:${s.litWindows ? 'L' : 'D'}:${s.hasSign ? 'S' : 'N'}`
  },
  paint(g: Phaser.GameObjects.Graphics, ctx: PaintContext, ox: number, oy: number) {
    const s = ctx.style
    const c = colorsFor(s)
    const w = s.width, h = s.height
    g.fillStyle(c.wall, 1)
    g.fillRect(ox, oy + 6, w, h - 6)
    g.fillStyle(c.roof, 1)
    g.fillRect(ox - 2, oy, w + 4, 8)
    g.fillStyle(0x707880, 1)
    g.fillRect(ox + 4, oy + 2, 6, 4)
    g.fillRect(ox + w - 12, oy + 2, 7, 4)
    g.fillStyle(0x404850, 1)
    g.fillRect(ox + 5, oy + 3, 4, 1)
    g.fillRect(ox + w - 11, oy + 3, 5, 1)
    const cols = 4
    const winW = 10, winH = 12
    const padX = (w - cols * winW) / (cols + 1)
    for (let f = 0; f < s.floors; f++) {
      const fy = oy + 12 + f * 18
      for (let cIdx = 0; cIdx < cols; cIdx++) {
        const wx = ox + padX + cIdx * (winW + padX)
        const lit = s.litWindows && (((f * 11 + cIdx * 7) % 4) > 0)
        drawWindow(g, wx, fy, winW, winH, c.window, c.trim, lit)
      }
    }
    g.fillStyle(0x101820, 1)
    g.fillRect(ox + w / 2 - 12, oy + h - 14, 24, 14)
    g.fillStyle(c.window, 0.6)
    g.fillRect(ox + w / 2 - 11, oy + h - 13, 22, 12)
    if (s.hasSign) {
      g.fillStyle(c.trim, 1)
      g.fillRect(ox, oy, w, 5)
      g.fillStyle(0xffffff, 0.9)
      g.fillRect(ox + 6, oy + 1, 12, 3)
    }
  },
}
