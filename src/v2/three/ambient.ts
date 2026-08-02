/**
 * Ambient city life: low-poly cars cruising the avenues and pedestrians
 * strolling the sidewalks. Pure decoration — instanced meshes, deterministic
 * spawns, cheap per-frame matrix updates.
 */
import * as THREE from 'three'
import type { CityLayout, TileKind } from '../world/cityLayout'
import { mulberry32 } from '../world/cityLayout'
import type { Metrics } from './metrics'
import { tileAtWorld, tileRect } from './metrics'

const CAR_COLORS = [0xc0392b, 0x2980b9, 0xf1c40f, 0xe8e8e8, 0x2c3e50, 0x27ae60, 0x8e44ad, 0xd35400, 0x95a5a6, 0x16a085]
const CLOTHES = [0xc0392b, 0x2980b9, 0xe67e22, 0x27ae60, 0x8e44ad, 0x34495e, 0xd35400, 0x7f8c8d, 0xf1c40f, 0x16a085]

interface Car {
  axis: 'x' | 'z'
  lane: number
  dir: 1 | -1
  pos: number
  speed: number
}

interface Ped {
  x: number
  z: number
  dir: number
  speed: number
  phase: number
}

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const

export class AmbientLife {
  private cars: Car[] = []
  private peds: Ped[] = []
  private carBody: THREE.InstancedMesh
  private carCabin: THREE.InstancedMesh
  private carWheels: THREE.InstancedMesh
  private pedBody: THREE.InstancedMesh
  private pedHead: THREE.InstancedMesh
  private layout: CityLayout
  private metrics: Metrics
  private worldW: number
  private worldD: number
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private v = new THREE.Vector3()
  private s = new THREE.Vector3(1, 1, 1)

