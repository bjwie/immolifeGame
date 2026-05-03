import Phaser from 'phaser'
import { CityRenderer } from '../render/CityRenderer'
import { BuildingRenderer } from '../render/BuildingRenderer'
import { Engine, formatEuro } from '../sim/Engine'
import type { Property } from '../sim/types'
import { HUD } from '../ui/HUD'
import { DealSheet } from '../ui/DealSheet'
import { MenuModal } from '../ui/MenuModal'
import { NegotiationModal } from '../ui/NegotiationModal'
import { RentalModal } from '../ui/RentalModal'
import { RenovationModal } from '../ui/RenovationModal'
import { WEGModal } from '../ui/WEGModal'
import { ModalManager } from '../ui/ModalManager'

const TILE = 48

export class CityScene extends Phaser.Scene {
  private engine!: Engine
  private city!: CityRenderer
  private worldRoot!: Phaser.GameObjects.Container
  private propertyLayer!: Phaser.GameObjects.Container
  private buildingByPropertyId = new Map<string, Phaser.GameObjects.Container>()
  private hud!: HUD
  private deal!: DealSheet
  private menu!: MenuModal
  private negModal!: NegotiationModal
  private rentalModal!: RentalModal
  private renovationModal!: RenovationModal
  private wegModal!: WEGModal
  private hoverDiv!: HTMLDivElement
  private hoveredPropertyId: string | null = null

  // camera/pan state
  private isPanning = false
  private panStart = { x: 0, y: 0, camX: 0, camY: 0 }
  private camTargetZoom = 1
  private currentZoom = 1

  constructor() { super({ key: 'CityScene' }) }

