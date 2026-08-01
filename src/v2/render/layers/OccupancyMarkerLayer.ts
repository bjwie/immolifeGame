import Phaser from 'phaser'
import { RuntimeLayer, PaintContext } from './Layer'

const VACANT_KEY = 'ol_occ_vacant'
const NOMAD_KEY = 'ol_occ_nomad'
const VACANT_W = 26
const VACANT_H = 12
const NOMAD_W = 14
const NOMAD_H = 14

function ensureVacantTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(VACANT_KEY)) return
  const g = scene.add.graphics({ x: 0, y: 0 })
  g.fillStyle(0x000000, 0.4)
  g.fillRect(1, 1, VACANT_W - 1, VACANT_H - 1)
  g.fillStyle(0xc02040, 1)
  g.fillRect(0, 0, VACANT_W - 1, VACANT_H - 1)
  g.fillStyle(0xffffff, 1)
  g.fillRect(2, 2, VACANT_W - 5, VACANT_H - 5)
  g.fillStyle(0xc02040, 1)
  // pseudo-glyph "ZU LET" — small bars approximating text
  for (let i = 0; i < 4; i++) {
    g.fillRect(3 + i * 5, 5, 3, 2)
  }
  g.generateTexture(VACANT_KEY, VACANT_W, VACANT_H)
  g.destroy()
}

function ensureNomadTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(NOMAD_KEY)) return
  const g = scene.add.graphics({ x: 0, y: 0 })
  // shadow
  g.fillStyle(0x000000, 0.4)
  g.fillTriangle(2, 12, 12, 12, 7, 2)
  // warning triangle
  g.fillStyle(0xf2c94c, 1)
  g.fillTriangle(1, 11, 13, 11, 7, 1)
  g.lineStyle(1, 0x6b3b00, 1)
  g.beginPath()
  g.moveTo(1, 11)
  g.lineTo(13, 11)
  g.lineTo(7, 1)
  g.lineTo(1, 11)
  g.strokePath()
  // exclamation
  g.fillStyle(0x000000, 1)
  g.fillRect(6, 4, 2, 4)
  g.fillRect(6, 9, 2, 1)
  g.generateTexture(NOMAD_KEY, NOMAD_W, NOMAD_H)
  g.destroy()
}

function isVacant(ctx: PaintContext): boolean {
  const p = ctx.property
  if (!p) return false
  if (p.state !== 'owned') return false
  if (p.activeRenovation && p.activeRenovation.status === 'active') return false
  if (p.tenant) return false
  if (p.units && p.units.length > 0) {
    return p.units.every(u => !u.tenant)
  }
  return true
}

function isNomadOuted(ctx: PaintContext): boolean {
  const p = ctx.property
  if (!p) return false
  const tenants = [
    p.tenant,
    ...(p.units?.map(u => u.tenant) ?? []),
  ].filter(Boolean) as NonNullable<typeof p.tenant>[]
  return tenants.some(t => t.personality === 'nomad' && (t.monthsBehind ?? 0) >= 3)
}

export const OccupancyMarkerLayer: RuntimeLayer = {
  id: 'overlay.occupancy',
  applies(ctx: PaintContext) { return isVacant(ctx) || isNomadOuted(ctx) },
  mount(scene: Phaser.Scene, ctx: PaintContext) {
    const s = ctx.style
    const container = scene.add.container(0, 0)
    if (isVacant(ctx)) {
      ensureVacantTexture(scene)
      const img = scene.add.image(0, 0, VACANT_KEY).setOrigin(0.5, 0.5)
      img.setPosition(0, -0.85 * (s.height + 26) + 4)
      container.add(img)
    }
    if (isNomadOuted(ctx)) {
      ensureNomadTexture(scene)
      const img = scene.add.image(0, 0, NOMAD_KEY).setOrigin(0.5, 0.5)
      img.setPosition(-(s.width / 2) + 8, -12.1 - 0.85 * s.height + 14)
      container.add(img)
    }
    return container
  },
}
