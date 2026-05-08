import Phaser from 'phaser'
import { BakedLayer, RuntimeLayer, PaintContext, mulberry32 } from './layers/Layer'
import { HouseBase } from './layers/base/HouseBase'
import { VillaBase } from './layers/base/VillaBase'
import { ApartmentBase } from './layers/base/ApartmentBase'
import { ShopBase } from './layers/base/ShopBase'
import { OfficeBase } from './layers/base/OfficeBase'
import { TowerBase } from './layers/base/TowerBase'
import { ConditionPatinaLayer } from './layers/ConditionPatinaLayer'
import { OwnedBadgeLayer } from './layers/OwnedBadgeLayer'
import { DistrictSkinLayer } from './layers/DistrictSkinLayer'
import { RenovationScaffoldLayer } from './layers/RenovationScaffoldLayer'
import { OccupancyMarkerLayer } from './layers/OccupancyMarkerLayer'
import type { Property } from '../sim/types'

export type BuildingKind = 'house' | 'apartment' | 'office' | 'shop' | 'tower' | 'villa'

export interface BuildingStyle {
  kind: BuildingKind
  width: number
  height: number
  floors: number
  wallColor: number
  roofColor: number
  windowColor: number
  trimColor: number
  accentColor: number
  condition: number
  litWindows: boolean
  hasSign: boolean
  signColor?: number
}

const PALETTES: Record<BuildingKind, Array<Omit<BuildingStyle, 'kind' | 'width' | 'height' | 'floors' | 'condition' | 'litWindows' | 'hasSign' | 'signColor'>>> = {
  house: [
    { wallColor: 0xf2d7b6, roofColor: 0x8b3a2f, windowColor: 0x6ec6ff, trimColor: 0x5a3825, accentColor: 0x3d2418 },
    { wallColor: 0xe5c79a, roofColor: 0x6b2c20, windowColor: 0xfff3a6, trimColor: 0x4a3320, accentColor: 0x2a1810 },
    { wallColor: 0xfff1d6, roofColor: 0x4f7942, windowColor: 0x88d8ff, trimColor: 0x3a2f1c, accentColor: 0x1f1810 },
  ],
  apartment: [
    { wallColor: 0xc5b89a, roofColor: 0x4a4a4a, windowColor: 0xffd866, trimColor: 0x3a3a3a, accentColor: 0xa08562 },
    { wallColor: 0xd4c0a0, roofColor: 0x5a4a3a, windowColor: 0x88c8ff, trimColor: 0x6b5440, accentColor: 0xa48868 },
    { wallColor: 0xb89c7d, roofColor: 0x3d3530, windowColor: 0xffd84d, trimColor: 0x2c241e, accentColor: 0x8a6f54 },
  ],
  office: [
    { wallColor: 0x9aa6b0, roofColor: 0x5a6573, windowColor: 0x4eb4e0, trimColor: 0x3d4854, accentColor: 0x6e7a86 },
    { wallColor: 0xb0bcc8, roofColor: 0x6e7886, windowColor: 0x76d0f0, trimColor: 0x4a5460, accentColor: 0x8290a0 },
  ],
  shop: [
    { wallColor: 0xe8d5a0, roofColor: 0xa84020, windowColor: 0xffe888, trimColor: 0x6e3015, accentColor: 0xc05030 },
    { wallColor: 0xfff0c8, roofColor: 0x208860, windowColor: 0xffd24d, trimColor: 0x166040, accentColor: 0x2aa080 },
    { wallColor: 0xddc8a8, roofColor: 0x4060a8, windowColor: 0xfff088, trimColor: 0x2c4470, accentColor: 0x5070b8 },
  ],
  tower: [
    { wallColor: 0x4a5a72, roofColor: 0x2a3848, windowColor: 0x8acff0, trimColor: 0x1a2330, accentColor: 0x60708a },
    { wallColor: 0x6c7a8a, roofColor: 0x3a4858, windowColor: 0x9adcf2, trimColor: 0x222a36, accentColor: 0x88a0b8 },
  ],
  villa: [
    { wallColor: 0xfff6e0, roofColor: 0x9a3020, windowColor: 0x88d4f8, trimColor: 0x5a3424, accentColor: 0xc89060 },
    { wallColor: 0xf0e4c8, roofColor: 0x6a4a2a, windowColor: 0xffeea4, trimColor: 0x4a3320, accentColor: 0xb88660 },
  ],
}

const BAKED_PIPELINE: BakedLayer[] = [
  HouseBase, VillaBase, ApartmentBase, ShopBase, OfficeBase, TowerBase,
  DistrictSkinLayer,
]

const RUNTIME_LAYERS: RuntimeLayer[] = [
  ConditionPatinaLayer,
  RenovationScaffoldLayer,
  OccupancyMarkerLayer,
  OwnedBadgeLayer,
]

const RUNTIME_LAYER_TAG = '_layerId'

export class BuildingRenderer {
  private static textureCache = new Map<string, true>()
  private static MAX_CACHE = 500

