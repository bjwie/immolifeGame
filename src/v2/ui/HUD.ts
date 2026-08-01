import type { Engine } from '../sim/Engine'
import { formatEuro } from '../sim/Engine'
import type { Speed } from '../sim/types'

const SPEED_VALUES: Speed[] = [0, 1, 2, 4, 8]
const MONTH_NAMES = ['Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

export class HUD {
  private engine: Engine
  private root: HTMLDivElement
  private chart: ChartCanvas
  private onMenu: () => void

  constructor(engine: Engine, root: HTMLElement, onMenu: () => void) {
    this.engine = engine
    this.onMenu = onMenu
    this.root = document.createElement('div')
    this.root.id = 'hud-v2'
    this.root.innerHTML = HUD_HTML
    root.appendChild(this.root)
    this.chart = new ChartCanvas(this.root.querySelector('#nw-chart') as HTMLCanvasElement)

    this.bindControls()
    this.refresh()
    engine.on('day', () => this.refreshTime())
    engine.on('month', () => { this.refresh() })
    engine.on('financial', () => this.refresh())
    engine.on('bought', () => this.refresh())
    engine.on('sold', () => this.refresh())
    engine.on('renovated', () => this.refresh())
    engine.on('speed', () => this.refreshSpeedButtons())
    engine.on('event', (e: any) => this.toast(e.title, 'info'))
    engine.on('toast', (t: any) => this.toast(t.text, t.kind))
    engine.on('achievement', (a: any) => this.celebrate(a.title, a.desc))
    engine.on('capex', () => this.refresh())
    engine.on('capexPaid', () => this.refresh())
    engine.on('renovationStart', () => this.refresh())
    engine.on('renovationDone', () => this.refresh())
    engine.on('wegAssembly', () => this.refresh())
  }

  private bindControls() {
    this.root.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(b => {
      b.addEventListener('click', () => {
        const s = Number(b.dataset.speed) as Speed
        this.engine.setSpeed(s)
      })
    })
    this.root.querySelector('#btn-menu')?.addEventListener('click', () => this.onMenu())
  }

  private refresh() {
    const s = this.engine.state
    this.refreshTime()
    const flow = this.engine.monthlyCashflow()
    const nw = this.engine.netWorth()

    this.set('#cash', formatEuro(s.player.cash))
    this.set('#networth', formatEuro(nw))
    this.set('#props-count', String(s.owned.length))
    this.set('#cashflow', formatEuro(flow.net) + '/M')
    const cf = this.root.querySelector('#cashflow') as HTMLElement
    if (cf) cf.style.color = flow.net >= 0 ? '#5fdc78' : '#ff7676'

    this.set('#credit-score', String(Math.round(s.player.creditScore)))
    this.set('#reputation', String(Math.round(s.player.reputation)))
    this.set('#base-rate', s.market.baseRate.toFixed(1) + '%')

    // active events strip
    const events = this.root.querySelector('#event-strip')!
    events.innerHTML = ''
    for (const e of s.market.events) {
      const chip = document.createElement('div')
      chip.className = 'event-chip'
      chip.textContent = e.title
      chip.title = e.body
      events.appendChild(chip)
    }
    for (const ls of s.lawsuits) {
      const chip = document.createElement('div')
      chip.className = 'event-chip lawsuit'
      const label = ls.reason === 'eviction' ? 'Raeumung' : 'Mieterhoehung'
      chip.textContent = `⚖ ${label} (${ls.monthsRemaining} M, ${formatEuro(ls.monthlyCost)}/M)`
      chip.title = `${label}-Klage. Gesamtkosten bisher ${formatEuro(ls.totalSpent)}. Erfolgschance ${(ls.successChance * 100).toFixed(0)}%.`
      events.appendChild(chip)
    }
    const pendingCapex = s.owned.filter(p => p.pendingCapex)
    if (pendingCapex.length > 0) {
      const chip = document.createElement('div')
      chip.className = 'event-chip capex'
      const totalCost = pendingCapex.reduce((sum, p) => sum + (p.pendingCapex?.cost ?? 0), 0)
      chip.textContent = `⚠ ${pendingCapex.length} Reparatur${pendingCapex.length === 1 ? '' : 'en'} faellig (${formatEuro(totalCost)})`
      chip.title = pendingCapex.map(p => `${p.pendingCapex!.title} — Frist ${p.pendingCapex!.deadlineMonth - this.engine.gameMonth()} M`).join('\n')
      events.appendChild(chip)
    }
    const activeRenos = s.owned.filter(p => p.activeRenovation)
    if (activeRenos.length > 0) {
      const chip = document.createElement('div')
      chip.className = 'event-chip reno'
      chip.textContent = `🔨 ${activeRenos.length} Renovierung${activeRenos.length === 1 ? '' : 'en'} laeuft`
      chip.title = activeRenos.map(p => {
        const c = p.activeRenovation!
        const step = c.steps[c.currentStepIndex]
        return `${this.engine.nameFor(p)}: Schritt ${c.currentStepIndex + 1}/${c.steps.length}${step ? ` (${step.contractorName})` : ''}`
      }).join('\n')
      events.appendChild(chip)
    }
    if (s.player.schwarzJobsThisYear > 0) {
      const chip = document.createElement('div')
      chip.className = 'event-chip schwarz'
      chip.textContent = `🚫 Schwarz: ${s.player.schwarzJobsThisYear} Jobs YTD`
      chip.title = `${s.player.schwarzJobsThisYear} Schwarzarbeit-Jobs in diesem Jahr — Audit-Risiko steigt mit jedem. Reset im Januar.\nGesamt: ${s.player.totalSchwarzJobs} · Audits erlebt: ${s.player.taxAuditsExperienced}`
      events.appendChild(chip)
    }
    const managed = s.owned.filter(p => p.management)
    if (managed.length > 0) {
      const chip = document.createElement('div')
      chip.className = 'event-chip mgmt'
      const totalFee = managed.reduce((sum, p) => sum + this.engine.managementFeeFor(p), 0)
      chip.textContent = `🏢 ${managed.length} Verwaltung (${formatEuro(totalFee)}/M)`
      chip.title = managed.map(p => `${this.engine.nameFor(p)} — ${formatEuro(this.engine.managementFeeFor(p))}/M`).join('\n')
      events.appendChild(chip)
    }
    const pendingWeg = s.wegAssemblies.filter(a => !a.decided)
    if (pendingWeg.length > 0) {
      const chip = document.createElement('div')
      chip.className = 'event-chip weg'
      chip.textContent = `📋 ${pendingWeg.length} WEG-Versammlung${pendingWeg.length === 1 ? '' : 'en'}`
      chip.title = pendingWeg.map(a => {
        const p = s.owned.find(pp => pp.id === a.propertyId)
        return `${p ? this.engine.nameFor(p) : 'Property'}: ${a.proposals.length} TOPs, ${(a.playerShare * 100).toFixed(0)}% Stimmenanteil`
      }).join('\n')
      events.appendChild(chip)
    }
    if (s.market.events.length === 0 && s.lawsuits.length === 0 && pendingCapex.length === 0 && activeRenos.length === 0 && pendingWeg.length === 0) {
      const chip = document.createElement('div')
      chip.className = 'event-chip muted'
      chip.textContent = 'Markt ruhig'
      events.appendChild(chip)
    }

    // chart
    this.chart.draw(s.player.netWorthHistory.map(h => h.netWorth))

    this.refreshSpeedButtons()
  }

  private refreshSpeedButtons() {
    const cur = this.engine.getSpeed()
    SPEED_VALUES.forEach(s => {
      const btn = this.root.querySelector(`[data-speed="${s}"]`)
      if (!btn) return
      btn.classList.toggle('active', s === cur)
    })
  }

  private refreshTime() {
    const t = this.engine.state.time
    this.set('#date', `${t.day}. ${MONTH_NAMES[t.month - 1]} ${t.year}`)
  }

  private set(sel: string, value: string) {
    const el = this.root.querySelector(sel)
    if (el) el.textContent = value
  }

  toast(text: string, kind: 'success' | 'error' | 'warning' | 'info' = 'info') {
    const el = document.createElement('div')
    el.className = 'toast toast-' + kind
    el.textContent = text
    const tray = this.root.querySelector('#toast-tray')!
    tray.appendChild(el)
    requestAnimationFrame(() => el.classList.add('show'))
    setTimeout(() => {
      el.classList.remove('show')
      setTimeout(() => el.remove(), 300)
    }, 4000)
  }

  celebrate(title: string, desc: string) {
    const el = document.createElement('div')
    el.className = 'achievement-pop'
    el.innerHTML = `<div class="ach-title">★ ${escapeHtml(title)}</div><div class="ach-desc">${escapeHtml(desc)}</div>`
    this.root.appendChild(el)
    requestAnimationFrame(() => el.classList.add('show'))
    setTimeout(() => {
      el.classList.remove('show')
      setTimeout(() => el.remove(), 400)
    }, 5000)
  }

  destroy() { this.root.remove() }
}

const HUD_HTML = `
<div class="hud-top">
  <div class="hud-card stat-card">
    <div class="stat-label">CASH</div>
    <div class="stat-value" id="cash">€0</div>
  </div>
  <div class="hud-card stat-card">
    <div class="stat-label">NET WORTH</div>
    <div class="stat-value gold" id="networth">€0</div>
  </div>
  <div class="hud-card stat-card">
    <div class="stat-label">PORTFOLIO</div>
    <div class="stat-value" id="props-count">0</div>
  </div>
  <div class="hud-card stat-card">
    <div class="stat-label">CASHFLOW</div>
    <div class="stat-value" id="cashflow">€0/M</div>
  </div>
  <div class="hud-card date-card">
    <div class="stat-label">DATUM</div>
    <div class="stat-value sm" id="date">1. Jan 2026</div>
    <div class="speed-row">
      <button data-speed="0" title="Pause">II</button>
      <button data-speed="1" title="Normal">1×</button>
      <button data-speed="2" title="Schnell">2×</button>
      <button data-speed="4" title="Sehr schnell">4×</button>
      <button data-speed="8" title="Ultra">8×</button>
    </div>
  </div>
  <button id="btn-menu" class="menu-btn" title="Menue">☰</button>
</div>

<div class="hud-side">
  <div class="hud-card chart-card">
    <div class="card-title">Vermoegen</div>
    <canvas id="nw-chart" width="240" height="100"></canvas>
  </div>
  <div class="hud-card meta-card">
    <div class="meta-row"><span>Bonitaet</span><b id="credit-score">0</b></div>
    <div class="meta-row"><span>Reputation</span><b id="reputation">0</b></div>
    <div class="meta-row"><span>EZB-Zins</span><b id="base-rate">0%</b></div>
  </div>
  <div class="hud-card events-card">
    <div class="card-title">Markt</div>
    <div id="event-strip"></div>
  </div>
</div>

<div id="toast-tray"></div>
`

class ChartCanvas {
  ctx: CanvasRenderingContext2D
  w: number
  h: number
  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!
    this.w = canvas.width
    this.h = canvas.height
  }
  draw(values: number[]) {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.w, this.h)
    if (values.length === 0) {
      ctx.fillStyle = '#5a6776'
      ctx.font = '11px monospace'
      ctx.fillText('Daten werden gesammelt …', 8, 18)
      return
    }
    const min = Math.min(0, ...values)
    const max = Math.max(...values, 1)
    const range = max - min || 1
    const w = this.w, h = this.h
    // grid
    ctx.strokeStyle = '#2c3848'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 1; i < 4; i++) {
      const y = (h / 4) * i
      ctx.moveTo(0, y); ctx.lineTo(w, y)
    }
    ctx.stroke()
    // line
    ctx.strokeStyle = '#f1c40f'
    ctx.lineWidth = 2
    ctx.beginPath()
    values.forEach((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * (w - 4) + 2
      const y = h - 4 - ((v - min) / range) * (h - 8)
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    })
    ctx.stroke()
    // fill
    ctx.lineTo(w - 2, h - 4)
    ctx.lineTo(2, h - 4)
    ctx.closePath()
    ctx.fillStyle = 'rgba(241,196,15,0.15)'
    ctx.fill()
    // last value label
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 10px monospace'
    const last = values[values.length - 1]
    ctx.fillText('€' + Math.round(last).toLocaleString('de-DE'), 4, 12)
  }
}

function escapeHtml(s: string) { return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)) }
