import type { Engine } from '../sim/Engine'
import { formatEuro } from '../sim/Engine'
import type { BankOfferTerms, Property } from '../sim/types'
import type { NegotiationModal } from './NegotiationModal'
import type { RentalModal } from './RentalModal'

const DISTRICT_LABEL: Record<string, string> = {
  mitte: 'Mitte', prenzlauer: 'Prenzlauer Berg', kreuzberg: 'Kreuzberg',
  charlottenburg: 'Charlottenburg', wedding: 'Wedding', neukoelln: 'Neukoelln',
}

const TYPE_LABEL: Record<string, string> = {
  house: 'Haus', villa: 'Villa', apartment: 'Wohnung', shop: 'Ladenlokal',
  office: 'Buero', tower: 'Hochhaus',
}

export class DealSheet {
  private engine: Engine
  private root: HTMLDivElement
  private current: Property | null = null
  private isOwned = false
  private selectedBankId: string | null = null
  private ltvSlider: HTMLInputElement | null = null
  private negotiated: { price: number } | null = null  // result of seller negotiation
  private bankOverride: BankOfferTerms | null = null   // result of bank negotiation
  private negotiationModal: NegotiationModal | null = null

  constructor(engine: Engine, mountIn: HTMLElement) {
    this.engine = engine
    this.root = document.createElement('div')
    this.root.id = 'deal-sheet'
    this.root.style.display = 'none'
    this.root.innerHTML = HTML
    mountIn.appendChild(this.root)
    this.root.querySelector('[data-close]')?.addEventListener('click', () => this.close())
    this.root.addEventListener('click', (e) => { if (e.target === this.root) this.close() })
  }

  setNegotiationModal(nm: NegotiationModal) { this.negotiationModal = nm }
  setRentalModal(rm: RentalModal) { this.rentalModal = rm }
  private rentalModal: RentalModal | null = null

  open(p: Property, isOwned: boolean) {
    this.current = p
    this.isOwned = isOwned
    this.selectedBankId = isOwned ? null : this.engine.state.banks[0].id
    this.negotiated = null
    this.bankOverride = null
    this.render()
    this.root.style.display = 'flex'
    this.root.style.opacity = '1'
    this.root.classList.add('show')
  }

  close() {
    this.root.classList.remove('show')
    this.root.style.opacity = ''
    this.root.style.display = 'none'
    this.current = null
  }

  isOpen(): boolean { return this.current !== null }
  refresh() { if (this.current) this.render() }

  private render() {
    if (!this.current) return
    const p = this.current
    const e = this.engine
    const cap = e.capRate(p)
    const condClass = p.condition >= 70 ? 'good' : p.condition >= 40 ? 'mid' : 'bad'
    const conditionLabel = p.condition >= 80 ? 'Top' : p.condition >= 60 ? 'Gut' : p.condition >= 40 ? 'Mittel' : p.condition >= 20 ? 'Schlecht' : 'Ruine'

    const districtName = DISTRICT_LABEL[p.district] ?? p.district
    const typeName = TYPE_LABEL[p.type] ?? p.type

    const head = this.root.querySelector('#ds-head')!
    head.innerHTML = `
      <div class="ds-name">${escape(e.nameFor(p))}</div>
      <div class="ds-sub">${typeName} · ${districtName} · Baujahr ${p.yearBuilt}</div>
    `

    const stats = this.root.querySelector('#ds-stats')!
    stats.innerHTML = `
      <div class="ds-stat"><label>${this.isOwned ? 'Aktueller Marktwert' : 'Angebotspreis'}</label><b>${formatEuro(this.isOwned ? p.marketValue : p.price)}</b></div>
      <div class="ds-stat"><label>Marktwert</label><b>${formatEuro(p.marketValue)}</b></div>
      <div class="ds-stat"><label>Mietpotential</label><b>${formatEuro(p.baseRent)}/M</b></div>
      <div class="ds-stat"><label>Cap Rate</label><b class="${cap >= 5 ? 'good' : cap >= 3 ? 'mid' : 'bad'}">${cap.toFixed(2)}%</b></div>
      <div class="ds-stat"><label>Zustand</label><div class="cond-bar"><span class="${condClass}" style="width:${p.condition}%"></span></div><b class="${condClass}">${Math.round(p.condition)}% · ${conditionLabel}</b></div>
      <div class="ds-stat"><label>Wartung</label><b>${formatEuro(this['_maint'](p))}/M</b></div>
    `

    if (this.isOwned) this.renderOwnedActions(p)
    else this.renderBuyActions(p)
  }

