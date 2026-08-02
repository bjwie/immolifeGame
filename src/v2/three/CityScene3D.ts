/**
 * First-person 3D city scene (Three.js) — replaces the old Phaser CityScene.
 * Owns the camera/world/buildings and wires the Engine to the DOM UI exactly
 * like the 2D scene did: same events, same modals, same tooltip, same
 * lock/unlock visuals — just walkable at street level.
 */
import * as THREE from 'three'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { generateCityLayout, formatProgress, mulberry32 } from '../world/cityLayout'
import type { CityLayout, DistrictDef, DistrictId } from '../world/cityLayout'
import { rollStyle, mixColor } from '../world/buildingStyle'
import type { BuildingKind } from '../world/buildingStyle'
import { paintGround, paintLockOverlay } from './ground'
import { AmbientLife } from './ambient'
import { facadeTexture, dimsFor, ownedBadgeTexture, contactShadowTexture, gableGeometry, trimGeometry, trimColor } from './facade'
import type { BuildingDims, Lot, Face } from './facade'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { buildMetrics, tileCenter, tileRect, tileAtWorld } from './metrics'
import type { Metrics } from './metrics'
import { Engine, formatEuro } from '../sim/Engine'
import type { Property } from '../sim/types'
import { HUD } from '../ui/HUD'
import { DealSheet } from '../ui/DealSheet'
import { MenuModal } from '../ui/MenuModal'
import { NegotiationModal } from '../ui/NegotiationModal'
import { RentalModal } from '../ui/RentalModal'
import { RenovationModal } from '../ui/RenovationModal'
import { WEGModal } from '../ui/WEGModal'
import { ActivityLog } from '../ui/ActivityLog'
import { ModalManager } from '../ui/ModalManager'

const EYE = 1.7
const WALK_SPEED = 9
const SPRINT_SPEED = 18
const PLAYER_RADIUS = 0.45

interface BuildingHandle {
  group: THREE.Group
  prop: Property
  isOwned: boolean
  snapshotKey: string
  dims: BuildingDims
  frontDir: THREE.Vector3
  center: THREE.Vector3
  priceLabel?: { obj: CSS2DObject; el: HTMLDivElement; textEl: HTMLElement }
  meshes: THREE.Mesh[]
}

interface Collider {
  minX: number; maxX: number; minZ: number; maxZ: number
  /** roof height — only needed for the label occlusion test */
  top: number
  /** set for market buildings so a label can ignore its own building */
  ownerId?: string
}

/** Slab test: does the ray [origin, origin + dir*limit] enter this box? */
function rayHitsBox(
  ox: number, oy: number, oz: number,
  rx: number, ry: number, rz: number,
  limit: number, c: Collider,
): boolean {
  let tmin = 0
  let tmax = limit
  const axis = (o: number, r: number, lo: number, hi: number) => {
    if (Math.abs(r) < 1e-6) return o >= lo && o <= hi
    let t1 = (lo - o) / r
    let t2 = (hi - o) / r
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t }
    if (t1 > tmin) tmin = t1
    if (t2 < tmax) tmax = t2
    return tmin <= tmax
  }
  if (!axis(ox, rx, c.minX, c.maxX)) return false
  if (!axis(oy, ry, 0, c.top)) return false
  if (!axis(oz, rz, c.minZ, c.maxZ)) return false
  return true
}

export class CityScene3D {
  readonly engine: Engine
  private layout: CityLayout
  private metrics: Metrics

  private renderer: THREE.WebGLRenderer
  private css2d: CSS2DRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private sun: THREE.DirectionalLight

  private buildingsRoot = new THREE.Group()
  private byPropertyId = new Map<string, BuildingHandle>()
  private colliders: Collider[] = []
  /** Backdrop city: every buildable spot without an active property gets a
   *  deterministic filler building (instanced, non-purchasable). */
  private fillerRoot = new THREE.Group()
  private fillerColliders: Collider[] = []
  private staticColliders: Collider[] = []
  private lastFillerToast = 0
  /** Fillers are built once for every buildable lot. When the market puts a
   *  real property on a lot we only hide that lot's instances — rebuilding all
   *  ~470 batches cost 120 ms and showed up as a hitch while walking. */
  private fillerBuilt = false
  private fillerTiles = new Map<string, {
    refs: Array<{ mesh: THREE.InstancedMesh; index: number; matrix: THREE.Matrix4 }>
    collider: Collider
  }>()
  private hiddenFillerTiles = new Set<string>()

  private lockOverlays = new Map<DistrictId, THREE.Mesh>()
  /** Visual unlock state for teaser districts. The shared layout's `locked`
   *  flag stays untouched — Engine.resetToFresh() re-seeds from it. */
  private visuallyUnlocked = new Set<DistrictId>()
  private banners = new Map<DistrictId, { el: HTMLDivElement; nameEl: HTMLDivElement; subEl: HTMLDivElement; pos: THREE.Vector3 }>()

  private hud: HUD
  private deal: DealSheet
  private menu: MenuModal
  private activityLog: ActivityLog
  private hoverDiv: HTMLDivElement
  private crosshair: HTMLDivElement
  private hint: HTMLDivElement
  private hoveredPropertyId: string | null = null
  private aimedHandle: BuildingHandle | null = null

  // player state
  private yaw = 0
  private pitch = -0.05
  private pos = new THREE.Vector3()
  private keys = new Set<string>()
  private locked = false
  private lastLockToast = 0
  /** Pointer lock unavailable (iframe/edge cases): drag-to-look + cursor picking. */
  private fallbackLook = false
  private drag: { x: number; y: number; total: number; dragged: boolean } | null = null
  private cursor = { x: 0, y: 0 }

  private raycaster = new THREE.Raycaster()
  private clock = new THREE.Clock()
  private particles: Array<{ mesh: THREE.Mesh; vel: THREE.Vector3; life: number }> = []
  private disposed = false
  private sunDir = new THREE.Vector3()
  private bobPhase = 0
  private bobAmount = 0
  private fovTarget = 72
  private ambient!: AmbientLife
  private clouds: Array<{ sprite: THREE.Sprite; speed: number }> = []

  constructor(container: HTMLElement) {
    this.layout = generateCityLayout(48, 4242)
    this.metrics = buildMetrics(this.layout)

    // Engine — pick up the difficulty chosen at the start screen (only relevant
    // for a fresh game; on continue, the saved difficulty wins via tryLoad).
    const chosenDifficulty = (window as any).__immolife_difficulty as 'easy' | 'standard' | 'hardcore' | undefined
    this.engine = new Engine(this.layout, chosenDifficulty ? { freshStart: true, difficulty: chosenDifficulty } : {})
    if (chosenDifficulty) delete (window as any).__immolife_difficulty

    // --- renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 0.78
    container.appendChild(this.renderer.domElement)

    this.css2d = new CSS2DRenderer()
    this.css2d.setSize(window.innerWidth, window.innerHeight)
    this.css2d.domElement.style.position = 'absolute'
    this.css2d.domElement.style.inset = '0'
    this.css2d.domElement.style.pointerEvents = 'none'
    container.appendChild(this.css2d.domElement)

    // The far plane doubles as the cheapest possible occlusion budget: the
    // frustum discards whole city blocks past it, and the fog hides the cut.
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 380)

