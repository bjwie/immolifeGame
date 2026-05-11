import type { Engine } from '../sim/Engine'
import { formatEuro } from '../sim/Engine'
import type { Applicant, Property, TenantPersonality } from '../sim/types'
import { ModalManager, type ManagedModal } from './ModalManager'

const PERSONA_LABEL: Record<TenantPersonality, string> = {
  tidy: 'Ordentlich',
  partyer: 'Partyfreudig',
  quiet: 'Ruhig',
  demanding: 'Anspruchsvoll',
  family: 'Familie',
  student: 'Student:in',
  nomad: 'Mietnomade',
}
const PERSONA_EMOJI: Record<TenantPersonality, string> = {
  tidy: '🧹', partyer: '🎉', quiet: '🤫', demanding: '🧐', family: '👨‍👩‍👧', student: '🎓', nomad: '🏚',
}
const PERSONA_BG: Record<TenantPersonality, string> = {
  tidy: 'linear-gradient(135deg,#16a085,#27ae60)',
  partyer: 'linear-gradient(135deg,#c0392b,#e67e22)',
  quiet: 'linear-gradient(135deg,#34495e,#7f8c8d)',
  demanding: 'linear-gradient(135deg,#5d3478,#9b59b6)',
  family: 'linear-gradient(135deg,#2980b9,#3498db)',
  student: 'linear-gradient(135deg,#d4ac0d,#f1c40f)',
  nomad: 'linear-gradient(135deg,#3a1f1f,#7b2f2f)',
}

export class RentalModal {
  private engine: Engine
  private root: HTMLDivElement
  private property: Property | null = null
  private unitId: string | undefined = undefined
  private askingRent: number = 0
  private leaseMonths: number = 24
  private applicants: Applicant[] = []
  private onClosed: (() => void) | null = null
  private modal: ManagedModal

  constructor(engine: Engine, mountIn: HTMLElement) {
    this.engine = engine
    this.root = document.createElement('div')
    this.root.id = 'rental-modal'
    mountIn.appendChild(this.root)
    this.modal = { id: 'rental', el: this.root, onCancel: () => this.close() }
  }

  open(p: Property, onClosed?: () => void, unitId?: string) {
    this.property = p
    this.unitId = unitId
    this.onClosed = onClosed ?? null
    const u = unitId ? p.units.find(x => x.id === unitId) : (p.units.find(x => !x.tenant) ?? p.units[0])
    const refKalt = u?.baseKalt ?? p.baseRent
    // Default ask: legal top-of-market (Mietspiegel x 1.05) so the player
    // starts at the "natural" level. Player can slide down for faster rental
    // or up to push the Mietpreisbremse limit.
    const mietspiegelUnit = u ? this.engine.mietspiegelKaltForUnit(p, u) : p.mietspiegelKalt
    this.askingRent = Math.max(refKalt, Math.round(mietspiegelUnit * 1.05))
    this.leaseMonths = 24
    this.refreshApplicants()
    this.render()
    ModalManager.get().push(this.modal)
  }

  close() {
    ModalManager.get().pop(this.modal)
    this.property = null
    this.applicants = []
    const cb = this.onClosed; this.onClosed = null
    cb?.()
  }

  private refreshApplicants() {
    if (!this.property) return
    // Initial / passive load — does not consume the monthly refresh budget.
    this.applicants = this.engine.getApplicants(this.property.id, this.askingRent, 5)
  }

  private refreshApplicantsManual(): boolean {
    if (!this.property) return false
    const res = this.engine.tryRefreshApplicants(this.property.id, this.askingRent, 5)
    if (res.ok) this.applicants = res.applicants
    return res.ok
  }

