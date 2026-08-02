/**
 * Street furniture that gives the city its Berlin character: Litfassaeulen,
 * orange BSR bins, bollards, traffic lights and cars parked in the kerbside
 * bays. All instanced and static — built once, never touched per frame.
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { CityLayout } from '../world/cityLayout'
import { mulberry32 } from '../world/cityLayout'
import type { Metrics } from './metrics'
import { tileRect } from './metrics'

const PARK_W = 2.0
const KERB_W = 0.35
const BIKE_W = 1.3

const PARKED_COLORS = [0x9aa0a6, 0x2c3e50, 0xb03a2e, 0xe8e8e8, 0x1f6650, 0x34495e, 0x7d6608, 0x515a5a]

export interface PropsResult {
  /** boxes the player should not walk through */
  colliders: Array<{ minX: number; maxX: number; minZ: number; maxZ: number; top: number }>
}

export function buildStreetProps(scene: THREE.Scene, layout: CityLayout, metrics: Metrics): PropsResult {
  const rng = mulberry32(9182736)
  const { tilesW, tilesH, tiles } = layout
  const colliders: PropsResult['colliders'] = []

  const at = (x: number, y: number) => (x < 0 || x >= tilesW || y < 0 || y >= tilesH) ? null : tiles[y * tilesW + x]
  const isRoad = (k: string | null) => k === 'road_h' || k === 'road_v' || k === 'road_x'

  // ---- collect placement slots along every sidewalk kerb
  interface Slot { x: number; z: number; toRoad: { x: number; z: number }; tx: number; ty: number }
  const kerbSlots: Slot[] = []
  for (let ty = 0; ty < tilesH; ty++) {
    for (let tx = 0; tx < tilesW; tx++) {
      if (tiles[ty * tilesW + tx] !== 'sidewalk') continue
      const r = tileRect(metrics, tx, ty)
      // stand clear of the Radweg: props go on the building side of it
      const inset = KERB_W + BIKE_W + 0.75
      let x = r.x + r.w / 2, z = r.z + r.d / 2
      let toRoad: { x: number; z: number } | null = null
      if (isRoad(at(tx, ty - 1))) { z = r.z + inset; toRoad = { x: 0, z: -1 } }
      else if (isRoad(at(tx, ty + 1))) { z = r.z + r.d - inset; toRoad = { x: 0, z: 1 } }
      else if (isRoad(at(tx - 1, ty))) { x = r.x + inset; toRoad = { x: -1, z: 0 } }
      else if (isRoad(at(tx + 1, ty))) { x = r.x + r.w - inset; toRoad = { x: 1, z: 0 } }
      if (!toRoad) continue
      kerbSlots.push({ x, z, toRoad, tx, ty })
    }
  }

  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const v = new THREE.Vector3()
  const one = new THREE.Vector3(1, 1, 1)
  const up = new THREE.Vector3(0, 1, 0)
  const place = (mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, yaw: number) => {
    q.setFromAxisAngle(up, yaw)
    m.compose(v.set(x, y, z), q, one)
    mesh.setMatrixAt(i, m)
  }

  // ---- Litfasssaeule: advertising column, one per handful of blocks
  const columnSlots = kerbSlots.filter((_, i) => i % 23 === 5)
  if (columnSlots.length) {
    const body = new THREE.CylinderGeometry(0.62, 0.66, 3.0, 14)
    body.translate(0, 1.5, 0)
    const cap = new THREE.CylinderGeometry(0.34, 0.72, 0.5, 14)
    cap.translate(0, 3.2, 0)
    const knob = new THREE.SphereGeometry(0.12, 8, 6)
    knob.translate(0, 3.5, 0)
    const geo = mergeGeometries([body, cap, knob], false)!
    body.dispose(); cap.dispose(); knob.dispose()
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({
      map: posterTexture(), roughness: 0.85, envMapIntensity: 0.6,
    }), columnSlots.length)
    mesh.castShadow = true
    columnSlots.forEach((s, i) => {
      place(mesh, i, s.x, 0, s.z, rng() * Math.PI * 2)
      colliders.push({ minX: s.x - 0.7, maxX: s.x + 0.7, minZ: s.z - 0.7, maxZ: s.z + 0.7, top: 3.5 })
    })
    mesh.computeBoundingSphere()
    scene.add(mesh)
  }

  // ---- BSR bins: orange, hung on a post
  const binSlots = kerbSlots.filter((_, i) => i % 11 === 3)
  if (binSlots.length) {
    const post = new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6)
    post.translate(0, 0.55, 0)
    const drum = new THREE.CylinderGeometry(0.24, 0.2, 0.62, 10)
    drum.translate(0, 1.05, 0)
    const geo = mergeGeometries([post, drum], false)!
    post.dispose(); drum.dispose()
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({
      color: 0xe2661a, roughness: 0.55, metalness: 0.15, envMapIntensity: 0.8,
    }), binSlots.length)
    mesh.castShadow = true
    binSlots.forEach((s, i) => place(mesh, i, s.x, 0, s.z, 0))
    mesh.computeBoundingSphere()
    scene.add(mesh)
  }

  // ---- bollards along the kerb
  const bollardSlots: Array<{ x: number; z: number }> = []
  for (const s of kerbSlots) {
    if ((s.tx * 7 + s.ty * 13) % 4 !== 0) continue
    // three per tile, spaced along the kerb line
    const along = { x: -s.toRoad.z, z: s.toRoad.x }
    for (let k = -1; k <= 1; k++) {
      bollardSlots.push({
        x: s.x + along.x * k * 2.6 - s.toRoad.x * 0.55,
        z: s.z + along.z * k * 2.6 - s.toRoad.z * 0.55,
      })
    }
  }
  if (bollardSlots.length) {
    const shaft = new THREE.CylinderGeometry(0.075, 0.085, 0.95, 8)
    shaft.translate(0, 0.475, 0)
    const cap = new THREE.SphereGeometry(0.085, 8, 6)
    cap.translate(0, 0.95, 0)
    const geo = mergeGeometries([shaft, cap], false)!
    shaft.dispose(); cap.dispose()
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({
      color: 0x2b3138, roughness: 0.5, metalness: 0.6, envMapIntensity: 0.9,
    }), bollardSlots.length)
    mesh.castShadow = true
    bollardSlots.forEach((s, i) => place(mesh, i, s.x, 0, s.z, 0))
    mesh.computeBoundingSphere()
    scene.add(mesh)
  }

  // ---- traffic lights on the corners of every crossing
  const lightSlots: Array<{ x: number; z: number; yaw: number }> = []
  for (let ty = 0; ty < tilesH; ty++) {
    for (let tx = 0; tx < tilesW; tx++) {
      if (tiles[ty * tilesW + tx] !== 'road_x') continue
      for (const [dx, dz] of [[1, 1], [-1, -1]] as const) {
        const nx = tx + dx, nz = ty + dz
        if (at(nx, nz) !== 'sidewalk') continue
        const r = tileRect(metrics, nx, nz)
        lightSlots.push({
          x: dx > 0 ? r.x + 1.2 : r.x + r.w - 1.2,
          z: dz > 0 ? r.z + 1.2 : r.z + r.d - 1.2,
          yaw: dx > 0 ? 0 : Math.PI,
        })
      }
    }
  }
  if (lightSlots.length) {
    const mast = new THREE.CylinderGeometry(0.07, 0.09, 3.4, 7)
    mast.translate(0, 1.7, 0)
    const head = new THREE.BoxGeometry(0.3, 0.85, 0.26)
    head.translate(0, 3.7, 0)
    const geo = mergeGeometries([mast, head], false)!
    mast.dispose(); head.dispose()
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({
      color: 0x24282c, roughness: 0.6, metalness: 0.4,
    }), lightSlots.length)
    mesh.castShadow = true
    lightSlots.forEach((s, i) => place(mesh, i, s.x, 0, s.z, s.yaw))
    mesh.computeBoundingSphere()
    scene.add(mesh)

    // the three lenses, as one emissive-ish batch each
    const lensGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.05, 8)
    lensGeo.rotateX(Math.PI / 2)
    const lensDefs = [
      { color: 0xc0392b, emissive: 0x8e1e12, dy: 3.95 },
      { color: 0x6b5a20, emissive: 0x2a2408, dy: 3.7 },
      { color: 0x27ae60, emissive: 0x0f5a2c, dy: 3.45 },
    ]
    for (const def of lensDefs) {
      const lens = new THREE.InstancedMesh(lensGeo, new THREE.MeshStandardMaterial({
        color: def.color, emissive: def.emissive, emissiveIntensity: 0.9, roughness: 0.3,
      }), lightSlots.length)
      lightSlots.forEach((s, i) => {
        const fz = Math.cos(s.yaw), fx = Math.sin(s.yaw)
        place(lens, i, s.x + fx * 0.15, def.dy, s.z + fz * 0.15, s.yaw)
      })
      lens.computeBoundingSphere()
      scene.add(lens)
    }
  }

  // ---- cars parked in the kerbside bays
  interface Park { x: number; z: number; yaw: number }
  const parked: Park[] = []
  for (let ty = 0; ty < tilesH; ty++) {
    for (let tx = 0; tx < tilesW; tx++) {
      const t = tiles[ty * tilesW + tx]
      if (t !== 'road_h' && t !== 'road_v') continue
      const r = tileRect(metrics, tx, ty)
      const horizontal = t === 'road_h'
      const lengthM = horizontal ? r.w : r.d
      // one bay per 6 m, skipping gaps so the row doesn't look like a wall
      for (let off = 3; off < lengthM - 3; off += 6) {
        for (const side of [0, 1]) {
          if (mulberry32(((tx * 3163 + ty * 811 + off * 31 + side) >>> 0))() > 0.55) continue
          if (horizontal) {
            const z = side === 0 ? r.z + PARK_W * 0.5 : r.z + r.d - PARK_W * 0.5
            parked.push({ x: r.x + off, z, yaw: Math.PI / 2 })
          } else {
            const x = side === 0 ? r.x + PARK_W * 0.5 : r.x + r.w - PARK_W * 0.5
            parked.push({ x, z: r.z + off, yaw: 0 })
          }
        }
      }
    }
  }
  if (parked.length) {
    const bodyGeo = new THREE.BoxGeometry(1.78, 0.72, 4.1)
    bodyGeo.translate(0, 0.52, 0)
    const cabinGeo = new THREE.BoxGeometry(1.56, 0.58, 1.95)
    cabinGeo.translate(0, 1.17, -0.35)
    const bodies = new THREE.InstancedMesh(bodyGeo, new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.3, metalness: 0.5, envMapIntensity: 1.1,
    }), parked.length)
    // glazing catches the sky hard, otherwise a dark cabin on a dark body
    // makes the car read as a flat slab
    const cabins = new THREE.InstancedMesh(cabinGeo, new THREE.MeshStandardMaterial({
      color: 0x46525f, roughness: 0.06, metalness: 0.25, envMapIntensity: 2.4,
    }), parked.length)
    const wheelGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.22, 10)
    wheelGeo.rotateZ(Math.PI / 2)
    const wheels = new THREE.InstancedMesh(wheelGeo, new THREE.MeshStandardMaterial({
      color: 0x15181c, roughness: 0.85,
    }), parked.length * 4)
    bodies.castShadow = true
    const col = new THREE.Color()
    parked.forEach((p, i) => {
      place(bodies, i, p.x, 0, p.z, p.yaw)
      place(cabins, i, p.x, 0, p.z, p.yaw)
      col.setHex(PARKED_COLORS[Math.floor(rng() * PARKED_COLORS.length)])
      bodies.setColorAt(i, col)
      const alongX = Math.abs(Math.sin(p.yaw)) > 0.5
      for (let k = 0; k < 4; k++) {
        const fore = (k < 2 ? 1 : -1) * 1.25
        const side = (k % 2 === 0 ? 1 : -1) * 0.83
        const wx = alongX ? p.x + fore : p.x + side
        const wz = alongX ? p.z + side : p.z + fore
        place(wheels, i * 4 + k, wx, 0.33, wz, p.yaw)
      }
      const hx = alongX ? 2.0 : 0.9
      const hz = alongX ? 0.9 : 2.0
      colliders.push({ minX: p.x - hx, maxX: p.x + hx, minZ: p.z - hz, maxZ: p.z + hz, top: 1.2 })
    })
    bodies.computeBoundingSphere(); cabins.computeBoundingSphere(); wheels.computeBoundingSphere()
    scene.add(bodies, cabins, wheels)
  }

  return { colliders }
}

