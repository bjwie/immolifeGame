import Phaser from 'phaser'
import { BakedLayer, PaintContext } from './Layer'

export const OwnedBadgeLayer: BakedLayer = {
  id: 'badge.owned',
  applies(ctx) { return ctx.ownedBadge },
  key(_ctx) { return 'ob' },
  paint(g: Phaser.GameObjects.Graphics, ctx: PaintContext, ox: number, oy: number) {
    const s = ctx.style
    const padding = 6
    const totalW = s.width + padding * 2
    const x = ox + (totalW - 16 - padding)
    const y = oy + 4
    g.fillStyle(0x000000, 0.4)
    g.fillCircle(x + 1, y + 1, 8)
    g.fillStyle(0xf1c40f, 1)
    g.fillCircle(x, y, 8)
    g.lineStyle(1.5, 0xb8870a, 1)
    g.strokeCircle(x, y, 8)
    g.fillStyle(0xfff4c8, 1)
    g.fillTriangle(x - 4, y + 2, x + 4, y + 2, x, y - 3)
    g.fillRect(x - 4, y + 2, 8, 2)
  },
}