  constructor(scene: THREE.Scene, layout: CityLayout, metrics: Metrics, carCount = 60, pedCount = 150, avoid?: THREE.Vector3) {
    this.layout = layout
    this.metrics = metrics
    this.worldW = metrics.width
    this.worldD = metrics.depth
    const rng = mulberry32(20260801)

    // --- cars: one lane each way on every avenue, right-hand traffic
    const roadRows: number[] = []
    const roadCols: number[] = []
    for (let y = 0; y < layout.tilesH; y++) if (metrics.rowKind[y] === 'road') roadRows.push(y)
    for (let x = 0; x < layout.tilesW; x++) if (metrics.colKind[x] === 'road') roadCols.push(x)

    for (let i = 0; i < carCount; i++) {
      const horizontal = rng() > 0.45
      const dir: 1 | -1 = rng() > 0.5 ? 1 : -1
      if (horizontal && roadRows.length) {
        const ty = roadRows[Math.floor(rng() * roadRows.length)]
        const r = tileRect(metrics, 0, ty)
        const centre = r.z + r.d / 2
        const laneOff = r.d * 0.22
        this.cars.push({ axis: 'x', lane: centre + dir * laneOff, dir, pos: rng() * this.worldW, speed: 9 + rng() * 7 })
      } else if (roadCols.length) {
        const tx = roadCols[Math.floor(rng() * roadCols.length)]
        const r = tileRect(metrics, tx, 0)
        const centre = r.x + r.w / 2
        const laneOff = r.w * 0.22
        this.cars.push({ axis: 'z', lane: centre - dir * laneOff, dir, pos: rng() * this.worldD, speed: 9 + rng() * 7 })
      }
    }

    const n = Math.max(1, this.cars.length)
    const bodyGeo = new THREE.BoxGeometry(1.78, 0.72, 4.1)
    const cabinGeo = new THREE.BoxGeometry(1.56, 0.58, 1.95)
    // clear-coat car paint and dark glass — the biggest single readability win
    // for traffic, because the highlights make the shapes legible at distance
    this.carBody = new THREE.InstancedMesh(bodyGeo, new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.28, metalness: 0.55, envMapIntensity: 1.2,
    }), n)
    this.carCabin = new THREE.InstancedMesh(cabinGeo, new THREE.MeshStandardMaterial({
      color: 0x46525f, roughness: 0.06, metalness: 0.25, envMapIntensity: 2.4,
    }), n)
    const wheelGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.22, 10)
    wheelGeo.rotateZ(Math.PI / 2)   // axis across the car
    this.carWheels = new THREE.InstancedMesh(wheelGeo, new THREE.MeshStandardMaterial({
      color: 0x15181c, roughness: 0.85, metalness: 0.1,
    }), n * 4)
    this.carBody.castShadow = true
    this.cars.forEach((_, i) => this.carBody.setColorAt(i, new THREE.Color(CAR_COLORS[i % CAR_COLORS.length])))
    scene.add(this.carBody, this.carCabin, this.carWheels)

    // --- pedestrians on sidewalks
    const walkTiles: Array<{ tx: number; ty: number }> = []
    for (let ty = 0; ty < layout.tilesH; ty++) {
      for (let tx = 0; tx < layout.tilesW; tx++) {
        const t = layout.tiles[ty * layout.tilesW + tx]
        if (t === 'sidewalk' || t === 'plaza') walkTiles.push({ tx, ty })
      }
    }
    for (let i = 0; i < pedCount && walkTiles.length > 0; i++) {
      const t = walkTiles[Math.floor(rng() * walkTiles.length)]
      const r = tileRect(metrics, t.tx, t.ty)
      const x = r.x + 0.9 + rng() * Math.max(0.2, r.w - 1.8)
      const z = r.z + 0.9 + rng() * Math.max(0.2, r.d - 1.8)
      if (avoid && Math.hypot(x - avoid.x, z - avoid.z) < 8) continue
      this.peds.push({ x, z, dir: Math.floor(rng() * 4), speed: 1.1 + rng() * 1.1, phase: rng() * Math.PI * 2 })
    }
    const pedGeo = new THREE.CapsuleGeometry(0.26, 0.72, 2, 6)
    const headGeo = new THREE.SphereGeometry(0.19, 6, 5)
    this.pedBody = new THREE.InstancedMesh(pedGeo, new THREE.MeshStandardMaterial({ color: 0xffffff }), Math.max(1, this.peds.length))
    this.pedHead = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ color: 0xe8c39e }), Math.max(1, this.peds.length))
    this.pedBody.castShadow = true
    this.peds.forEach((_, i) => this.pedBody.setColorAt(i, new THREE.Color(CLOTHES[i % CLOTHES.length])))
    scene.add(this.pedBody, this.pedHead)

    this.update(0)
  }

  private tileKindAt(x: number, z: number): TileKind | null {
    const { tx, ty } = tileAtWorld(this.metrics, x, z)
    if (tx < 0 || tx >= this.layout.tilesW || ty < 0 || ty >= this.layout.tilesH) return null
    return this.layout.tiles[ty * this.layout.tilesW + tx]
  }

  private walkable(x: number, z: number): boolean {
    if (x < 0 || z < 0 || x > this.worldW || z > this.worldD) return false
    const t = this.tileKindAt(x, z)
    return t === 'sidewalk' || t === 'plaza' || t === 'park'
  }

  update(dt: number) {
    for (let i = 0; i < this.cars.length; i++) {
      const c = this.cars[i]
      c.pos += c.dir * c.speed * dt
      let x: number, z: number, heading: number
      if (c.axis === 'x') {
        if (c.pos > this.worldW + 4) c.pos = -4
        if (c.pos < -4) c.pos = this.worldW + 4
        x = c.pos; z = c.lane
        heading = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2
      } else {
        if (c.pos > this.worldD + 4) c.pos = -4
        if (c.pos < -4) c.pos = this.worldD + 4
        x = c.lane; z = c.pos
        heading = c.dir > 0 ? 0 : Math.PI
      }
      this.q.setFromAxisAngle(this.v.set(0, 1, 0), heading)
      this.m.compose(this.v.set(x, 0.52, z), this.q, this.s)
      this.carBody.setMatrixAt(i, this.m)
      const backOff = 0.35
      const cabX = c.axis === 'x' ? x - c.dir * backOff : x
      const cabZ = c.axis === 'z' ? z - c.dir * backOff : z
      this.m.compose(this.v.set(cabX, 1.17, cabZ), this.q, this.s)
      this.carCabin.setMatrixAt(i, this.m)
      // four wheels, offset along the car's own axes
      const alongX = c.axis === 'x'
      for (let k = 0; k < 4; k++) {
        const fore = (k < 2 ? 1 : -1) * 1.25
        const side = (k % 2 === 0 ? 1 : -1) * 0.83
        const wx = alongX ? x + fore * c.dir : x + side
        const wz = alongX ? z + side : z + fore * c.dir
        this.m.compose(this.v.set(wx, 0.33, wz), this.q, this.s)
        this.carWheels.setMatrixAt(i * 4 + k, this.m)
      }
    }
    this.carBody.instanceMatrix.needsUpdate = true
    this.carCabin.instanceMatrix.needsUpdate = true
    this.carWheels.instanceMatrix.needsUpdate = true

    for (let i = 0; i < this.peds.length; i++) {
      const p = this.peds[i]
      p.phase += dt * p.speed * 4.2
      const step = p.speed * dt
      const [dx, dz] = DIRS[p.dir]
      if (!this.walkable(p.x + dx * (step + 0.6), p.z + dz * (step + 0.6))) {
        const options = [(p.dir + 1) % 4, (p.dir + 3) % 4, (p.dir + 2) % 4]
        let turned = false
        for (const o of options) {
          const [ox, oz] = DIRS[o]
          if (this.walkable(p.x + ox * 1.0, p.z + oz * 1.0)) { p.dir = o; turned = true; break }
        }
        if (!turned) p.dir = (p.dir + 2) % 4
      } else {
        p.x += dx * step
        p.z += dz * step
      }
      const bob = Math.sin(p.phase) * 0.035
      const yaw = Math.atan2(DIRS[p.dir][0], DIRS[p.dir][1])
      this.q.setFromAxisAngle(this.v.set(0, 1, 0), yaw)
      this.m.compose(this.v.set(p.x, 0.62 + bob, p.z), this.q, this.s)
      this.pedBody.setMatrixAt(i, this.m)
      this.m.compose(this.v.set(p.x, 1.35 + bob, p.z), this.q, this.s)
      this.pedHead.setMatrixAt(i, this.m)
    }
    this.pedBody.instanceMatrix.needsUpdate = true
    this.pedHead.instanceMatrix.needsUpdate = true
  }
}
