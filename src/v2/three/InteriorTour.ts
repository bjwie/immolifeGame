/**
 * Besichtigung: a walkable interior for a property — hallway, rooms, bathroom,
 * kitchen and a cellar down the stairs — with the building's defects visible
 * where a surveyor would find them.
 *
 * This is its own THREE.Scene, so while you are inside, none of the city is
 * rendered at all: it is a separate level, not a room hidden in the street.
 *
 * The floor plan is generated per property from its size and style seed, so two
 * flats are never the same. The flat and the cellar never overlap in plan (the
 * cellar sits east, past the stair), which lets the same flat 2D collision the
 * street uses work here and makes the floor height a pure function of x.
 */
import * as THREE from 'three'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import type { Property } from '../sim/types'
import { mulberry32 } from '../world/cityLayout'
import { formatEuro } from '../sim/Engine'

export interface TourCollider { minX: number; maxX: number; minZ: number; maxZ: number }

const WALL_T = 0.16
const CELLAR_Y = -3.0
const DOOR_H = 2.05
const WIN_Y0 = 0.92
const WIN_Y1 = 2.28

type Span = [number, number]

interface PlanRoom {
  id: string
  name: string
  x0: number; z0: number; x1: number; z1: number
  floor: 'wood' | 'tile' | 'concrete'
  side: 'n' | 's' | 'corridor' | 'cellar'
  /** door opening on the corridor wall, in x */
  doorFrom?: number
  doorTo?: number
}

export interface Defect {
  room: string
  label: string
  detail: string
  cost: number
  severity: 'warn' | 'bad'
  u: number; v: number; y: number
}

interface RoomSpec {
  id: string
  name: string
  share: number
  floor: 'wood' | 'tile'
  minW: number
}

export class InteriorTour {
  readonly scene = new THREE.Scene()
  readonly colliders: TourCollider[] = []
  readonly defects: Defect[] = []
  readonly spawn = { x: 0.9, z: 0, yaw: -Math.PI / 2 }
  readonly property: Property
  /** metres of usable floor area the plan was built for */
  readonly sqm: number
  readonly roomCount: number

  private rooms: PlanRoom[] = []
  private corridor!: PlanRoom
  private cellar!: PlanRoom
  private stairX0 = 12
  private stairX1 = 15.2
  private wallH = 2.8
  private disposables: Array<{ dispose(): void }> = []
  private labelEls: HTMLElement[] = []
  private labelAnchors: Array<{ el: HTMLElement; x: number; z: number }> = []

  constructor(property: Property) {
    this.property = property
    const rng = mulberry32(((property.styleSeed ?? 1) * 2654435761) >>> 0)

    // Altbau ceilings are high, Plattenbau squat — read it off the build year.
    this.wallH = property.yearBuilt < 1930 ? 3.25 : property.yearBuilt < 1975 ? 2.7 : 2.55
    this.sqm = this.livingArea()
    this.buildPlan(rng)
    this.roomCount = this.rooms.filter(r => r.side === 'n' || r.side === 's').length

    this.scene.background = new THREE.Color(0x0f1216)
    this.buildShell()
    this.buildStair()
    this.furnish(rng)
    this.collectDefects(property.condition, rng)
    this.placeDefectMarkers()
    this.light()
  }

  floorAt(x: number): number {
    if (x <= this.stairX0) return 0
    if (x >= this.stairX1) return CELLAR_Y
    return ((x - this.stairX0) / (this.stairX1 - this.stairX0)) * CELLAR_Y
  }

  roomAt(x: number, z: number): string | null {
    for (const r of this.rooms) {
      if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r.name
    }
    if (x > this.stairX0 && x < this.stairX1) return 'Kellertreppe'
    return null
  }

  // ------------------------------------------------------------ floor plan

  private livingArea(): number {
    const p = this.property
    const unit = p.units?.[0]
    if (unit?.sqm) return unit.sqm
    // fall back to something plausible from the rent
    return Math.max(38, Math.min(180, Math.round(p.baseRent / 11)))
  }

