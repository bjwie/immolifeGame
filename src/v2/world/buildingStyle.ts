/**
 * Pure building-style rolls — no renderer dependencies.
 * Extracted from the old Phaser BuildingRenderer so the Three.js facade
 * painter can reuse the exact same deterministic style system.
 */
import { mulberry32 } from './cityLayout'

export type BuildingKind = 'house' | 'apartment' | 'office' | 'shop' | 'tower' | 'villa'
export type ApartmentSubtype = 'altbau' | 'plattenbau' | 'neubau'

export interface BuildingStyle {
  kind: BuildingKind
  width: number      // 2D elevation px — the 3D scene maps px -> meters
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
  subtype?: ApartmentSubtype
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

export function rollStyle(kind: BuildingKind, seed: number, condition: number = 100, district?: string): BuildingStyle {
  const rng = mulberry32(seed)
  const palette = PALETTES[kind]
  const p = palette[Math.floor(rng() * palette.length)]
  const sizeProfile = sizeFor(kind, rng)
  const subtype = kind === 'apartment' ? rollApartmentSubtype(rng, district) : undefined
  return {
    kind,
    ...p,
    ...sizeProfile,
    condition,
    litWindows: rng() > 0.4,
    hasSign: kind === 'shop' || (kind === 'office' && rng() > 0.6),
    signColor: kind === 'shop' ? [0xc02040, 0x208844, 0x2050a8, 0xc06820][Math.floor(rng() * 4)] : 0xc02040,
    subtype,
  }
}

function rollApartmentSubtype(rng: () => number, district?: string): ApartmentSubtype {
  // District weighting: Plattenbau more likely in wedding/neukoelln,
  // Altbau more likely in prenzlauer/charlottenburg, Neubau in mitte.
  const weights: { altbau: number; plattenbau: number; neubau: number } = (() => {
    switch (district) {
      case 'prenzlauer': return { altbau: 0.65, plattenbau: 0.10, neubau: 0.25 }
      case 'charlottenburg': return { altbau: 0.55, plattenbau: 0.10, neubau: 0.35 }
      case 'mitte': return { altbau: 0.20, plattenbau: 0.10, neubau: 0.70 }
      case 'wedding': return { altbau: 0.20, plattenbau: 0.55, neubau: 0.25 }
      case 'neukoelln': return { altbau: 0.30, plattenbau: 0.45, neubau: 0.25 }
      case 'kreuzberg': return { altbau: 0.45, plattenbau: 0.25, neubau: 0.30 }
      default: return { altbau: 0.40, plattenbau: 0.30, neubau: 0.30 }
    }
  })()
  const r = rng()
  if (r < weights.altbau) return 'altbau'
  if (r < weights.altbau + weights.plattenbau) return 'plattenbau'
  return 'neubau'
}

function sizeFor(kind: BuildingKind, rng: () => number) {
  switch (kind) {
    case 'house': return { width: 56, height: 60, floors: 1 + Math.floor(rng() * 2) }
    case 'villa': return { width: 76, height: 72, floors: 2 }
    case 'apartment': return { width: 64, height: 90, floors: 3 + Math.floor(rng() * 3) }
    case 'shop': return { width: 64, height: 56, floors: 1 }
    case 'office': return { width: 64, height: 92, floors: 4 + Math.floor(rng() * 2) }
    case 'tower': return { width: 56, height: 130, floors: 7 + Math.floor(rng() * 4) }
  }
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

export function cssColor(c: number): string {
  return '#' + c.toString(16).padStart(6, '0')
}
