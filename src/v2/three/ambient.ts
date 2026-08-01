/**
 * Ambient city life: low-poly cars cruising the avenues and pedestrians
 * strolling the sidewalks. Pure decoration — instanced meshes, deterministic
 * spawns, cheap per-frame matrix updates.
 */
import * as THREE from 'three'
import type { CityLayout, TileKind } from '../world/cityLayout'
import { mulberry32 } from '../world/cityLayout'

const TILE_M = 12

const CAR_COLORS = [0xc0392b, 0x2980b9, 0xf1c40f, 0xe8e8e8, 0x2c3e50, 0x27ae60, 0x8e44ad, 0xd35400, 0x95a5a6, 0x16a085]
const CLOTHES = [0xc0392b, 0x2980b9, 0xe67e22, 0x27ae60, 0x8e44ad, 0x34495e, 0xd35400, 0x7f8c8d, 0xf1c40f, 0x16a085]
const LANE_OFFSET = 2.7

interface Car {
  axis: 'x' | 'z'
  lane: number      // fixed world coord on the other axis
  dir: 1 | -1
  pos: number       // world coord along the axis
  speed: number
}

interface Ped {
  x: number
  z: number
  dir: number       // 0=+x 1=+z 2=-x 3=-z
  speed: number
  phase: number
}

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const

export class AmbientLife {
  private cars: Car[] = []
  private peds: Ped[] = []
  private carBody: THREE.InstancedMesh
  private carCabin: THREE.InstancedMesh
  private pedBody: THREE.InstancedMesh
  private pedHead: THREE.InstancedMesh
  private layout: CityLayout
  private worldW: number
  private worldH: number
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private v = new THREE.Vector3()
  private s = new THREE.Vector3(1, 1, 1)

  constructor(scene: THREE.Scene, layout: CityLayout, carCount = 44, pedCount = 80) {
    this.layout = layout
    this.worldW = layout.tilesW * TILE_M
    this.worldH = layout.tilesH * TILE_M
    const rng = mulberry32(20260801)

    // --- cars on every avenue, right-hand traffic
    const hRows: number[] = []
    const vCols: number[] = []
    for (let ty = 0; ty < layout.tilesH; ty += 4) hRows.push(ty)
    for (let tx = 0; tx < layout.tilesW; tx += 6) vCols.push(tx)
    for (let i = 0; i < carCount; i++) {
      const horizontal = rng() > 0.45
      const dir: 1 | -1 = rng() > 0.5 ? 1 : -1
      if (horizontal) {
        const row = hRows[Math.floor(rng() * hRows.length)]
        const center = row * TILE_M + TILE_M / 2
        this.cars.push({ axis: 'x', lane: center + dir * LANE_OFFSET, dir, pos: rng() * this.worldW, speed: 8 + rng() * 6 })
      } else {
        const col = vCols[Math.floor(rng() * vCols.length)]
        const center = col * TILE_M + TILE_M / 2
        this.cars.push({ axis: 'z', lane: center - dir * LANE_OFFSET, dir, pos: rng() * this.worldH, speed: 8 + rng() * 6 })
      }
    }

    const bodyGeo = new THREE.BoxGeometry(1.75, 0.6, 3.9)
    const cabinGeo = new THREE.BoxGeometry(1.55, 0.55, 1.9)
    this.carBody = new THREE.InstancedMesh(bodyGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), this.cars.length)
    this.carCabin = new THREE.InstancedMesh(cabinGeo, new THREE.MeshLambertMaterial({ color: 0x1a232e }), this.cars.length)
    this.carBody.castShadow = true
    this.cars.forEach((_, i) => this.carBody.setColorAt(i, new THREE.Color(CAR_COLORS[i % CAR_COLORS.length])))
    scene.add(this.carBody, this.carCabin)

    // --- pedestrians on sidewalks
    const sidewalks: Array<{ tx: number; ty: number }> = []
    for (let ty = 0; ty < layout.tilesH; ty++) {
      for (let tx = 0; tx < layout.tilesW; tx++) {
        if (layout.tiles[ty * layout.tilesW + tx] === 'sidewalk') sidewalks.push({ tx, ty })
      }
    }
    for (let i = 0; i < pedCount && sidewalks.length > 0; i++) {
      const t = sidewalks[Math.floor(rng() * sidewalks.length)]
      this.peds.push({
        x: t.tx * TILE_M + 2 + rng() * (TILE_M - 4),
        z: t.ty * TILE_M + 2 + rng() * (TILE_M - 4),
        dir: Math.floor(rng() * 4),
        speed: 1.1 + rng() * 1.1,
        phase: rng() * Math.PI * 2,
      })
    }
    const pedGeo = new THREE.CapsuleGeometry(0.26, 0.72, 2, 6)
    const headGeo = new THREE.SphereGeometry(0.19, 6, 5)
    this.pedBody = new THREE.InstancedMesh(pedGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), this.peds.length)
    this.pedHead = new THREE.InstancedMesh(headGeo, new THREE.MeshLambertMaterial({ color: 0xe8c39e }), this.peds.length)
    this.pedBody.castShadow = true
    this.peds.forEach((_, i) => this.pedBody.setColorAt(i, new THREE.Color(CLOTHES[i % CLOTHES.length])))
    scene.add(this.pedBody, this.pedHead)

    this.update(0)
  }

  private tileAt(x: number, z: number): TileKind | null {
    const tx = Math.floor(x / TILE_M), ty = Math.floor(z / TILE_M)
    if (tx < 0 || tx >= this.layout.tilesW || ty < 0 || ty >= this.layout.tilesH) return null
    return this.layout.tiles[ty * this.layout.tilesW + tx]
  }

  private walkable(x: number, z: number): boolean {
    const t = this.tileAt(x, z)
    return t === 'sidewalk' || t === 'plaza' || t === 'park'
  }

  update(dt: number) {
    // cars
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
        if (c.pos > this.worldH + 4) c.pos = -4
        if (c.pos < -4) c.pos = this.worldH + 4
        x = c.lane; z = c.pos
        heading = c.dir > 0 ? 0 : Math.PI
      }
      this.q.setFromAxisAngle(this.v.set(0, 1, 0), heading)
      this.m.compose(this.v.set(x, 0.42, z), this.q, this.s)
      this.carBody.setMatrixAt(i, this.m)
      this.m.compose(this.v.set(x, 0.95, z), this.q, this.s)
      this.carCabin.setMatrixAt(i, this.m)
    }
    this.carBody.instanceMatrix.needsUpdate = true
    this.carCabin.instanceMatrix.needsUpdate = true

    // pedestrians
    for (let i = 0; i < this.peds.length; i++) {
      const p = this.peds[i]
      p.phase += dt * p.speed * 4.2
      const step = p.speed * dt
      const [dx, dz] = DIRS[p.dir]
      const aheadX = p.x + dx * (step + 0.5)
      const aheadZ = p.z + dz * (step + 0.5)
      if (!this.walkable(aheadX, aheadZ)) {
        // try left / right / back, deterministic-ish preference
        const options = [(p.dir + 1) % 4, (p.dir + 3) % 4, (p.dir + 2) % 4]
        let turned = false
        for (const o of options) {
          const [ox, oz] = DIRS[o]
          if (this.walkable(p.x + ox * 0.9, p.z + oz * 0.9)) { p.dir = o; turned = true; break }
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