  private render() {
    if (!this.property) return
    const p = this.property
    const u = this.unitId ? p.units.find(x => x.id === this.unitId) : (p.units.find(x => !x.tenant) ?? p.units[0])
    const refKalt = u?.baseKalt ?? p.baseRent
    const mietspiegelUnit = u ? this.engine.mietspiegelKaltForUnit(p, u) : p.mietspiegelKalt
    const minRent = Math.round(refKalt * 0.4)
    // Widen the upper bound so the slider can reach Mietspiegel x 1.30
    // (legal-grey zone with high lawsuit risk). Without this, low-baseRent
    // properties would be capped well below Mietspiegel.
    const maxRent = Math.max(Math.round(refKalt * 1.6), Math.round(mietspiegelUnit * 1.30))
    const nk = p.nebenkosten ?? 0
    const warm = this.askingRent + nk
    const spiegelRatio = this.askingRent / Math.max(1, mietspiegelUnit)
    const spiegelDeltaPct = Math.round((spiegelRatio - 1) * 100)
    const spiegelLabel = formatSpiegelDelta(spiegelDeltaPct)
    const spiegelClass = spiegelRatio <= 1.10 ? 'good' : spiegelRatio <= 1.20 ? 'mid' : 'bad'

    const apps = this.applicants
    const hasNone = apps.length === 0

    const rows = apps.map(a => {
      const reliabilityClass = a.reliability >= 85 ? 'good' : a.reliability >= 65 ? 'mid' : 'bad'
      // applicants compare warm vs warm budget
      const incomeRatio = a.income / Math.max(1, warm)
      const incomeOK = incomeRatio >= 3
      const overBudget = warm > a.maxRentBudget * 1.05
      return `
        <div class="applicant-row" data-app-id="${a.id}">
          <div class="app-avatar" style="background:${PERSONA_BG[a.personality]}">${PERSONA_EMOJI[a.personality]}</div>
          <div class="app-info">
            <div class="app-head">
              <b>${escape(a.name)}</b>
              <span class="persona-tag persona-${a.personality}">${PERSONA_LABEL[a.personality]}</span>
            </div>
            <div class="micro">${escape(a.occupation)} · Einkommen ${formatEuro(a.income)}/M ${incomeOK ? '<span class="good">✓</span>' : '<span class="bad">⚠ knapp</span>'}</div>
            <div class="app-blurb">${escape(a.blurb)}</div>
          </div>
          <div class="app-stats">
            <div class="micro">Zuverlaessig.</div>
            <div class="${reliabilityClass}"><b>${a.reliability}%</b></div>
            <div class="micro">Wunsch-Vertrag</div>
            <div><b>${a.preferredLeaseMonths} Mon.</b></div>
            <div class="micro">Max. warm</div>
            <div><b>${formatEuro(a.maxRentBudget)}</b></div>
            <button class="primary small" data-sign-id="${a.id}" ${overBudget ? 'disabled' : ''}>Vertrag</button>
          </div>
        </div>
      `
    }).join('')

    const monthsOptions = [12, 24, 36].map(m => `<button class="lease-opt ${this.leaseMonths === m ? 'sel' : ''}" data-lease="${m}">${m} Monate</button>`).join('')

    this.root.innerHTML = `
      <div class="rental-modal">
        <div class="rental-head">
          <div class="neg-title">Vermietung — ${escape(this.engine.nameFor(p))}</div>
          <div class="neg-sub">Zustand ${Math.round(p.condition)}% · Basismiete ${formatEuro(p.baseRent)} kalt · NK ${formatEuro(nk)} · Leerstand ${p.vacantMonths} M</div>
          <button class="ds-close" data-close>×</button>
        </div>
        <div class="rental-body">
          <div class="rental-controls">
            <div class="rental-section">
              <div class="card-title">DEINE KALTMIETE</div>
              <input type="range" id="rent-slider" min="${minRent}" max="${maxRent}" step="20" value="${this.askingRent}">
              <div class="rent-display">
                <b id="rent-value">${formatEuro(this.askingRent)}</b> kalt
                <span class="micro" style="margin-left:8px">+ <b id="nk-value">${formatEuro(nk)}</b> NK = <b id="warm-value">${formatEuro(warm)}</b> warm</span>
              </div>
              <div class="micro">Mietspiegel: <b>${formatEuro(mietspiegelUnit)}</b> kalt - <span id="spiegel-delta" class="${spiegelClass}">${spiegelLabel}</span></div>
              <div class="micro">Bewerber vergleichen ihr Budget mit der Warmmiete. Nebenkosten zahlt der Mieter zusaetzlich, sie laufen durch. Ab 110% Mietspiegel Klagerisiko (Mietpreisbremse).</div>
            </div>
            <div class="rental-section">
              <div class="card-title">VERTRAGSDAUER</div>
              <div class="lease-opts">${monthsOptions}</div>
              <div class="micro">Lange Vertraege = stabile Mieter, kuendigen ungern.</div>
            </div>
            <button class="ghost" data-refresh ${this.engine.applicantRefreshesLeft(p.id) <= 0 ? 'disabled' : ''}>↻ Neue Bewerber suchen (${this.engine.applicantRefreshesLeft(p.id)}/3 Monat)</button>
          </div>
          <div class="applicants-list">
            <div class="card-title">BEWERBER (${apps.length})</div>
            ${hasNone ? `<div class="empty-state">Keine Bewerber bei dieser Miete. Senke den Mietpreis oder verbessere den Zustand.</div>` : rows}
          </div>
        </div>
      </div>
    `

    const slider = this.root.querySelector<HTMLInputElement>('#rent-slider')
    const display = this.root.querySelector<HTMLElement>('#rent-value')
    const warmDisplay = this.root.querySelector<HTMLElement>('#warm-value')
    const spiegelDelta = this.root.querySelector<HTMLElement>('#spiegel-delta')
    slider?.addEventListener('input', () => {
      this.askingRent = Number(slider.value)
      if (display) display.textContent = formatEuro(this.askingRent)
      if (warmDisplay) warmDisplay.textContent = formatEuro(this.askingRent + nk)
      if (spiegelDelta) {
        const r = this.askingRent / Math.max(1, mietspiegelUnit)
        const pct = Math.round((r - 1) * 100)
        spiegelDelta.textContent = formatSpiegelDelta(pct)
        spiegelDelta.className = r <= 1.10 ? 'good' : r <= 1.20 ? 'mid' : 'bad'
      }
    })
    slider?.addEventListener('change', () => {
      this.refreshApplicants()
      this.render()
    })

    this.root.querySelectorAll<HTMLElement>('[data-lease]').forEach(b => {
      b.addEventListener('click', () => {
        this.leaseMonths = Number(b.dataset.lease)
        this.render()
      })
    })

    this.root.querySelector('[data-refresh]')?.addEventListener('click', () => {
      const ok = this.refreshApplicantsManual()
      if (!ok) {
        ;(this.engine as any).emit?.('toast', { kind: 'info', text: 'Diesen Monat keine Suche mehr — naechsten Monat wieder 3 Versuche.' })
      }
      this.render()
    })

    this.root.querySelectorAll<HTMLElement>('[data-sign-id]').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.dataset.signId!
        const app = this.applicants.find(a => a.id === id)
        if (!app) return
        const res = this.engine.signLease(p.id, app, this.askingRent, this.leaseMonths, this.unitId)
        if (!res.ok) (this.engine as any).emit?.('toast', { kind: 'error', text: res.reason ?? 'Vertrag fehlgeschlagen' })
        this.close()
      })
    })

    this.root.querySelector('[data-close]')?.addEventListener('click', () => this.close())
  }
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function formatSpiegelDelta(deltaPct: number): string {
  if (deltaPct === 0) return 'genau auf Mietspiegel'
  if (deltaPct > 0) return `${deltaPct}% ueber Mietspiegel`
  return `${Math.abs(deltaPct)}% unter Mietspiegel`
}
