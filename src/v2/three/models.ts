/**
 * Optional hand-modelled furniture.
 *
 * Drop a `.glb` into `public/assets/v2/furniture/` named after a kit builder
 * (`sofa.glb`, `bed.glb`, `kitchenRun.glb`, ...) and it replaces the
 * procedural version everywhere. Nothing else changes — no code, no manifest
 * edit — which mirrors how `assets/v2/buildings/*.png` already override the
 * procedural facades.
 *
 * Modelling rules so a drop-in lands correctly:
 *   - metres, Y up, Z forward (the piece faces +z)
 *   - origin on the floor, centred on the footprint
 *   - materials baked into the glb; the kit palette is not applied to models
 *
 * Loading is fire-and-forget at boot. A tour opened before a model finishes
 * loading just uses the procedural piece for that visit.
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const BASE = 'assets/v2/furniture/'

/** Names we look for. Anything absent silently falls back to the kit. */
export const FURNITURE_NAMES = [
  'sofa', 'couchTable', 'shelf', 'bed', 'wardrobe', 'kitchenRun', 'fridge',
  'bathtub', 'basin', 'toilet', 'mirror', 'desk', 'chair', 'radiator',
  'ceilingLamp', 'doorLeaf', 'boiler', 'meterBoard', 'cartonBox',
] as const

const cache = new Map<string, THREE.Object3D>()
let started = false

export function preloadFurniture() {
  if (started) return
  started = true
  const loader = new GLTFLoader()
  for (const name of FURNITURE_NAMES) {
    loader.load(
      `${BASE}${name}.glb`,
      gltf => {
        const root = gltf.scene
        root.traverse(o => {
          const mesh = o as THREE.Mesh
          if (!mesh.isMesh) return
          mesh.castShadow = true
          mesh.receiveShadow = true
        })
        cache.set(name, root)
      },
      undefined,
      () => { /* not provided — the kit builder covers it */ },
    )
  }
}

/** A fresh clone of a hand-modelled piece, or null if none was supplied. */
export function getModel(name: string): THREE.Object3D | null {
  const root = cache.get(name)
  return root ? root.clone(true) : null
}

export function hasModel(name: string): boolean {
  return cache.has(name)
}
