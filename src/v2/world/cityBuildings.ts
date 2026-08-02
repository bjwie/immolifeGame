/**
 * The standing city: one persistent building per buildable lot.
 *
 * Generated once when a game starts and then carried in the save, so the city
 * is a place that changes over time rather than a backdrop regenerated on every
 * boot. Buildings gain storeys, get renovated, and slowly decay; a listing that
 * appears on a lot adopts that building's identity, so "eine Wohnung wird frei"
 * happens in a house that was already standing there.
 *
 * Pure module — no renderer imports, so the Engine can own this state.
 */
import type { CityLayout, DistrictId } from './cityLayout'
import { mulberry32 } from './cityLayout'
import type { BuildingKind } from './buildingStyle'
import { rollStyle } from './buildingStyle'

export type CityWorksKind = 'aufstockung' | 'sanierung'

export interface CityWorks {
  kind: CityWorksKind
  monthsLeft: number
}

export interface CityBuilding {
  tileX: number
  tileY: number
  district: DistrictId
  kind: BuildingKind
  /** style seed — drives palette, subtype and proportions */
  seed: number
  /** storeys above ground; grows when an Aufstockung completes */
  floors: number
  /** 0-100, drifts down with age and jumps back up after a Sanierung */
  condition: number
  /** running building works — the building is scaffolded while this lasts */
  works?: CityWorks
}

export function cityKey(tileX: number, tileY: number): string {
  return tileX + ',' + tileY
}

const KIND_INDEX: Record<BuildingKind, number> = {
  house: 0, apartment: 1, office: 2, shop: 3, tower: 4, villa: 5,
}

/** Deterministic backdrop mix per district — apartment-heavy with local flavour. */
export function pickCityKind(district: DistrictId, r: number): BuildingKind {
  const pick = (weights: Array<[BuildingKind, number]>): BuildingKind => {
    let acc = 0
    for (const [kind, w] of weights) {
      acc += w
      if (r < acc) return kind
    }
    return weights[weights.length - 1][0]
  }
  switch (district) {
    case 'mitte': return pick([['apartment', 0.45], ['office', 0.25], ['tower', 0.15], ['shop', 0.15]])
    case 'prenzlauer': return pick([['apartment', 0.6], ['shop', 0.2], ['house', 0.1], ['villa', 0.1]])
    case 'charlottenburg': return pick([['apartment', 0.45], ['villa', 0.25], ['office', 0.15], ['shop', 0.15]])
    case 'kreuzberg': return pick([['apartment', 0.6], ['shop', 0.25], ['office', 0.15]])
    case 'wedding': return pick([['apartment', 0.55], ['shop', 0.2], ['house', 0.15], ['office', 0.1]])
    case 'neukoelln': return pick([['apartment', 0.55], ['shop', 0.25], ['house', 0.2]])
    default: return pick([['apartment', 0.55], ['house', 0.25], ['shop', 0.2]])
  }
}

/** Build the standing city for a fresh game. Deterministic per lot. */
export function generateCityBuildings(layout: CityLayout): CityBuilding[] {
  const districtIndex = new Map(layout.districts.map((d, i) => [d.id, i]))
  const out: CityBuilding[] = []
  for (const spot of layout.buildableSpots) {
    const rng = mulberry32(((spot.tileX * 73856093) ^ (spot.tileY * 19349663)) >>> 0)
    const kind = pickCityKind(spot.district, rng())
    const variant = Math.floor(rng() * 3)
    const seed = (districtIndex.get(spot.district) ?? 0) * 1013 + KIND_INDEX[kind] * 211 + variant * 57
    const style = rollStyle(kind, seed, 90, spot.district)
    out.push({
      tileX: spot.tileX,
      tileY: spot.tileY,
      district: spot.district,
      kind,
      seed,
      floors: style.floors,
      condition: 55 + Math.round(rng() * 40),
    })
  }
  return out
}

export interface CityChange {
  key: string
  building: CityBuilding
  /** what just happened, for the activity log */
  note: string
}

/**
 * Advance the standing city by one month: finish running works, occasionally
 * start new ones, and let untouched buildings weather. Returns only the
 * buildings that actually changed so the renderer can patch those lots
 * instead of rebuilding the whole city.
 */
export function evolveCity(
  city: CityBuilding[],
  rng: () => number,
  districtName: (id: DistrictId) => string,
): CityChange[] {
  const changes: CityChange[] = []
  const changed = new Set<string>()
  const mark = (b: CityBuilding, note: string) => {
    const key = cityKey(b.tileX, b.tileY)
    if (changed.has(key)) return
    changed.add(key)
    changes.push({ key, building: b, note })
  }

  // 1. finish works that are due
  for (const b of city) {
    if (!b.works) continue
    b.works.monthsLeft -= 1
    if (b.works.monthsLeft > 0) continue
    if (b.works.kind === 'aufstockung') {
      b.floors += 1
      b.works = undefined
      mark(b, `Aufstockung fertig in ${districtName(b.district)} — Haus hat jetzt ${b.floors} Etagen`)
    } else {
      b.condition = Math.min(100, b.condition + 28 + Math.round(rng() * 12))
      b.works = undefined
      mark(b, `Sanierung abgeschlossen in ${districtName(b.district)}`)
    }
  }

  // 2. start something new — roughly one site every couple of months
  const idle = city.filter(b => !b.works)
  if (idle.length && rng() < 0.5) {
    const b = idle[Math.floor(rng() * idle.length)]
    // Aufstockung only where it is plausible: flat-roofed blocks that are not
    // already towering over the street.
    const canRaise = (b.kind === 'apartment' || b.kind === 'office' || b.kind === 'shop') && b.floors < 8
    if (canRaise && rng() < 0.45) {
      b.works = { kind: 'aufstockung', monthsLeft: 3 + Math.floor(rng() * 4) }
      mark(b, `Aufstockung begonnen in ${districtName(b.district)}`)
    } else if (b.condition < 70) {
      b.works = { kind: 'sanierung', monthsLeft: 2 + Math.floor(rng() * 3) }
      mark(b, `Sanierung begonnen in ${districtName(b.district)}`)
    }
  }

  // 3. weathering: a slice of the city ages a little each month.
  //    Deliberately NOT reported as a change — re-batching the whole city for a
  //    fraction of a condition point would cost more than it shows. The drift
  //    still feeds listing condition and lands visually on the next rebuild.
  const sample = Math.max(1, Math.floor(city.length * 0.05))
  for (let i = 0; i < sample; i++) {
    const b = city[Math.floor(rng() * city.length)]
    if (b.works) continue
    b.condition = Math.max(15, b.condition - rng() * 0.9)
  }

  return changes
}
