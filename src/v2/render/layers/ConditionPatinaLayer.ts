import Phaser from 'phaser'
import { RuntimeLayer, PaintContext, mulberry32 } from './Layer'

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

function textureKeyFor(ctx: PaintContext): string {
  const s = ctx.style
  const bucket = Math.round(s.condition / 5) * 5
  return `ol_patina_${s.kind}_${s.width}x${s.height}_${bucket}`
}

function ensureTexture(scene: Phaser.Scene, ctx: PaintContext, key: string) {
  if (scene.textures.exists(key)) return
  const s = ctx.style
  const padding = 6
  const totalW = s.width + padding * 2
  const totalH = s.height + padding * 2 + 14
  const yOffset = bodyYOffset(s.kind)
  const bodyH = s.height - yOffset
  const x = padding
  const y = padding + yOffset

  const g = scene.add.graphics({ x: 0, y: 0 })

  const condFactor = Math.max(0.4, s.condition / 100)
  const tintAlpha = Math.min(0.6, (1 - condFactor))
  if (tintAlpha > 0.01) {
    g.fillStyle(0x3a2820, tintAlpha)
    g.fillRect(x, y, s.width, bodyH)
    if (yOffset > 0) {
      g.fillStyle(0x3a2820, tintAlpha * 0.85)
      g.fillRect(x - 2, padding, s.width + 4, yOffset)
    }
  }

  if (s.condition < 30) {
    g.fillStyle(0x102030, 0.35)
    g.fillRect(x, y, s.width, bodyH)
  }

  if (s.condition < 50) {
    const intensity = Math.max(0, (50 - s.condition) / 50)
    g.lineStyle(1, 0x2a1810, 0.4 + intensity * 0.5)
    const cracks = Math.round(2 + intensity * 5)
    const seedRng = mulberry32(x * 31 + y * 17 + Math.floor(s.condition))
    for (let i = 0; i < cracks; i++) {
      const sx = x + seedRng() * s.width
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
  }

  if (s.condition < 25) {
    g.fillStyle(0x4a3320, 0.7)
    g.fillRect(x + s.width * 0.2, y + bodyH * 0.3, 6, 1)
    g.fillRect(x + s.width * 0.6, y + bodyH * 0.5, 6, 1)
  }

  g.generateTexture(key, totalW, totalH)
  g.destroy()
}

export const ConditionPatinaLayer: RuntimeLayer = {
  id: 'patina.condition',
  applies(ctx) { return ctx.style.condition < 95 },
  mount(scene: Phaser.Scene, ctx: PaintContext) {
    const key = textureKeyFor(ctx)
    ensureTexture(scene, ctx, key)
    const img = scene.add.image(0, 0, key).setOrigin(0.5, 0.85)
    return img
  },
}