  create() {
    const width = this.scale.width || this.cameras.main.width || 1280
    const height = this.scale.height || this.cameras.main.height || 720
    // ensure camera viewport matches
    this.cameras.main.setSize(width, height)
    // World container — camera follows this
    this.worldRoot = this.add.container(0, 0)

    // City layout
    this.city = new CityRenderer(this, TILE, 4242)
    this.city.renderToContainer(this.worldRoot)

    // Property layer above tiles
    this.propertyLayer = this.add.container(0, 0)
    this.worldRoot.add(this.propertyLayer)

    // Engine
    this.engine = new Engine(this.city.layout)

    // Camera setup
    const worldW = this.city.pixelWidth()
    const worldH = this.city.pixelHeight()
    const cam = this.cameras.main
    cam.setBounds(-100, -100, worldW + 200, worldH + 200)
    // initial: center on city
    cam.centerOn(worldW / 2, worldH / 2)

    // Initial properties
    this.refreshProperties()

    // HUD
    const overlay = (window as any).__overlayRoot as HTMLElement
    this.hud = new HUD(this.engine, overlay, () => this.menu.open())
    this.deal = new DealSheet(this.engine, overlay)
    this.negModal = new NegotiationModal(this.engine, overlay)
    this.rentalModal = new RentalModal(this.engine, overlay)
    this.renovationModal = new RenovationModal(this.engine, overlay)
    this.wegModal = new WEGModal(this.engine, overlay)
    this.deal.setNegotiationModal(this.negModal)
    this.deal.setRentalModal(this.rentalModal)
    this.deal.setRenovationModal(this.renovationModal)
    this.deal.setWegModal(this.wegModal)
    this.menu = new MenuModal(this.engine, overlay, () => this.refreshProperties())
    this.hoverDiv = document.createElement('div')
    this.hoverDiv.className = 'prop-tooltip'
    overlay.appendChild(this.hoverDiv)

    // Engine -> view sync
    this.engine.on('bought', () => this.refreshProperties())
    this.engine.on('sold', (data: any) => { this.refreshProperties(); this.spawnCoinBurst(data.property) })
    this.engine.on('renovated', () => this.refreshProperties())
    this.engine.on('leaseSigned', () => this.refreshProperties())
    this.engine.on('month', () => this.refreshProperties())
    this.engine.on('reset', () => this.refreshProperties())

    // Input
    this.setupInput()

    // Resize
    this.scale.on('resize', () => {
      this.cameras.main.setSize(this.scale.gameSize.width, this.scale.gameSize.height)
    })

    // Cleanup on shutdown
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.engine.stop()
      this.hud?.destroy()
      this.deal && (this.deal as any).root?.remove?.()
      this.menu && (this.menu as any).root?.remove?.()
      this.hoverDiv?.remove()
    })

    // Start time
    this.engine.start()

    // Welcome
    setTimeout(() => {
      const t = this.engine.state.time
      this.hud.toast(`Willkommen! Du startest mit ${formatEuro(this.engine.state.player.cash)} im ${t.month}/${t.year}.`, 'success')
    }, 400)

    void width; void height
  }

  private setupInput() {
    const cam = this.cameras.main

    // Pan with right-click or middle-click drag, or with shift+left-drag
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const ev = p.event as MouseEvent | undefined
      if (p.rightButtonDown() || p.middleButtonDown() || (ev && ev.shiftKey)) {
        this.isPanning = true
        this.panStart = { x: p.x, y: p.y, camX: cam.scrollX, camY: cam.scrollY }
      }
    })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.isPanning) {
        const dx = (p.x - this.panStart.x) / this.currentZoom
        const dy = (p.y - this.panStart.y) / this.currentZoom
        cam.setScroll(this.panStart.camX - dx, this.panStart.camY - dy)
      }
    })
    this.input.on('pointerup', () => { this.isPanning = false })
    this.input.on('pointerupoutside', () => { this.isPanning = false })

    // Zoom on wheel
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _objs: any, _dx: number, dy: number) => {
      const factor = dy > 0 ? 0.9 : 1.1
      this.camTargetZoom = Phaser.Math.Clamp(this.camTargetZoom * factor, 0.5, 2.5)
    })

    // Disable default browser context menu so right-click pan works
    this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault())

    // Keyboard pan
    const keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,ESC') as any
    let lastCamX = cam.scrollX, lastCamY = cam.scrollY, lastZoom = cam.zoom
    this.events.on('update', () => {
      const speed = 8 / this.currentZoom
      if (keys.W?.isDown || keys.UP?.isDown) cam.scrollY -= speed
      if (keys.S?.isDown || keys.DOWN?.isDown) cam.scrollY += speed
      if (keys.A?.isDown || keys.LEFT?.isDown) cam.scrollX -= speed
      if (keys.D?.isDown || keys.RIGHT?.isDown) cam.scrollX += speed

      // smooth zoom
      this.currentZoom += (this.camTargetZoom - this.currentZoom) * 0.15
      cam.setZoom(this.currentZoom)

      // tooltip follows camera + hides if camera moves much during hover
      if (this.hoveredPropertyId) {
        const moved = Math.abs(cam.scrollX - lastCamX) + Math.abs(cam.scrollY - lastCamY) + Math.abs(cam.zoom - lastZoom) * 100
        if (this.isPanning || moved > 8) {
          // user is moving — hide tooltip, it interferes
          this.hideTooltip()
          this.hoveredPropertyId = null
        } else {
          this.repositionTooltip()
        }
      }
      lastCamX = cam.scrollX; lastCamY = cam.scrollY; lastZoom = cam.zoom
    })

    keys.SPACE?.on('down', () => {
      const cur = this.engine.getSpeed()
      this.engine.setSpeed(cur === 0 ? 1 : 0)
    })
    keys.ESC?.on('down', () => {
      // ModalManager already handles ESC when modals are open (capture phase).
      // Only act here if nothing is open: open the main menu.
      if (ModalManager.get().size() === 0) this.menu.open()
    })
  }

  private refreshProperties() {
    // any tooltip becomes invalid during refresh
    this.hideTooltip()
    this.hoveredPropertyId = null
    // remove gone
    const allProps = new Map<string, Property>()
    for (const p of this.engine.state.listings) allProps.set(p.id, p)
    for (const p of this.engine.state.owned) allProps.set(p.id, p)
    for (const [id, sprite] of this.buildingByPropertyId) {
      if (!allProps.has(id)) {
        sprite.destroy()
        this.buildingByPropertyId.delete(id)
      }
    }
    // add new / refresh existing
    for (const p of allProps.values()) {
      const isOwned = p.state === 'owned'
      const existing = this.buildingByPropertyId.get(p.id)
      if (existing) {
        // if ownership flipped (or any other state change requiring new handler),
        // tear down and respawn so click/hover closures match the new state
        const wasOwned = (existing as any)._isOwned === true
        if (wasOwned !== isOwned) {
          existing.destroy()
          this.buildingByPropertyId.delete(p.id)
          this.spawnPropertySprite(p, isOwned)
        } else {
          // just refresh texture if condition tier changed
          const style = BuildingRenderer.rollStyle(p.type, p.styleSeed, Math.round(p.condition / 5) * 5)
          const key = BuildingRenderer.ensureTexture(this, style, isOwned)
          const img = existing.getAt(0) as Phaser.GameObjects.Image
          if (img && img.texture.key !== key) img.setTexture(key)
        }
      } else {
        this.spawnPropertySprite(p, isOwned)
      }
    }
  }

  private spawnPropertySprite(p: Property, isOwned: boolean) {
    const style = BuildingRenderer.rollStyle(p.type, p.styleSeed, Math.round(p.condition / 5) * 5)
    const key = BuildingRenderer.ensureTexture(this, style, isOwned)
    const pos = this.city.tileToWorld(p.tileX, p.tileY)
    const container = this.add.container(pos.x, pos.y)
    const img = this.add.image(0, 0, key).setOrigin(0.5, 0.85) // anchor at base
    container.add(img)

    // for-sale price tag bobbing above the building
    if (!isOwned) {
      const tagBg = this.add.rectangle(0, -img.height + 12, 70, 18, 0x131c28, 0.95)
        .setStrokeStyle(1, 0x4eb4e0)
      const tagTxt = this.add.text(0, -img.height + 12, formatEuro(p.price), {
        fontFamily: 'monospace', fontSize: '11px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5)
      container.add(tagBg)
      container.add(tagTxt)
      this.tweens.add({ targets: [tagBg, tagTxt], y: '-=4', duration: 1200, ease: 'Sine.inOut', yoyo: true, repeat: -1 })
      ;(container as any)._tag = tagTxt
    }

    container.setSize(style.width, style.height)
    container.setInteractive(new Phaser.Geom.Rectangle(-style.width / 2, -style.height + 6, style.width, style.height), Phaser.Geom.Rectangle.Contains)

    container.on('pointerover', () => {
      this.tweens.add({ targets: img, scale: 1.06, duration: 140, ease: 'Sine.out' })
      this.hoveredPropertyId = p.id
      this.showTooltip(p, container.x, container.y, isOwned)
      this.input.setDefaultCursor('pointer')
    })
    container.on('pointerout', () => {
      this.tweens.add({ targets: img, scale: 1, duration: 140 })
      if (this.hoveredPropertyId === p.id) {
        this.hoveredPropertyId = null
        this.hideTooltip()
      }
      this.input.setDefaultCursor('default')
    })
    container.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // ignore if it was a pan drag
      if (pointer.getDistance && pointer.getDistance() > 6) return
      // ignore right click / middle click — they are pan
      const ev = pointer.event as MouseEvent | undefined
      if (ev && (ev.button === 2 || ev.button === 1 || ev.shiftKey)) return
      // hide tooltip on click — modal will overlap it
      this.hoveredPropertyId = null
      this.hideTooltip()
      this.deal.open(p, isOwned)
    })

    ;(container as any)._isOwned = isOwned
    this.propertyLayer.add(container)
    this.buildingByPropertyId.set(p.id, container)
  }

  private showTooltip(p: Property, worldX: number, worldY: number, isOwned: boolean) {
    if (!this.hoverDiv) return
    const cam = this.cameras.main
    const screenX = (worldX - cam.scrollX) * cam.zoom
    const screenY = (worldY - cam.scrollY) * cam.zoom
    const cap = this.engine.capRate(p)
    const t = p.tenant
    const condClass = p.condition >= 70 ? 'good' : p.condition >= 40 ? 'mid' : 'bad'
    const tag = isOwned ? '<span class="pt-tag owned">DEIN</span>' : '<span class="pt-tag forsale">VERKAUF</span>'
    const channelTag = !isOwned && p.seller
      ? p.seller.channel === 'agent'
        ? `<div class="pt-row" style="font-size:10px;color:var(--accent)">🏢 via ${escape(p.seller.agentName!.split(' (')[0])}</div>`
        : `<div class="pt-row" style="font-size:10px;color:var(--muted)">🏠 Privatverkauf von ${escape(p.seller.ownerName)}</div>`
      : ''
    this.hoverDiv.innerHTML = `
      <div class="pt-name">${escape(this.engine.nameFor(p))}</div>
      <div class="pt-sub">${capitalize(p.type)} · ${districtName(p.district)} · ${p.yearBuilt}</div>
      <div class="pt-row"><span>${isOwned ? 'Wert' : 'Preis'}</span><b>${formatEuro(isOwned ? p.marketValue : p.price)}</b></div>
      <div class="pt-row"><span>Miete</span><b>${formatEuro(p.baseRent)}/M</b></div>
      <div class="pt-row"><span>Zustand</span><b class="${condClass}">${Math.round(p.condition)}%</b></div>
      <div class="pt-row"><span>Cap Rate</span><b class="${cap >= 5 ? 'good' : cap >= 3 ? 'mid' : 'bad'}">${cap.toFixed(1)}%</b></div>
      ${isOwned ? `<div class="pt-row"><span>Mieter</span><b>${t ? escape(t.name) : 'leer'}</b></div>` : ''}
      ${channelTag}
      ${tag}
    `
    this.hoverDiv.style.display = 'block'
    this.hoverDiv.style.left = screenX + 'px'
    this.hoverDiv.style.top = screenY + 'px'
  }

  private hideTooltip() {
    if (this.hoverDiv) this.hoverDiv.style.display = 'none'
  }

  private repositionTooltip() {
    if (!this.hoveredPropertyId || !this.hoverDiv) return
    const sprite = this.buildingByPropertyId.get(this.hoveredPropertyId)
    if (!sprite) { this.hideTooltip(); this.hoveredPropertyId = null; return }
    const cam = this.cameras.main
    const screenX = (sprite.x - cam.scrollX) * cam.zoom
    const screenY = (sprite.y - cam.scrollY) * cam.zoom
    this.hoverDiv.style.left = screenX + 'px'
    this.hoverDiv.style.top = screenY + 'px'
  }

  private spawnCoinBurst(p: Property) {
    const pos = this.city.tileToWorld(p.tileX, p.tileY)
    for (let i = 0; i < 12; i++) {
      const c = this.add.circle(pos.x, pos.y, 3, 0xf1c40f).setDepth(100)
      const angle = Math.random() * Math.PI * 2
      const dist = 30 + Math.random() * 40
      this.tweens.add({
        targets: c,
        x: pos.x + Math.cos(angle) * dist,
        y: pos.y + Math.sin(angle) * dist,
        alpha: 0,
        duration: 800 + Math.random() * 400,
        ease: 'Sine.out',
        onComplete: () => c.destroy(),
      })
    }
  }
}

function capitalize(s: string) { return s.slice(0, 1).toUpperCase() + s.slice(1) }
function escape(s: string) { return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)) }
function districtName(id: string): string {
  const map: Record<string, string> = {
    mitte: 'Mitte', prenzlauer: 'Prenzlauer Berg', kreuzberg: 'Kreuzberg',
    charlottenburg: 'Charlottenburg', wedding: 'Wedding', neukoelln: 'Neukoelln',
  }
  return map[id] ?? id
}
