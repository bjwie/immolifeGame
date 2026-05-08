import Phaser from 'phaser'
import { BakedLayer, PaintContext, mulberry32 } from './Layer'

interface DistrictSkin {
  tintColor?: number
  tintAlpha?: number
  paint(g: Phaser.GameObjects.Graphics, ctx: PaintContext, ox: number, oy: number): void
}

const SKINS: Record<string, DistrictSkin> = {
  mitte: {
    tintColor: 0xe8f0f8,
    tintAlpha: 0.10,
    paint(g, ctx, ox, oy) {
      const s = ctx.style
      const yTop = oy + bodyYOffset(s.kind)
      g.fillStyle(0x9ed4ff, 0.18)
      g.fillRect(ox + 2, yTop, s.width - 4, 2)
    },
  },
  prenzlauer: {
    tintColor: 0xf2e0c4,
    tintAlpha: 0.15,
    paint(g, ctx, ox, oy) {
      const s = ctx.style
      if (s.kind === 'apartment' || s.kind === 'house') {
        const yTop = oy + bodyYOffset(s.kind) + 4
        g.fillStyle(0xc89060, 1)
        g.fillRect(ox + s.width - 8, yTop, 4, Math.min(40, s.height - bodyYOffset(s.kind) - 8))
        g.fillStyle(0x8b3a2f, 1)
        g.fillRect(ox + s.width - 9, yTop, 6, 2)
      }
    },
  },
  kreuzberg: {
    tintColor: 0xffd066,
    tintAlpha: 0.06,
    paint(g, ctx, ox, oy) {
      const s = ctx.style
      const baseY = oy + s.height - 8
      const seedRng = mulberry32(s.width * 7 + s.height * 13 + s.kind.length)
      const tagCount = 2 + Math.floor(seedRng() * 2)
      const palette = [0xff4080, 0x40d080, 0xffaa20, 0x40a0ff]
      for (let i = 0; i < tagCount; i++) {
        const tx = ox + 4 + Math.floor(seedRng() * (s.width - 16))
        const ty = baseY - Math.floor(seedRng() * 6)
        const len = 4 + Math.floor(seedRng() * 6)
        const color = palette[Math.floor(seedRng() * palette.length)]
        g.fillStyle(color, 0.85)
        for (let k = 0; k < 3; k++) {
          g.fillRect(tx + k, ty - (k & 1), len - k, 1)
        }
      }
    },
  },
  charlottenburg: {
    tintColor: 0xfff0e0,
    tintAlpha: 0.10,
    paint(g, ctx, ox, oy) {
      const s = ctx.style
      const yTop = oy + bodyYOffset(s.kind)
      g.fillStyle(0xfff8e8, 0.85)
      g.fillRect(ox - 1, yTop - 2, s.width + 2, 2)
      g.fillStyle(0xc0a868, 1)
      for (let dx = 4; dx < s.width; dx += 8) {
        g.fillRect(ox + dx, yTop - 1, 2, 1)
      }
    },
  },
  wedding: {
    tintColor: 0x8a96a0,
    tintAlpha: 0.18,
    paint(g, ctx, ox, oy) {
      const s = ctx.style
      const yTop = oy + bodyYOffset(s.kind)
      const yBot = oy + s.height
      g.fillStyle(0x6b7480, 0.5)
      g.fillRect(ox, yBot - 4, s.width, 4)
      g.fillStyle(0x40484e, 0.4)
      g.fillRect(ox, yTop, s.width, 1)
    },
  },
  neukoelln: {
    tintColor: 0xffc080,
    tintAlpha: 0.10,
    paint(g, ctx, ox, oy) {
      const s = ctx.style
      if (s.kind === 'shop' || s.kind === 'apartment' || s.kind === 'house') {
        const yTop = oy + bodyYOffset(s.kind) + 4
        g.fillStyle(0xc04030, 0.95)
        g.fillTriangle(ox + 4, yTop + 8, ox + s.width / 2 - 4, yTop + 8, ox + s.width / 4, yTop + 1)
        g.fillStyle(0xfff0c0, 0.6)
        g.fillRect(ox + 6, yTop + 3, 4, 2)
      }
    },
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

export const DistrictSkinLayer: BakedLayer = {
  id: 'skin.district',
  applies(ctx: PaintContext) { return ctx.district !== undefined && SKINS[ctx.district] !== undefined },
  key(ctx: PaintContext) { return `ds:${ctx.district}` },
  paint(g: Phaser.GameObjects.Graphics, ctx: PaintContext, ox: number, oy: number) {
    const skin = SKINS[ctx.district!]
    if (!skin) return
    const s = ctx.style
    if (skin.tintColor !== undefined && skin.tintAlpha !== undefined) {
      const yTop = oy + bodyYOffset(s.kind)
      const bodyH = s.height - bodyYOffset(s.kind)
      g.fillStyle(skin.tintColor, skin.tintAlpha)
      g.fillRect(ox, yTop, s.width, bodyH)
    }
    skin.paint(g, ctx, ox, oy)
  },
}

export const ALL_DISTRICTS = Object.keys(SKINS)
