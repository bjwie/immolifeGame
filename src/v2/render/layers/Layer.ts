import Phaser from 'phaser'
import type { BuildingStyle, BuildingKind } from '../BuildingRenderer'
import type { Property } from '../../sim/types'

export interface PaintContext {
  kind: BuildingKind
  style: BuildingStyle
  condition: number
  ownedBadge: boolean
  seed: number
  subtype?: string
  district?: string
  property?: Property
}

export interface BakedLayer {
  id: string
  applies(ctx: PaintContext): boolean
  key(ctx: PaintContext): string
  paint(g: Phaser.GameObjects.Graphics, ctx: PaintContext, ox: number, oy: number): void
}

export interface RuntimeLayer {
  id: string
  applies(ctx: PaintContext): boolean
  mount(scene: Phaser.Scene, ctx: PaintContext): Phaser.GameObjects.GameObject
}

export function mixColor(a: number, b: number, t: number): number {
  t = Math.max(0, Math.min(1, t))
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return (r << 16) | (g << 8) | bl
}

export function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const DAMAGE_TINT = 0x3a2820

export function drawWindow(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number,
  color: number, trim: number, lit: boolean,
) {
  g.fillStyle(trim, 1)
  g.fillRect(x - 1, y - 1, w + 2, h + 2)
  g.fillStyle(lit ? color : mixColor(color, 0x101830, 0.55), 1)
  g.fillRect(x, y, w, h)
  g.fillStyle(trim, 0.7)
  g.fillRect(x + Math.floor(w / 2), y, 1, h)
  g.fillRect(x, y + Math.floor(h / 2), w, 1)
  g.fillStyle(0xffffff, lit ? 0.55 : 0.18)
  g.fillRect(x + 1, y + 1, Math.max(2, Math.floor(w / 3)), 1)
}

export interface PaintColors {
  wall: number
  roof: number
  trim: number
  accent: number
  window: number
}

export function colorsFor(s: BuildingStyle): PaintColors {
  return {
    wall: s.wallColor,
    roof: s.roofColor,
    trim: s.trimColor,
    accent: s.accentColor,
    window: s.windowColor,
  }
}
