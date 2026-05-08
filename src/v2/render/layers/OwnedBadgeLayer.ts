import Phaser from 'phaser'
import { RuntimeLayer, PaintContext } from './Layer'

const TEXTURE_KEY = 'ol_owned_badge'
const W = 18
const H = 14

function ensureTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(TEXTURE_KEY)) return
  const g = scene.add.graphics({ x: 0, y: 0 })
  const x = 9, y = 8
  g.fillStyle(0x000000, 0.4)
  g.fillCircle(x + 1, y + 1, 8)
  g.fillStyle(0xf1c40f, 1)
  g.fillCircle(x, y, 8)
  g.lineStyle(1.5, 0xb8870a, 1)
  g.strokeCircle(x, y, 8)
  g.fillStyle(0xfff4c8, 1)
  g.fillTriangle(x - 4, y + 2, x + 4, y + 2, x, y - 3)
  g.fillRect(x - 4, y + 2, 8, 2)
  g.generateTexture(TEXTURE_KEY, W, H)
  g.destroy()
}

export const OwnedBadgeLayer: RuntimeLayer = {
  id: 'badge.owned',
  applies(ctx) { return ctx.ownedBadge },
  mount(scene: Phaser.Scene, ctx: PaintContext) {
    ensureTexture(scene)
    const s = ctx.style
    const img = scene.add.image(0, 0, TEXTURE_KEY).setOrigin(0.5, 0.5)
    img.setPosition(s.width / 2 - 10, -12.1 - 0.85 * s.height)
    return img
  },
}
