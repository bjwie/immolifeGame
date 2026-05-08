import Phaser from 'phaser'
import { BakedLayer, PaintContext, drawWindow, colorsFor } from '../Layer'

export const TowerBase: BakedLayer = {
  id: 'base.tower',
  applies(ctx) { return ctx.kind === 'tower' },
  key(ctx) {
    const s = ctx.style
    return `bt:${s.width}x${s.height}:${s.floors}:${s.wallColor.toString(16)}:${s.roofColor.toString(16)}:${s.windowColor.toString(16)}:${s.trimColor.toString(16)}:${s.accentColor.toString(16)}:${s.litWindows ? 'L' : 'D'}`
  },
  paint(g: Phaser.GameObjects.Graphics, ctx: PaintContext, ox: number, oy: number) {
    const s = ctx.style
    const c = colorsFor(s)
    const w = s.width, h = s.height
    const tipNarrow = 6
    g.fillStyle(c.wall, 1)
    g.beginPath()
    g.moveTo(ox + tipNarrow, oy + 4)
    g.lineTo(ox + w - tipNarrow, oy + 4)
    g.lineTo(ox + w, oy + h)
    g.lineTo(ox, oy + h)
    g.closePath()
    g.fillPath()
    g.fillStyle(c.roof, 1)
    g.fillRect(ox + tipNarrow - 1, oy, w - tipNarrow * 2 + 2, 4)
    g.fillStyle(c.accent, 1)
    g.fillRect(ox + w / 2 - 1, oy - 6, 2, 6)
    g.fillStyle(0x808890, 1); g.fillRect(ox + tipNarrow + 2, oy + 4, 5, 3)
    g.fillStyle(0xb0b8c0, 1); g.fillCircle(ox + w - tipNarrow - 4, oy + 5, 2)
    const cols = 3
    const winW = 8, winH = 10
    for (let f = 0; f < s.floors; f++) {
      const fy = oy + 10 + f * 14
      const innerW = w - tipNarrow * 2 + (f / s.floors) * tipNarrow * 1.4
      const startX = ox + (w - innerW) / 2
      const padX = (innerW - cols * winW) / (cols + 1)
      for (let cIdx = 0; cIdx < cols; cIdx++) {
        const wx = startX + padX + cIdx * (winW + padX)
        const lit = s.litWindows && (((f * 17 + cIdx * 11) % 5) > 1)
        drawWindow(g, wx, fy, winW, winH, c.window, c.trim, lit)
      }
    }
    g.fillStyle(0x101820, 1)
    g.fillRect(ox + w / 2 - 10, oy + h - 12, 20, 12)
    g.fillStyle(c.window, 0.7)
    g.fillRect(ox + w / 2 - 9, oy + h - 11, 18, 10)
  },
}
