import Phaser from 'phaser'
import { RuntimeLayer, PaintContext } from './Layer'

const TEXTURE_PREFIX = 'ol_scaffold_'

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

function ensureTexture(scene: Phaser.Scene, ctx: PaintContext, key: string) {
  if (scene.textures.exists(key)) return
  const s = ctx.style
  const padding = 6
  const totalW = s.width + padding * 2
  const totalH = s.height + padding * 2 + 14
  const yOffset = bodyYOffset(s.kind)
  const yTop = padding + yOffset
  const yBot = padding + s.height
  const x = padding

  const g = scene.add.graphics({ x: 0, y: 0 })
  // Outer scaffold: vertical poles along left edge + horizontal cross-beams
  const poleColor = 0xf2c94c
  const railColor = 0xc89020
  const tarpColor = 0xb0b0b0

  // Construction tarp behind scaffold, semi-transparent
  g.fillStyle(tarpColor, 0.25)
  g.fillRect(x - 1, yTop, 8, s.height - yOffset)

  // Vertical poles
  g.fillStyle(poleColor, 1)
  g.fillRect(x - 1, yTop, 2, s.height - yOffset)
  g.fillRect(x + 5, yTop, 2, s.height - yOffset)

  // Horizontal cross-beams every 14px
  g.fillStyle(railColor, 1)
  for (let py = yTop + 6; py < yBot; py += 14) {
    g.fillRect(x - 1, py, 8, 1)
  }

  // Diagonal struts
  g.lineStyle(1, railColor, 0.8)
  for (let py = yTop; py < yBot - 14; py += 28) {
    g.beginPath()
    g.moveTo(x - 1, py)
    g.lineTo(x + 7, py + 14)
    g.strokePath()
  }

  // Small crane cap at top-right of building
  const craneX = x + s.width - 6
  const craneY = padding - 2
  g.fillStyle(0x303030, 1)
  g.fillRect(craneX, craneY, 2, 8)
  g.fillStyle(poleColor, 1)
  g.fillRect(craneX - 8, craneY, 14, 1)
  g.fillRect(craneX + 6, craneY + 1, 1, 3)

  g.generateTexture(key, totalW, totalH)
  g.destroy()
}

export const RenovationScaffoldLayer: RuntimeLayer = {
  id: 'overlay.scaffold',
  applies(ctx: PaintContext) {
    const p = ctx.property
    return !!p?.activeRenovation && p.activeRenovation.status === 'active'
  },
  mount(scene: Phaser.Scene, ctx: PaintContext) {
    const s = ctx.style
    const key = `${TEXTURE_PREFIX}${s.kind}_${s.width}x${s.height}`
    ensureTexture(scene, ctx, key)
    return scene.add.image(0, 0, key).setOrigin(0.5, 0.85)
  },
}