  /** maintenance helper (mirror of Engine.maintenanceCost — kept private there) */
  private _maint(p: Property): number {
    const baseline = p.baseRent * 0.12
    const condFactor = p.condition < 30 ? 2.5 : p.condition < 50 ? 1.6 : p.condition < 75 ? 1.0 : 0.7
    return Math.round(baseline * condFactor + 80)
  }

  private renderBuyActions(p: Property) {
    const banks = this.engine.state.banks
    const player = this.engine.state.player

    const bankList = this.root.querySelector('#ds-banks')!
    bankList.innerHTML = `<div class="bank-row cash-row ${this.selectedBankId === null ? 'sel' : ''}" data-bank="cash">
        <div><b>Cash kaufen</b><div class="bank-blurb">Eigenkapital: ${formatEuro(player.cash)}</div></div>
        <div class="bank-rate">${player.cash >= p.price ? 'Moeglich' : 'Reicht nicht'}</div>
      </div>` + banks.map(b => {
      const eligible = player.creditScore >= b.minCreditScore
      return `<div class="bank-row ${this.selectedBankId === b.id ? 'sel' : ''} ${!eligible ? 'disabled' : ''}" data-bank="${b.id}">
        <div><b>${b.name}</b><div class="bank-blurb">${b.blurb}</div></div>
        <div class="bank-rate">
          <div>${b.annualRate.toFixed(1)}%</div>
          <div class="micro">max ${Math.round(b.maxLTV * 100)}% LTV · Score ${b.minCreditScore}+</div>
        </div>
      </div>`
    }).join('')

    bankList.querySelectorAll('[data-bank]').forEach(row => {
      row.addEventListener('click', () => {
        if (row.classList.contains('disabled')) return
        const id = (row as HTMLElement).dataset.bank!
        this.selectedBankId = id === 'cash' ? null : id
        this.render()
      })
    })

    const effectivePrice = this.negotiated ? this.negotiated.price : p.price
    const broker = this.engine.currentBroker()
    const brokerHtml = broker
      ? `<div class="dealsheet-broker"><b>Makler: ${escape(broker.name)}</b> · ${(broker.commissionPct * 100).toFixed(1)}% Provision · +${broker.negotiationBonus} Bonus <button class="ghost small" data-pick-broker>wechseln</button></div>`
      : `<div class="dealsheet-broker"><b>Kein Makler</b> — du verhandelst selbst <button class="ghost small" data-pick-broker>Makler waehlen</button></div>`

    const negotiatedSavingsHtml = this.negotiated
      ? `<div class="negotiated-tag">✓ Verhandelt: ${formatEuro(p.price - this.negotiated.price)} gespart (Endpreis ${formatEuro(this.negotiated.price)})</div>`
      : `<button class="negotiate-btn" data-negotiate-seller>💬 Mit Verkaeufer verhandeln</button>`

    const bankNegHtml = this.selectedBankId && !this.bankOverride
      ? `<button class="ghost small" data-negotiate-bank>💬 Mit Bank verhandeln</button>`
      : this.bankOverride
        ? `<div class="negotiated-tag">✓ Bank-Konditionen verhandelt</div>`
        : ''

    this.root.querySelector('#ds-actions')!.innerHTML = `
      ${brokerHtml}
      ${negotiatedSavingsHtml}

      <div class="financing-box ${this.selectedBankId === null ? 'hidden' : ''}">
        <label>Beleihung (LTV): <span id="ltv-display">${this.ltvSlider?.value ?? '70'}%</span> ${bankNegHtml}</label>
        <input id="ltv-slider" type="range" min="20" max="85" step="5" value="${this.ltvSlider?.value ?? '70'}" ${this.bankOverride ? 'disabled' : ''}>
        <div id="financing-summary"></div>
      </div>
      <button id="ds-buy" class="primary big">${this.selectedBankId ? 'Mit Hypothek kaufen' : 'Bar kaufen'} (${formatEuro(effectivePrice)})</button>
    `
    this.ltvSlider = this.root.querySelector('#ltv-slider') as HTMLInputElement | null
    this.ltvSlider?.addEventListener('input', () => this.refreshFinancing())
    this.refreshFinancing()
    this.root.querySelector('#ds-buy')?.addEventListener('click', () => this.tryBuy())
    this.root.querySelector('[data-negotiate-seller]')?.addEventListener('click', () => this.negotiateSeller())
    this.root.querySelector('[data-negotiate-bank]')?.addEventListener('click', () => this.negotiateBank())
    this.root.querySelector('[data-pick-broker]')?.addEventListener('click', () => this.openBrokerPicker())
  }

