import type { Engine } from '../sim/Engine'
import { formatEuro } from '../sim/Engine'
import type { ContractorOffer, GewerkKind, Property, RenovationScope } from '../sim/types'
import { ModalManager, type ManagedModal } from './ModalManager'

const GEWERK_LABEL: Record<GewerkKind, string> = {
  abbruch: 'Abbruch & Entkernung', rohbau: 'Rohbau / Wanddurchbrueche', sanitaer: 'Sanitaer-Rohinstallation',
  elektrik: 'Elektrik-Rohinstallation', heizung_install: 'Heizung einbauen', fenster_install: 'Fenster tauschen',
  dach_decken: 'Dach decken', fassade_putz: 'Fassade verputzen', estrich: 'Estrich legen',
  trockenbau: 'Trockenbau / Putz', fliesen: 'Fliesen', maler: 'Maler', boden: 'Boden verlegen',
  endmontage: 'Endmontage & Uebergabe',
}

const TIER_LABEL: Record<string, string> = {
  cheap: 'Billiger Anbieter', standard: 'Standard-Betrieb', premium: 'Premium-Fachbetrieb', gu: 'Generalunternehmer',
}

interface PlanRow {
  gewerk: GewerkKind
  /** offers cached on first request to keep them stable while the modal is open */
  offers: ContractorOffer[]
  selectedOfferIndex: number
  isSchwarz: boolean
  material: 'standard' | 'premium'
}

export class RenovationModal {
  private engine: Engine
  private root: HTMLDivElement
  private property: Property | null = null
  private scope: RenovationScope = 'modern'
  private isGU = false
  private guOffer: ContractorOffer | null = null
  private rows: PlanRow[] = []
  private reorderMode = false
  private onClosed: (() => void) | null = null
  private modal: ManagedModal

  constructor(engine: Engine, mountIn: HTMLElement) {
    this.engine = engine
    this.root = document.createElement('div')
    this.root.id = 'renovation-modal'
    mountIn.appendChild(this.root)
    this.modal = { id: 'renovation', el: this.root, onCancel: () => this.close() }
  }

  open(p: Property, scope: RenovationScope, onClosed?: () => void) {
    this.property = p
    this.scope = scope
    this.isGU = false
    this.onClosed = onClosed ?? null
    this.reorderMode = false
    // Build the default plan rows for this scope
    const plan = this.engine.plansForScope(p, scope)
    this.rows = plan.map(g => ({
      gewerk: g,
      offers: this.engine.generateOffersForGewerk(p.id, g),
      selectedOfferIndex: 1,  // default to standard (middle tier)
      isSchwarz: false,
      material: 'standard',
    }))
    this.guOffer = scope === 'capex' ? null : this.engine.generateGUOffer(p.id, scope)
    this.render()
    ModalManager.get().push(this.modal)
  }

  close() {
    ModalManager.get().pop(this.modal)
    this.property = null
    this.rows = []
    this.guOffer = null
    const cb = this.onClosed; this.onClosed = null
    cb?.()
  }

