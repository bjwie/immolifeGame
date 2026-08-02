/**
 * Floor plan generation for the Besichtigung.
 *
 * Real flats are not all "a corridor with N doors off it", so this produces
 * genuinely different topologies and picks one from the building's era:
 *
 *   flur       Berliner Altbau — long hallway, rooms both sides
 *   durchgang  enfilade — rooms chained into each other, barely any hall
 *   offen      open plan — one big living/kitchen, bath and bedroom boxed off
 *   kompakt    small square entry hall with rooms pinwheeled around it
 *
 * Rooms are laid out on a coarse grid so that adjacent rooms share whole
 * edges; the wall builder relies on that to dedupe shared walls and to tell
 * interior walls from the outer envelope.
 */
import type { Property } from '../sim/types'

export type Archetype = 'flur' | 'durchgang' | 'offen' | 'kompakt'

export interface PlanRoom {
  id: string
  name: string
  x0: number; z0: number; x1: number; z1: number
  floor: 'wood' | 'tile' | 'concrete'
  /** rooms you can walk to directly from here */
  kind: 'living' | 'circulation' | 'wet' | 'cellar'
}

export interface Door { a: string; b: string }

export interface Plan {
  archetype: Archetype
  rooms: PlanRoom[]
  doors: Door[]
  /** where the player starts and which way they look */
  spawn: { x: number; z: number; yaw: number }
  /** hallway/room the cellar stair leaves from */
  stairFrom: string
  cellar: PlanRoom
  stairX0: number
  stairX1: number
}

export function pickArchetype(p: Property, rng: () => number): Archetype {
  const year = p.yearBuilt
  const r = rng()
  if (year < 1930) return r < 0.55 ? 'flur' : 'durchgang'
  if (year < 1990) return r < 0.55 ? 'kompakt' : 'flur'
  return r < 0.55 ? 'offen' : 'kompakt'
}

export function buildPlan(p: Property, sqm: number, rng: () => number): Plan {
  const archetype = pickArchetype(p, rng)
  const plan =
    archetype === 'flur' ? planFlur(sqm, rng)
      : archetype === 'durchgang' ? planDurchgang(sqm, rng)
        : archetype === 'offen' ? planOffen(sqm, rng)
          : planKompakt(sqm, rng)

  // cellar hangs east of the flat, past the stair, so it never overlaps in plan
  const maxX = Math.max(...plan.rooms.map(r => r.x1))
  const stairX0 = maxX
  const stairX1 = maxX + 3.2
  const cellarD = 3.0 + rng() * 2.2
  const cellarW = 5.0 + rng() * 3.0
  const cellar: PlanRoom = {
    id: 'keller', name: 'Keller', floor: 'concrete', kind: 'cellar',
    x0: stairX1, x1: stairX1 + cellarW, z0: -cellarD, z1: cellarD,
  }
  return { ...plan, archetype, cellar, stairX0, stairX1 }
}

// ------------------------------------------------------------- archetypes

type Partial = Omit<Plan, 'archetype' | 'cellar' | 'stairX0' | 'stairX1'>

function roomSet(sqm: number, rng: () => number) {
  const out: Array<{ id: string; name: string; share: number; wet?: boolean }> = [
    { id: 'wohnen', name: 'Wohnzimmer', share: 0.30 },
    { id: 'schlaf', name: 'Schlafzimmer', share: 0.20 },
    { id: 'kueche', name: 'Kueche', share: 0.13, wet: true },
    { id: 'bad', name: 'Badezimmer', share: 0.09, wet: true },
  ]
  if (sqm > 76) out.push({ id: 'schlaf2', name: '2. Schlafzimmer', share: 0.16 })
  if (sqm > 104) out.push({ id: 'arbeit', name: 'Arbeitszimmer', share: 0.12 })
  if (sqm > 128 && rng() > 0.4) out.push({ id: 'gaeste', name: 'Gaeste-WC', share: 0.05, wet: true })
  return out
}