  private negotiateSeller() {
    if (!this.current || !this.negotiationModal) return
    const p = this.current
    // hide ourselves while neg modal is open
    this.root.style.visibility = 'hidden'
    this.negotiationModal.openSeller(p, {
      onAccepted: (price) => {
        this.negotiated = { price }
        this.root.style.visibility = 'visible'
        this.render()
      },
      onCancelled: () => { this.root.style.visibility = 'visible' },
    })
  }

  private negotiateBank() {
    if (!this.current || !this.negotiationModal || !this.selectedBankId) return
    this.root.style.visibility = 'hidden'
    this.negotiationModal.openBank(this.selectedBankId, this.current, {
      onAccepted: (terms) => {
        this.bankOverride = terms
        this.root.style.visibility = 'visible'
        this.render()
      },
      onCancelled: () => { this.root.style.visibility = 'visible' },
    })
  }

  private openBrokerPicker() {
    // reuse the negotiation modal's broker picker via opening a fake seller neg
    if (!this.current || !this.negotiationModal) return
    this.root.style.visibility = 'hidden'
    this.negotiationModal.openSeller(this.current, {
      onAccepted: (price) => { this.negotiated = { price }; this.root.style.visibility = 'visible'; this.render() },
      onCancelled: () => { this.root.style.visibility = 'visible'; this.render() },
    })
  }

  private refreshFinancing() {
    if (!this.current || this.selectedBankId === null) return
    const bank = this.engine.state.banks.find(b => b.id === this.selectedBankId)!
    const ltvFromSlider = this.ltvSlider ? Number(this.ltvSlider.value) / 100 : bank.maxLTV
    const effectiveLtv = this.bankOverride ? this.bankOverride.ltv : ltvFromSlider
    const display = this.root.querySelector('#ltv-display')
    if (display) display.textContent = (effectiveLtv * 100).toFixed(0) + '%' + (this.bankOverride ? ' (verhandelt)' : '')
    const sum = this.root.querySelector('#financing-summary')
    if (!sum) return

    // Use negotiated price if available
    const propPriceForCalc = this.negotiated ? this.negotiated.price : this.current.price
    // Mirror engine math (hypothetical with negotiated terms / price)
    const baseRatePct = this.bankOverride ? this.bankOverride.annualRate : (bank.annualRate + this.engine.state.market.baseRate * 0.1)
    const origination = this.bankOverride ? this.bankOverride.origination : bank.origination
    const broker = this.engine.currentBroker()
    const commission = broker && this.negotiated ? Math.round(propPriceForCalc * broker.commissionPct) : 0
    const principal = Math.round(propPriceForCalc * effectiveLtv)
    const fees = Math.round(principal * origination)
    const downPayment = propPriceForCalc - principal + fees + commission
    const r = baseRatePct / 100 / 12
    const months = 240
    const monthlyPayment = Math.round(principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1))
    const grossRent = this.current.baseRent * (0.55 + (this.current.condition / 100) * 0.45)
    const maintenance = this._maint(this.current)
    const netMonthly = Math.round(grossRent - maintenance - monthlyPayment)
    const cashOnCash = (netMonthly * 12) / Math.max(1, downPayment) * 100

