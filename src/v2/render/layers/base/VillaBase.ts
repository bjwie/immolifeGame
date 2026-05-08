import Phaser from 'phaser'
import { BakedLayer, PaintContext, drawWindow, colorsFor } from '../Layer'

export const VillaBase: BakedLayer = {
  id: 'base.villa',
  applies(ctx) { return ctx.kind === 'villa' },
  key(ctx) {
    const s = ctx.style
    return `bv:${s.width}x${s.height}:${s.floors}:${s.wallColor.toString(16)}:${s.roofColor.toString(16)}:${s.windowColor.toString(16)}:${s.trimColor.toString(16)}:${s.accentColor.toString(16)}:${s.litWindows ? 'L' : 'D'}`
  },
  paint(g: Phaser.GameObjects.Graphics, ctx: PaintContext, ox: number, oy: number) {
    const s = ctx.style
    const c = colorsFor(s)
    const w = s.width, h = s.height
    const roofH = 20
    g.fillStyle(c.wall, 1)
    g.fillRect(ox, oy + roofH, w, h - roofH)
    g.fillStyle(c.roof, 1)
    g.fillTriangle(ox - 3, oy + roofH + 1, ox + w * 0.35, oy + 4, ox + w * 0.35, oy + roofH + 1)
    g.fillTriangle(ox + w * 0.65, oy + roofH + 1, ox + w + 3, oy + roofH + 1, ox + w * 0.65, oy + 4)
    g.fillRect(ox + w * 0.35, oy + 4, w * 0.3, roofH - 4)
    g.fillStyle(0xffffff, 0.85)
    g.fillRect(ox + w / 2 - 14, oy + h - 30, 4, 30)
    g.fillRect(ox + w / 2 + 10, oy + h - 30, 4, 30)
    g.fillStyle(c.accent, 1)
    g.fillRect(ox + w / 2 - 8, oy + h - 28, 16, 28)
    const winY = oy + roofH + 10
    for (let i = 0; i < 4; i++) {
      const wx = ox + 6 + i * (w - 16) / 3
      drawWindow(g, wx, winY, 10, 12, c.window, c.trim, s.litWindows)
    }
    if (s.floors > 1) {
      for (let i = 0; i < 4; i++) {
        const wx = ox + 6 + i * (w - 16) / 3
        drawWindow(g, wx, winY + 22, 10, 10, c.window, c.trim, s.litWindows)
      }
    }
  },
}