/** Berliner Flurwohnung: long hallway, rooms packed along both sides. */
function planFlur(sqm: number, rng: () => number): Partial {
  const specs = roomSet(sqm, rng)
  const half = 0.7 + rng() * 0.3
  const cursor = { n: 0, s: 0 }
  const depth = { n: 0, s: 0 }
  const staged: Array<{ spec: typeof specs[0]; side: 'n' | 's'; x0: number; x1: number; d: number }> = []
  for (const spec of specs.slice().sort(() => rng() - 0.5)) {
    const area = Math.max(6, sqm * spec.share * (0.85 + rng() * 0.3))
    const d = Math.max(2.7, Math.min(6.2, Math.sqrt(area) * (0.9 + rng() * 0.3)))
    const w = Math.max(2.2, Math.min(7.5, area / d))
    const side: 'n' | 's' = cursor.n <= cursor.s ? 'n' : 's'
    staged.push({ spec, side, x0: cursor[side], x1: cursor[side] + w, d })
    cursor[side] += w
    depth[side] = Math.max(depth[side], d)
  }
  const len = Math.max(cursor.n, cursor.s)
  const rooms: PlanRoom[] = [{
    id: 'flur', name: 'Flur', x0: 0, x1: len, z0: -half, z1: half,
    floor: 'wood', kind: 'circulation',
  }]
  const doors: Door[] = []
  for (const side of ['n', 's'] as const) {
    const mine = staged.filter(s => s.side === side).sort((a, b) => a.x0 - b.x0)
    if (!mine.length) continue
    mine[0].x0 = 0
    mine[mine.length - 1].x1 = len
    for (const s of mine) {
      rooms.push({
        id: s.spec.id, name: s.spec.name, x0: s.x0, x1: s.x1,
        z0: side === 'n' ? half : -half - depth[side],
        z1: side === 'n' ? half + depth[side] : -half,
        floor: s.spec.wet ? 'tile' : 'wood', kind: s.spec.wet ? 'wet' : 'living',
      })
      doors.push({ a: 'flur', b: s.spec.id })
    }
  }
  return { rooms, doors, spawn: { x: 0.8, z: 0, yaw: -Math.PI / 2 }, stairFrom: 'flur' }
}

/** Enfilade: rooms chained one into the next, the way an unmodernised Altbau
 *  actually works. There is only a stub of hallway at the front door. */
function planDurchgang(sqm: number, rng: () => number): Partial {
  const specs = roomSet(sqm, rng)
  const depth = Math.max(3.4, Math.min(6.5, Math.sqrt(sqm) * (0.62 + rng() * 0.18)))
  const rooms: PlanRoom[] = [{
    id: 'flur', name: 'Diele', x0: 0, x1: 2.2 + rng() * 0.8, z0: -depth / 2, z1: depth / 2,
    floor: 'wood', kind: 'circulation',
  }]
  const doors: Door[] = []
  let x = rooms[0].x1
  let prev = 'flur'
  // wet rooms hang off the chain rather than sitting in it
  const chain = specs.filter(s => !s.wet)
  const wet = specs.filter(s => s.wet)
  for (const spec of chain) {
    const area = Math.max(7, sqm * spec.share * (0.9 + rng() * 0.25))
    const w = Math.max(2.8, Math.min(7.5, area / depth))
    rooms.push({
      id: spec.id, name: spec.name, x0: x, x1: x + w, z0: -depth / 2, z1: depth / 2,
      floor: 'wood', kind: 'living',
    })
    doors.push({ a: prev, b: spec.id })
    prev = spec.id
    x += w
  }
  // bath and kitchen tucked behind the first room, off the north side
  let wx = rooms[1] ? rooms[1].x0 : 2.2
  for (const spec of wet) {
    const area = Math.max(5, sqm * spec.share * (0.9 + rng() * 0.2))
    const w = Math.max(2.2, Math.min(4.2, Math.sqrt(area) * 1.1))
    const d = Math.max(2.2, area / w)
    rooms.push({
      id: spec.id, name: spec.name, x0: wx, x1: wx + w,
      z0: depth / 2, z1: depth / 2 + d,
      floor: 'tile', kind: 'wet',
    })
    // reachable from whichever chain room it sits above
    const host = rooms.find(r => r.kind === 'living' && r.x0 <= wx && r.x1 >= wx + w * 0.5) ?? rooms[1] ?? rooms[0]
    doors.push({ a: host.id, b: spec.id })
    wx += w
  }
  return { rooms, doors, spawn: { x: 0.8, z: 0, yaw: -Math.PI / 2 }, stairFrom: prev }
}

/** Modern open plan: one big living/dining/kitchen, bedrooms and bath boxed
 *  into a corner block. */
