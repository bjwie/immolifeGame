import Phaser from 'phaser'
import { BakedLayer, PaintContext, colorsFor } from '../Layer'

export const ShopBase: BakedLayer = {
  id: 'base.shop',
  applies(ctx) { return ctx.kind === 'shop' },
  key(ctx) {
    const s = ctx.style
    return `bs:${s.width}x${s.height}:${s.floors}:${s.wallColor.toString(16)}:${s.roofColor.toString(16)}:${s.windowColor.toString(16)}:${s.trimColor.toString(16)}:${s.accentColor.toString(16)}:${s.litWindows ? 'L' : 'D'}:${s.hasSign ? 'S' + (s.signColor?.toString(16) ?? '') : 'N'}`
  },
  paint(g: Phaser.GameObjects.Graphics, ctx: PaintContext, ox: number, oy: number) {
    const s = ctx.style
    const c = colorsFor(s)
    const w = s.width, h = s.height
    g.fillStyle(c.wall, 1)
    g.fillRect(ox, oy + 18, w, h - 18)
    g.fillStyle(c.roof, 1)
    g.fillTriangle(ox - 4, oy + 22, ox + w + 4, oy + 22, ox + w / 2, oy + 8)
    g.fillStyle(0xffffff, 0.55)
    for (let i = 0; i < 4; i++) {
      const tx = ox + i * (w / 4)
      g.fillTriangle(tx, oy + 22, tx + w / 8, oy + 22, tx + w / 16, oy + 14)
    }
    const bigWin = { x: ox + 4, y: oy + 26, w: w - 8, h: 22 }
    g.fillStyle(0x101820, 1)
    g.fillRect(bigWin.x, bigWin.y, bigWin.w, bigWin.h)
    g.fillStyle(c.window, 0.85)
    g.fillRect(bigWin.x + 1, bigWin.y + 1, bigWin.w - 2, bigWin.h - 2)
    g.fillStyle(0xffffff, 0.3)
    g.fillRect(bigWin.x + 2, bigWin.y + 2, bigWin.w - 4, 3)
    g.fillStyle(c.trim, 1)
    g.fillRect(ox + w / 2 - 8, oy + h - 8, 16, 8)
    if (s.hasSign && s.signColor !== undefined) {
      g.fillStyle(s.signColor, 1)
      g.fillRect(ox + 2, oy + 2, w - 4, 8)
      g.fillStyle(0xffffff, 0.95)
      for (let i = 0; i < 5; i++) {
        g.fillRect(ox + 6 + i * 8, oy + 5, 4, 2)
      }
    }
  },
}
