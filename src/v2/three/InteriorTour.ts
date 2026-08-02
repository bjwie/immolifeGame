/**
 * Besichtigung: a walkable interior for a property.
 *
 * This is its own THREE.Scene, so while you are inside, none of the city is
 * rendered at all — it is a separate level, not a room hidden in the street.
 *
 * The floor plan comes from plan.ts and varies by building era (hallway flat,
 * enfilade, open plan, compact pinwheel). Walls are derived from the room
 * rectangles: an edge shared by two rooms becomes an interior wall, an edge
 * nobody else touches becomes the outer envelope and can take a window.
 *
 * Defects are *not* handed over as a list. The clue — a stain, a crack, a
 * scorched patch — sits in the room from the start; walking up and looking at
 * it turns it into a named, priced finding. Miss one and you buy it.
 */
import * as THREE from 'three'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import type { Property } from '../sim/types'
import { mulberry32 } from '../world/cityLayout'
import { formatEuro } from '../sim/Engine'
import * as kit from './kit'
import type { MatKey, Builder } from './kit'
import { getModel } from './models'
import { buildPlan } from './plan'
import type { Plan, PlanRoom } from './plan'
import { rollDefects } from './defects'
import type { DefectDef } from './defects'

export interface TourCollider { minX: number; maxX: number; minZ: number; maxZ: number }

const WALL_T = 0.16
const CELLAR_Y = -3.0
const DOOR_H = 2.05
const DOOR_W = 1.0
const WIN_Y0 = 0.92
const WIN_Y1 = 2.28
/** how close and how squarely you must look to identify a defect */
const FIND_DIST = 3.6
const FIND_DOT = 0.9
const FIND_DWELL = 0.35

type Span = [number, number]
interface Edge { axis: 'x' | 'z'; fixed: number; from: number; to: number; room: PlanRoom }

export interface Finding {
  def: DefectDef
  room: PlanRoom
  pos: THREE.Vector3
  cost: number
  found: boolean
  dwell: number
  el: HTMLElement
}

export class InteriorTour {
  readonly scene = new THREE.Scene()
  readonly colliders: TourCollider[] = []
  readonly findings: Finding[] = []
  readonly property: Property
  readonly sqm: number
  readonly plan: Plan
  spawn: { x: number; z: number; yaw: number }

  private rooms: PlanRoom[]
  private wallH = 2.8
  private disposables: Array<{ dispose(): void }> = []
  private labelEls: HTMLElement[] = []
  private furnishRng: () => number = Math.random
  private doorSpans: Array<{ axis: 'x' | 'z'; fixed: number; from: number; to: number }> = []
  private winSpans: Array<{ axis: 'x' | 'z'; fixed: number; from: number; to: number }> = []

  constructor(property: Property) {
    this.property = property
    const rng = mulberry32(((property.styleSeed ?? 1) * 2654435761) >>> 0)
    this.wallH = property.yearBuilt < 1930 ? 3.25 : property.yearBuilt < 1975 ? 2.7 : 2.55
    this.sqm = this.livingArea()
    this.plan = buildPlan(property, this.sqm, rng)
    this.rooms = [...this.plan.rooms, this.plan.cellar]
    this.spawn = { ...this.plan.spawn }

    this.scene.background = new THREE.Color(0x0f1216)
    this.planOpenings()
    this.buildShell()
    this.buildStair()
    this.furnish(rng)
    this.placeDefects(rng)
    this.light()
  }

  get archetypeLabel(): string {
    switch (this.plan.archetype) {
      case 'flur': return 'Flurwohnung'
      case 'durchgang': return 'Durchgangszimmer'
      case 'offen': return 'Offener Grundriss'
      default: return 'Kompaktgrundriss'
    }
  }

  get roomCount(): number {
    return this.plan.rooms.filter(r => r.kind === 'living' || r.kind === 'wet').length
  }

  floorAt(x: number): number {
    const { stairX0, stairX1 } = this.plan
    if (x <= stairX0) return 0
    if (x >= stairX1) return CELLAR_Y
    return ((x - stairX0) / (stairX1 - stairX0)) * CELLAR_Y
  }