function planOffen(sqm: number, rng: () => number): Partial {
  const specs = roomSet(sqm, rng)
  const privates = specs.filter(s => s.id !== 'wohnen' && s.id !== 'kueche')
  const bigW = Math.max(5.5, Math.min(9.5, Math.sqrt(sqm) * (0.85 + rng() * 0.2)))
  const bigD = Math.max(4.8, (sqm * 0.5) / bigW)
  const rooms: PlanRoom[] = [{
    id: 'wohnen', name: 'Wohn-Essbereich', x0: 0, x1: bigW, z0: -bigD / 2, z1: bigD / 2,
    floor: 'wood', kind: 'circulation',
  }]
  const doors: Door[] = []
  // the kitchen is part of the big room — modelled as a second rect with a
  // wide opening so it reads as open plan, not a separate room
  const kitchW = Math.min(3.6, bigW * 0.45)
  rooms.push({
    id: 'kueche', name: 'Kuechenzeile', x0: 0, x1: kitchW,
    z0: bigD / 2, z1: bigD / 2 + 2.9, floor: 'tile', kind: 'wet',
  })
  doors.push({ a: 'wohnen', b: 'kueche' })

  let z = -bigD / 2
  const blockX = bigW
  for (const spec of privates) {
    const area = Math.max(6, sqm * spec.share * (0.9 + rng() * 0.25))
    const w = Math.max(2.6, Math.min(5.5, Math.sqrt(area) * 1.05))
    const d = Math.max(2.4, area / w)
    rooms.push({
      id: spec.id, name: spec.name, x0: blockX, x1: blockX + w, z0: z, z1: z + d,
      floor: spec.wet ? 'tile' : 'wood', kind: spec.wet ? 'wet' : 'living',
    })
    doors.push({ a: 'wohnen', b: spec.id })
    z += d
  }
  return { rooms, doors, spawn: { x: 0.9, z: 0, yaw: -Math.PI / 2 }, stairFrom: 'wohnen' }
}

/** Plattenbau/Neubau compact: a square entry hall with rooms pinwheeled
 *  around it, which is what most postwar flats actually look like. */
function planKompakt(sqm: number, rng: () => number): Partial {
  const specs = roomSet(sqm, rng)
  const hall = 2.0 + rng() * 0.9
  const rooms: PlanRoom[] = [{
    id: 'flur', name: 'Diele', x0: 0, x1: hall, z0: -hall / 2, z1: hall / 2,
    floor: 'wood', kind: 'circulation',
  }]
  const doors: Door[] = []
  // north stack, south stack, and one room straight ahead
  const north = specs.filter((_, i) => i % 3 === 0)
  const south = specs.filter((_, i) => i % 3 === 1)
  const ahead = specs.filter((_, i) => i % 3 === 2)

  const stack = (list: typeof specs, side: 'n' | 's') => {
    let x = 0
    let maxD = 0
    for (const spec of list) {
      const area = Math.max(6, sqm * spec.share * (0.9 + rng() * 0.25))
      const d = Math.max(2.6, Math.min(5.6, Math.sqrt(area) * (0.95 + rng() * 0.2)))
      const w = Math.max(2.4, area / d)
      rooms.push({
        id: spec.id, name: spec.name, x0: x, x1: x + w,
        z0: side === 'n' ? hall / 2 : -hall / 2 - d,
        z1: side === 'n' ? hall / 2 + d : -hall / 2,
        floor: spec.wet ? 'tile' : 'wood', kind: spec.wet ? 'wet' : 'living',
      })
      doors.push({ a: 'flur', b: spec.id })
      x += w
      maxD = Math.max(maxD, d)
    }
    // square the side off
    const mine = rooms.filter(r => list.some(s => s.id === r.id))
    for (const r of mine) {
      r.z0 = side === 'n' ? hall / 2 : -hall / 2 - maxD
      r.z1 = side === 'n' ? hall / 2 + maxD : -hall / 2
    }
    return x
  }
  const nLen = stack(north, 'n')
  const sLen = stack(south, 's')
  const span = Math.max(nLen, sLen, hall)
  for (const r of rooms) {
    if (r.id === 'flur') continue
    const isN = r.z0 >= hall / 2 - 0.01
    const group = isN ? north : south
    const mine = rooms.filter(x => group.some(s => s.id === x.id)).sort((a, b) => a.x0 - b.x0)
    if (mine.length && mine[mine.length - 1].id === r.id) r.x1 = span
  }
  // the room straight ahead closes the hall
  let ax = hall
  for (const spec of ahead) {
    const area = Math.max(6, sqm * spec.share)
    const w = Math.max(2.6, Math.min(5.0, area / Math.max(2.6, hall)))
    rooms.push({
      id: spec.id, name: spec.name, x0: ax, x1: ax + w, z0: -hall / 2, z1: hall / 2,
      floor: spec.wet ? 'tile' : 'wood', kind: spec.wet ? 'wet' : 'living',
    })
    doors.push({ a: 'flur', b: spec.id })
    ax += w
  }
  return { rooms, doors, spawn: { x: 0.7, z: 0, yaw: -Math.PI / 2 }, stairFrom: 'flur' }
}
