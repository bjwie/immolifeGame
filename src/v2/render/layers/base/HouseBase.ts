import Phaser from 'phaser'
import { BakedLayer, PaintContext, drawWindow, colorsFor, mixColor } from '../Layer'

export const HouseBase: BakedLayer = {
  id: 'base.house',
  applies(ctx) { return ctx.kind === 'house' },
  key(ctx) {
    const s = ctx.style
    return `bh:${s.width}x${s.height}:${s.floors}:${s.wallColor.toString(16)}:${s.roofColor.toString(16)}:${s.windowColor.toString(16)}:${s.trimColor.toString(16)}:${s.accentColor.toString(16)}:${s.litWindows ? 'L' : 'D'}`
  },
  paint(g: Phaser.GameObjects.Graphics, ctx: PaintContext, ox: number, oy: number) {
    const s = ctx.style
    const c = colorsFor(s)
    const w = s.width, h = s.height
    const roofH = 18
    g.fillStyle(c.wall, 1)
    g.fillRect(ox, oy + roofH, w, h - roofH)
    g.fillStyle(c.roof, 1)
    g.fillTriangle(ox - 2, oy + roofH + 2, ox + w + 2, oy + roofH + 2, ox + w / 2, oy)
    g.fillStyle(mixColor(c.roof, 0x000000, 0.3), 1)
    g.fillRect(ox - 3, oy + roofH, w + 6, 3)
    const doorW = 12, doorH = 18
    g.fillStyle(c.accent, 1)
    g.fillRect(ox + w / 2 - doorW / 2, oy + h - doorH, doorW, doorH)
    g.fillStyle(0xf1c40f, 0.9)
    g.fillRect(ox + w / 2 + doorW / 2 - 3, oy + h - doorH / 2, 1, 1)
    const winY = oy + roofH + 8
    drawWindow(g, ox + 8, winY, 12, 10, c.window, c.trim, s.litWindows)
    drawWindow(g, ox + w - 20, winY, 12, 10, c.window, c.trim, s.litWindows)
    if (s.floors > 1) {
      drawWindow(g, ox + 8, winY + 18, 10, 8, c.window, c.trim, s.litWindows)
      drawWindow(g, ox + w - 18, winY + 18, 10, 8, c.window, c.trim, s.litWindows)
    }
    g.fillStyle(c.trim, 1)
    g.fillRect(ox + w - 14, oy + 4, 6, 14)
  },
}