let posterTex: THREE.CanvasTexture | null = null

/** Advertising column wrap: torn poster layers in club-flyer colours. */
function posterTexture(): THREE.CanvasTexture {
  if (posterTex) return posterTex
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#2b2622'
  g.fillRect(0, 0, 256, 128)
  const rng = mulberry32(4242)
  const palette = ['#c0392b', '#e0b93a', '#2e6fb7', '#e8e2d4', '#7d3f9c', '#1f8a5c', '#d4552a']
  for (let i = 0; i < 26; i++) {
    const w = 34 + rng() * 30
    const h = 46 + rng() * 46
    const x = rng() * 256
    const y = 12 + rng() * (128 - h - 12)
    g.fillStyle = palette[Math.floor(rng() * palette.length)]
    g.globalAlpha = 0.9
    g.fillRect(x, y, w, h)
    // headline + body bars so it reads as a poster, not a colour patch
    g.globalAlpha = 1
    g.fillStyle = rng() > 0.5 ? '#1a1713' : '#f2ece0'
    g.fillRect(x + 4, y + 6, w - 8, 6)
    for (let k = 0; k < 3; k++) g.fillRect(x + 4, y + 20 + k * 7, (w - 8) * (0.4 + rng() * 0.5), 3)
  }
  g.globalAlpha = 1
  // grimy base and cap bands
  g.fillStyle = '#1e1b18'
  g.fillRect(0, 118, 256, 10)
  g.fillStyle = '#3a332c'
  g.fillRect(0, 0, 256, 10)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  posterTex = tex
  return tex
}