  /** Lay rooms out along a central hallway, alternating sides and packing by
   *  area. Bigger flats get more rooms, so no two plans look alike. */
  private buildPlan(rng: () => number) {
    const sqm = this.sqm
    const specs: RoomSpec[] = [
      { id: 'wohnen', name: 'Wohnzimmer', share: 0.30, floor: 'wood', minW: 3.4 },
      { id: 'schlaf', name: 'Schlafzimmer', share: 0.19, floor: 'wood', minW: 3.0 },
      { id: 'kueche', name: 'Kueche', share: 0.13, floor: 'tile', minW: 2.6 },
      { id: 'bad', name: 'Badezimmer', share: 0.09, floor: 'tile', minW: 2.2 },
    ]
    if (sqm > 78) specs.push({ id: 'schlaf2', name: '2. Schlafzimmer', share: 0.15, floor: 'wood', minW: 2.8 })
    if (sqm > 105) specs.push({ id: 'arbeit', name: 'Arbeitszimmer', share: 0.12, floor: 'wood', minW: 2.6 })
    if (sqm > 120) specs.push({ id: 'gaeste', name: 'Gaeste-WC', share: 0.05, floor: 'tile', minW: 1.8 })

    const halfWidth = 0.7 + rng() * 0.35           // corridor half-width
    const cursor = { n: 0.25 + rng() * 0.4, s: 0.25 + rng() * 0.4 }
    const rooms: PlanRoom[] = []

    // Shuffle a little so the same size doesn't always land in the same order
    const order = specs.slice().sort(() => rng() - 0.5)

    for (const spec of order) {
      const area = Math.max(5.5, sqm * spec.share * (0.85 + rng() * 0.3))
      let depth = Math.max(2.6, Math.min(6.4, Math.sqrt(area) * (0.9 + rng() * 0.35)))
      let width = Math.max(spec.minW, area / depth)
      if (width > 7.5) { width = 7.5; depth = Math.min(6.4, area / width) }
      const side: 'n' | 's' = cursor.n <= cursor.s ? 'n' : 's'
      const x0 = cursor[side]
      const x1 = x0 + width
      cursor[side] = x1 + 0.35 + rng() * 0.5      // party wall between rooms
      const z0 = side === 'n' ? halfWidth : -halfWidth - depth
      const z1 = side === 'n' ? halfWidth + depth : -halfWidth
      const doorC = x0 + width * (0.3 + rng() * 0.4)
      rooms.push({
        id: spec.id, name: spec.name, x0, z0, x1, z1, floor: spec.floor, side,
        doorFrom: doorC - 0.55, doorTo: doorC + 0.55,
      })
    }

    const corridorLen = Math.max(cursor.n, cursor.s) + 0.4
    this.corridor = {
      id: 'flur', name: 'Flur', x0: 0, z0: -halfWidth, x1: corridorLen, z1: halfWidth,
      floor: 'wood', side: 'corridor',
    }
    this.stairX0 = corridorLen
    this.stairX1 = corridorLen + 3.2

    const cellarD = 3.0 + rng() * 2.2
    const cellarW = 5.0 + rng() * 3.0
    this.cellar = {
      id: 'keller', name: 'Keller', floor: 'concrete', side: 'cellar',
      x0: this.stairX1, x1: this.stairX1 + cellarW, z0: -cellarD, z1: cellarD,
    }

    this.rooms = [this.corridor, ...rooms, this.cellar]
    this.spawn.x = 0.85
    this.spawn.z = 0
    this.spawn.yaw = -Math.PI / 2
  }

  private room(id: string): PlanRoom | undefined { return this.rooms.find(r => r.id === id) }

  // ------------------------------------------------------------- geometry