    // --- sky, fog, lights: late-afternoon Berlin light
    const sky = new Sky()
    sky.scale.setScalar(4000)
    const skyU = sky.material.uniforms
    skyU.turbidity.value = 3.2
    skyU.rayleigh.value = 1.1
    skyU.mieCoefficient.value = 0.0035
    skyU.mieDirectionalG.value = 0.8
    // Every lot fronts +z, so the sun has to sit on the +z side or every single
    // street facade in the city would be permanently in its own shadow.
    this.sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 54), THREE.MathUtils.degToRad(28))
    skyU.sunPosition.value.copy(this.sunDir)

    this.scene.add(sky)
    // IBL comes from a plain sky/ground gradient, NOT from the Sky shader:
    // Sky outputs unnormalised radiance in the hundreds, which through PMREM
    // blows every surface to white. A 0..1 gradient keeps envMapIntensity
    // meaning what it says.
    this.scene.environment = this.buildEnvironment()
    this.scene.fog = new THREE.Fog(0xcfe0ef, 70, 350)
    // the gradient environment already supplies sky/ground bounce, so the
    // hemisphere light is only a gentle top-up now
    this.scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x6a8a5e, 0.62))
    this.sun = new THREE.DirectionalLight(0xfff2dc, 2.9)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.bias = -0.0004
    // Shadow casting ignores the view frustum, so every metre of this box costs
    // draw calls every frame. Keep it tight around the player — that is the only
    // place contact shadows read anyway.
    const sc = this.sun.shadow.camera
    sc.left = -48; sc.right = 48; sc.top = 48; sc.bottom = -48
    sc.near = 10; sc.far = 380
    this.scene.add(this.sun)
    this.scene.add(this.sun.target)

    // --- ground + trees
    const ground = paintGround(this.layout, this.metrics)
    const groundTex = new THREE.CanvasTexture(ground.canvas)
    groundTex.colorSpace = THREE.SRGBColorSpace
    groundTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
    const worldW = this.metrics.width
    const worldH = this.metrics.depth
    const groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(worldW, worldH),
      new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.93, metalness: 0.0, envMapIntensity: 0.3 }),
    )
    groundMesh.rotation.x = -Math.PI / 2
    groundMesh.position.set(worldW / 2, 0, worldH / 2)
    groundMesh.receiveShadow = true
    this.scene.add(groundMesh)
    // grass apron beyond city bounds so the horizon isn't a void
    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(worldW * 4, worldH * 6),
      new THREE.MeshStandardMaterial({ color: 0x5aa647, roughness: 1, envMapIntensity: 0.4 }),
    )
    apron.rotation.x = -Math.PI / 2
    apron.position.set(worldW / 2, -0.05, worldH / 2)
    this.scene.add(apron)
    this.plantTrees(ground.treeSpots)
    this.plantStreetLamps()

    this.scene.add(this.buildingsRoot)
    this.scene.add(this.fillerRoot)
    // spawn first so ambient life can keep clear of the camera on frame one
    this.spawnPlayer()
    this.ambient = new AmbientLife(this.scene, this.layout, this.metrics, 60, 150, this.pos)
    this.mountPlazaFountain()
    this.mountClouds()

    // --- locked-district overlays + banners
    for (const d of this.layout.districts) {
      if (d.locked) this.mountLockOverlay(d)
      this.mountBanner(d)
    }

    // --- DOM UI (identical wiring to the 2D scene)
    const overlay = (window as any).__overlayRoot as HTMLElement
    this.hud = new HUD(this.engine, overlay, () => this.menu.open())
    this.deal = new DealSheet(this.engine, overlay)
    const negModal = new NegotiationModal(this.engine, overlay)
    const rentalModal = new RentalModal(this.engine, overlay)
    const renovationModal = new RenovationModal(this.engine, overlay)
    const wegModal = new WEGModal(this.engine, overlay)
    this.activityLog = new ActivityLog(this.engine, overlay)
    this.activityLog.onFocusProperty = (id) => this.focusProperty(id)
    this.deal.setNegotiationModal(negModal)
    this.deal.setRentalModal(rentalModal)
    this.deal.setRenovationModal(renovationModal)
    this.deal.setWegModal(wegModal)
    this.menu = new MenuModal(this.engine, overlay, () => this.refreshProperties())

    this.hoverDiv = document.createElement('div')
    this.hoverDiv.className = 'prop-tooltip fp'
    overlay.appendChild(this.hoverDiv)

    this.crosshair = document.createElement('div')
    this.crosshair.id = 'crosshair'
    overlay.appendChild(this.crosshair)

    this.hint = document.createElement('div')
    this.hint.id = 'fp-hint'
    this.hint.innerHTML = `🖱 <b>Klicken</b>: Steuerung uebernehmen · <b>WASD</b> Laufen · <b>Shift</b> Sprint · <b>Leertaste</b> Pause · <b>ESC</b> Menue`
    overlay.appendChild(this.hint)

    // --- engine -> view sync (same events as the 2D scene)
    this.engine.on('bought', () => { this.refreshProperties(); this.refreshLockProgress() })
    this.engine.on('sold', (data: any) => { this.refreshProperties(); this.spawnCoinBurst(data.property); this.refreshLockProgress() })
    this.engine.on('renovated', () => this.refreshProperties())
    this.engine.on('renovationStart', () => this.refreshProperties())
    this.engine.on('renovationDone', () => this.refreshProperties())
    this.engine.on('leaseSigned', () => this.refreshProperties())
    this.engine.on('month', () => { this.refreshProperties(); this.refreshLockProgress() })
    this.engine.on('reset', () => { this.resyncLockVisuals(); this.refreshProperties(); this.refreshLockProgress() })
    this.engine.on('districtUnlocked', (data: { id: string; name: string; label: string }) => {
      this.unlockDistrictVisual(data.id as DistrictId, true)
      this.hud.toast(`${data.name} freigeschaltet!`, 'success')
      this.refreshProperties()
    })

    // Reconcile: a save may have districts already unlocked from a previous
    // session, but the freshly-generated layout marks them locked.
    this.resyncLockVisuals()
    this.refreshLockProgress()


    this.refreshProperties()
    this.setupInput()

    window.addEventListener('resize', this.onResize)

    this.engine.start()
    setTimeout(() => {
      const t = this.engine.state.time
      this.hud.toast(`Willkommen! Du startest mit ${formatEuro(this.engine.state.player.cash)} im ${t.month}/${t.year}.`, 'success')
    }, 400)

    this.loop()
  }

  /** Sky/ground gradient prefiltered into an irradiance map — gives every
   *  PBR surface believable ambient bounce without a real HDRI. */
  private buildEnvironment(): THREE.Texture {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 32
    const g = c.getContext('2d')!
    const grad = g.createLinearGradient(0, 0, 0, 32)
    grad.addColorStop(0.00, '#7fa9df')
    grad.addColorStop(0.45, '#c3d8ee')
    grad.addColorStop(0.50, '#d6dfe4')
    grad.addColorStop(0.56, '#8c9472')
    grad.addColorStop(1.00, '#5b6448')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 32)
    const tex = new THREE.CanvasTexture(c)
    tex.mapping = THREE.EquirectangularReflectionMapping
    tex.colorSpace = THREE.SRGBColorSpace
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const rt = pmrem.fromEquirectangular(tex)
    pmrem.dispose()
    tex.dispose()
    return rt.texture
  }

  /** Stand the player on the Mitte sidewalk closest to the middle of the
   *  district, looking down the street rather than at a wall. */
  private spawnPlayer() {
    const mitte = this.layout.districts.find(d => d.id === 'mitte') ?? this.layout.districts[1]
    const { tilesW, tiles } = this.layout
    const target = this.districtRect(mitte)
    let best: { x: number; z: number; dist: number } | null = null
    for (let ty = mitte.bounds.y; ty < mitte.bounds.y + mitte.bounds.h; ty++) {
      if (this.metrics.rowKind[ty] !== 'walk') continue
      for (let tx = mitte.bounds.x; tx < mitte.bounds.x + mitte.bounds.w; tx++) {
        if (tiles[ty * tilesW + tx] !== 'sidewalk') continue
        if (this.metrics.colKind[tx] !== 'build') continue
        const c = tileCenter(this.metrics, tx, ty)
        const dist = Math.hypot(c.x - target.cx, c.z - target.cz)
        if (!best || dist < best.dist) best = { x: c.x, z: c.z, dist }
      }
    }
    this.pos.set(best?.x ?? this.metrics.width / 2, EYE, best?.z ?? this.metrics.depth / 2)
    this.yaw = Math.PI / 2   // look east, along the street
    this.pitch = 0
  }

  // ------------------------------------------------------------------ trees

  private plantTrees(spots: Array<{ x: number; z: number; park: boolean }>) {
    if (spots.length === 0) return
    // Street trees: slim trunk, crown starting above head height so you can
    // walk under them without the canopy clipping the camera. Each canopy is
    // three overlapping blobs with their own rotation, scale and green, which
    // is what stops a whole avenue of trees reading as one cloned lollipop.
    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.27, 4.2, 7)
    const crownGeo = new THREE.IcosahedronGeometry(1.55, 1)
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.95, envMapIntensity: 0.4 })
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, envMapIntensity: 0.5, flatShading: true })
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length)
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, spots.length * 3)
    trunks.castShadow = true
    crowns.castShadow = true

    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const v = new THREE.Vector3()
    const sc = new THREE.Vector3()
    const col = new THREE.Color()
    const GREENS = [0x2f7d27, 0x3d9130, 0x276b23, 0x49a13a]
    let ci = 0
    spots.forEach((sp, i) => {
      const rng = mulberry32(Math.round(sp.x * 31 + sp.z * 17) >>> 0)
      const scale = (sp.park ? 1.25 : 0.92) + rng() * 0.3
      const lean = (rng() - 0.5) * 0.09
      e.set(lean, rng() * Math.PI * 2, (rng() - 0.5) * 0.06)
      q.setFromEuler(e)
      m.compose(v.set(sp.x, 2.1 * scale, sp.z), q, sc.set(1, scale, 1))
      trunks.setMatrixAt(i, m)
      for (let k = 0; k < 3; k++) {
        const bs = scale * (k === 0 ? 1.0 : 0.62 + rng() * 0.25)
        const off = k === 0 ? 0 : 1.0 * scale
        const ang = rng() * Math.PI * 2
        e.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI)
        q.setFromEuler(e)
        m.compose(
          v.set(sp.x + Math.cos(ang) * off, (5.0 + (k === 0 ? 0 : rng() * 1.3)) * scale, sp.z + Math.sin(ang) * off),
          q, sc.set(bs, bs * 0.9, bs),
        )
        crowns.setMatrixAt(ci, m)
        col.setHex(GREENS[Math.floor(rng() * GREENS.length)])
        crowns.setColorAt(ci, col)
        ci++
      }
    })
    trunks.computeBoundingSphere(); crowns.computeBoundingSphere()
    this.scene.add(trunks, crowns)

    // bushes around park trees
    const parkSpots = spots.filter(s => s.park)
    if (parkSpots.length > 0) {
      const bushGeo = new THREE.IcosahedronGeometry(0.65, 1)
      const bushes = new THREE.InstancedMesh(bushGeo, new THREE.MeshStandardMaterial({ color: 0x3c8f30, roughness: 0.95, flatShading: true }), parkSpots.length * 3)
      let bi = 0
      parkSpots.forEach((sp, i) => {
        const rng = mulberry32(i * 7919 + 13)
        for (let k = 0; k < 3; k++) {
          const ang = rng() * Math.PI * 2
          const dist = 2.5 + rng() * 2.4
          const s2 = 0.7 + rng() * 0.6
          m.makeScale(s2, s2 * 0.8, s2).setPosition(sp.x + Math.cos(ang) * dist, 0.35 * s2, sp.z + Math.sin(ang) * dist)
          bushes.setMatrixAt(bi++, m)
        }
      })
      bushes.computeBoundingSphere()
      this.scene.add(bushes)
    }
  }

  /** A real fountain on the central plaza in Mitte. */
  private mountPlazaFountain() {
    const { tilesW, tilesH, tiles } = this.layout
    const at = (x: number, y: number) => (x >= 0 && x < tilesW && y >= 0 && y < tilesH) ? tiles[y * tilesW + x] : null
    for (let ty = 0; ty < tilesH; ty++) {
      for (let tx = 0; tx < tilesW; tx++) {
        if (at(tx, ty) !== 'plaza') continue
        if (at(tx - 1, ty) !== 'plaza' || at(tx + 1, ty) !== 'plaza' || at(tx, ty - 1) !== 'plaza' || at(tx, ty + 1) !== 'plaza') continue
        const c0 = tileCenter(this.metrics, tx, ty)
        const cx = c0.x, cz = c0.z
        const stone = new THREE.MeshStandardMaterial({ color: 0xcfc6ae, roughness: 0.85, envMapIntensity: 0.7 })
        // real water: smooth and reflective, so it catches the sky
        const water = new THREE.MeshStandardMaterial({ color: 0x3f93cf, roughness: 0.06, metalness: 0.25, envMapIntensity: 1.6 })
        const basin = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.6, 0.9, 20), stone)
        basin.position.set(cx, 0.45, cz)
        basin.castShadow = true
        const pool = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 4.0, 0.12, 20), water)
        pool.position.set(cx, 0.85, cz)
        const column = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 2.4, 10), stone)
        column.position.set(cx, 1.8, cz)
        column.castShadow = true
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.1, 0.5, 14), stone)
        bowl.position.set(cx, 3.1, cz)
        bowl.castShadow = true
        const bowlWater = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.1, 14), water)
        bowlWater.position.set(cx, 3.4, cz)
        this.scene.add(basin, pool, column, bowl, bowlWater)
        this.staticColliders.push({ minX: cx - 4.6, maxX: cx + 4.6, minZ: cz - 4.6, maxZ: cz + 4.6, top: 3.5 })
        // benches facing the fountain
        const wood = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.8, envMapIntensity: 0.6 })
        const iron = new THREE.MeshStandardMaterial({ color: 0x30363c, roughness: 0.42, metalness: 0.7, envMapIntensity: 0.9 })
        for (let k = 0; k < 4; k++) {
          const ang = k * Math.PI / 2 + Math.PI / 4
          const bx = cx + Math.cos(ang) * 9.5, bz = cz + Math.sin(ang) * 9.5
          const bench = new THREE.Group()
          const seat = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.7), wood)
          seat.position.y = 0.55
          const back = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.55, 0.1), wood)
          back.position.set(0, 0.95, -0.32)
          const legL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.6), iron)
          legL.position.set(-1.1, 0.28, 0)
          const legR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.6), iron)
          legR.position.set(1.1, 0.28, 0)
          bench.add(seat, back, legL, legR)
          bench.position.set(bx, 0, bz)
          bench.rotation.y = Math.atan2(cx - bx, cz - bz)
          bench.traverse(o => { (o as THREE.Mesh).castShadow = true })
          this.scene.add(bench)
        }
        return
      }
    }
  }

  /** Soft cloud sprites drifting over the city. */
  private mountClouds() {
    const c = document.createElement('canvas')
    c.width = 256; c.height = 128
    const g = c.getContext('2d')!
    const rng = mulberry32(777)
    for (let i = 0; i < 9; i++) {
      const x = 40 + rng() * 176, y = 40 + rng() * 48, r = 22 + rng() * 30
      const grad = g.createRadialGradient(x, y, r * 0.15, x, y, r)
      grad.addColorStop(0, 'rgba(255,255,255,0.85)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = grad
      g.fillRect(x - r, y - r, r * 2, r * 2)
    }
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    const worldW = this.metrics.width
    const worldH = this.metrics.depth
    const rng2 = mulberry32(1312)
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.45 + rng2() * 0.3, depthWrite: false })
      const sprite = new THREE.Sprite(mat)
      const s = 70 + rng2() * 90
      sprite.scale.set(s, s * 0.42, 1)
      sprite.position.set(rng2() * (worldW + 600) - 300, 110 + rng2() * 70, rng2() * (worldH + 400) - 200)
      this.scene.add(sprite)
      this.clouds.push({ sprite, speed: 1.2 + rng2() * 2.2 })
    }
  }

  /** Warm-bulb street lamps standing at the kerb along every sidewalk strip. */
  private plantStreetLamps() {
    const { tilesW, tilesH, tiles } = this.layout
    const spots: Array<{ x: number; z: number; toRoad: { x: number; z: number } }> = []
    const isRoad = (tx: number, ty: number) => {
      if (tx < 0 || tx >= tilesW || ty < 0 || ty >= tilesH) return false
      const t = tiles[ty * tilesW + tx]
      return t === 'road_h' || t === 'road_v' || t === 'road_x'
    }
    for (let ty = 0; ty < tilesH; ty++) {
      for (let tx = 0; tx < tilesW; tx++) {
        if (tiles[ty * tilesW + tx] !== 'sidewalk') continue
        // one lamp per two lots, offset from the tree rhythm
        if (((tx * 91 + ty * 53) & 0xff) % 3 !== 1) continue
        const r = tileRect(this.metrics, tx, ty)
        const inset = 1.3
        let x = r.x + r.w / 2, z = r.z + r.d / 2
        let toRoad: { x: number; z: number }
        if (isRoad(tx, ty - 1)) { z = r.z + inset; toRoad = { x: 0, z: -1 } }
        else if (isRoad(tx, ty + 1)) { z = r.z + r.d - inset; toRoad = { x: 0, z: 1 } }
        else if (isRoad(tx - 1, ty)) { x = r.x + inset; toRoad = { x: -1, z: 0 } }
        else if (isRoad(tx + 1, ty)) { x = r.x + r.w - inset; toRoad = { x: 1, z: 0 } }
        else continue
        spots.push({ x, z, toRoad })
      }
    }
    if (spots.length === 0) return
    // Berlin street lamp: mast + curved bracket reaching over the kerb, with
    // the luminaire hanging off the end rather than a lollipop on a stick.
    const mast = new THREE.CylinderGeometry(0.08, 0.14, 6.0, 7)
    const arm = new THREE.BoxGeometry(0.1, 0.1, 1.5)
    arm.translate(0, 3.0, 0.75)
    const collar = new THREE.CylinderGeometry(0.17, 0.17, 0.3, 8)
    collar.translate(0, 2.55, 0)
    const poleGeo = mergeGeometries([mast, arm, collar], false)!
    mast.dispose(); arm.dispose(); collar.dispose()
    const shade = new THREE.ConeGeometry(0.42, 0.42, 10)
    shade.translate(0, 0.2, 0)
    const bulb = new THREE.SphereGeometry(0.26, 8, 6)
    const headGeo = mergeGeometries([shade, bulb], false)!
    shade.dispose(); bulb.dispose()
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c343c, roughness: 0.45, metalness: 0.75, envMapIntensity: 0.9 })
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffe9b0, emissive: 0xffd98a, emissiveIntensity: 1.1, roughness: 0.3 })
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, spots.length)
    const heads = new THREE.InstancedMesh(headGeo, headMat, spots.length)
    poles.castShadow = true
    const m = new THREE.Matrix4()
    const lampQ = new THREE.Quaternion()
    const lampV = new THREE.Vector3()
    const lampS = new THREE.Vector3(1, 1, 1)
    spots.forEach((sp, i) => {
      // turn the bracket so it reaches out over the roadway
      const yaw = Math.atan2(sp.toRoad.x, sp.toRoad.z)
      lampQ.setFromAxisAngle(lampV.set(0, 1, 0), yaw)
      m.compose(lampV.set(sp.x, 3.0, sp.z), lampQ, lampS)
      poles.setMatrixAt(i, m)
      m.compose(lampV.set(sp.x + sp.toRoad.x * 1.5, 5.85, sp.z + sp.toRoad.z * 1.5), lampQ, lampS)
      heads.setMatrixAt(i, m)
    })
    poles.computeBoundingSphere(); heads.computeBoundingSphere()
    this.scene.add(poles, heads)
  }

  // ------------------------------------------------------ filler city

  /** The city is fully built: every buildable spot that has no active listing
   *  or owned property carries a deterministic backdrop building. Only market
   *  objects are interactive — fillers answer clicks with an info toast. */
  private buildFillers() {
    if (this.fillerBuilt) return

    // dispose previous batch meshes
    for (const child of [...this.fillerRoot.children]) {
      const mesh = child as THREE.InstancedMesh
      mesh.geometry.dispose()
      const mat = mesh.material
      if (Array.isArray(mat)) mat.forEach(m => m.dispose())
      else mat.dispose()
    }
    this.fillerRoot.clear()
    this.fillerColliders = []
    this.fillerTiles.clear()
    this.hiddenFillerTiles.clear()
    this.fillerBuilt = true

    interface Batch {
      kind: BuildingKind
      district: string | undefined
      seed: number
      lot: Lot
      spots: Array<{ x: number; z: number; yaw: number; front: THREE.Vector3; tile: string }>
    }
    // Batched per (block, style): keeping a batch inside one city block keeps
    // its bounding sphere small, so the frustum can cull whole blocks that are
    // behind the player instead of drawing the entire city every frame.
    const batches = new Map<string, Batch>()
    const districtIndex = new Map(this.layout.districts.map((d, i) => [d.id, i]))

    for (const spot of this.layout.buildableSpots) {
      const d = this.layout.districts.find(dd => dd.id === spot.district)!
      const locked = !this.engine.isDistrictUnlocked(d.id)
      const rng = mulberry32(((spot.tileX * 73856093) ^ (spot.tileY * 19349663)) >>> 0)
      const kind = pickFillerKind(spot.district, locked, rng())
      const variant = Math.floor(rng() * 3)
      const base = (locked ? 999 * 1013 : districtIndex.get(d.id)! * 1013) + FILLER_KIND_INDEX[kind] * 211
      const seed = base + variant * 57
      const district = locked ? undefined : spot.district
      const front = this.frontDirForTile(spot.tileX, spot.tileY)
      const lot = this.lotFor(spot.tileX, spot.tileY, front)
      const block = `${Math.floor(spot.tileX / 12)},${Math.floor(spot.tileY / 4)}`
      const key = `${block}|${kind}|${seed}|${district ?? '-'}|${lot.w.toFixed(1)}x${lot.d.toFixed(1)}`
      let batch = batches.get(key)
      if (!batch) {
        batch = { kind, district, seed, lot, spots: [] }
        batches.set(key, batch)
      }
      const c = tileCenter(this.metrics, spot.tileX, spot.tileY)
      batch.spots.push({
        x: c.x, z: c.z, yaw: Math.atan2(front.x, front.z), front,
        tile: spot.tileX + ',' + spot.tileY,
      })
    }

    const m = new THREE.Matrix4()
    for (const batch of batches.values()) {
      const style = rollStyle(batch.kind, batch.seed, 90, batch.district)
      const dims = dimsFor(style, batch.lot)
      const zOff = (batch.lot.d - dims.d) / 2 - dims.setback
      const n = batch.spots.length

      const body = new THREE.InstancedMesh(
        new THREE.BoxGeometry(dims.w, dims.bodyH, dims.d),
        this.facadeMaterials(style, batch.district, dims),
        n,
      )
      body.castShadow = true
      body.receiveShadow = true
      body.userData.filler = true

      // Only freestanding buildings need a contact blob — a Blockrand body
      // covers its whole lot, so the blob would sit entirely underneath it.
      let blobs: THREE.InstancedMesh | null = null
      if (style.detached) {
        const blobGeo = new THREE.PlaneGeometry(dims.w * 1.4, dims.d * 1.4)
        blobGeo.rotateX(-Math.PI / 2)
        blobs = new THREE.InstancedMesh(
          blobGeo,
          new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false }),
          n,
        )
      }

      const roofPieces = this.roofPieces(style, dims).map(piece => {
        const mesh = new THREE.InstancedMesh(piece.geo, new THREE.MeshStandardMaterial({ color: piece.color, roughness: 0.72, metalness: 0.1, envMapIntensity: 0.7 }), n)
        mesh.castShadow = true
        mesh.userData.filler = true
        return { mesh, y: piece.y }
      })

      // architectural relief, merged into one geometry -> one extra draw call
      const trimGeo = trimGeometry(style, dims)
      let trim: THREE.InstancedMesh | null = null
      if (trimGeo) {
        trim = new THREE.InstancedMesh(trimGeo, new THREE.MeshStandardMaterial({
          color: trimColor(style), roughness: 0.8, envMapIntensity: 0.7,
        }), n)
        trim.castShadow = true
        trim.receiveShadow = true
        trim.userData.filler = true
      }

      batch.spots.forEach((sp, i) => {
        const cx = sp.x + sp.front.x * zOff
        const cz = sp.z + sp.front.z * zOff
        m.makeRotationY(sp.yaw).setPosition(cx, dims.bodyH / 2, cz)
        body.setMatrixAt(i, m)
        if (blobs) {
          m.makeRotationY(sp.yaw).setPosition(cx, 0.03, cz)
          blobs.setMatrixAt(i, m)
        }
        for (const rp of roofPieces) {
          m.makeRotationY(sp.yaw).setPosition(cx, rp.y, cz)
          rp.mesh.setMatrixAt(i, m)
        }
        if (trim) {
          m.makeRotationY(sp.yaw).setPosition(cx, 0, cz)
          trim.setMatrixAt(i, m)
        }
        const alongX = Math.abs(sp.front.z) > 0.5
        const hx = (alongX ? dims.w : dims.d) / 2
        const hz = (alongX ? dims.d : dims.w) / 2
        const collider: Collider = {
          minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz,
          top: dims.bodyH + dims.roofH,
        }
        const refs: Array<{ mesh: THREE.InstancedMesh; index: number; matrix: THREE.Matrix4 }> = []
        const remember = (mesh: THREE.InstancedMesh | null) => {
          if (!mesh) return
          const mat = new THREE.Matrix4()
          mesh.getMatrixAt(i, mat)
          refs.push({ mesh, index: i, matrix: mat })
        }
        remember(body)
        remember(trim)
        remember(blobs)
        for (const rp of roofPieces) remember(rp.mesh)
        this.fillerTiles.set(sp.tile, { refs, collider })
      })

      body.computeBoundingSphere()
      this.fillerRoot.add(body)
      if (trim) { trim.computeBoundingSphere(); this.fillerRoot.add(trim) }
      if (blobs) { blobs.computeBoundingSphere(); this.fillerRoot.add(blobs) }
      for (const rp of roofPieces) {
        rp.mesh.computeBoundingSphere()
        this.fillerRoot.add(rp.mesh)
      }
    }
  }

  /** Hide the filler on any lot the market has put a real property on, and
   *  restore it when that property leaves. Touches only the lots that changed,
   *  so buying a house costs microseconds instead of a full rebuild. */
  private syncFillerOccupancy() {
    const occupied = new Set<string>()
    for (const p of this.engine.state.listings) occupied.add(p.tileX + ',' + p.tileY)
    for (const p of this.engine.state.owned) occupied.add(p.tileX + ',' + p.tileY)

    const touched = new Set<THREE.InstancedMesh>()
    const ZERO = CityScene3D.ZERO_MATRIX

    for (const tile of occupied) {
      if (this.hiddenFillerTiles.has(tile)) continue
      const entry = this.fillerTiles.get(tile)
      if (!entry) continue
      for (const r of entry.refs) { r.mesh.setMatrixAt(r.index, ZERO); touched.add(r.mesh) }
    }
    for (const tile of this.hiddenFillerTiles) {
      if (occupied.has(tile)) continue
      const entry = this.fillerTiles.get(tile)
      if (!entry) continue
      for (const r of entry.refs) { r.mesh.setMatrixAt(r.index, r.matrix); touched.add(r.mesh) }
    }
    for (const mesh of touched) mesh.instanceMatrix.needsUpdate = true

    this.hiddenFillerTiles = occupied
    this.fillerColliders = []
    for (const [tile, entry] of this.fillerTiles) {
      if (!occupied.has(tile)) this.fillerColliders.push(entry.collider)
    }
  }

  private static ZERO_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0)

  /** Lot extents expressed in the building's local axes (w runs along the
   *  facade, d runs back from the street). */
  private lotFor(tileX: number, tileY: number, frontDir: THREE.Vector3): Lot {
    const r = tileRect(this.metrics, tileX, tileY)
    return Math.abs(frontDir.x) > 0.5 ? { w: r.d, d: r.w } : { w: r.w, d: r.d }
  }

  /** Box face materials: street facade at +z, courtyard facade at -z, and
   *  blank Brandmauern on the party-wall sides (windowed flanks if detached). */
  private facadeMaterials(style: ReturnType<typeof rollStyle>, district: string | undefined, dims: BuildingDims) {
    const tex = (f: Face) => facadeTexture(style, district, f, dims)
    const flank = tex(style.detached ? 'side' : 'firewall')
    // Render/plaster: rough, barely reflective, but enough env pickup that
    // shaded facades keep some sky bounce instead of going muddy.
    const wall = (map: THREE.Texture) =>
      new THREE.MeshStandardMaterial({ map, roughness: 0.88, metalness: 0.0, envMapIntensity: 0.8 })
    const roofTop = new THREE.MeshStandardMaterial({
      color: mixColor(style.roofColor, 0x000000, 0.15), roughness: 0.75, metalness: 0.08, envMapIntensity: 0.6,
    })
    return [
      wall(flank),
      wall(flank),
      roofTop,
      new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 1 }),
      wall(tex('front')),
      wall(tex('back')),
    ]
  }

  /** Roof geometry pieces with their local Y centre, shared by market
   *  buildings and instanced fillers. */
  private roofPieces(style: ReturnType<typeof rollStyle>, dims: BuildingDims): Array<{ geo: THREE.BufferGeometry; color: number; y: number }> {
    if (dims.roof === 'gable' && dims.roofH > 0.5) {
      // gableGeometry sits with its eaves at y = 0
      return [{ geo: gableGeometry(dims.w * 1.02, dims.d * 1.04, dims.roofH), color: style.roofColor, y: dims.bodyH }]
    }
    if (dims.roof === 'hip' && dims.roofH > 0.5) {
      const geo = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4)
      geo.rotateY(Math.PI / 4)
      geo.scale(dims.w * 1.08, dims.roofH, dims.d * 1.08)
      return [{ geo, color: style.roofColor, y: dims.bodyH + dims.roofH / 2 }]
    }
    // flat roof: a parapet band reads much better than a bare box top
    const geo = new THREE.BoxGeometry(dims.w + 0.25, 0.75, dims.d + 0.25)
    return [{ geo, color: mixColor(style.roofColor, 0xffffff, 0.1), y: dims.bodyH + 0.2 }]
  }

  // ------------------------------------------- district lock visuals

  /** World-space rect of a district, derived from the metric column/row edges. */
  private districtRect(d: DistrictDef) {
    const x0 = this.metrics.colX[d.bounds.x]
    const x1 = this.metrics.colX[Math.min(d.bounds.x + d.bounds.w, this.layout.tilesW)]
    const z0 = this.metrics.rowZ[d.bounds.y]
    const z1 = this.metrics.rowZ[Math.min(d.bounds.y + d.bounds.h, this.layout.tilesH)]
    return { x0, z0, w: x1 - x0, d: z1 - z0, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 }
  }

  private mountLockOverlay(d: DistrictDef) {
    const r = this.districtRect(d)
    const tex = new THREE.CanvasTexture(paintLockOverlay(r.w, r.d))
    tex.colorSpace = THREE.SRGBColorSpace
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(r.w, r.d),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    )
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(r.cx, 0.08, r.cz)
    mesh.userData.lockedDistrict = d.id
    this.lockOverlays.set(d.id, mesh)
    this.scene.add(mesh)
  }

  private mountBanner(d: DistrictDef) {
    const el = document.createElement('div')
    el.className = 'district-banner-3d' + (d.locked ? ' locked' : '')
    el.style.setProperty('--banner-color', '#' + d.color.toString(16).padStart(6, '0'))
    const nameEl = document.createElement('div')
    nameEl.className = 'db-name'
    nameEl.textContent = (d.locked ? `GESPERRT - ${d.name}` : d.name).toUpperCase()
    const subEl = document.createElement('div')
    subEl.className = 'db-sub'
    el.appendChild(nameEl)
    el.appendChild(subEl)
    const r = this.districtRect(d)
    const obj = new CSS2DObject(el)
    const pos = new THREE.Vector3(r.cx, 34, r.cz)
    obj.position.copy(pos)
    this.scene.add(obj)
    this.banners.set(d.id, { el, nameEl, subEl, pos })
  }

  /** Pull current unlockProgress for every locked district and push it into
   *  each banner's sub-text. Called on bought/sold/month and once on init. */
  private refreshLockProgress() {
    for (const d of this.layout.districts) {
      if (this.engine.isDistrictUnlocked(d.id)) continue
      const p = this.engine.unlockProgress(d.id)
      if (!p) continue
      const banner = this.banners.get(d.id)
      if (banner) banner.subEl.textContent = formatProgress(p.current, p.threshold)
    }
  }

  /** Two-way sync of lock visuals with engine state — covers save-load at
   *  boot AND the in-place "Neues Spiel" reset, which re-locks districts. */
  private resyncLockVisuals() {
    for (const d of this.layout.districts) {
      if (!d.locked) continue // never a teaser district
      const engineLocked = !this.engine.isDistrictUnlocked(d.id)
      const visualUnlocked = this.visuallyUnlocked.has(d.id)
      if (!engineLocked && !visualUnlocked) {
        this.unlockDistrictVisual(d.id, false)
      } else if (engineLocked && visualUnlocked) {
        this.visuallyUnlocked.delete(d.id)
        if (!this.lockOverlays.has(d.id)) this.mountLockOverlay(d)
        const banner = this.banners.get(d.id)
        if (banner) {
          banner.el.classList.add('locked')
          banner.nameEl.textContent = `GESPERRT - ${d.name}`.toUpperCase()
        }
      }
    }
    // filler styles depend on lock state — force a rebuild on the next refresh
    this.fillerBuilt = false
  }

  /** Fade out the lock overlay and swap banner styling to the unlocked look.
   *  Idempotent. Does NOT mutate the shared layout. */
  private unlockDistrictVisual(id: DistrictId, animate: boolean) {
    const d = this.layout.districts.find(dd => dd.id === id)
    if (!d || !d.locked) return
    if (this.visuallyUnlocked.has(id)) return
    this.visuallyUnlocked.add(id)

    const overlay = this.lockOverlays.get(id)
    if (overlay) {
      this.lockOverlays.delete(id)
      const mat = overlay.material as THREE.MeshBasicMaterial
      if (!animate) {
        this.scene.remove(overlay)
        mat.map?.dispose(); mat.dispose(); overlay.geometry.dispose()
      } else {
        const t0 = performance.now()
        const fade = () => {
          const k = (performance.now() - t0) / 600
          mat.opacity = Math.max(0, 1 - k)
          if (k < 1 && !this.disposed) requestAnimationFrame(fade)
          else {
            this.scene.remove(overlay)
            mat.map?.dispose(); mat.dispose(); overlay.geometry.dispose()
          }
        }
        fade()
      }
    }

    const banner = this.banners.get(id)
    if (banner) {
      banner.el.classList.remove('locked')
      banner.nameEl.textContent = d.name.toUpperCase()
      banner.subEl.textContent = ''
    }
  }

  // ------------------------------------------------------------ properties

  private snapshotKey(p: Property, isOwned: boolean): string {
    const condBucket = Math.round(p.condition / 5) * 5
    const renov = !!p.activeRenovation && p.activeRenovation.status === 'active'
    const vacant = isOwned && !renov && this.isVacant(p)
    const nomad = this.isNomadOuted(p)
    return `${condBucket}|${isOwned}|${renov}|${vacant}|${nomad}`
  }

  private isVacant(p: Property): boolean {
    if (p.state !== 'owned') return false
    if (p.tenant) return false
    if (p.units && p.units.length > 0) return p.units.every(u => !u.tenant)
    return true
  }

  private isNomadOuted(p: Property): boolean {
    const tenants = [p.tenant, ...(p.units?.map(u => u.tenant) ?? [])].filter(Boolean) as NonNullable<Property['tenant']>[]
    return tenants.some(t => t.personality === 'nomad' && (t.monthsBehind ?? 0) >= 3)
  }

  private refreshProperties() {
    this.hideTooltip()
    this.hoveredPropertyId = null
    const allProps = new Map<string, Property>()
    for (const p of this.engine.state.listings) allProps.set(p.id, p)
    for (const p of this.engine.state.owned) allProps.set(p.id, p)

    for (const [id, handle] of this.byPropertyId) {
      if (!allProps.has(id)) {
        this.disposeBuilding(handle)
        this.byPropertyId.delete(id)
      }
    }

    for (const p of allProps.values()) {
      const isOwned = p.state === 'owned'
      const existing = this.byPropertyId.get(p.id)
      const key = this.snapshotKey(p, isOwned)
      if (existing && existing.snapshotKey === key) {
        existing.prop = p
        existing.isOwned = isOwned
        if (existing.priceLabel) {
          if (isOwned) { existing.priceLabel.el.style.display = 'none' }
          else {
            existing.priceLabel.el.style.display = ''
            existing.priceLabel.textEl.textContent = formatEuro(p.price)
          }
        }
      } else {
        if (existing) { this.disposeBuilding(existing); this.byPropertyId.delete(p.id) }
        this.spawnBuilding(p, isOwned, key)
      }
    }

    this.rebuildColliders()
    this.buildFillers()
    this.syncFillerOccupancy()
  }

  private frontDirForTile(tileX: number, tileY: number): THREE.Vector3 {
    const { tilesW, tilesH, tiles } = this.layout
    const walk = (tx: number, ty: number) => {
      if (tx < 0 || tx >= tilesW || ty < 0 || ty >= tilesH) return false
      const t = tiles[ty * tilesW + tx]
      return t === 'sidewalk' || t === 'road_h' || t === 'road_v' || t === 'road_x'
    }
    if (walk(tileX, tileY + 1)) return new THREE.Vector3(0, 0, 1)
    if (walk(tileX, tileY - 1)) return new THREE.Vector3(0, 0, -1)
    if (walk(tileX + 1, tileY)) return new THREE.Vector3(1, 0, 0)
    if (walk(tileX - 1, tileY)) return new THREE.Vector3(-1, 0, 0)
    return new THREE.Vector3(0, 0, 1)
  }

  private spawnBuilding(p: Property, isOwned: boolean, key: string) {
    const style = rollStyle(p.type, p.styleSeed, Math.round(p.condition / 5) * 5, p.district)
    const frontDir = this.frontDirForTile(p.tileX, p.tileY)
    const lot = this.lotFor(p.tileX, p.tileY, frontDir)
    const dims = dimsFor(style, lot)
    // push the body forward so its street facade lands on the pavement edge
    const zOff = (lot.d - dims.d) / 2 - dims.setback

    const group = new THREE.Group()
    const tc = tileCenter(this.metrics, p.tileX, p.tileY)
    const center = new THREE.Vector3(tc.x + frontDir.x * zOff, 0, tc.z + frontDir.z * zOff)
    group.position.copy(center)
    group.rotation.y = Math.atan2(frontDir.x, frontDir.z)

    const meshes: THREE.Mesh[] = []
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(dims.w, dims.bodyH, dims.d),
      this.facadeMaterials(style, p.district, dims),
    )
    body.position.y = dims.bodyH / 2
    body.castShadow = true
    body.receiveShadow = true
    group.add(body)
    meshes.push(body)

    // cornice, string course, balconies, dormers
    const trimGeo = trimGeometry(style, dims)
    if (trimGeo) {
      const trimMesh = new THREE.Mesh(trimGeo, new THREE.MeshStandardMaterial({
        color: trimColor(style), roughness: 0.8, envMapIntensity: 0.7,
      }))
      trimMesh.castShadow = true
      trimMesh.receiveShadow = true
      group.add(trimMesh)
      meshes.push(trimMesh)
    }

    // roof
    for (const piece of this.roofPieces(style, dims)) {
      const mesh = new THREE.Mesh(piece.geo, new THREE.MeshStandardMaterial({ color: piece.color, roughness: 0.72, metalness: 0.1, envMapIntensity: 0.7 }))
      mesh.position.y = piece.y
      mesh.castShadow = true
      group.add(mesh)
      meshes.push(mesh)
    }
    if (dims.roof !== 'flat' && dims.roofH > 0.5) {
      const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.2, 0.8), new THREE.MeshStandardMaterial({ color: style.trimColor }))
      chimney.position.set(dims.w * 0.3, dims.bodyH + dims.roofH * 0.8, -dims.d * 0.18)
      chimney.castShadow = true
      group.add(chimney)
      meshes.push(chimney)
    } else if (style.kind === 'office' || style.kind === 'tower') {
      const mech = new THREE.Mesh(new THREE.BoxGeometry(dims.w * 0.3, 1.4, dims.d * 0.25), new THREE.MeshStandardMaterial({ color: 0x707880 }))
      mech.position.set(-dims.w * 0.2, dims.bodyH + 1.1, -dims.d * 0.15)
      group.add(mech)
      meshes.push(mech)
      if (style.kind === 'tower') {
        const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.2, 4), new THREE.MeshStandardMaterial({ color: style.accentColor }))
        antenna.position.y = dims.bodyH + 2.5
        group.add(antenna)
        meshes.push(antenna)
      }
    }

    // contact shadow blob
    const blob = new THREE.Mesh(
      new THREE.PlaneGeometry(dims.w * 1.3, dims.d * 1.3),
      new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false }),
    )
    blob.rotation.x = -Math.PI / 2
    blob.position.y = 0.03
    group.add(blob)

    const renovActive = !!p.activeRenovation && p.activeRenovation.status === 'active'
    if (renovActive) this.addScaffold(group, dims)

    const topY = dims.bodyH + dims.roofH

    // owned badge (gold sprite) — parity with the old OwnedBadgeLayer
    if (isOwned) {
      const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: ownedBadgeTexture(), depthTest: true }))
      badge.scale.set(1.8, 1.8, 1)
      badge.position.y = topY + 1.6
      group.add(badge)
    }

    const handle: BuildingHandle = { group, prop: p, isOwned, snapshotKey: key, dims, frontDir, center, meshes }

    // price tag for listings — parity with the old for-sale tag
    if (!isOwned) {
      const el = document.createElement('div')
      el.className = 'price-tag-3d'
      const textEl = document.createElement('span')
      textEl.className = 'ptg-inner'
      textEl.textContent = formatEuro(p.price)
      el.appendChild(textEl)
      const obj = new CSS2DObject(el)
      // hang it over the street-facing eave, not the roof centre, so the sight
      // line from the pavement doesn't pass through the building itself
      obj.position.set(0, topY + 2.2, dims.d / 2)
      group.add(obj)
      handle.priceLabel = { obj, el, textEl }
    }

    // occupancy markers — parity with the old OccupancyMarkerLayer
    if (isOwned && !renovActive && this.isVacant(p)) {
      const el = document.createElement('div')
      el.className = 'marker-chip vacant'
      el.textContent = 'ZU VERMIETEN'
      const obj = new CSS2DObject(el)
      obj.position.set(0, topY + 1.2 + (isOwned ? 1.6 : 0), dims.d / 2)
      group.add(obj)
    }
    if (this.isNomadOuted(p)) {
      const el = document.createElement('div')
      el.className = 'marker-chip nomad'
      el.textContent = '⚠ Mietnomade'
      const obj = new CSS2DObject(el)
      obj.position.set(0, topY + 3.4, dims.d / 2)
      group.add(obj)
    }

    for (const m of meshes) m.userData.propertyId = p.id
    this.buildingsRoot.add(group)
    this.byPropertyId.set(p.id, handle)
  }

  /** Simple 3D scaffold: yellow corner poles + rails + grey tarp on the front. */
  private addScaffold(group: THREE.Group, dims: BuildingDims) {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xf2c94c })
    const railMat = new THREE.MeshStandardMaterial({ color: 0xc89020 })
    const h = dims.bodyH + 0.5
    const hw = dims.w / 2 + 0.35, hd = dims.d / 2 + 0.35
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.09, h, 5)
    for (const [px, pz] of [[-hw, hd], [hw, hd], [-hw, -hd], [hw, -hd]] as const) {
      const pole = new THREE.Mesh(poleGeo, poleMat)
      pole.position.set(px, h / 2, pz)
      group.add(pole)
    }
    const railGeo = new THREE.BoxGeometry(dims.w + 0.7, 0.07, 0.07)
    for (let y = 2; y < h; y += 2.8) {
      const rail = new THREE.Mesh(railGeo, railMat)
      rail.position.set(0, y, hd)
      group.add(rail)
    }
    const tarp = new THREE.Mesh(
      new THREE.PlaneGeometry(dims.w + 0.6, h * 0.85),
      new THREE.MeshStandardMaterial({ color: 0xb0b0b0, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
    )
    tarp.position.set(0, h * 0.45, hd + 0.05)
    group.add(tarp)
  }

  private disposeBuilding(handle: BuildingHandle) {
    this.buildingsRoot.remove(handle.group)
    handle.group.traverse(obj => {
      const mesh = obj as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
      const mat = (mesh as any).material
      if (Array.isArray(mat)) mat.forEach((m: THREE.Material) => m.dispose())
      else if (mat) (mat as THREE.Material).dispose()
      // CSS2DObjects remove their element when removed from the scene graph,
      // but be explicit so no chips leak:
      if ((obj as any).isCSS2DObject) (obj as CSS2DObject).element.remove()
    })
    if (this.aimedHandle === handle) this.aimedHandle = null
  }

  private rebuildColliders() {
    this.colliders = []
    for (const h of this.byPropertyId.values()) {
      // rotated buildings (front facing +-X) have swapped footprints
      const swap = Math.abs(h.frontDir.x) > 0.5
      const hw = (swap ? h.dims.d : h.dims.w) / 2
      const hd = (swap ? h.dims.w : h.dims.d) / 2
      this.colliders.push({
        minX: h.center.x - hw,
        maxX: h.center.x + hw,
        minZ: h.center.z - hd,
        maxZ: h.center.z + hd,
        top: h.dims.bodyH + h.dims.roofH,
        ownerId: h.prop.id,
      })
    }
  }

  // ------------------------------------------------------------------ input

  private setupInput() {
    const canvas = this.renderer.domElement
    canvas.addEventListener('contextmenu', e => e.preventDefault())

    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return
      if (ModalManager.get().size() > 0) return
      if (this.locked) {
        // pointer locked: interact with whatever the crosshair aims at
        this.interact()
        return
      }
      this.drag = { x: e.clientX, y: e.clientY, total: 0, dragged: false }
      if (!this.fallbackLook) {
        const req: any = canvas.requestPointerLock()
        // Chromium returns a promise; if the environment forbids pointer lock
        // (some embeds/iframes), fall back to drag-look + cursor picking.
        if (req && typeof req.catch === 'function') {
          req.catch(() => { this.fallbackLook = true; this.updateHudChrome() })
        }
      }
    })

    window.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return
      const d = this.drag
      this.drag = null
      if (!d || this.locked) return
      if (ModalManager.get().size() > 0) return
      if (this.fallbackLook && !d.dragged) this.interactAt(e.clientX, e.clientY)
    })

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas
      this.updateHudChrome()
    })
    document.addEventListener('pointerlockerror', () => {
      this.fallbackLook = true
      this.updateHudChrome()
    })

    document.addEventListener('mousemove', (e) => {
      this.cursor.x = e.clientX
      this.cursor.y = e.clientY
      if (this.locked) {
        this.yaw -= e.movementX * 0.0022
        this.pitch -= e.movementY * 0.0022
        this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch))
        return
      }
      if (this.drag && (e.buttons & 1)) {
        const dx = e.clientX - this.drag.x
        const dy = e.clientY - this.drag.y
        this.drag.total += Math.abs(dx) + Math.abs(dy)
        if (this.drag.total > 6) this.drag.dragged = true
        this.yaw -= dx * 0.005
        this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dy * 0.005))
        this.drag.x = e.clientX
        this.drag.y = e.clientY
      }
    })

    document.addEventListener('keydown', (e) => {
      const tgt = e.target as HTMLElement
      const typing = tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)
      if (typing) return
      this.keys.add(e.code)
      if (e.code === 'Space' && ModalManager.get().size() === 0) {
        e.preventDefault()
        const cur = this.engine.getSpeed()
        this.engine.setSpeed(cur === 0 ? 1 : 0)
      }
      if (e.code === 'Escape') {
        // ModalManager handles ESC when modals are open (capture phase).
        // While pointer-locked the browser consumes ESC for the unlock, so this
        // only fires unlocked: open the main menu — parity with the 2D scene.
        if (ModalManager.get().size() === 0 && !this.locked) this.menu.open()
      }
    })
    document.addEventListener('keyup', (e) => this.keys.delete(e.code))
    window.addEventListener('blur', () => this.keys.clear())
  }

  /** Crosshair-raycast interaction: property -> DealSheet, locked district -> info toast. */
  private interact() {
    this.handleHit(this.aimcast())
  }

  /** Cursor-position interaction (fallback mode without pointer lock). */
  private interactAt(clientX: number, clientY: number) {
    const ndcX = (clientX / window.innerWidth) * 2 - 1
    const ndcY = -((clientY / window.innerHeight) * 2 - 1)
    this.handleHit(this.aimcastAt(ndcX, ndcY))
  }

  private handleHit(hit: { property?: string; lockedDistrict?: DistrictId; filler?: boolean } | null) {
    if (!hit) return
    if (hit.property) {
      const handle = this.byPropertyId.get(hit.property)
      if (!handle) return
      this.hideTooltip()
      this.hoveredPropertyId = null
      if (this.locked) document.exitPointerLock()
      this.deal.open(handle.prop, handle.isOwned)
    } else if (hit.filler) {
      const now = performance.now()
      if (now - this.lastFillerToast > 2500) {
        this.lastFillerToast = now
        this.hud.toast('Nicht auf dem Markt — achte auf Gebaeude mit Preisschild.', 'info')
      }
    } else if (hit.lockedDistrict) {
      this.lockedDistrictToast(hit.lockedDistrict)
    }
  }

  private lockedDistrictToast(id: DistrictId) {
    const now = performance.now()
    if (now - this.lastLockToast < 2500) return
    this.lastLockToast = now
    const d = this.layout.districts.find(dd => dd.id === id)
    if (!d) return
    const prog = this.engine.unlockProgress(id)
    const msg = prog
      ? `${d.name} ist gesperrt - ${prog.label} (${prog.current}/${prog.threshold})`
      : `${d.name} ist gesperrt`
    this.hud.toast(msg, 'info')
  }

  private aimcast(): { property?: string; lockedDistrict?: DistrictId } | null {
    return this.aimcastAt(0, 0)
  }

  private aimcastAt(ndcX: number, ndcY: number): { property?: string; lockedDistrict?: DistrictId; filler?: boolean } | null {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera)
    this.raycaster.far = 400
    const targets: THREE.Object3D[] = [this.buildingsRoot, this.fillerRoot, ...this.lockOverlays.values()]
    const hits = this.raycaster.intersectObjects(targets, true)
    for (const h of hits) {
      const pid = h.object.userData.propertyId
      if (pid) return { property: pid }
      if (h.object.userData.filler) return { filler: true }
      const locked = h.object.userData.lockedDistrict
      if (locked) return { lockedDistrict: locked }
    }
    return null
  }

  // ------------------------------------------------------------- tooltip

  private showTooltip(p: Property, isOwned: boolean) {
    const cap = this.engine.capRate(p)
    const t = p.tenant
    const condClass = p.condition >= 70 ? 'good' : p.condition >= 40 ? 'mid' : 'bad'
    const tag = isOwned ? '<span class="pt-tag owned">DEIN</span>' : '<span class="pt-tag forsale">VERKAUF</span>'
    const channelTag = !isOwned && p.seller
      ? p.seller.channel === 'agent'
        ? `<div class="pt-row" style="font-size:10px;color:var(--accent)">🏢 via ${escapeHtml(p.seller.agentName!.split(' (')[0])}</div>`
        : `<div class="pt-row" style="font-size:10px;color:var(--muted)">🏠 Privatverkauf von ${escapeHtml(p.seller.ownerName)}</div>`
      : ''
    this.hoverDiv.innerHTML = `
      <div class="pt-name">${escapeHtml(this.engine.nameFor(p))}</div>
      <div class="pt-sub">${capitalize(p.type)}${p.buildingForm === 'mfh' ? ` · MFH ${p.units.length} Einh.` : p.buildingForm === 'wg' ? ` · WG ${p.units.length} Zi.` : ''} · ${districtName(p.district)} · ${p.yearBuilt}</div>
      <div class="pt-row"><span>${isOwned ? 'Wert' : 'Preis'}</span><b>${formatEuro(isOwned ? p.marketValue : p.price)}</b></div>
      <div class="pt-row"><span>Miete</span><b>${formatEuro(p.baseRent)}/M</b></div>
      <div class="pt-row"><span>Zustand</span><b class="${condClass}">${Math.round(p.condition)}%</b></div>
      <div class="pt-row"><span>Cap Rate</span><b class="${cap >= 5 ? 'good' : cap >= 3 ? 'mid' : 'bad'}">${cap.toFixed(1)}%</b></div>
      ${isOwned ? `<div class="pt-row"><span>Mieter</span><b>${t ? escapeHtml(t.name) : 'leer'}</b></div>` : ''}
      ${channelTag}
      ${tag}
    `
    this.hoverDiv.style.display = 'block'
  }

  private hideTooltip() {
    this.hoverDiv.style.display = 'none'
  }

  /** Fallback mode: anchor the tooltip above the mouse cursor like in 2D. */
  private positionTooltipAtCursor() {
    this.hoverDiv.classList.remove('fp')
    this.hoverDiv.style.left = this.cursor.x + 'px'
    this.hoverDiv.style.top = this.cursor.y + 'px'
  }

  // ---------------------------------------------------------- focus helper

  /** Activity-Log helper: teleport the player in front of a property and open
   *  its DealSheet — the FP equivalent of the old camera pan. */
  focusProperty(propertyId: string) {
    const handle = this.byPropertyId.get(propertyId)
    if (!handle) return
    // stand across the street, far enough back that the whole facade fits
    const standoff = Math.max(14, handle.dims.bodyH * 0.75)
    const dist = handle.dims.d / 2 + standoff
    const target = handle.center.clone().addScaledVector(handle.frontDir, dist)
    this.pos.set(target.x, EYE, target.z)
    const dx = handle.center.x - this.pos.x
    const dz = handle.center.z - this.pos.z
    this.yaw = Math.atan2(-dx, -dz)
    this.pitch = Math.atan2(handle.dims.bodyH * 0.45, standoff)
    const all = [...this.engine.state.listings, ...this.engine.state.owned]
    const p = all.find(pp => pp.id === propertyId)
    if (!p) return
    const isOwned = p.state === 'owned'
    setTimeout(() => this.deal.open(p, isOwned), 200)
  }

  // ------------------------------------------------------------- particles

  private spawnCoinBurst(p: Property) {
    const handle = this.byPropertyId.get(p.id)
    const base = handle
      ? handle.center.clone().setY(handle.dims.bodyH * 0.6)
      : (() => { const c = tileCenter(this.metrics, p.tileX, p.tileY); return new THREE.Vector3(c.x, 4, c.z) })()
    const geo = new THREE.SphereGeometry(0.22, 6, 5)
    for (let i = 0; i < 12; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xf1c40f, transparent: true })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.copy(base)
      const angle = Math.random() * Math.PI * 2
      const vel = new THREE.Vector3(Math.cos(angle) * (2 + Math.random() * 3), 4 + Math.random() * 3, Math.sin(angle) * (2 + Math.random() * 3))
      this.scene.add(mesh)
      this.particles.push({ mesh, vel, life: 1.2 })
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i]
      pt.life -= dt
      pt.vel.y -= 9.8 * dt
      pt.mesh.position.addScaledVector(pt.vel, dt)
      ;(pt.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, pt.life / 1.2)
      if (pt.life <= 0) {
        this.scene.remove(pt.mesh)
        ;(pt.mesh.material as THREE.Material).dispose()
        this.particles.splice(i, 1)
      }
    }
  }

  // ------------------------------------------------------------- main loop

  private districtAt(x: number, z: number): DistrictDef | null {
    const { tx, ty } = tileAtWorld(this.metrics, x, z)
    return this.layout.districts.find(d =>
      tx >= d.bounds.x && tx < d.bounds.x + d.bounds.w && ty >= d.bounds.y && ty < d.bounds.y + d.bounds.h) ?? null
  }

  private blockedAt(x: number, z: number): 'building' | 'locked' | null {
    for (const c of this.colliders) {
      if (x > c.minX - PLAYER_RADIUS && x < c.maxX + PLAYER_RADIUS && z > c.minZ - PLAYER_RADIUS && z < c.maxZ + PLAYER_RADIUS) return 'building'
    }
    for (const c of this.fillerColliders) {
      if (x > c.minX - PLAYER_RADIUS && x < c.maxX + PLAYER_RADIUS && z > c.minZ - PLAYER_RADIUS && z < c.maxZ + PLAYER_RADIUS) return 'building'
    }
    for (const c of this.staticColliders) {
      if (x > c.minX - PLAYER_RADIUS && x < c.maxX + PLAYER_RADIUS && z > c.minZ - PLAYER_RADIUS && z < c.maxZ + PLAYER_RADIUS) return 'building'
    }
    const d = this.districtAt(x, z)
    if (d && !this.engine.isDistrictUnlocked(d.id)) return 'locked'
    return null
  }

  private move(dt: number): boolean {
    const fwd = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0)
    const strafe = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0)
    if (!fwd && !strafe) return false
    if (ModalManager.get().size() > 0) return false
    const speed = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) ? SPRINT_SPEED : WALK_SPEED
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw)
    // camera forward on ground plane
    const dirX = -sin * fwd + cos * strafe
    const dirZ = -cos * fwd - sin * strafe
    const len = Math.hypot(dirX, dirZ) || 1
    const dx = (dirX / len) * speed * dt
    const dz = (dirZ / len) * speed * dt

    const worldW = this.metrics.width
    const worldH = this.metrics.depth
    // axis-separated slide
    let nx = this.pos.x + dx
    let blocked = this.blockedAt(nx, this.pos.z)
    if (blocked) { if (blocked === 'locked') this.bumpLocked(nx, this.pos.z); nx = this.pos.x }
    let nz = this.pos.z + dz
    blocked = this.blockedAt(nx, nz)
    if (blocked) { if (blocked === 'locked') this.bumpLocked(nx, nz); nz = this.pos.z }
    this.pos.x = Math.max(1, Math.min(worldW - 1, nx))
    this.pos.z = Math.max(1, Math.min(worldH - 1, nz))
    return true
  }

  private bumpLocked(x: number, z: number) {
    const d = this.districtAt(x, z)
    if (d) this.lockedDistrictToast(d.id)
  }

  private updateHudChrome() {
    const modalOpen = ModalManager.get().size() > 0
    this.crosshair.style.display = this.locked && !modalOpen ? 'block' : 'none'
    this.hint.style.display = !this.locked && !modalOpen ? 'block' : 'none'
    if (this.fallbackLook) {
      this.hint.innerHTML = `🖱 <b>Ziehen</b>: Umsehen · <b>Klick auf Gebaeude</b>: Details · <b>WASD</b> Laufen · <b>Shift</b> Sprint · <b>Leertaste</b> Pause · <b>ESC</b> Menue`
    }
    if (this.locked) this.hoverDiv.classList.add('fp')
  }

  private highlight(handle: BuildingHandle | null) {
    if (this.aimedHandle === handle) return
    const setEmissive = (h: BuildingHandle, on: boolean) => {
      for (const m of h.meshes) {
        const mats = Array.isArray(m.material) ? m.material : [m.material]
        for (const mat of mats) {
          if ((mat as THREE.MeshStandardMaterial).emissive) {
            (mat as THREE.MeshStandardMaterial).emissive.setHex(on ? 0x2a2a20 : 0x000000)
          }
        }
      }
    }
    if (this.aimedHandle) setEmissive(this.aimedHandle, false)
    this.aimedHandle = handle
    if (handle) setEmissive(handle, true)
  }

  private loop = () => {
    if (this.disposed) return
    requestAnimationFrame(this.loop)
    const dt = Math.min(0.05, this.clock.getDelta())

    const moving = this.move(dt)
    this.updateParticles(dt)
    this.ambient.update(dt)
    const cloudWrap = this.metrics.width + 300
    for (const cl of this.clouds) {
      cl.sprite.position.x += cl.speed * dt
      if (cl.sprite.position.x > cloudWrap) cl.sprite.position.x = -300
    }

    // head-bob + sprint FOV kick
    const sprinting = moving && (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'))
    this.bobAmount += ((moving ? 1 : 0) - this.bobAmount) * Math.min(1, dt * 8)
    if (moving) this.bobPhase += dt * (sprinting ? 13 : 9)
    this.fovTarget = sprinting ? 79 : 72
    if (Math.abs(this.camera.fov - this.fovTarget) > 0.05) {
      this.camera.fov += (this.fovTarget - this.camera.fov) * Math.min(1, dt * 6)
      this.camera.updateProjectionMatrix()
    }

    // camera from player state
    this.camera.position.copy(this.pos)
    this.camera.position.y = EYE + Math.sin(this.bobPhase) * 0.055 * this.bobAmount
    this.camera.rotation.set(0, 0, 0)
    this.camera.rotateY(this.yaw)
    this.camera.rotateX(this.pitch)

    // sun follows player so the shadow box stays useful
    this.sun.position.copy(this.pos).addScaledVector(this.sunDir, 140)
    this.sun.target.position.set(this.pos.x, 0, this.pos.z)

    // aim raycast: tooltip + highlight. Pointer-locked -> crosshair centre;
    // fallback mode -> hover under the visible cursor (like the 2D scene).
    const modalOpen = ModalManager.get().size() > 0
    const canAim = !modalOpen && (this.locked || (this.fallbackLook && !this.drag?.dragged))
    if (canAim) {
      const hit = this.locked
        ? this.aimcast()
        : this.aimcastAt((this.cursor.x / window.innerWidth) * 2 - 1, -((this.cursor.y / window.innerHeight) * 2 - 1))
      if (hit?.property) {
        const handle = this.byPropertyId.get(hit.property) ?? null
        this.highlight(handle)
        if (handle && this.hoveredPropertyId !== hit.property) {
          this.hoveredPropertyId = hit.property
          this.showTooltip(handle.prop, handle.isOwned)
        }
        if (!this.locked) this.positionTooltipAtCursor()
      } else {
        this.highlight(null)
        if (this.hoveredPropertyId) { this.hoveredPropertyId = null; this.hideTooltip() }
      }
    } else {
      this.highlight(null)
      if (this.hoveredPropertyId) { this.hoveredPropertyId = null; this.hideTooltip() }
    }
    if (modalOpen && this.locked) document.exitPointerLock()
    this.updateHudChrome()
    this.fadeLabelsByDistance()

    this.renderer.render(this.scene, this.camera)
    this.css2d.render(this.scene, this.camera)
  }

  /** Distance-fade CSS2D labels so far-away banners/tags don't pile up on the
   *  horizon, and hard-hide any that project outside the viewport — otherwise
   *  CSS2DRenderer parks them against the screen edge. */
  private fadeLabelsByDistance() {
    const ndc = new THREE.Vector3()
    const fade = (el: HTMLElement, world: THREE.Vector3, near: number, far: number, ownerId: string | null) => {
      const d = Math.hypot(world.x - this.pos.x, world.z - this.pos.z)
      let o = d < near ? 1 : Math.max(0, 1 - (d - near) / (far - near))
      if (o > 0.02) {
        ndc.copy(world).project(this.camera)
        const onScreen = ndc.z < 1 && Math.abs(ndc.x) < 1.05 && Math.abs(ndc.y) < 1.05
        // CSS2D labels have no depth test, so a tag on the far side of a block
        // would otherwise read as if it were stuck on the wall in front of it.
        if (!onScreen || (ownerId !== null && this.isOccluded(world, ownerId))) o = 0
      }
      el.style.opacity = String(o)
      el.style.visibility = o <= 0.02 ? 'hidden' : 'visible'
    }
    for (const b of this.banners.values()) fade(b.el, b.pos, 150, 320, null)
    const world = new THREE.Vector3()
    for (const h of this.byPropertyId.values()) {
      for (const child of h.group.children) {
        if (!(child as any).isCSS2DObject) continue
        child.getWorldPosition(world)
        fade((child as CSS2DObject).element, world, 200, 360, h.prop.id)
      }
    }
  }

  /** Is another building between the camera and this world point? Hits on the
   *  label's own building don't count — a tag hanging over its own eave is
   *  meant to be readable from the pavement below.
   *
   *  This deliberately tests building bounding boxes by hand instead of
   *  raycasting the scene: a Raycaster walks every instance of ~470 batched
   *  InstancedMeshes triangle by triangle, which cost ~1.4 ms *per label* and
   *  was the reason the game stuttered to a halt while walking. */
  private isOccluded(world: THREE.Vector3, ownerId: string | null): boolean {
    const cam = this.camera.position
    const dx = world.x - cam.x, dy = world.y - cam.y, dz = world.z - cam.z
    const dist = Math.hypot(dx, dy, dz)
    if (dist < 2) return false
    const inv = 1 / dist
    const rx = dx * inv, ry = dy * inv, rz = dz * inv
    const limit = dist - 1.0
    for (const c of this.colliders) {
      if (c.ownerId && c.ownerId === ownerId) continue
      if (rayHitsBox(cam.x, cam.y, cam.z, rx, ry, rz, limit, c)) return true
    }
    for (const c of this.fillerColliders) {
      if (rayHitsBox(cam.x, cam.y, cam.z, rx, ry, rz, limit, c)) return true
    }
    return false
  }

  private onResize = () => {
    const w = window.innerWidth, h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.css2d.setSize(w, h)
  }

  destroy() {
    this.disposed = true
    this.engine.stop()
    window.removeEventListener('resize', this.onResize)
    this.hud?.destroy()
    this.activityLog?.destroy()
    this.hoverDiv?.remove()
    this.crosshair?.remove()
    this.hint?.remove()
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.css2d.domElement.remove()
  }
}

