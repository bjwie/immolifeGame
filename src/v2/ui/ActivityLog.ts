import type { Engine } from '../sim/Engine'
import { formatEuro } from '../sim/Engine'

interface LogEntry {
  id: string
  monthLabel: string  // "Mar 2026"
  kind: 'success' | 'info' | 'warning' | 'error' | 'digest'
  icon: string
  text: string
  propertyId?: string
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
const MAX_ENTRIES = 80

/**
 * Activity-Log: scrollable left-side panel that captures every notable engine
 * event (toasts + structured events with propertyId). Click an entry to focus
 * the camera on the involved property and open its DealSheet.
 */
export class ActivityLog {
  private engine: Engine
  private root: HTMLDivElement
  private listEl: HTMLDivElement
  private entries: LogEntry[] = []
  private collapsed = false
  /** Set externally so click-to-focus works. */
  onFocusProperty: (propertyId: string) => void = () => {}

  constructor(engine: Engine, mountIn: HTMLElement) {
    this.engine = engine
    this.root = document.createElement('div')
    this.root.id = 'activity-log'
    this.root.innerHTML = `
      <div class="al-head">
        <div class="al-title">📜 Aktivitaetsprotokoll</div>
        <button class="al-toggle" data-toggle title="Ein-/Ausklappen">−</button>
      </div>
      <div class="al-list" id="al-list"></div>
    `
    mountIn.appendChild(this.root)
    this.listEl = this.root.querySelector('#al-list') as HTMLDivElement
    this.root.querySelector('[data-toggle]')?.addEventListener('click', () => this.toggle())
    this.subscribe()
    this.render()
  }

  private toggle() {
    this.collapsed = !this.collapsed
    this.root.classList.toggle('collapsed', this.collapsed)
    const btn = this.root.querySelector<HTMLElement>('[data-toggle]')
    if (btn) btn.textContent = this.collapsed ? '+' : '−'
  }

  destroy() { this.root.remove() }

  private monthLabel(): string {
    const t = this.engine.state.time
    return `${MONTH_NAMES[t.month - 1]} ${t.year}`
  }

  private push(entry: Omit<LogEntry, 'id' | 'monthLabel'>) {
    const e: LogEntry = {
      id: 'al_' + Math.random().toString(36).slice(2, 9),
      monthLabel: this.monthLabel(),
      ...entry,
    }
    this.entries.unshift(e)
    if (this.entries.length > MAX_ENTRIES) this.entries.length = MAX_ENTRIES
    this.appendOne(e, true)
  }

  private subscribe() {
    // Plain toasts have no propertyId — capture them as info/warn/etc rows.
    this.engine.on('toast', (t: any) => {
      const kind = (t?.kind ?? 'info') as LogEntry['kind']
      const icon = kind === 'success' ? '✓' : kind === 'warning' ? '⚠' : kind === 'error' ? '🚨' : 'ℹ'
      this.push({ kind, icon, text: t?.text ?? '' })
    })

    // Structured events with propertyId — link to the property.
    this.engine.on('bought', (d: any) => this.push({ kind: 'success', icon: '🏠', text: `Gekauft: ${this.engine.nameFor(d.property)}`, propertyId: d.property.id }))
    this.engine.on('sold', (d: any) => this.push({ kind: 'success', icon: '💰', text: `Verkauft: ${this.engine.nameFor(d.property)} (Netto ${formatEuro(d.net)})` }))
    this.engine.on('renovationStart', (d: any) => {
      const p = this.engine.state.owned.find(pp => pp.id === d.contract.propertyId)
      if (p) this.push({ kind: 'info', icon: '🔨', text: `Renovierung gestartet: ${this.engine.nameFor(p)}`, propertyId: p.id })
    })
    this.engine.on('renovationDone', (d: any) => this.push({ kind: 'success', icon: '✨', text: `Renovierung fertig: ${this.engine.nameFor(d.property)}`, propertyId: d.property.id }))
    this.engine.on('capex', (cap: any) => {
      const p = this.engine.state.owned.find(pp => pp.id === cap.propertyId)
      if (p) this.push({ kind: 'warning', icon: '⚠', text: `${cap.title} bei ${this.engine.nameFor(p)}`, propertyId: p.id })
    })
    this.engine.on('capexPaid', (d: any) => this.push({ kind: 'success', icon: '🛠', text: `Repariert: ${d.capex.title} (${this.engine.nameFor(d.property)})`, propertyId: d.property.id }))
    this.engine.on('leaseSigned', (d: any) => this.push({ kind: 'success', icon: '🤝', text: `Vertrag: ${d.tenant.name} → ${this.engine.nameFor(d.property)}${d.unit ? ' (' + d.unit.label + ')' : ''}`, propertyId: d.property.id }))
    this.engine.on('event', (e: any) => this.push({ kind: 'info', icon: '📰', text: e.title }))
    this.engine.on('achievement', (a: any) => this.push({ kind: 'success', icon: '★', text: `Erfolg: ${a.title}` }))
    this.engine.on('wegAssembly', (d: any) => {
      const p = this.engine.state.owned.find(pp => pp.id === d.propertyId)
      if (p) this.push({ kind: 'info', icon: '📋', text: `WEG-Versammlung in ${this.engine.nameFor(p)}`, propertyId: p.id })
    })
    this.engine.on('reset', () => {
      this.entries = []
      this.render()
    })

    // Monthly digest: special highlighted row.
    this.engine.on('digest', (d: any) => {
      const cf = d.net >= 0 ? `+${formatEuro(d.net)}` : formatEuro(d.net)
      this.push({
        kind: 'digest', icon: '📊',
        text: `${MONTH_NAMES[(d.month as number) - 1]} ${d.year}: Cashflow ${cf} · Cash ${formatEuro(d.cash)} · Netto-Vermoegen ${formatEuro(d.netWorth)} · ${d.ownedCount} Properties`,
      })
    })
  }

  private appendOne(e: LogEntry, animate: boolean) {
    const row = document.createElement('div')
    row.className = `al-row al-${e.kind}${e.propertyId ? ' al-clickable' : ''}${animate ? ' al-fadein' : ''}`
    row.dataset.entryId = e.id
    if (e.propertyId) row.dataset.propertyId = e.propertyId
    row.innerHTML = `
      <span class="al-icon">${e.icon}</span>
      <span class="al-text">${escape(e.text)}</span>
      <span class="al-time">${e.monthLabel}</span>
    `
    this.listEl.insertBefore(row, this.listEl.firstChild)
    if (e.propertyId) {
      row.addEventListener('click', () => this.onFocusProperty(e.propertyId!))
    }
    // Trim DOM to max
    while (this.listEl.children.length > MAX_ENTRIES) {
      this.listEl.removeChild(this.listEl.lastChild!)
    }
  }

  private render() {
    this.listEl.innerHTML = ''
    for (const e of this.entries.slice().reverse()) this.appendOne(e, false)
  }
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