  roomAt(x: number, z: number): string | null {
    for (const r of this.rooms) {
      if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r.name
    }
    if (x > this.plan.stairX0 && x < this.plan.stairX1) return 'Kellertreppe'
    return null
  }

  // ------------------------------------------------------------ openings

  private livingArea(): number {
    const p = this.property
    const unit = p.units?.[0]
    if (unit?.sqm) return unit.sqm
    return Math.max(38, Math.min(180, Math.round(p.baseRent / 11)))
  }

  private roomById(id: string) { return this.rooms.find(r => r.id === id) }

  /** Work out where doors and windows go before any geometry is built. */
  private planOpenings() {
    // doors: centre a gap on the overlap of every connected pair
    for (const d of this.plan.doors) {
      const a = this.roomById(d.a), b = this.roomById(d.b)
      if (!a || !b) continue
      const shared = sharedEdge(a, b)
      if (!shared) continue
      const mid = (shared.from + shared.to) / 2
      const half = Math.min(DOOR_W, shared.to - shared.from - 0.3) / 2
      if (half <= 0.15) continue
      this.doorSpans.push({ axis: shared.axis, fixed: shared.fixed, from: mid - half, to: mid + half })
    }
    // front door: the outer face of the entrance room
    const entry = this.roomById(this.plan.stairFrom === 'flur' ? 'flur' : this.plan.rooms[0].id) ?? this.rooms[0]
    this.doorSpans.push({ axis: 'z', fixed: entry.x0, from: -0.5, to: 0.5 })

    // windows: one per habitable room, on its longest exterior edge
    for (const r of this.plan.rooms) {
      if (r.kind === 'circulation' && r.id !== 'wohnen') continue
      const ext = this.exteriorEdges(r).sort((p, q) => (q.to - q.from) - (p.to - p.from))
      if (!ext.length) continue
      const e = ext[0]
      const span = e.to - e.from
      if (span < 1.3) continue
      const w = Math.max(0.8, Math.min(2.3, span * 0.5))
      const mid = (e.from + e.to) / 2
      this.winSpans.push({ axis: e.axis, fixed: e.fixed, from: mid - w / 2, to: mid + w / 2 })
    }
  }

  private edgesOf(r: PlanRoom): Edge[] {
    return [
      { axis: 'x', fixed: r.z1, from: r.x0, to: r.x1, room: r },
      { axis: 'x', fixed: r.z0, from: r.x0, to: r.x1, room: r },
      { axis: 'z', fixed: r.x0, from: r.z0, to: r.z1, room: r },
      { axis: 'z', fixed: r.x1, from: r.z0, to: r.z1, room: r },
    ]
  }