    const cocClass = cashOnCash >= 8 ? 'good' : cashOnCash >= 4 ? 'mid' : 'bad'
    const netClass = netMonthly >= 0 ? 'good' : 'bad'
    sum.innerHTML = `
      <div class="fin-row"><span>Eigenkapital</span><b>${formatEuro(downPayment)}</b></div>
      ${commission ? `<div class="fin-row"><span>davon Makler-Provision</span><b>${formatEuro(commission)}</b></div>` : ''}
      <div class="fin-row"><span>Monatsrate (${baseRatePct.toFixed(2)}%)</span><b>${formatEuro(monthlyPayment)}</b></div>
      <div class="fin-row"><span>Netto/Monat</span><b class="${netClass}">${formatEuro(netMonthly)}</b></div>
      <div class="fin-row"><span>Cash-on-Cash</span><b class="${cocClass}">${cashOnCash.toFixed(1)}%</b></div>
    `
  }

  private tryBuy() {
    if (!this.current) return
    const bankId = this.selectedBankId ?? undefined
    const ltv = bankId && this.ltvSlider ? Number(this.ltvSlider.value) / 100 : undefined
    const broker = this.engine.currentBroker()

    let res: { ok: boolean; reason?: string }
    if (this.negotiated) {
      // route through engine's negotiation finalizer (handles broker commission)
      // We need a tiny shim — engine.acceptSellerOffer requires a SellerNegotiationState.
      // Instead, mutate the listing price + buy directly with extra cash for commission + bank override.
      const p = this.engine.state.listings.find(pp => pp.id === this.current!.id)
      if (!p) { res = { ok: false, reason: 'Inserat verschwunden' } }
      else {
        const oldPrice = p.price
        p.price = this.negotiated.price
        const commission = broker ? Math.round(p.price * broker.commissionPct) : 0
        res = this.engine.buy(p.id, bankId, ltv, { extraCashCost: commission, bankTermsOverride: this.bankOverride ?? undefined })
        if (!res.ok) p.price = oldPrice
      }
    } else {
      res = this.engine.buy(this.current.id, bankId, ltv, { bankTermsOverride: this.bankOverride ?? undefined })
    }

    if (!res.ok) (this.engine as any).emit?.('toast', { kind: 'error', text: res.reason ?? 'Kauf fehlgeschlagen' })
    this.close()
  }

  private renderOwnedActions(p: Property) {
    this.root.querySelector('#ds-banks')!.innerHTML = ''
    const t = p.tenant
    const personaLabels: Record<string, string> = { tidy: 'Ordentlich', partyer: 'Partyfreudig', quiet: 'Ruhig', demanding: 'Anspruchsvoll', family: 'Familie', student: 'Student:in' }
    const personaTag = t?.personality ? `<span class="persona-tag persona-${t.personality}">${personaLabels[t.personality] ?? t.personality}</span>` : ''
    const tenantHtml = t ? `
      <div class="tenant-card">
        <div class="t-head"><b>${escape(t.name)}</b> ${personaTag} <span class="t-job">${escape(t.occupation)}</span></div>
        <div class="t-stats">
          <div><label>Vereinbarte Miete</label><b>${formatEuro(t.agreedRent ?? p.baseRent)}/M</b></div>
          <div><label>Kaution</label><b>${formatEuro(t.deposit ?? 0)}</b></div>
          <div><label>Zuverlaessigkeit</label><b>${Math.round(t.reliability)}%</b></div>
          <div><label>Zufriedenheit</label><b class="${t.satisfaction >= 70 ? 'good' : t.satisfaction >= 40 ? 'mid' : 'bad'}">${Math.round(t.satisfaction)}%</b></div>
          <div><label>Vertrag</label><b>${t.monthsRemaining} Monate</b></div>
          <div><label>Rueckstand</label><b class="${t.monthsBehind > 0 ? 'bad' : ''}">${t.monthsBehind} Monate</b></div>
        </div>
        <button class="ghost small" data-evict>Mietverhaeltnis kuendigen (-5 Reputation)</button>
      </div>` : `
      <div class="tenant-card vacant">
        <div><b>Wohnung leer (${p.vacantMonths} Monate)</b></div>
        <div class="micro">Veroeffentliche eine Anzeige und waehle aus den Bewerbern.</div>
        <button class="primary" data-show-applicants>👥 Bewerber ansehen</button>
      </div>`

    const sellPrice = Math.round(p.marketValue * 0.96)
    const loan = this.engine.state.loans.find(l => l.propertyId === p.id)
    const payoff = loan ? Math.round(loan.principal * 1.01) : 0
    const sellNet = sellPrice - payoff

    const loanHtml = loan ? `
      <div class="loan-card">
        <div class="card-title">Hypothek</div>
        <div class="fin-row"><span>Restschuld</span><b>${formatEuro(loan.principal)}</b></div>
        <div class="fin-row"><span>Monatsrate</span><b>${formatEuro(loan.monthlyPayment)}</b></div>
        <div class="fin-row"><span>Restlaufzeit</span><b>${Math.round(loan.monthsRemaining / 12)} Jahre ${loan.monthsRemaining % 12} M</b></div>
        ${loan.paymentsMissed > 0 ? `<div class="fin-row warn"><span>Verpasste Raten</span><b>${loan.paymentsMissed}</b></div>` : ''}
      </div>` : ''

    this.root.querySelector('#ds-actions')!.innerHTML = `
      ${tenantHtml}
      ${loanHtml}
      <div class="reno-box">
        <div class="card-title">Renovierung</div>
        <div class="reno-grid">
          <button class="reno-btn" data-reno="basic">
            <div class="r-head">Grundsanierung</div>
            <div class="r-info">+18 Zustand · +4% Miete</div>
          </button>
          <button class="reno-btn" data-reno="modern">
            <div class="r-head">Modernisierung</div>
            <div class="r-info">+38 Zustand · +12% Miete</div>
          </button>
          <button class="reno-btn" data-reno="luxury">
            <div class="r-head">Luxus-Sanierung</div>
            <div class="r-info">+60 Zustand · +25% Miete</div>
          </button>
        </div>
      </div>
      <div class="sell-box">
        <div class="fin-row"><span>Verkaufspreis (- 4% Gebuehren)</span><b>${formatEuro(sellPrice)}</b></div>
        ${loan ? `<div class="fin-row"><span>Hypothek tilgen (+1% Penalty)</span><b>-${formatEuro(payoff)}</b></div>` : ''}
        <div class="fin-row total"><span>Netto</span><b class="${sellNet >= 0 ? 'good' : 'bad'}">${formatEuro(sellNet)}</b></div>
        <button class="danger" data-sell>Verkaufen</button>
      </div>
    `

    this.root.querySelector('[data-evict]')?.addEventListener('click', () => {
      this.engine.evictTenant(p.id); this.refresh()
    })
    this.root.querySelector('[data-show-applicants]')?.addEventListener('click', () => {
      if (!this.rentalModal) return
      this.root.style.visibility = 'hidden'
      this.rentalModal.open(p, () => { this.root.style.visibility = 'visible'; this.refresh() })
    })
    this.root.querySelectorAll('[data-reno]').forEach(b => {
      b.addEventListener('click', () => {
        const lvl = (b as HTMLElement).dataset.reno as 'basic' | 'modern' | 'luxury'
        const r = this.engine.renovate(p.id, lvl)
        if (!r.ok) this.engine['emit']?.('toast', { kind: 'error', text: r.reason ?? 'Renovierung fehlgeschlagen' })
        this.refresh()
      })
    })
    this.root.querySelector('[data-sell]')?.addEventListener('click', () => {
      const before = this.engine.netWorth()
      const res = this.engine.sell(p.id)
      if (res.ok && typeof res.net === 'number') {
        const profit = res.net - p.basePrice
        this.engine.markFlipIfBig(profit)
      }
      this.close()
      void before
    })
  }
}

const HTML = `
  <div class="ds-modal">
    <div class="ds-head" id="ds-head"></div>
    <button class="ds-close" data-close title="Schliessen">×</button>
    <div class="ds-body">
      <div class="ds-left">
        <div class="ds-stats" id="ds-stats"></div>
        <div class="ds-banks" id="ds-banks"></div>
      </div>
      <div class="ds-right" id="ds-actions"></div>
    </div>
  </div>
`

function escape(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