  private render() {
    if (!this.property) return
    const p = this.property

    // Compute totals
    const totals = this.computeTotals()
    const kfwEligible = this.checkKfwEligible()

    const scopeLabel = this.scope === 'capex' ? 'Capex-Reparatur'
      : this.scope === 'basic' ? 'Grundsanierung'
      : this.scope === 'modern' ? 'Modernisierung'
      : 'Luxus-Sanierung'

    const guHtml = this.guOffer && this.scope !== 'capex' ? `
      <label class="reno-mode-row ${this.isGU ? 'sel' : ''}">
        <input type="radio" name="reno-mode" value="gu" ${this.isGU ? 'checked' : ''}>
        <div class="mode-label">
          <b>Generalunternehmer</b> · ${escape(this.guOffer.contractorName)}
          <div class="micro">+20% Aufschlag · keine Nachforderung · alles aus einer Hand</div>
        </div>
        <div class="mode-cost">${formatEuro(this.computeGUTotal())}</div>
      </label>
      <label class="reno-mode-row ${!this.isGU ? 'sel' : ''}">
        <input type="radio" name="reno-mode" value="self" ${!this.isGU ? 'checked' : ''}>
        <div class="mode-label">
          <b>Eigenregie</b> · du waehlst pro Gewerk
          <div class="micro">Mehr Kontrolle, mehr Risiko, ggf. guenstiger</div>
        </div>
      </label>
    ` : ''

    // Gewerke list (only for Eigenregie, or single Gewerk for capex)
    const gewerkRows = this.rows.map((row, i) => {
      const offer = row.offers[row.selectedOfferIndex]
      const offerCost = offer ? this.engine.costForOffer(offer, row.gewerk, p, row.isSchwarz, row.material) : { cost: 0, duration: 0 }
      const reorder = this.reorderMode ? `
        <span class="reorder-controls">
          <button class="ghost small" data-move-up="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="ghost small" data-move-down="${i}" ${i === this.rows.length - 1 ? 'disabled' : ''}>↓</button>
        </span>
      ` : ''
      const offersList = row.offers.map((o, oi) => {
        const cd = this.engine.costForOffer(o, row.gewerk, p, row.isSchwarz, row.material)
        const tag = TIER_LABEL[o.tier] ?? o.tier
        const sel = oi === row.selectedOfferIndex ? 'selected' : ''
        return `<option value="${oi}" ${sel}>${escape(o.contractorName)} · ${tag} · ${formatEuro(cd.cost)} · ${cd.duration}d</option>`
      }).join('')
      const finishing = ['fliesen', 'maler', 'boden', 'endmontage'].includes(row.gewerk)
      const seqOk = this.isOrderOk(i)
      return `
        <div class="gewerk-row ${seqOk ? '' : 'order-bad'} ${this.isGU ? 'dimmed' : ''}">
          <div class="gewerk-head">
            <span class="gw-num">${i + 1}.</span>
            <span class="gw-name">${escape(GEWERK_LABEL[row.gewerk])}</span>
            ${reorder}
            ${seqOk ? '' : '<span class="bad small">⚠ Reihenfolge: Vorgaenger fehlt</span>'}
          </div>
          <div class="gewerk-controls">
            <select data-row="${i}" data-field="offer" ${this.isGU ? 'disabled' : ''}>${offersList}</select>
            <label class="cb"><input type="checkbox" data-row="${i}" data-field="schwarz" ${row.isSchwarz ? 'checked' : ''} ${this.isGU ? 'disabled' : ''}> 🚫 Schwarz (-35%, kein Recht)</label>
            ${finishing ? `<label class="cb"><input type="checkbox" data-row="${i}" data-field="material" ${row.material === 'premium' ? 'checked' : ''} ${this.isGU ? 'disabled' : ''}> ⭐ Premium-Material (+30%)</label>` : ''}
          </div>
          <div class="gewerk-summary">
            <span>${formatEuro(offerCost.cost)}</span>
            <span class="micro">${offerCost.duration} Tage</span>
            ${row.isSchwarz ? '<span class="schwarz-warn">Audit-Risiko</span>' : ''}
          </div>
        </div>
      `
    }).join('')

    this.root.innerHTML = `
      <div class="renovation-modal">
        <div class="rental-head">
          <div class="neg-title">${scopeLabel} — ${escape(this.engine.nameFor(p))}</div>
          <div class="neg-sub">Zustand ${Math.round(p.condition)}% · Baujahr ${p.yearBuilt} · ${this.rows.length} Gewerke geplant</div>
          <button class="ds-close" data-close>×</button>
        </div>
        <div class="renovation-body">
          ${guHtml}
          <div class="gewerk-section ${this.isGU ? 'dimmed' : ''}">
            <div class="gewerk-header">
              <span class="card-title">GEWERKE${this.scope === 'capex' ? '' : ' (Default-Reihenfolge)'}</span>
              ${this.scope !== 'capex' && !this.isGU ? `
                <button class="ghost small" data-toggle-reorder>${this.reorderMode ? 'Reihenfolge fertig' : 'Reihenfolge bearbeiten'}</button>
              ` : ''}
            </div>
            ${gewerkRows}
          </div>

          <div class="reno-totals">
            <div class="fin-row"><span>Summe</span><b>${formatEuro(totals.cost)}</b></div>
            <div class="fin-row"><span>Bauzeit</span><b>~${Math.ceil(totals.days / 30)} Monate</b></div>
            <div class="fin-row"><span>Mietminderung waehrend Bau</span><b class="bad">-${this.scope === 'capex' || this.scope === 'basic' ? 5 : 15}%</b></div>
            ${kfwEligible ? `<div class="fin-row"><span>KfW-Foerderung (energetische Kombi)</span><b class="good">-30% nach 2 Monaten</b></div>` : ''}
            <div class="fin-row"><span>Anzahlung (30%)</span><b>${formatEuro(Math.round(totals.cost * 0.3))}</b></div>
          </div>

          <div class="reno-actions">
            <button class="primary big" data-confirm>Auftrag erteilen (${formatEuro(Math.round(totals.cost * 0.3))} Anzahlung)</button>
            <button class="ghost" data-close>Abbrechen</button>
          </div>
        </div>
      </div>
    `

    // Wire events
    this.root.querySelectorAll<HTMLInputElement>('input[name="reno-mode"]').forEach(r => {
      r.addEventListener('change', () => {
        this.isGU = r.value === 'gu'
        this.render()
      })
    })
    this.root.querySelector('[data-toggle-reorder]')?.addEventListener('click', () => {
      this.reorderMode = !this.reorderMode
      this.render()
    })
    this.root.querySelectorAll<HTMLElement>('[data-move-up]').forEach(b => {
      b.addEventListener('click', () => {
        const i = Number(b.dataset.moveUp)
        if (i > 0) { [this.rows[i - 1], this.rows[i]] = [this.rows[i], this.rows[i - 1]]; this.render() }
      })
    })
    this.root.querySelectorAll<HTMLElement>('[data-move-down]').forEach(b => {
      b.addEventListener('click', () => {
        const i = Number(b.dataset.moveDown)
        if (i < this.rows.length - 1) { [this.rows[i], this.rows[i + 1]] = [this.rows[i + 1], this.rows[i]]; this.render() }
      })
    })
    this.root.querySelectorAll<HTMLSelectElement>('select[data-field="offer"]').forEach(sel => {
      sel.addEventListener('change', () => {
        const i = Number(sel.dataset.row)
        this.rows[i].selectedOfferIndex = Number(sel.value)
        this.render()
      })
    })
    this.root.querySelectorAll<HTMLInputElement>('input[data-field="schwarz"]').forEach(cb => {
      cb.addEventListener('change', () => {
        const i = Number(cb.dataset.row)
        this.rows[i].isSchwarz = cb.checked
        this.render()
      })
    })
    this.root.querySelectorAll<HTMLInputElement>('input[data-field="material"]').forEach(cb => {
      cb.addEventListener('change', () => {
        const i = Number(cb.dataset.row)
        this.rows[i].material = cb.checked ? 'premium' : 'standard'
        this.render()
      })
    })
    this.root.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => this.close()))
    this.root.querySelector('[data-confirm]')?.addEventListener('click', () => this.confirm())
  }

  private computeTotals(): { cost: number; days: number } {
    if (!this.property) return { cost: 0, days: 0 }
    if (this.isGU && this.guOffer) {
      const cost = this.computeGUTotal()
      const days = this.rows.reduce((s, r) => s + this.engine.costForOffer(r.offers[r.selectedOfferIndex], r.gewerk, this.property!, false, 'standard').duration, 0)
      // GU finishes faster
      return { cost, days: Math.round(days * 0.85) }
    }
    let cost = 0, days = 0
    for (const r of this.rows) {
      const o = r.offers[r.selectedOfferIndex]
      if (!o) continue
      const cd = this.engine.costForOffer(o, r.gewerk, this.property, r.isSchwarz, r.material)
      cost += cd.cost
      days += cd.duration
    }
    return { cost, days }
  }

  private computeGUTotal(): number {
    if (!this.property || !this.guOffer) return 0
    let base = 0
    for (const r of this.rows) {
      const cd = this.engine.costForOffer(this.guOffer, r.gewerk, this.property, false, 'standard')
      base += cd.cost
    }
    return base
  }

  private checkKfwEligible(): boolean {
    const set = new Set(this.rows.map(r => r.gewerk))
    return set.has('heizung_install') && set.has('fenster_install') && set.has('fassade_putz')
  }

  /** Order check: each Gewerk's recommended predecessors should appear before it. */
  private isOrderOk(index: number): boolean {
    const recommended: Partial<Record<GewerkKind, GewerkKind[]>> = {
      rohbau: ['abbruch'],
      sanitaer: ['rohbau'],
      elektrik: ['rohbau'],
      heizung_install: ['rohbau'],
      estrich: ['sanitaer', 'elektrik'],
      trockenbau: ['estrich'],
      fliesen: ['trockenbau'],
      maler: ['trockenbau'],
      boden: ['maler'],
      endmontage: ['boden'],
    }
    const row = this.rows[index]
    const reqs = recommended[row.gewerk]
    if (!reqs) return true
    const before = new Set(this.rows.slice(0, index).map(r => r.gewerk))
    return reqs.every(req => !this.rows.some(r => r.gewerk === req) || before.has(req))
  }

  private confirm() {
    if (!this.property) return
    const plan = this.isGU && this.guOffer
      ? this.rows.map(r => ({ gewerk: r.gewerk, offer: this.guOffer!, isSchwarz: false, material: 'standard' as const }))
      : this.rows.map(r => ({ gewerk: r.gewerk, offer: r.offers[r.selectedOfferIndex], isSchwarz: r.isSchwarz, material: r.material }))
    const r = this.engine.startRenovation(this.property.id, this.scope, plan, this.isGU)
    if (!r.ok) {
      ;(this.engine as any).emit?.('toast', { kind: 'error', text: r.reason ?? 'Auftrag fehlgeschlagen' })
      return
    }
    this.close()
  }
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