  /** Edges of this room that no other room sits against — the outer envelope. */
  private exteriorEdges(r: PlanRoom): Edge[] {
    const others = this.plan.rooms.filter(o => o !== r)
    return this.edgesOf(r).filter(e => !others.some(o => {
      if (e.axis === 'x') {
        if (Math.abs(o.z0 - e.fixed) > 0.02 && Math.abs(o.z1 - e.fixed) > 0.02) return false
        return overlap(o.x0, o.x1, e.from, e.to) > 0.3
      }
      if (Math.abs(o.x0 - e.fixed) > 0.02 && Math.abs(o.x1 - e.fixed) > 0.02) return false
      return overlap(o.z0, o.z1, e.from, e.to) > 0.3
    }))
  }

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
      const y = r.kind === 'cellar' ? CELLAR_Y : 0
      const h = r.kind === 'cellar' ? 2.3 : this.wallH
      const mat = r.floor === 'wood' ? woodMat : r.floor === 'tile' ? tileMat : concreteMat
      this.addBox(new THREE.BoxGeometry(w, 0.12, d), mat, (r.x0 + r.x1) / 2, y - 0.06, (r.z0 + r.z1) / 2)
      this.addBox(new THREE.BoxGeometry(w, 0.1, d), ceilMat, (r.x0 + r.x1) / 2, y + h, (r.z0 + r.z1) / 2)
    }

    // Every room edge becomes a wall, deduped so shared walls are drawn once.
    const seen = new Set<string>()
    for (const r of this.rooms) {
      const isCellar = r.kind === 'cellar'
      for (const e of this.edgesOf(r)) {
        const key = `${e.axis}|${e.fixed.toFixed(2)}|${e.from.toFixed(2)}|${e.to.toFixed(2)}`
        if (seen.has(key)) continue
        seen.add(key)
        this.wallRun(e.axis, e.fixed, e.from, e.to, isCellar ? CELLAR_Y : 0, isCellar ? 2.3 : this.wallH)
      }
    }

    // skirting
    const skirt = this.mat(0xf2efe6, 0.7)
    for (const r of this.rooms) {
      if (r.kind === 'cellar') continue
      this.addBox(new THREE.BoxGeometry(r.x1 - r.x0, 0.12, 0.03), skirt, (r.x0 + r.x1) / 2, 0.06, r.z0 + 0.09)
      this.addBox(new THREE.BoxGeometry(r.x1 - r.x0, 0.12, 0.03), skirt, (r.x0 + r.x1) / 2, 0.06, r.z1 - 0.09)
      this.addBox(new THREE.BoxGeometry(0.03, 0.12, r.z1 - r.z0), skirt, r.x0 + 0.09, 0.06, (r.z0 + r.z1) / 2)
      this.addBox(new THREE.BoxGeometry(0.03, 0.12, r.z1 - r.z0), skirt, r.x1 - 0.09, 0.06, (r.z0 + r.z1) / 2)
    }
  }

  /** One wall, minus whatever doors and windows fall on it. */
  private wallRun(axis: 'x' | 'z', fixed: number, a0: number, a1: number, y: number, h: number) {
    const mat = this.wallMat()
    const on = (list: typeof this.doorSpans) => list
      .filter(s => s.axis === axis && Math.abs(s.fixed - fixed) < 0.02 && s.to > a0 + 0.01 && s.from < a1 - 0.01)
      .map(s => [Math.max(a0, s.from), Math.min(a1, s.to)] as Span)
    const doors = on(this.doorSpans)
    const windows = on(this.winSpans)
    const all = [...doors, ...windows].sort((p, q) => p[0] - q[0])

    const put = (from: number, to: number, yFrom: number, yTo: number, solid: boolean) => {
      if (to - from < 0.03 || yTo - yFrom < 0.03) return
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

    let cursor = a0
    for (const [os, oe] of all) {
      if (os > cursor) put(cursor, os, y, y + h, true)
      cursor = Math.max(cursor, oe)
    }
    if (cursor < a1) put(cursor, a1, y, y + h, true)

    for (const [os, oe] of doors) put(os, oe, y + Math.min(DOOR_H, h - 0.05), y + h, false)
    for (const [os, oe] of windows) {
      put(os, oe, y, y + Math.min(WIN_Y0, h * 0.4), true)
      put(os, oe, y + Math.min(WIN_Y1, h - 0.15), y + h, false)
      this.glaze(axis, fixed, os, oe, y, h)
    }
  }

  private glaze(axis: 'x' | 'z', fixed: number, from: number, to: number, y: number, h: number) {
    const w = to - from
    const y0 = y + Math.min(WIN_Y0, h * 0.4)
    const y1 = y + Math.min(WIN_Y1, h - 0.15)
    const hh = y1 - y0
    if (hh < 0.3) return
    const cx = axis === 'x' ? (from + to) / 2 : fixed
    const cz = axis === 'x' ? fixed : (from + to) / 2
    const yc = (y0 + y1) / 2
    const glass = this.glassMat()
    const frame = this.frameMat()
    const put = (bw: number, bh: number, bd: number, ox: number, oy: number, oz: number, m: THREE.Material) =>
      this.addBox(new THREE.BoxGeometry(bw, bh, bd), m, cx + ox, yc + oy, cz + oz)

    if (axis === 'x') {
      put(w - 0.12, hh - 0.12, 0.04, 0, 0, 0, glass)
      put(w, 0.09, 0.14, 0, hh / 2 - 0.04, 0, frame)
      put(w, 0.09, 0.14, 0, -hh / 2 + 0.04, 0, frame)
      put(0.09, hh, 0.14, -w / 2 + 0.04, 0, 0, frame)
      put(0.09, hh, 0.14, w / 2 - 0.04, 0, 0, frame)
      put(0.07, hh, 0.1, 0, 0, 0, frame)
    } else {
      put(0.04, hh - 0.12, w - 0.12, 0, 0, 0, glass)
      put(0.14, 0.09, w, 0, hh / 2 - 0.04, 0, frame)
      put(0.14, 0.09, w, 0, -hh / 2 + 0.04, 0, frame)
      put(0.14, hh, 0.09, 0, 0, -w / 2 + 0.04, frame)
      put(0.14, hh, 0.09, 0, 0, w / 2 - 0.04, frame)
      put(0.1, hh, 0.07, 0, 0, 0, frame)
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

  private buildStair() {
    const { stairX0, stairX1 } = this.plan
    const stepMat = this.mat(0x9a9186, 0.9)
    const steps = 12
    const run = (stairX1 - stairX0) / steps
    for (let i = 0; i < steps; i++) {
      const y = ((i + 1) / steps) * CELLAR_Y
      this.addBox(new THREE.BoxGeometry(run, 0.14, 1.9), stepMat, stairX0 + run * (i + 0.5), y + 0.07, 0)
    }
    const sideMat = this.wallMat()
    for (const z of [-1.05, 1.05]) {
      this.addBox(new THREE.BoxGeometry(stairX1 - stairX0, 3.6, WALL_T), sideMat, (stairX0 + stairX1) / 2, -0.7, z)
      this.colliders.push({ minX: stairX0, maxX: stairX1, minZ: z - 0.1, maxZ: z + 0.1 })
    }
    // doorway from the flat into the stair, and from the stair into the cellar
    this.doorSpans.push({ axis: 'z', fixed: stairX0, from: -0.6, to: 0.6 })
    this.doorSpans.push({ axis: 'z', fixed: stairX1, from: -1.0, to: 1.0 })
  }

  // ------------------------------------------------------------ furniture

  private _palette: Record<MatKey, THREE.MeshStandardMaterial> | null = null
  private palette(): Record<MatKey, THREE.MeshStandardMaterial> {
    if (!this._palette) {
      this._palette = {
        wood: this.mat(0x8a6038, 0.72),
        fabric: this.mat(0x556579, 0.95),
        white: this.mat(0xf2f1ec, 0.5),
        steel: this.mat(0xa8aeb4, 0.3, 0.75),
        dark: this.mat(0x24282d, 0.6),
        stone: this.mat(0x3c4046, 0.35, 0.2),
        glass: this.mat(0xc3d8e4, 0.05, 0.5),
      }
    }
    return this._palette
  }

  private put(name: string, builder: Builder, x: number, y: number, z: number, yaw = 0, size?: number) {
    const model = getModel(name)
    if (model) {
      model.position.set(x, y, z)
      model.rotation.y = yaw
      this.scene.add(model)
      return
    }
    const piece = builder(this.furnishRng, size)
    const pal = this.palette()
    for (const part of piece.parts) {
      const mesh = new THREE.Mesh(part.geo, pal[part.mat])
      mesh.position.set(x, y, z)
      mesh.rotation.y = yaw
      mesh.castShadow = true
      this.scene.add(mesh)
      this.disposables.push(part.geo)
    }
  }

  /** Where the agent/owner stands, and the room they wait in. */
  sellerPos = new THREE.Vector3()

  private placeSeller(rng: () => number) {
    // in the largest habitable room, a little off-centre so they aren't in the
    // middle of the floor like a statue
    const habitable = this.plan.rooms.filter(r => r.kind !== 'cellar')
    const room = habitable.slice().sort((a, b) =>
      (b.x1 - b.x0) * (b.z1 - b.z0) - (a.x1 - a.x0) * (a.z1 - a.z0))[0] ?? this.plan.rooms[0]
    const x = room.x0 + (room.x1 - room.x0) * (0.3 + rng() * 0.35)
    const z = room.z0 + (room.z1 - room.z0) * (0.3 + rng() * 0.35)
    this.sellerPos.set(x, 0, z)
    this.put('person', kit.person, x, 0, z, Math.PI * (0.6 + rng() * 0.8))
    this.colliders.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 })
  }

  /** Room name plus its floor area, for the viewing notes. */
  roomInfoAt(x: number, z: number): { name: string; sqm: number } | null {
    for (const r of this.rooms) {
      if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) {
        return { name: r.name, sqm: Math.round((r.x1 - r.x0) * (r.z1 - r.z0) * 10) / 10 }
      }
    }
    if (x > this.plan.stairX0 && x < this.plan.stairX1) return { name: 'Kellertreppe', sqm: 0 }
    return null
  }

  private furnish(rng: () => number) {
    this.furnishRng = rng
    for (const r of this.plan.rooms) {
      const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2
      const w = r.x1 - r.x0, d = r.z1 - r.z0
      // face into the room from the deepest wall
      const backZ = r.z1 - 0.45
      if (r.id.startsWith('schlaf')) {
        this.put('bed', kit.bed, cx, 0, cz, Math.PI, Math.min(1.8, Math.max(1.0, w - 1.4)))
        if (w > 3.2) this.put('wardrobe', kit.wardrobe, r.x0 + 0.85, 0, backZ, Math.PI, Math.min(1.5, w * 0.45))
      } else if (r.id === 'wohnen') {
        this.put('sofa', kit.sofa, cx - 0.2, 0, cz - d * 0.18, Math.PI, w > 4.6 ? 3 : 2)
        this.put('couchTable', kit.couchTable, cx - 0.2, 0, cz + 0.4)
        if (w > 3.6) this.put('shelf', kit.shelf, r.x1 - 0.6, 0, cz, -Math.PI / 2, 4)
      } else if (r.id === 'kueche') {
        this.put('kitchenRun', kit.kitchenRun, cx - 0.3, 0, backZ, Math.PI, Math.min(3.2, Math.max(1.6, w - 1.0)))
        if (w > 3.0) this.put('fridge', kit.fridge, r.x1 - 0.5, 0, backZ, Math.PI)
      } else if (r.id === 'bad' || r.id === 'gaeste') {
        if (r.id === 'bad' && w > 2.4) {
          this.put('bathtub', kit.bathtub, cx - 0.15, 0, backZ, Math.PI, Math.min(1.7, w - 0.7))
        }
        this.put('basin', kit.basin, r.x1 - 0.6, 0, backZ, Math.PI)
        this.put('mirror', kit.mirror, r.x1 - 0.6, 1.55, r.z1 - 0.12, Math.PI)
        this.put('toilet', kit.toilet, r.x1 - 0.5, 0, cz + 0.4, -Math.PI / 2)
      } else if (r.kind === 'living') {
        this.put('desk', kit.desk, cx, 0, backZ, Math.PI)
        this.put('chair', kit.chair, cx, 0, backZ - 0.9, Math.PI)
        this.put('shelf', kit.shelf, r.x1 - 0.5, 0, cz + 0.6, -Math.PI / 2, 3)
      }
      if (r.kind !== 'circulation' || r.id === 'wohnen') {
        this.put('radiator', kit.radiator, cx, 0, r.z1 - 0.18, 0, Math.min(1.5, w * 0.4))
      }
      this.put('ceilingLamp', kit.ceilingLamp, cx, this.wallH - 0.06, cz)
    }

    const k = this.plan.cellar
    this.put('boiler', kit.boiler, k.x0 + 1.3, CELLAR_Y, k.z0 + 0.45, 0)
    this.put('meterBoard', kit.meterBoard, k.x0 + 3.3, CELLAR_Y + 1.45, k.z0 + 0.1, 0)
    this.put('shelf', kit.shelf, k.x1 - 0.5, CELLAR_Y, k.z1 - 1.2, -Math.PI / 2, 4)
    for (let i = 0; i < 6; i++) {
      this.put('cartonBox', kit.cartonBox,
        k.x0 + 1.2 + rng() * (k.x1 - k.x0 - 2.4), CELLAR_Y,
        k.z0 + 1.0 + rng() * (k.z1 - k.z0 - 2.0), rng() * Math.PI)
    }
    this.addBox(new THREE.CylinderGeometry(0.06, 0.06, 2.3, 8), this.palette().steel,
      k.x0 + 0.45, CELLAR_Y + 1.15, k.z1 - 0.5)

    this.placeSeller(rng)
  }

  // -------------------------------------------------------------- defects

  private placeDefects(rng: () => number) {
    const ids = this.rooms.map(r => r.id)
    const kindOf = (id: string) => this.rooms.find(r => r.id === id)?.kind ?? ''
    const defs = rollDefects(this.property.condition, rng, ids, kindOf)
    const scale = Math.max(0.75, Math.min(2.2, this.property.baseRent / 900))

    for (const def of defs) {
      const room = this.pickRoom(def, rng)
      if (!room) continue
      const base = room.kind === 'cellar' ? CELLAR_Y : 0
      const h = room.kind === 'cellar' ? 2.3 : this.wallH
      let pos: THREE.Vector3
      let quat = new THREE.Euler()
      if (def.surface === 'floor') {
        pos = new THREE.Vector3(
          room.x0 + 0.6 + rng() * Math.max(0.1, room.x1 - room.x0 - 1.2), base + 0.07,
          room.z0 + 0.6 + rng() * Math.max(0.1, room.z1 - room.z0 - 1.2))
        quat = new THREE.Euler(-Math.PI / 2, 0, 0)
      } else if (def.surface === 'ceiling') {
        pos = new THREE.Vector3(
          room.x0 + 0.7 + rng() * Math.max(0.1, room.x1 - room.x0 - 1.4), base + h - 0.06,
          room.z0 + 0.7 + rng() * Math.max(0.1, room.z1 - room.z0 - 1.4))
        quat = new THREE.Euler(Math.PI / 2, 0, 0)
      } else {
        // pick a wall and sit on its inner face
        const side = Math.floor(rng() * 4)
        const t = 0.25 + rng() * 0.5
        if (side === 0) { pos = new THREE.Vector3(room.x0 + (room.x1 - room.x0) * t, base + 0.5 + rng() * 1.3, room.z1 - 0.1); quat = new THREE.Euler(0, Math.PI, 0) }
        else if (side === 1) { pos = new THREE.Vector3(room.x0 + (room.x1 - room.x0) * t, base + 0.5 + rng() * 1.3, room.z0 + 0.1) }
        else if (side === 2) { pos = new THREE.Vector3(room.x0 + 0.1, base + 0.5 + rng() * 1.3, room.z0 + (room.z1 - room.z0) * t); quat = new THREE.Euler(0, Math.PI / 2, 0) }
        else { pos = new THREE.Vector3(room.x1 - 0.1, base + 0.5 + rng() * 1.3, room.z0 + (room.z1 - room.z0) * t); quat = new THREE.Euler(0, -Math.PI / 2, 0) }
      }

      // the clue: always visible, unlabelled
      const stainMat = new THREE.MeshStandardMaterial({
        color: def.tint, roughness: 1, transparent: true, opacity: def.severity === 'bad' ? 0.8 : 0.62,
      })
      this.disposables.push(stainMat)
      const size = 0.55 + rng() * 0.6
      const geo = new THREE.PlaneGeometry(size, size * (0.7 + rng() * 0.5))
      const stain = new THREE.Mesh(geo, stainMat)
      stain.position.copy(pos)
      stain.rotation.copy(quat)
      this.scene.add(stain)
      this.disposables.push(geo)

      const el = document.createElement('div')
      el.className = `defect-marker ${def.severity}`
      el.style.visibility = 'hidden'
      el.innerHTML = `<b>${def.severity === 'bad' ? '⚠' : '!'} ${escapeHtml(def.label)}</b>
        <span>${escapeHtml(def.detail)}</span>
        <em>ca. ${formatEuro(Math.round(def.baseCost * scale))}</em>`
      const obj = new CSS2DObject(el)
      obj.position.copy(pos).add(new THREE.Vector3(0, 0.55, 0))
      this.scene.add(obj)
      this.labelEls.push(el)

      this.findings.push({
        def, room, pos: pos.clone(), cost: Math.round(def.baseCost * scale),
        found: false, dwell: 0, el,
      })
    }
  }

  private pickRoom(def: DefectDef, rng: () => number): PlanRoom | undefined {
    const exact = this.rooms.filter(r => def.rooms.includes(r.id))
    if (exact.length) return exact[Math.floor(rng() * exact.length)]
    const byKind = this.rooms.filter(r => def.rooms.includes(r.kind))
    if (byKind.length) return byKind[Math.floor(rng() * byKind.length)]
    return undefined
  }

  /**
   * Reveal anything the player is close to and looking at. Returns whatever
   * was newly identified this frame so the scene can announce it.
   */
  updateDiscovery(cam: THREE.Vector3, dir: THREE.Vector3, dt: number): Finding[] {
    const found: Finding[] = []
    const to = new THREE.Vector3()
    for (const f of this.findings) {
      if (f.found) continue
      to.copy(f.pos).sub(cam)
      const dist = to.length()
      if (dist > FIND_DIST) { f.dwell = 0; continue }
      to.normalize()
      if (to.dot(dir) < FIND_DOT) { f.dwell = 0; continue }
      f.dwell += dt
      if (f.dwell < FIND_DWELL) continue
      f.found = true
      f.el.style.visibility = 'visible'
      found.push(f)
    }
    return found
  }

  /** Keep identified labels from cluttering the whole flat. */
  updateLabels(px: number, pz: number) {
    for (const f of this.findings) {
      if (!f.found) continue
      f.el.style.visibility = Math.hypot(f.pos.x - px, f.pos.z - pz) < 6 ? 'visible' : 'hidden'
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
    for (const r of this.plan.rooms) {
      const warm = r.floor === 'tile' ? 0xeaf2ff : 0xfff0d8
      const span = Math.max(r.x1 - r.x0, r.z1 - r.z0)
      lamp((r.x0 + r.x1) / 2, this.wallH - 0.4, (r.z0 + r.z1) / 2, warm, 10 + span * 2.2, span * 2.8)
    }
    const k = this.plan.cellar
    lamp((k.x0 + k.x1) / 2, CELLAR_Y + 1.9, 0, 0xffd9a0, 14, (k.x1 - k.x0) * 1.7)
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

function overlap(a0: number, a1: number, b0: number, b1: number): number {
  return Math.min(a1, b1) - Math.max(a0, b0)
}

/** The wall two rooms have in common, if they touch at all. */
function sharedEdge(a: PlanRoom, b: PlanRoom): { axis: 'x' | 'z'; fixed: number; from: number; to: number } | null {
  if (Math.abs(a.z1 - b.z0) < 0.02 || Math.abs(a.z0 - b.z1) < 0.02) {
    const fixed = Math.abs(a.z1 - b.z0) < 0.02 ? a.z1 : a.z0
    const from = Math.max(a.x0, b.x0), to = Math.min(a.x1, b.x1)
    if (to - from > 0.4) return { axis: 'x', fixed, from, to }
  }
  if (Math.abs(a.x1 - b.x0) < 0.02 || Math.abs(a.x0 - b.x1) < 0.02) {
    const fixed = Math.abs(a.x1 - b.x0) < 0.02 ? a.x1 : a.x0
    const from = Math.max(a.z0, b.z0), to = Math.min(a.z1, b.z1)
    if (to - from > 0.4) return { axis: 'z', fixed, from, to }
  }
  return null
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