// ----------------------------------------------------------------- helpers

const FILLER_KIND_INDEX: Record<BuildingKind, number> = {
  house: 0, apartment: 1, office: 2, shop: 3, tower: 4, villa: 5,
}

/** Deterministic backdrop mix per district — apartment-heavy with local flavour. */
function pickFillerKind(district: DistrictId, locked: boolean, r: number): BuildingKind {
  const pick = (weights: Array<[BuildingKind, number]>): BuildingKind => {
    let acc = 0
    for (const [kind, w] of weights) {
      acc += w
      if (r < acc) return kind
    }
    return weights[weights.length - 1][0]
  }
  if (locked) return pick([['apartment', 0.5], ['house', 0.3], ['shop', 0.2]])
  switch (district) {
    case 'mitte': return pick([['apartment', 0.45], ['office', 0.25], ['tower', 0.15], ['shop', 0.15]])
    case 'prenzlauer': return pick([['apartment', 0.6], ['shop', 0.2], ['house', 0.1], ['villa', 0.1]])
    case 'charlottenburg': return pick([['apartment', 0.45], ['villa', 0.25], ['office', 0.15], ['shop', 0.15]])
    case 'kreuzberg': return pick([['apartment', 0.6], ['shop', 0.25], ['office', 0.15]])
    case 'wedding': return pick([['apartment', 0.55], ['shop', 0.2], ['house', 0.15], ['office', 0.1]])
    case 'neukoelln': return pick([['apartment', 0.55], ['shop', 0.25], ['house', 0.2]])
    default: return pick([['apartment', 0.6], ['house', 0.2], ['shop', 0.2]])
  }
}

function capitalize(s: string) { return s.slice(0, 1).toUpperCase() + s.slice(1) }
function escapeHtml(s: string) { return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)) }
function districtName(id: string): string {
  const map: Record<string, string> = {
    mitte: 'Mitte', prenzlauer: 'Prenzlauer Berg', kreuzberg: 'Kreuzberg',
    charlottenburg: 'Charlottenburg', wedding: 'Wedding', neukoelln: 'Neukoelln',
    spandau: 'Spandau', steglitz: 'Steglitz', lichtenberg: 'Lichtenberg', marzahn: 'Marzahn',
  }
  return map[id] ?? id
}