  static preloadAssets(scene: Phaser.Scene) {
    scene.load.on('loaderror', (file: any) => {
      if (typeof file?.key === 'string' && file.key.startsWith('asset_')) {
        // silently skip; the procedural fallback handles missing assets
      }
    })
    const kinds: BuildingKind[] = ['house', 'villa', 'apartment', 'shop', 'office', 'tower']
    for (const kind of kinds) {
      for (let i = 1; i <= 4; i++) {
        const num = String(i).padStart(2, '0')
        const key = `asset_${kind}_${i - 1}`
        if (!scene.textures.exists(key)) {
          scene.load.image(key, `assets/v2/buildings/${kind}_${num}.png`)
        }
      }
    }
  }

  private static externalAssetKey(scene: Phaser.Scene, kind: BuildingKind, seed: number): string | null {
    for (let i = 0; i < 4; i++) {
      const idx = (seed + i) & 3
      const key = `asset_${kind}_${idx}`
      if (scene.textures.exists(key)) return key
    }
    return null
  }

  static rollStyle(kind: BuildingKind, seed: number, condition: number = 100): BuildingStyle {
    const rng = mulberry32(seed)
    const palette = PALETTES[kind]
    const p = palette[Math.floor(rng() * palette.length)]
    const sizeProfile = this.sizeFor(kind, rng)
    return {
      kind,
      ...p,
      ...sizeProfile,
      condition,
      litWindows: rng() > 0.4,
      hasSign: kind === 'shop' || (kind === 'office' && rng() > 0.6),
      signColor: kind === 'shop' ? [0xc02040, 0x208844, 0x2050a8, 0xc06820][Math.floor(rng() * 4)] : 0xc02040,
    }
  }

  private static sizeFor(kind: BuildingKind, rng: () => number) {
    switch (kind) {
      case 'house': return { width: 56, height: 60, floors: 1 + Math.floor(rng() * 2) }
      case 'villa': return { width: 76, height: 72, floors: 2 }
      case 'apartment': return { width: 64, height: 90, floors: 3 + Math.floor(rng() * 3) }
      case 'shop': return { width: 64, height: 56, floors: 1 }
      case 'office': return { width: 64, height: 92, floors: 4 + Math.floor(rng() * 2) }
      case 'tower': return { width: 56, height: 130, floors: 7 + Math.floor(rng() * 4) }
    }
  }

  static textureKey(style: BuildingStyle, district?: string): string {
    const ctx: PaintContext = {
      kind: style.kind,
      style,
      condition: style.condition,
      ownedBadge: false,
      seed: 0,
      district,
    }
    const parts: string[] = []
    for (const layer of BAKED_PIPELINE) {
      if (layer.applies(ctx)) parts.push(layer.key(ctx))
    }
    return parts.join('|')
  }

  static ensureTexture(scene: Phaser.Scene, style: BuildingStyle, seed?: number, district?: string): string {
    if (typeof seed === 'number') {
      const assetKey = this.externalAssetKey(scene, style.kind, seed)
      if (assetKey) return assetKey
    }

    const key = this.textureKey(style, district)
    if (this.textureCache.has(key) && scene.textures.exists(key)) {
      this.textureCache.delete(key)
      this.textureCache.set(key, true)
      return key
    }

    const padding = 6
    const totalW = style.width + padding * 2
    const totalH = style.height + padding * 2 + 14
    const g = scene.add.graphics({ x: 0, y: 0 })

    this.drawShadow(g, padding + style.width / 2, padding + style.height + 6, style.width * 0.55)

    const ctx: PaintContext = {
      kind: style.kind,
      style,
      condition: style.condition,
      ownedBadge: false,
      seed: seed ?? 0,
      district,
    }
    for (const layer of BAKED_PIPELINE) {
      if (layer.applies(ctx)) layer.paint(g, ctx, padding, padding)
    }

    g.generateTexture(key, totalW, totalH)
    g.destroy()
    this.textureCache.set(key, true)

    while (this.textureCache.size > this.MAX_CACHE) {
      const oldest = this.textureCache.keys().next().value
      if (!oldest) break
      this.textureCache.delete(oldest)
      if (scene.textures.exists(oldest)) scene.textures.remove(oldest)
    }
    return key
  }

  /** Mount runtime overlay sprites (badge, patina, etc.) into the property container.
   *  Idempotent — always clears existing runtime overlays before re-mounting.
   *  Insert position: index 1 (just above the base sprite). */
  static applyRuntimeOverlays(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    style: BuildingStyle,
    isOwned: boolean,
    seed?: number,
    district?: string,
    property?: Property,
  ): void {
    const existing = container.list.filter(
      (o: any) => o[RUNTIME_LAYER_TAG] !== undefined,
    )
    for (const o of existing) o.destroy()

    const ctx: PaintContext = {
      kind: style.kind,
      style,
      condition: style.condition,
      ownedBadge: isOwned,
      seed: seed ?? 0,
      district,
      property,
    }
    let insertAt = 1
    for (const layer of RUNTIME_LAYERS) {
      if (!layer.applies(ctx)) continue
      const obj = layer.mount(scene, ctx)
      ;(obj as any)[RUNTIME_LAYER_TAG] = layer.id
      container.addAt(obj, insertAt)
      insertAt++
    }
  }

  private static drawShadow(g: Phaser.GameObjects.Graphics, cx: number, cy: number, radius: number) {
    g.fillStyle(0x000000, 0.25)
    g.fillEllipse(cx, cy, radius * 2, radius * 0.55)
  }
}
