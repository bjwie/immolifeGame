import Phaser from 'phaser'
import { BakedLayer, PaintContext, mulberry32 } from './Layer'

export const ConditionPatinaLayer: BakedLayer = {
  id: 'patina.condition',
  applies(ctx) { return ctx.style.condition < 50 },
  key(ctx) {
    return `cp:${Math.round(ctx.style.condition / 5) * 5}:${ctx.style.kind}:${ctx.style.width}x${ctx.style.height}`
  },
  paint(g: Phaser.GameObjects.Graphics, ctx: PaintContext, ox: number, oy: number) {
    const s = ctx.style
    const condition = s.condition
    const w = s.width
    const h = s.height
    const yOffset = bodyYOffset(s.kind)
    const bodyH = h - yOffset
    const x = ox
    const y = oy + yOffset

    const intensity = Math.max(0, (50 - condition) / 50)
    g.lineStyle(1, 0x2a1810, 0.4 + intensity * 0.5)
    const cracks = Math.round(2 + intensity * 5)
    const seedRng = mulberry32(x * 31 + y * 17 + Math.floor(condition))
    for (let i = 0; i < cracks; i++) {
      const sx = x + seedRng() * w
      const sy = y + seedRng() * (bodyH * 0.7)
      g.beginPath()
      g.moveTo(sx, sy)
      let cx = sx, cy = sy
      const steps = 3 + Math.floor(seedRng() * 3)
      for (let st = 0; st < steps; st++) {
        cx += (seedRng() - 0.3) * 8
        cy += seedRng() * 6
        g.lineTo(cx, cy)
      }
      g.strokePath()
    }
    if (condition < 25) {
      g.fillStyle(0x4a3320, 0.7)
      g.fillRect(x + w * 0.2, y + bodyH * 0.3, 6, 1)
      g.fillRect(x + w * 0.6, y + bodyH * 0.5, 6, 1)
    }
  },
}

function bodyYOffset(kind: string): number {
  switch (kind) {
    case 'house': return 18
    case 'villa': return 20
    case 'apartment': return 6
    case 'shop': return 18
    case 'office': return 6
    case 'tower': return 4
    default: return 0
  }
}