  private mat(color: number, roughness = 0.9, metalness = 0) {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness })
    this.disposables.push(m)
    return m
  }

  private addBox(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) {
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(x, y, z)
    this.scene.add(mesh)
    this.disposables.push(geo)
    return mesh
  }

  /**
   * A wall with openings. Each opening removes a span from the wall and then
   * fills the part above (and, for windows, below) it, so a window is a real
   * hole with a sill and a lintel rather than a pane stuck onto the plaster.
   */
  private wallRun(
    axis: 'x' | 'z', fixed: number, a0: number, a1: number,
    opts: { doors?: Span[]; windows?: Span[]; y?: number; h?: number } = {},
  ) {
    const mat = this.wallMat()
    const y = opts.y ?? 0
    const h = opts.h ?? this.wallH
    const doors = opts.doors ?? []
    const windows = opts.windows ?? []
    const all = [...doors, ...windows].slice().sort((p, q) => p[0] - q[0])

    const put = (from: number, to: number, yFrom: number, yTo: number, solid: boolean) => {
      if (to - from < 0.02 || yTo - yFrom < 0.02) return
      const geo = axis === 'x'
        ? new THREE.BoxGeometry(to - from, yTo - yFrom, WALL_T)
        : new THREE.BoxGeometry(WALL_T, yTo - yFrom, to - from)
      const cx = axis === 'x' ? (from + to) / 2 : fixed
      const cz = axis === 'x' ? fixed : (from + to) / 2
      this.addBox(geo, mat, cx, (yFrom + yTo) / 2, cz)
      if (!solid) return
      if (axis === 'x') this.colliders.push({ minX: from, maxX: to, minZ: fixed - WALL_T / 2, maxZ: fixed + WALL_T / 2 })
      else this.colliders.push({ minX: fixed - WALL_T / 2, maxX: fixed + WALL_T / 2, minZ: from, maxZ: to })
    }

    // full-height stretches between openings
    let cursor = a0
    for (const [os, oe] of all) {
      if (os > cursor) put(cursor, os, y, y + h, true)
      cursor = Math.max(cursor, oe)
    }
    if (cursor < a1) put(cursor, a1, y, y + h, true)

    // lintels over doors
    for (const [os, oe] of doors) put(os, oe, y + DOOR_H, y + h, false)
    // sill + lintel around windows, and the glazing itself
    for (const [os, oe] of windows) {
      put(os, oe, y, y + WIN_Y0, true)
      put(os, oe, y + WIN_Y1, y + h, false)
      this.glaze(axis, fixed, os, oe, y)
    }
  }

  private wallX(z: number, x0: number, x1: number, doors: Span[] = [], y = 0, h = this.wallH) {
    this.wallRun('x', z, x0, x1, { doors, y, h })
  }

  private wallZ(x: number, z0: number, z1: number, doors: Span[] = [], y = 0, h = this.wallH) {
    this.wallRun('z', x, z0, z1, { doors, y, h })
  }

  /** Glass, frame and outside daylight filling a window opening. */
  private glaze(axis: 'x' | 'z', fixed: number, from: number, to: number, y: number) {
    const w = to - from
    const hh = WIN_Y1 - WIN_Y0
    const cx = axis === 'x' ? (from + to) / 2 : fixed
    const cz = axis === 'x' ? fixed : (from + to) / 2
    const yc = y + (WIN_Y0 + WIN_Y1) / 2

    const glass = this.glassMat()
    const frame = this.frameMat()
    const box = (bw: number, bh: number, bd: number, ox: number, oy: number, oz: number) =>
      this.addBox(new THREE.BoxGeometry(bw, bh, bd), frame, cx + ox, yc + oy, cz + oz)

    if (axis === 'x') {
      this.addBox(new THREE.BoxGeometry(w - 0.12, hh - 0.12, 0.04), glass, cx, yc, cz)
      box(w, 0.09, 0.14, 0, hh / 2 - 0.04, 0)
      box(w, 0.09, 0.14, 0, -hh / 2 + 0.04, 0)
      box(0.09, hh, 0.14, -w / 2 + 0.04, 0, 0)
      box(0.09, hh, 0.14, w / 2 - 0.04, 0, 0)
      box(0.07, hh, 0.1, 0, 0, 0)               // mullion
      // sill board inside
      this.addBox(new THREE.BoxGeometry(w + 0.16, 0.06, 0.26), frame, cx, y + WIN_Y0 + 0.03, cz + (fixed > 0 ? -0.16 : 0.16))
    } else {
      this.addBox(new THREE.BoxGeometry(0.04, hh - 0.12, w - 0.12), glass, cx, yc, cz)
      box(0.14, 0.09, w, 0, hh / 2 - 0.04, 0)
      box(0.14, 0.09, w, 0, -hh / 2 + 0.04, 0)
      box(0.14, hh, 0.09, 0, 0, -w / 2 + 0.04)
      box(0.14, hh, 0.09, 0, 0, w / 2 - 0.04)
      box(0.1, hh, 0.07, 0, 0, 0)
      this.addBox(new THREE.BoxGeometry(0.26, 0.06, w + 0.16), frame, cx - 0.16, y + WIN_Y0 + 0.03, cz)
    }
  }

  private _glassMat: THREE.MeshStandardMaterial | null = null
  private glassMat() {
    if (!this._glassMat) {
      this._glassMat = new THREE.MeshStandardMaterial({
        color: 0xdff0ff, emissive: 0xcfe6fb, emissiveIntensity: 2.2, roughness: 0.08, metalness: 0.1,
      })
      this.disposables.push(this._glassMat)
    }
    return this._glassMat
  }

  private _frameMat: THREE.MeshStandardMaterial | null = null
  private frameMat() {
    if (!this._frameMat) this._frameMat = this.mat(0xf6f4ee, 0.55)
    return this._frameMat
  }

  private _wallMat: THREE.MeshStandardMaterial | null = null
  private wallMat() {
    if (!this._wallMat) this._wallMat = this.mat(0xe6e1d8, 0.95)
    return this._wallMat
  }

  private buildShell() {
    const woodMat = this.mat(0x8a6240, 0.85)
    const tileMat = this.mat(0xd8dbd8, 0.6)
    const concreteMat = this.mat(0x6e6f6b, 0.98)
    const ceilMat = this.mat(0xf2efe8, 0.95)

    for (const r of this.rooms) {
      const w = r.x1 - r.x0, d = r.z1 - r.z0
      const y = r.side === 'cellar' ? CELLAR_Y : 0
      const h = r.side === 'cellar' ? 2.3 : this.wallH
      const mat = r.floor === 'wood' ? woodMat : r.floor === 'tile' ? tileMat : concreteMat
      const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), mat)
      floor.position.set((r.x0 + r.x1) / 2, y - 0.06, (r.z0 + r.z1) / 2)
      this.scene.add(floor)
      this.disposables.push(floor.geometry)
      const ceil = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), ceilMat)
      ceil.position.set((r.x0 + r.x1) / 2, y + h, (r.z0 + r.z1) / 2)
      this.scene.add(ceil)
      this.disposables.push(ceil.geometry)
    }

    // corridor walls, with a doorway per room on the matching side
    const nGaps: Array<[number, number]> = []
    const sGaps: Array<[number, number]> = []
    for (const r of this.rooms) {
      if (r.doorFrom === undefined || r.doorTo === undefined) continue
      ;(r.side === 'n' ? nGaps : sGaps).push([r.doorFrom, r.doorTo])
    }
    const c = this.corridor
    this.wallX(c.z1, 0, c.x1, nGaps)
    this.wallX(c.z0, 0, c.x1, sGaps)
    this.wallZ(0, c.z0, c.z1, [[-0.55, 0.55]])           // Wohnungstuer
    this.wallZ(c.x1, c.z0, c.z1, [[-0.6, 0.6]])          // through to the stair

    // each room's own three outer walls — the far one carries the window
    for (const r of this.rooms) {
      if (r.side !== 'n' && r.side !== 's') continue
      this.wallZ(r.x0, r.z0, r.z1)
      this.wallZ(r.x1, r.z0, r.z1)
      const span = r.x1 - r.x0
      const winW = Math.max(0.7, Math.min(2.3, span * 0.5))
      const cxw = (r.x0 + r.x1) / 2
      this.wallRun('x', r.side === 'n' ? r.z1 : r.z0, r.x0, r.x1, {
        windows: [[cxw - winW / 2, cxw + winW / 2]],
      })
    }

    // cellar box
    const k = this.cellar
    this.wallZ(k.x0, k.z0, k.z1, [[-1.0, 1.0]], CELLAR_Y, 2.3)
    this.wallZ(k.x1, k.z0, k.z1, [], CELLAR_Y, 2.3)
    this.wallX(k.z0, k.x0, k.x1, [], CELLAR_Y, 2.3)
    this.wallX(k.z1, k.x0, k.x1, [], CELLAR_Y, 2.3)

    // cellar light wells, so it is not a sealed box
    this.wallRun('x', k.z0, k.x0, k.x1, {
      windows: [[k.x0 + 1.2, k.x0 + 2.0]], y: CELLAR_Y, h: 2.3,
    })

    // skirting boards along every room — cheap, and the interior reads far
    // less like untextured cardboard with them
    const skirt = this.mat(0xf2efe6, 0.7)
    for (const r of this.rooms) {
      if (r.side === 'cellar') continue
      const y = 0.06
      this.addBox(new THREE.BoxGeometry(r.x1 - r.x0, 0.12, 0.03), skirt, (r.x0 + r.x1) / 2, y, r.z0 + 0.09)
      this.addBox(new THREE.BoxGeometry(r.x1 - r.x0, 0.12, 0.03), skirt, (r.x0 + r.x1) / 2, y, r.z1 - 0.09)
      this.addBox(new THREE.BoxGeometry(0.03, 0.12, r.z1 - r.z0), skirt, r.x0 + 0.09, y, (r.z0 + r.z1) / 2)
      this.addBox(new THREE.BoxGeometry(0.03, 0.12, r.z1 - r.z0), skirt, r.x1 - 0.09, y, (r.z0 + r.z1) / 2)
    }
  }

  private buildStair() {
    const stepMat = this.mat(0x9a9186, 0.9)
    const steps = 12
    const run = (this.stairX1 - this.stairX0) / steps
    for (let i = 0; i < steps; i++) {
      const y = ((i + 1) / steps) * CELLAR_Y
      this.addBox(new THREE.BoxGeometry(run, 0.14, 1.9), stepMat, this.stairX0 + run * (i + 0.5), y + 0.07, 0)
    }
    const sideMat = this.wallMat()
    for (const z of [-1.05, 1.05]) {
      this.addBox(new THREE.BoxGeometry(this.stairX1 - this.stairX0, 3.6, WALL_T), sideMat, (this.stairX0 + this.stairX1) / 2, -0.7, z)
      this.colliders.push({ minX: this.stairX0, maxX: this.stairX1, minZ: z - 0.1, maxZ: z + 0.1 })
    }
  }

  private furnish(rng: () => number) {
    const wood = this.mat(0x7a5230, 0.8)
    const fabric = this.mat(0x4a5a6a, 0.95)
    const white = this.mat(0xf4f4f2, 0.5)
    const steel = this.mat(0x9aa0a6, 0.35, 0.8)
    const cx = (r: PlanRoom) => (r.x0 + r.x1) / 2
    const cz = (r: PlanRoom) => (r.z0 + r.z1) / 2

    for (const r of this.rooms) {
      if (r.side !== 'n' && r.side !== 's') continue
      const inner = r.side === 'n' ? 1 : -1
      if (r.id.startsWith('schlaf')) {
        this.addBox(new THREE.BoxGeometry(1.85, 0.45, 2.05), wood, cx(r), 0.22, cz(r))
        this.addBox(new THREE.BoxGeometry(1.75, 0.22, 1.95), white, cx(r), 0.55, cz(r))
        this.addBox(new THREE.BoxGeometry(1.3, 2.0, 0.58), wood, r.x0 + 0.85, 1.0, cz(r) - inner * ((r.z1 - r.z0) / 2 - 0.5))
      } else if (r.id === 'wohnen') {
        this.addBox(new THREE.BoxGeometry(2.3, 0.45, 0.9), fabric, cx(r), 0.22, cz(r) - inner * 0.8)
        this.addBox(new THREE.BoxGeometry(2.3, 0.5, 0.25), fabric, cx(r), 0.7, cz(r) - inner * 1.12)
        this.addBox(new THREE.BoxGeometry(1.1, 0.06, 0.55), wood, cx(r), 0.42, cz(r) + inner * 0.5)
        this.addBox(new THREE.BoxGeometry(0.38, 1.7, 1.4), wood, r.x1 - 0.4, 0.85, cz(r))
      } else if (r.id === 'kueche') {
        const far = r.side === 'n' ? r.z1 - 0.35 : r.z0 + 0.35
        this.addBox(new THREE.BoxGeometry(r.x1 - r.x0 - 0.6, 0.9, 0.62), wood, cx(r), 0.45, far)
        this.addBox(new THREE.BoxGeometry(r.x1 - r.x0 - 0.6, 0.06, 0.66), steel, cx(r), 0.92, far)
        this.addBox(new THREE.BoxGeometry((r.x1 - r.x0) * 0.55, 0.7, 0.35), white, cx(r), 1.8, far - inner * 0.12)
        this.addBox(new THREE.BoxGeometry(0.6, 1.7, 0.6), white, r.x1 - 0.5, 0.85, far)
      } else if (r.id === 'bad' || r.id === 'gaeste') {
        const far = r.side === 'n' ? r.z1 - 0.45 : r.z0 + 0.45
        if (r.id === 'bad') {
          this.addBox(new THREE.BoxGeometry(Math.min(1.7, r.x1 - r.x0 - 0.5), 0.55, 0.75), white, cx(r) - 0.2, 0.27, far)
        }
        this.addBox(new THREE.BoxGeometry(0.55, 0.18, 0.42), white, r.x1 - 0.55, 0.85, far)
        this.addBox(new THREE.BoxGeometry(0.36, 0.42, 0.58), white, r.x1 - 0.5, 0.21, cz(r) + inner * 0.6)
        this.addBox(new THREE.BoxGeometry(0.34, 0.48, 0.2), white, r.x1 - 0.5, 0.65, cz(r) + inner * 0.85)
      } else {
        this.addBox(new THREE.BoxGeometry(1.4, 0.72, 0.7), wood, cx(r), 0.36, cz(r))
        this.addBox(new THREE.BoxGeometry(0.5, 0.9, 0.5), fabric, cx(r) + 0.9, 0.45, cz(r))
      }
    }

    // radiator under every window, a door leaf in every doorway, a ceiling
    // fixture in every room — the things you notice by their absence
    const rad = this.mat(0xf0eee8, 0.55, 0.15)
    const doorMat = this.mat(0xe8e2d6, 0.7)
    const fixture = this.mat(0xfaf6ea, 0.4)
    for (const r of this.rooms) {
      if (r.side !== 'n' && r.side !== 's') continue
      const far = r.side === 'n' ? r.z1 - 0.22 : r.z0 + 0.22
      const rw = Math.min(1.5, (r.x1 - r.x0) * 0.42)
      this.addBox(new THREE.BoxGeometry(rw, 0.58, 0.1), rad, (r.x0 + r.x1) / 2, 0.42, far)
      for (let i = 0; i < 5; i++) {
        this.addBox(new THREE.BoxGeometry(rw / 6, 0.5, 0.06), rad,
          (r.x0 + r.x1) / 2 - rw / 2 + rw * ((i + 0.5) / 5), 0.42, far + (r.side === 'n' ? -0.05 : 0.05))
      }
      // door leaf, swung open into the room
      if (r.doorFrom !== undefined && r.doorTo !== undefined) {
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.02, DOOR_H - 0.06, 0.045), doorMat)
        const hinge = r.side === 'n' ? r.z1 : r.z0
        void hinge
        leaf.position.set(r.doorFrom + 0.1, (DOOR_H - 0.06) / 2, (r.side === 'n' ? r.z0 : r.z1) + (r.side === 'n' ? 0.5 : -0.5))
        leaf.rotation.y = r.side === 'n' ? -1.15 : 1.15
        this.scene.add(leaf)
        this.disposables.push(leaf.geometry)
      }
      // ceiling fixture
      this.addBox(new THREE.CylinderGeometry(0.16, 0.22, 0.14, 10), fixture,
        (r.x0 + r.x1) / 2, this.wallH - 0.2, (r.z0 + r.z1) / 2)
    }
    // corridor fixture
    this.addBox(new THREE.CylinderGeometry(0.14, 0.2, 0.12, 10), fixture, this.corridor.x1 / 2, this.wallH - 0.18, 0)

    // kitchen extras: sink basin and hob rings on the worktop
    const kitchen = this.room('kueche')
    if (kitchen) {
      const far = kitchen.side === 'n' ? kitchen.z1 - 0.35 : kitchen.z0 + 0.35
      const kx = (kitchen.x0 + kitchen.x1) / 2
      this.addBox(new THREE.BoxGeometry(0.5, 0.05, 0.4), steel, kx - 0.75, 0.94, far)
      this.addBox(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 6), steel, kx - 0.75, 1.08, far - 0.14)
      for (let i = 0; i < 4; i++) {
        this.addBox(new THREE.CylinderGeometry(0.08, 0.08, 0.012, 12), this.mat(0x1c1f22, 0.4),
          kx + 0.45 + (i % 2) * 0.24, 0.955, far - 0.12 + Math.floor(i / 2) * 0.24)
      }
    }

    // bathroom mirror above the basin
    const bath = this.room('bad')
    if (bath) {
      const far = bath.side === 'n' ? bath.z1 - 0.12 : bath.z0 + 0.12
      this.addBox(new THREE.BoxGeometry(0.62, 0.7, 0.04),
        this.mat(0xbcd2dd, 0.05, 0.6), bath.x1 - 0.55, 1.55, far)
    }

    // cellar: boiler, meter board, shelving, junk, Steigstrang
    const k = this.cellar
    this.addBox(new THREE.BoxGeometry(0.7, 1.5, 0.5), steel, k.x0 + 1.2, CELLAR_Y + 0.75, k.z0 + 0.6)
    this.addBox(new THREE.BoxGeometry(1.3, 0.85, 0.12), this.mat(0x35404a, 0.7), k.x0 + 3.2, CELLAR_Y + 1.45, k.z0 + 0.12)
    for (let i = 0; i < 4; i++) {
      this.addBox(new THREE.BoxGeometry(2.4, 0.06, 0.5), wood, k.x1 - 1.6, CELLAR_Y + 0.4 + i * 0.48, k.z1 - 0.4)
    }
    for (let i = 0; i < 6; i++) {
      const s = 0.32 + rng() * 0.36
      this.addBox(new THREE.BoxGeometry(s, s, s), wood,
        k.x0 + 1 + rng() * (k.x1 - k.x0 - 2), CELLAR_Y + s / 2, k.z0 + 1 + rng() * (k.z1 - k.z0 - 2))
    }
    this.addBox(new THREE.CylinderGeometry(0.06, 0.06, 2.3, 8), steel, k.x0 + 0.45, CELLAR_Y + 1.15, k.z1 - 0.5)
  }

  // -------------------------------------------------------------- defects

  private collectDefects(cond: number, rng: () => number) {
    const p = this.property
    // A defect costs what it costs — clamp so a high-rent listing doesn't
    // report a six-figure Steigstrang.
    const scale = Math.max(0.75, Math.min(2.2, p.baseRent / 900))
    const has = (id: string) => !!this.room(id)
    const add = (roomId: string, label: string, detail: string, euro: number, severity: 'warn' | 'bad', u: number, v: number, y: number) => {
      if (!has(roomId)) return
      this.defects.push({ room: roomId, label, detail, cost: Math.round(euro * scale), severity, u, v, y })
    }

    if (cond < 64) add('bad', 'Schimmel an der Duschwand', 'Feuchteschaden in der Fuge, vermutlich undichte Abdichtung.', 1800, 'bad', 0.1, 0.5, 1.5)
    if (cond < 58) add('kueche', 'Elektrik ohne FI-Schutzschalter', 'Verteilung auf Stand der 70er. Neuinstallation faellig.', 5200, 'bad', 0.88, 0.35, 1.6)
    if (cond < 72) add('keller', 'Feuchte Kellerwand', 'Aufsteigende Feuchte, Salzausbluehungen am Sockel.', 6800, 'bad', 0.5, 0.03, 0.8)
    if (cond < 68) add('keller', 'Steigstrang von 1962', 'Verzinkte Leitungen, Rostwasser. Austausch empfohlen.', 9500, 'warn', 0.06, 0.94, 1.4)
    if (cond < 48) add('wohnen', 'Risse im Putz ueber dem Sturz', 'Setzrisse. Optisch, aber der Gutachter schaut genau hin.', 1200, 'warn', 0.5, 0.97, 2.1)
    if (cond < 60) add('schlaf', 'Einfachverglasung, undicht', 'Zugluft und hohe Heizkosten. Fenstertausch faellig.', 4200, 'warn', 0.5, 0.97, 1.5)
    if (cond < 52) add('schlaf2', 'Feuchter Fleck an der Aussenwand', 'Waermebruecke, Tapete loest sich.', 2400, 'warn', 0.3, 0.96, 1.7)
    if (cond < 40 || (cond < 55 && rng() > 0.5)) add('flur', 'Bodenbelag ausgetreten', 'Dielen ausgeschlagen, Trittschall grenzwertig.', 2600, 'warn', 0.45, 0.96, 0.35)
    if (cond < 35) add('bad', 'Wanne mit Rostkante', 'Emaille durch, Wanne muss raus.', 1500, 'warn', 0.5, 0.9, 0.6)
  }

  private placeDefectMarkers() {
    const stainMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1, transparent: true, opacity: 0.72 })
    const crackMat = new THREE.MeshStandardMaterial({ color: 0x33302b, roughness: 1, transparent: true, opacity: 0.8 })
    this.disposables.push(stainMat, crackMat)

    for (const d of this.defects) {
      const room = this.room(d.room)
      if (!room) continue
      const x = room.x0 + (room.x1 - room.x0) * d.u
      const z = room.z0 + (room.z1 - room.z0) * d.v
      const baseY = room.side === 'cellar' ? CELLAR_Y : 0
      const midX = (room.x0 + room.x1) / 2
      const midZ = (room.z0 + room.z1) / 2

      const g = new THREE.PlaneGeometry(0.85, 0.7)
      const stain = new THREE.Mesh(g, d.severity === 'bad' ? stainMat : crackMat)
      stain.position.set(x, baseY + d.y, z)
      stain.lookAt(new THREE.Vector3(midX, baseY + d.y, midZ))
      stain.translateZ(0.06)
      this.scene.add(stain)
      this.disposables.push(g)

      const el = document.createElement('div')
      el.className = `defect-marker ${d.severity}`
      el.innerHTML = `<b>${d.severity === 'bad' ? '⚠' : '!'} ${escapeHtml(d.label)}</b>
        <span>${escapeHtml(d.detail)}</span>
        <em>ca. ${formatEuro(d.cost)}</em>`
      const obj = new CSS2DObject(el)
      obj.position.set(x, baseY + d.y + 0.7, z)
      this.scene.add(obj)
      this.labelEls.push(el)
      this.labelAnchors.push({ el, x, z })
    }
  }

  private light() {
    this.scene.add(new THREE.AmbientLight(0xdfe6ee, 0.5))
    this.scene.add(new THREE.HemisphereLight(0xf2f6ff, 0x3a3a38, 0.7))
    const lamp = (x: number, y: number, z: number, colour: number, intensity: number, dist: number) => {
      const l = new THREE.PointLight(colour, intensity, dist, 2)
      l.position.set(x, y, z)
      this.scene.add(l)
    }
    lamp(this.corridor.x1 / 2, this.wallH - 0.4, 0, 0xffe6c0, 14 + this.corridor.x1, 6 + this.corridor.x1 * 1.6)
    for (const r of this.rooms) {
      if (r.side !== 'n' && r.side !== 's') continue
      const warm = r.floor === 'tile' ? 0xeaf2ff : 0xfff0d8
      const span = Math.max(r.x1 - r.x0, r.z1 - r.z0)
      lamp((r.x0 + r.x1) / 2, this.wallH - 0.4, (r.z0 + r.z1) / 2, warm, 10 + span * 2, span * 2.6)
    }
    const k = this.cellar
    lamp((k.x0 + k.x1) / 2, CELLAR_Y + 1.9, 0, 0xffd9a0, 13, (k.x1 - k.x0) * 1.6)
  }

  /** Only annotate what you are actually standing in front of — CSS2D labels
   *  have no depth test, so showing all of them at once means reading the
   *  bathroom's mould through the living room wall. */
  updateLabels(px: number, pz: number) {
    for (const a of this.labelAnchors) {
      const near = Math.hypot(a.x - px, a.z - pz) < 5.5
      a.el.style.display = near ? '' : 'none'
    }
  }

  dispose() {
    for (const el of this.labelEls) el.remove()
    this.scene.traverse(o => {
      const any = o as any
      if (any.isCSS2DObject) any.element?.remove()
    })
    for (const d of this.disposables) d.dispose()
    this.scene.clear()
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
