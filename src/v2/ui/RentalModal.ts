import type { Engine } from '../sim/Engine'
import { formatEuro } from '../sim/Engine'
import type { Applicant, Property, TenantPersonality } from '../sim/types'

const PERSONA_LABEL: Record<TenantPersonality, string> = {
  tidy: 'Ordentlich',
  partyer: 'Partyfreudig',
  quiet: 'Ruhig',
  demanding: 'Anspruchsvoll',
  family: 'Familie',
  student: 'Student:in',
}
const PERSONA_EMOJI: Record<TenantPersonality, string> = {
  tidy: '🧹', partyer: '🎉', quiet: '🤫', demanding: '🧐', family: '👨‍👩‍👧', student: '🎓',
}
const PERSONA_BG: Record<TenantPersonality, string> = {
  tidy: 'linear-gradient(135deg,#16a085,#27ae60)',
  partyer: 'linear-gradient(135deg,#c0392b,#e67e22)',
  quiet: 'linear-gradient(135deg,#34495e,#7f8c8d)',
  demanding: 'linear-gradient(135deg,#5d3478,#9b59b6)',
  family: 'linear-gradient(135deg,#2980b9,#3498db)',
  student: 'linear-gradient(135deg,#d4ac0d,#f1c40f)',
}

export class RentalModal {
  private engine: Engine
  private root: HTMLDivElement
  private property: Property | null = null
  private askingRent: number = 0
  private leaseMonths: number = 24
  private applicants: Applicant[] = []
  private onClosed: (() => void) | null = null

  constructor(engine: Engine, mountIn: HTMLElement) {
    this.engine = engine
    this.root = document.createElement('div')
    this.root.id = 'rental-modal'
    this.root.style.display = 'none'
    mountIn.appendChild(this.root)
    this.root.addEventListener('click', (e) => { if (e.target === this.root) this.close() })
  }

  open(p: Property, onClosed?: () => void) {
    this.property = p
    this.onClosed = onClosed ?? null
    this.askingRent = Math.max(p.baseRent, Math.round(p.baseRent * (0.55 + (p.condition / 100) * 0.45)))
    this.leaseMonths = 24
    this.refreshApplicants()
    this.render()
    this.root.style.display = 'flex'
    this.root.style.opacity = '1'
    this.root.classList.add('show')
  }

  close() {
    this.root.classList.remove('show')
    this.root.style.opacity = ''
    this.root.style.display = 'none'
    this.property = null
    this.applicants = []
    const cb = this.onClosed; this.onClosed = null
    cb?.()
  }

  private refreshApplicants() {
    if (!this.property) return
    this.applicants = this.engine.getApplicants(this.property.id, this.askingRent, 5)
  }

  private render() {
    if (!this.property) return
    const p = this.property
    const minRent = Math.round(p.baseRent * 0.4)
    const maxRent = Math.round(p.baseRent * 1.6)

    const apps = this.applicants
    const hasNone = apps.length === 0

    const rows = apps.map(a => {
      const reliabilityClass = a.reliability >= 85 ? 'good' : a.reliability >= 65 ? 'mid' : 'bad'
      const incomeRatio = a.income / Math.max(1, this.askingRent)
      const incomeOK = incomeRatio >= 3
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
            <div class="micro">Max. Miete</div>
            <div><b>${formatEuro(a.maxRentBudget)}</b></div>
            <button class="primary small" data-sign-id="${a.id}" ${this.askingRent > a.maxRentBudget * 1.05 ? 'disabled' : ''}>Vertrag</button>
          </div>
        </div>
      `
    }).join('')

    const monthsOptions = [12, 24, 36].map(m => `<button class="lease-opt ${this.leaseMonths === m ? 'sel' : ''}" data-lease="${m}">${m} Monate</button>`).join('')

    this.root.innerHTML = `
      <div class="rental-modal">
        <div class="rental-head">
          <div class="neg-title">Vermietung — ${escape(this.engine.nameFor(p))}</div>
          <div class="neg-sub">Zustand ${Math.round(p.condition)}% · Basismiete ${formatEuro(p.baseRent)}/M · Leerstand: ${p.vacantMonths} Monate</div>
          <button class="ds-close" data-close>×</button>
        </div>
        <div class="rental-body">
          <div class="rental-controls">
            <div class="rental-section">
              <div class="card-title">DEINE MIETE</div>
              <input type="range" id="rent-slider" min="${minRent}" max="${maxRent}" step="20" value="${this.askingRent}">
              <div class="rent-display"><b id="rent-value">${formatEuro(this.askingRent)}</b>/Monat</div>
              <div class="micro">Hoehere Miete = weniger Bewerber. Niedrigere Miete = mehr aber weniger Top-Mieter.</div>
            </div>
            <div class="rental-section">
              <div class="card-title">VERTRAGSDAUER</div>
              <div class="lease-opts">${monthsOptions}</div>
              <div class="micro">Lange Vertraege = stabile Mieter, kuendigen ungern.</div>
            </div>
            <button class="ghost" data-refresh>↻ Neue Bewerber suchen</button>
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
    slider?.addEventListener('input', () => {
      this.askingRent = Number(slider.value)
      if (display) display.textContent = formatEuro(this.askingRent)
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
      this.refreshApplicants()
      this.render()
    })

    this.root.querySelectorAll<HTMLElement>('[data-sign-id]').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.dataset.signId!
        const app = this.applicants.find(a => a.id === id)
        if (!app) return
        const res = this.engine.signLease(p.id, app, this.askingRent, this.leaseMonths)
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
