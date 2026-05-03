import type { Engine } from '../sim/Engine'
import { formatEuro } from '../sim/Engine'
import type { BankOfferTerms, GewerkKind, Property } from '../sim/types'
import type { NegotiationModal } from './NegotiationModal'
import type { RentalModal } from './RentalModal'
import type { RenovationModal } from './RenovationModal'
import type { WEGModal } from './WEGModal'
import { ModalManager, type ManagedModal } from './ModalManager'

const Engine_GEWERK_LABEL: Record<GewerkKind, string> = {
  abbruch: 'Abbruch & Entkernung', rohbau: 'Rohbau', sanitaer: 'Sanitaer',
  elektrik: 'Elektrik', heizung_install: 'Heizung', fenster_install: 'Fenster',
  dach_decken: 'Dach', fassade_putz: 'Fassade', estrich: 'Estrich',
  trockenbau: 'Trockenbau', fliesen: 'Fliesen', maler: 'Maler', boden: 'Boden',
  endmontage: 'Endmontage',
}

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
  /** Per-transaction sell-broker pick (M4). Null = explicitly DIY, undefined = take
   *  the player's saved default (Player.brokerId). */
  private selectedSellBrokerId: string | null | undefined = undefined
  private negotiationModal: NegotiationModal | null = null
  private modal: ManagedModal

  constructor(engine: Engine, mountIn: HTMLElement) {
    this.engine = engine
    this.root = document.createElement('div')
    this.root.id = 'deal-sheet'
    this.root.innerHTML = HTML
    mountIn.appendChild(this.root)
    this.root.querySelector('[data-close]')?.addEventListener('click', () => this.close())
    this.modal = { id: 'dealsheet', el: this.root, onCancel: () => this.close() }
  }

  setNegotiationModal(nm: NegotiationModal) { this.negotiationModal = nm }
  setRentalModal(rm: RentalModal) { this.rentalModal = rm }
  setRenovationModal(rm: RenovationModal) { this.renovationModal = rm }
  setWegModal(wm: WEGModal) { this.wegModal = wm }
  private rentalModal: RentalModal | null = null
  private renovationModal: RenovationModal | null = null
  private wegModal: WEGModal | null = null

  open(p: Property, isOwned: boolean) {
    this.current = p
    this.isOwned = isOwned
    this.selectedBankId = isOwned ? null : this.engine.state.banks[0].id
    this.negotiated = null
    this.bankOverride = null
    this.selectedSellBrokerId = undefined  // fall back to player default
    this.render()
    ModalManager.get().push(this.modal)
  }

  private effectiveSellBrokerId(): string | null {
    if (this.selectedSellBrokerId !== undefined) return this.selectedSellBrokerId
    return this.engine.state.player.brokerId
  }

  close() {
    ModalManager.get().pop(this.modal)
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
      <div class="ds-name">${escape(e.nameFor(p))}${p.buildingForm === 'mfh' ? ` · ${p.units.length} Einheiten MFH` : p.buildingForm === 'wg' ? ' · WG' : ''}</div>
      <div class="ds-sub">${typeName} · ${districtName} · Baujahr ${p.yearBuilt}</div>
    `

    const stats = this.root.querySelector('#ds-stats')!
    stats.innerHTML = `
      <div class="ds-stat"><label>${this.isOwned ? 'Aktueller Marktwert' : 'Angebotspreis'}</label><b>${formatEuro(this.isOwned ? p.marketValue : p.price)}</b></div>
      <div class="ds-stat"><label>Marktwert</label><b>${formatEuro(p.marketValue)}</b></div>
      <div class="ds-stat"><label>Kaltmiete-Potential</label><b>${formatEuro(p.baseRent)}/M</b><div class="micro">+ NK ${formatEuro(p.nebenkosten ?? 0)} = warm ${formatEuro(p.baseRent + (p.nebenkosten ?? 0))}</div></div>
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
    // M4: no buyer broker. Show the listing channel info instead.
    const channelHtml = p.seller && p.seller.channel === 'agent'
      ? `<div class="dealsheet-broker"><b>Inserat ueber Makler:</b> ${escape(p.seller.agentName ?? '')}<div class="micro">Eigentuemer: ${escape(p.seller.ownerName)} · Verkaeuferprovision: ${((p.seller.agentCommissionPct ?? 0) * 100).toFixed(1)}%</div></div>`
      : p.seller
        ? `<div class="dealsheet-broker"><b>Privatverkauf von:</b> ${escape(p.seller.ownerName)}<div class="micro">Direkt mit dem Eigentuemer verhandeln</div></div>`
        : ''

    // Buy-side preview of units inside MFH/WG so the player sees what's in the building
    const buyUnitPreviewHtml = p.units.length > 1 ? `
      <div class="units-card">
        <div class="card-title">${p.buildingForm === 'wg' ? 'ZIMMER' : 'EINHEITEN'} (${p.units.length})</div>
        ${p.units.map(u => `
          <div class="unit-row">
            <div class="unit-row-head">
              <b>${escape(u.label)}</b>
              <span class="micro">${u.sqm}m² · Kalt ${formatEuro(u.baseKalt)} + NK ${formatEuro(u.nebenkosten)}</span>
            </div>
            <div class="unit-tenant-row vacant"><span class="micro">Beim Kauf leer — du musst Mieter finden</span></div>
          </div>
        `).join('')}
        <div class="micro" style="margin-top:6px">Gesamt-Kaltmiete-Potenzial: <b>${formatEuro(p.units.reduce((s, u) => s + u.baseKalt, 0))}/M</b></div>
      </div>
    ` : ''

    const negotiatedSavingsHtml = this.negotiated
      ? `<div class="negotiated-tag">✓ Verhandelt: ${formatEuro(p.price - this.negotiated.price)} gespart (Endpreis ${formatEuro(this.negotiated.price)})</div>`
      : `<button class="negotiate-btn" data-negotiate-seller>💬 Mit ${p.seller?.channel === 'agent' ? 'Makler' : 'Verkaeufer'} verhandeln</button>`

    const bankNegHtml = this.selectedBankId && !this.bankOverride
      ? `<button class="ghost small" data-negotiate-bank>💬 Mit Bank verhandeln</button>`
      : this.bankOverride
        ? `<div class="negotiated-tag">✓ Bank-Konditionen verhandelt</div>`
        : ''

    this.root.querySelector('#ds-actions')!.innerHTML = `
      ${channelHtml}
      ${buyUnitPreviewHtml}
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
  }

  private negotiateSeller() {
    if (!this.current || !this.negotiationModal) return
    this.negotiationModal.openSeller(this.current, {
      onAccepted: (price) => { this.negotiated = { price }; this.render() },
      onCancelled: () => { /* manager restores us */ },
    })
  }

  private negotiateBank() {
    if (!this.current || !this.negotiationModal || !this.selectedBankId) return
    this.negotiationModal.openBank(this.selectedBankId, this.current, {
      onAccepted: (terms) => { this.bankOverride = terms; this.render() },
      onCancelled: () => { /* manager restores us */ },
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
    const principal = Math.round(propPriceForCalc * effectiveLtv)
    const fees = Math.round(principal * origination)
    const downPayment = propPriceForCalc - principal + fees
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
      <div class="fin-row"><span>Monatsrate (${baseRatePct.toFixed(2)}%)</span><b>${formatEuro(monthlyPayment)}</b></div>
      <div class="fin-row"><span>Netto/Monat</span><b class="${netClass}">${formatEuro(netMonthly)}</b></div>
      <div class="fin-row"><span>Cash-on-Cash</span><b class="${cocClass}">${cashOnCash.toFixed(1)}%</b></div>
    `
  }

  private tryBuy() {
    if (!this.current) return
    const bankId = this.selectedBankId ?? undefined
    const ltv = bankId && this.ltvSlider ? Number(this.ltvSlider.value) / 100 : undefined

    let res: { ok: boolean; reason?: string }
    if (this.negotiated) {
      // Mutate the listing price to the negotiated value, then buy at that price.
      const p = this.engine.state.listings.find(pp => pp.id === this.current!.id)
      if (!p) { res = { ok: false, reason: 'Inserat verschwunden' } }
      else {
        const oldPrice = p.price
        p.price = this.negotiated.price
        res = this.engine.buy(p.id, bankId, ltv, { bankTermsOverride: this.bankOverride ?? undefined })
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
    const isMulti = p.units.length > 1
    const t = p.tenant
    const personaLabels: Record<string, string> = { tidy: 'Ordentlich', partyer: 'Partyfreudig', quiet: 'Ruhig', demanding: 'Anspruchsvoll', family: 'Familie', student: 'Student:in', nomad: 'Mietnomade' }
    // Display the disguise persona while it's still in effect (cover not yet blown).
    const displayedPersona = t?.disguisePersonality ?? t?.personality
    const personaTag = displayedPersona ? `<span class="persona-tag persona-${displayedPersona}">${personaLabels[displayedPersona] ?? displayedPersona}</span>` : ''
    // Eviction logic: which button to show
    const activeEviction = this.engine.state.lawsuits.find(l => l.propertyId === p.id && l.reason === 'eviction' && l.outcome === 'pending')
    const canCooperativeQuit = t && t.personality !== 'nomad' && t.monthsBehind < 2
    const evictionEst = t && !activeEviction ? this.engine.evictionEstimate(p.id) : null
    const nomadRevealed = t && t.personality === 'nomad' && !t.disguisePersonality
    const formLabel = p.buildingForm === 'mfh' ? 'Mehrfamilienhaus' : p.buildingForm === 'wg' ? 'Wohngemeinschaft' : ''
    const unitsHtml = isMulti ? `
      <div class="units-card">
        <div class="card-title">${formLabel} · ${p.units.length} Einheiten</div>
        ${p.units.map(u => {
          const ut = u.tenant
          const upersona = ut?.disguisePersonality ?? ut?.personality
          const utag = upersona ? `<span class="persona-tag persona-${upersona}">${personaLabels[upersona] ?? upersona}</span>` : ''
          const uNomadAlert = ut && ut.personality === 'nomad' && !ut.disguisePersonality
          const uActiveEv = this.engine.state.lawsuits.find(l => l.propertyId === p.id && l.reason === 'eviction' && l.tenantId === ut?.id && l.outcome === 'pending')
          return `
            <div class="unit-row ${uNomadAlert ? 'nomad-alert' : ''}">
              <div class="unit-row-head">
                <b>${escape(u.label)}</b>
                <span class="micro">${u.sqm}m² · Kalt ${formatEuro(u.baseKalt)} + NK ${formatEuro(u.nebenkosten)}</span>
              </div>
              ${ut ? `
                <div class="unit-tenant-row">
                  <span><b>${escape(ut.name)}</b> ${utag}${uNomadAlert ? ' <span class="bad" style="font-weight:800">⚠ NOMADE</span>' : ''}</span>
                  <span class="micro">${Math.round(ut.satisfaction)}% Zufr · ${ut.monthsBehind} M Rueckstand · ${ut.monthsRemaining} M Vertrag</span>
                </div>
                ${uActiveEv ? `<div class="micro bad">⚖ Klage laeuft: noch ${uActiveEv.monthsRemaining} M, ${formatEuro(uActiveEv.totalSpent)} bisher</div>` : ''}
                <div class="unit-actions">
                  <button class="ghost small" data-unit-rent-hike="${u.id}">📈 Miete</button>
                  ${ut.personality !== 'nomad' && ut.monthsBehind < 2 ? `<button class="ghost small" data-unit-evict="${u.id}">Kuendigen</button>` : ''}
                  ${!uActiveEv && (ut.personality === 'nomad' || ut.monthsBehind >= 2) ? `<button class="danger small" data-unit-start-eviction="${u.id}">🧑‍⚖️ Raeumung</button>` : ''}
                </div>
              ` : `
                <div class="unit-tenant-row vacant"><span class="micro">Leer (${u.vacantMonths} M)</span>
                  <button class="primary small" data-unit-show-applicants="${u.id}">👥 Bewerber</button>
                </div>
              `}
            </div>
          `
        }).join('')}
      </div>
    ` : ''

    const tenantHtml = !isMulti && t ? `
      <div class="tenant-card ${nomadRevealed ? 'nomad-alert' : ''}">
        <div class="t-head"><b>${escape(t.name)}</b> ${personaTag} ${nomadRevealed ? '<span class="bad" style="font-weight:800">⚠ MIETNOMADE</span>' : ''} <span class="t-job">${escape(t.occupation)}</span></div>
        <div class="t-stats">
          <div><label>Kaltmiete</label><b>${formatEuro(t.agreedKaltMiete ?? p.baseRent)}/M</b></div>
          <div><label>Nebenkosten</label><b>${formatEuro(t.agreedNebenkosten ?? p.nebenkosten ?? 0)}/M</b></div>
          <div><label>Kaution</label><b>${formatEuro(t.deposit ?? 0)}</b></div>
          <div><label>Zuverlaessigkeit</label><b>${Math.round(t.reliability)}%</b></div>
          <div><label>Zufriedenheit</label><b class="${t.satisfaction >= 70 ? 'good' : t.satisfaction >= 40 ? 'mid' : 'bad'}">${Math.round(t.satisfaction)}%</b></div>
          <div><label>Vertrag</label><b>${t.monthsRemaining} Monate</b></div>
          <div><label>Rueckstand</label><b class="${t.monthsBehind > 0 ? 'bad' : ''}">${t.monthsBehind} Monate</b></div>
        </div>
        ${activeEviction ? `
          <div class="eviction-status">
            <b>⚖ Raeumungsklage laeuft</b>
            <div class="micro">Noch ${activeEviction.monthsRemaining} M · Anwaltskosten ${formatEuro(activeEviction.monthlyCost)}/M · bisher ${formatEuro(activeEviction.totalSpent)} · Erfolgschance ${Math.round(activeEviction.successChance * 100)}%</div>
          </div>
        ` : ''}
        <div class="rent-hike-row">
          <button class="ghost small" data-rent-hike>📈 Miete erhoehen (Mietspiegel ${DISTRICT_LABEL[p.district]}/${TYPE_LABEL[p.type]}: ${formatEuro(p.mietspiegelKalt ?? p.baseRent)})</button>
          ${canCooperativeQuit ? `<button class="ghost small" data-evict>Mietverhaeltnis kuendigen (-5 Reputation)</button>` : ''}
          ${!activeEviction && evictionEst && (t.personality === 'nomad' || t.monthsBehind >= 2) ? `
            <button class="danger small" data-start-eviction>🧑‍⚖️ Raeumungsklage einleiten (~${evictionEst.months} M, ${formatEuro(evictionEst.totalCost)}, ${Math.round(evictionEst.successChance * 100)}% Erfolg)</button>
          ` : ''}
        </div>
      </div>` : (!isMulti ? `
      <div class="tenant-card vacant">
        <div><b>Wohnung leer (${p.vacantMonths} Monate)</b></div>
        <div class="micro">Veroeffentliche eine Anzeige und waehle aus den Bewerbern.</div>
        <button class="primary" data-show-applicants>👥 Bewerber ansehen</button>
      </div>` : '')

    const sellPrice = Math.round(p.marketValue * 0.96)
    const loan = this.engine.state.loans.find(l => l.propertyId === p.id)
    const payoff = loan ? Math.round(loan.principal * 1.01) : 0
    const effectiveBrokerId = this.effectiveSellBrokerId()
    const sellBroker = effectiveBrokerId ? this.engine.state.brokers.find(b => b.id === effectiveBrokerId) : null
    const sellCommission = sellBroker && sellBroker.id !== 'do_it_yourself' ? Math.round(sellPrice * sellBroker.commissionPct) : 0
    const sellNet = sellPrice - payoff - sellCommission

    const brokerPickerHtml = `
      <div class="sell-broker-picker">
        <div class="card-title">VERKAUFS-MAKLER</div>
        ${this.engine.state.brokers.map(b => {
          const isDIY = b.id === 'do_it_yourself'
          const isSel = (effectiveBrokerId === null && isDIY) || effectiveBrokerId === b.id
          const comm = isDIY ? 0 : Math.round(sellPrice * b.commissionPct)
          const net = sellPrice - payoff - comm
          return `<div class="sell-broker-row ${isSel ? 'sel' : ''}" data-sell-broker="${b.id}">
            <div>
              <b>${escape(b.name)}</b> <span class="micro">· ${escape(b.title)}</span>
              <div class="micro">${escape(b.blurb)}</div>
            </div>
            <div class="sell-broker-num">
              <div>${(b.commissionPct * 100).toFixed(1)}%</div>
              <div class="micro">Netto ${formatEuro(net)}</div>
            </div>
          </div>`
        }).join('')}
      </div>
    `

    const loanHtml = loan ? `
      <div class="loan-card">
        <div class="card-title">Hypothek</div>
        <div class="fin-row"><span>Restschuld</span><b>${formatEuro(loan.principal)}</b></div>
        <div class="fin-row"><span>Monatsrate</span><b>${formatEuro(loan.monthlyPayment)}</b></div>
        <div class="fin-row"><span>Restlaufzeit</span><b>${Math.round(loan.monthsRemaining / 12)} Jahre ${loan.monthsRemaining % 12} M</b></div>
        ${loan.paymentsMissed > 0 ? `<div class="fin-row warn"><span>Verpasste Raten</span><b>${loan.paymentsMissed}</b></div>` : ''}
      </div>` : ''

    const cap = p.pendingCapex
    const capexHtml = cap ? `
      <div class="capex-card">
        <div class="capex-head">⚠ ${escape(cap.title)}</div>
        <div class="capex-body">${escape(cap.body)}</div>
        <div class="fin-row"><span>Reparaturkosten</span><b>${formatEuro(cap.cost)}</b></div>
        <div class="fin-row"><span>Frist</span><b>${cap.deadlineMonth - this.engine.gameMonth()} Monate</b></div>
        <div class="fin-row"><span>Bei Verfall</span><b class="bad">-${cap.conditionImpactIfIgnored} Zustand, Mieter -20 Zufriedenheit</b></div>
        <div class="fin-row"><span>Bei Reparatur</span><b class="good">+${cap.conditionGainIfPaid} Zustand</b></div>
        <button class="primary" data-plan-capex>🛠 Handwerker beauftragen</button>
      </div>` : ''

    const reno = p.activeRenovation
    const renoHtml = reno ? `
      <div class="reno-active-card">
        <div class="card-title">RENOVIERUNG LAEUFT</div>
        ${reno.steps.map((s, i) => `
          <div class="reno-step ${s.status}">
            <span>${i + 1}. ${Engine_GEWERK_LABEL[s.gewerk] ?? s.gewerk}</span>
            <span class="reno-step-meta">${escape(s.contractorName)} · ${s.status === 'done' ? '✓' : s.status === 'active' ? `${Math.max(0, Math.round(s.daysRemaining))} Tage` : 'wartet'}${s.isSchwarz ? ' · 🚫' : ''}${s.material === 'premium' ? ' · ⭐' : ''}</span>
          </div>
        `).join('')}
        <div class="fin-row"><span>Bisher gezahlt</span><b>${formatEuro(reno.totalPaidSoFar)} / ${formatEuro(reno.totalAgreedCost)}</b></div>
        <div class="fin-row"><span>Mietminderung</span><b class="bad">-${Math.round(reno.rentReductionPct * 100)}%</b></div>
        <button class="ghost small" data-cancel-reno>Renovierung abbrechen (50% Rest zurueck)</button>
      </div>
    ` : ''

    const renoBoxHtml = !reno ? `
      <div class="reno-box">
        <div class="card-title">Renovierung beauftragen</div>
        <div class="reno-grid">
          <button class="reno-btn" data-plan-scope="basic">
            <div class="r-head">Grundsanierung</div>
            <div class="r-info">Maler + Boden · ~1 Monat</div>
          </button>
          <button class="reno-btn" data-plan-scope="modern">
            <div class="r-head">Modernisierung</div>
            <div class="r-info">9 Gewerke · ~3-4 Monate</div>
          </button>
          <button class="reno-btn" data-plan-scope="luxury">
            <div class="r-head">Luxus-Sanierung</div>
            <div class="r-info">12 Gewerke · ~5-6 Monate</div>
          </button>
        </div>
      </div>
    ` : ''

    // WG-Umbau button — single property only, must be empty + condition >= 60
    const canConvertWg = p.buildingForm === 'single' && p.condition >= 60 && !p.units.some(u => u.tenant) && !reno
    const wgConvertCost = canConvertWg ? Math.round(30000 * (p.units[0]?.sqm ?? 60) / 60) : 0
    const wgHtml = canConvertWg ? `
      <div class="reno-box">
        <div class="card-title">UMBAU ZU WG</div>
        <div class="micro">Splittet die Wohnung in 3-5 Zimmer, +30% Mietpotenzial. Erfordert leere Wohnung & Zustand >=60.</div>
        <button class="primary" data-convert-wg>🛠 Zur WG umbauen (${formatEuro(wgConvertCost)})</button>
      </div>
    ` : ''

    // WEG assembly button if there's a pending one
    const wegPending = this.engine.state.wegAssemblies.find(a => a.propertyId === p.id && !a.decided)
    const wegHtml = wegPending ? `
      <div class="weg-card">
        <div class="card-title">📋 EIGENTUEMERVERSAMMLUNG OFFEN</div>
        <div class="micro">${wegPending.proposals.length} Tagesordnungspunkte · Stimmenanteil ${(wegPending.playerShare * 100).toFixed(0)}%</div>
        <button class="primary" data-open-weg="${wegPending.id}">Versammlung oeffnen</button>
      </div>
    ` : ''

    const umlageHtml = p.modernizationUmlageAvailable && p.tenant ? `
      <div class="umlage-card">
        <div class="card-title">§559 BGB MODERNISIERUNGSUMLAGE</div>
        <div class="micro">Nach Modernisierung darfst du legal +11% Kaltmiete verlangen, ohne Klagerisiko.</div>
        <button class="primary small" data-apply-umlage>+11% Miete legal anwenden</button>
      </div>
    ` : ''

    const mgmtFee = this.engine.managementFeeFor(p)
    const mgmtHtml = p.management ? `
      <div class="mgmt-card active">
        <div class="card-title">🏢 HAUSVERWALTUNG AKTIV</div>
        <div class="micro">Auto-Capex · Auto-Bewerbersuche · Auto-Raeumungsklage. Beauftragt seit ${p.management.hiredMonth} Mon.</div>
        <div class="fin-row"><span>Monatliche Gebuehr</span><b>${formatEuro(mgmtFee)}/M</b></div>
        <button class="ghost small" data-cancel-mgmt>Verwaltung kuendigen</button>
      </div>
    ` : `
      <div class="mgmt-card">
        <div class="card-title">HAUSVERWALTUNG</div>
        <div class="micro">Eine professionelle Verwaltung uebernimmt: Capex automatisch zahlen, vakante Wohnungen nachvermieten, bei Mietnomaden Raeumungsklage einleiten.</div>
        <div class="fin-row"><span>Gebuehr (5% Kaltmiete, min 80€)</span><b>${formatEuro(mgmtFee)}/M</b></div>
        <button class="primary small" data-hire-mgmt>Hausverwaltung beauftragen</button>
      </div>
    `

    this.root.querySelector('#ds-actions')!.innerHTML = `
      ${wegHtml}
      ${capexHtml}
      ${renoHtml}
      ${unitsHtml}
      ${tenantHtml}
      ${loanHtml}
      ${renoBoxHtml}
      ${wgHtml}
      ${umlageHtml}
      ${mgmtHtml}
      <div class="sell-box">
        <div class="fin-row"><span>Verkaufspreis (- 4% Gebuehren)</span><b>${formatEuro(sellPrice)}</b></div>
        ${loan ? `<div class="fin-row"><span>Hypothek tilgen (+1% Penalty)</span><b>-${formatEuro(payoff)}</b></div>` : ''}
        ${sellCommission > 0 ? `<div class="fin-row"><span>Makler-Provision ${sellBroker ? '(' + escape(sellBroker.name) + ')' : ''}</span><b>-${formatEuro(sellCommission)}</b></div>` : ''}
        <div class="fin-row total"><span>Netto</span><b class="${sellNet >= 0 ? 'good' : 'bad'}">${formatEuro(sellNet)}</b></div>
        ${brokerPickerHtml}
        <button class="danger" data-sell>Verkaufen ${sellBroker && sellBroker.id !== 'do_it_yourself' ? 'mit ' + escape(sellBroker.name) : 'in Eigenregie'}</button>
      </div>
    `

    this.root.querySelector('[data-evict]')?.addEventListener('click', () => {
      this.engine.evictTenant(p.id); this.refresh()
    })
    this.root.querySelector('[data-start-eviction]')?.addEventListener('click', () => {
      const r = this.engine.startEviction(p.id)
      if (!r.ok) (this.engine as any).emit?.('toast', { kind: 'error', text: r.reason ?? 'Klage nicht moeglich' })
      this.refresh()
    })
    this.root.querySelector('[data-show-applicants]')?.addEventListener('click', () => {
      if (!this.rentalModal) return
      this.rentalModal.open(p, () => { this.refresh() })
    })
    this.root.querySelectorAll('[data-plan-scope]').forEach(b => {
      b.addEventListener('click', () => {
        const scope = (b as HTMLElement).dataset.planScope as 'basic' | 'modern' | 'luxury'
        if (this.renovationModal) this.renovationModal.open(p, scope, () => this.refresh())
      })
    })
    this.root.querySelector('[data-plan-capex]')?.addEventListener('click', () => {
      if (this.renovationModal) this.renovationModal.open(p, 'capex', () => this.refresh())
    })
    this.root.querySelector('[data-cancel-reno]')?.addEventListener('click', () => {
      const r = this.engine.cancelRenovation(p.id)
      if (!r.ok) (this.engine as any).emit?.('toast', { kind: 'error', text: r.reason ?? 'Abbruch fehlgeschlagen' })
      this.refresh()
    })
    this.root.querySelector('[data-apply-umlage]')?.addEventListener('click', () => {
      const r = this.engine.applyModernisierungUmlage(p.id)
      if (!r.ok) (this.engine as any).emit?.('toast', { kind: 'error', text: r.reason ?? 'Umlage fehlgeschlagen' })
      this.refresh()
    })
    this.root.querySelector('[data-hire-mgmt]')?.addEventListener('click', () => {
      const r = this.engine.hireManagement(p.id)
      if (!r.ok) (this.engine as any).emit?.('toast', { kind: 'error', text: r.reason ?? 'Beauftragung fehlgeschlagen' })
      this.refresh()
    })
    this.root.querySelector('[data-cancel-mgmt]')?.addEventListener('click', () => {
      this.engine.cancelManagement(p.id)
      this.refresh()
    })
    this.root.querySelector('[data-convert-wg]')?.addEventListener('click', () => {
      const r = this.engine.convertToWG(p.id)
      if (!r.ok) (this.engine as any).emit?.('toast', { kind: 'error', text: r.reason ?? 'Umbau fehlgeschlagen' })
      this.refresh()
    })
    this.root.querySelector('[data-open-weg]')?.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.openWeg!
      if (this.wegModal) this.wegModal.open(id)
    })
    // Per-unit actions for MFH/WG
    this.root.querySelectorAll<HTMLElement>('[data-unit-evict]').forEach(b => {
      b.addEventListener('click', () => {
        this.engine.evictTenant(p.id, b.dataset.unitEvict!)
        this.refresh()
      })
    })
    this.root.querySelectorAll<HTMLElement>('[data-unit-start-eviction]').forEach(b => {
      b.addEventListener('click', () => {
        const r = this.engine.startEviction(p.id, b.dataset.unitStartEviction!)
        if (!r.ok) (this.engine as any).emit?.('toast', { kind: 'error', text: r.reason ?? 'Klage nicht moeglich' })
        this.refresh()
      })
    })
    this.root.querySelectorAll<HTMLElement>('[data-unit-rent-hike]').forEach(b => {
      b.addEventListener('click', () => {
        this.openRentHike(p, b.dataset.unitRentHike!)
      })
    })
    this.root.querySelectorAll<HTMLElement>('[data-unit-show-applicants]').forEach(b => {
      b.addEventListener('click', () => {
        if (this.rentalModal) this.rentalModal.open(p, () => this.refresh(), b.dataset.unitShowApplicants)
      })
    })
    this.root.querySelectorAll<HTMLElement>('[data-sell-broker]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.sellBroker!
        // 'do_it_yourself' resolves to null in the engine; we keep the literal id here so
        // the picker shows it as the selected option.
        this.selectedSellBrokerId = id
        // Persist as default for next time (player's own preference).
        this.engine.state.player.brokerId = id === 'do_it_yourself' ? null : id
        this.refresh()
      })
    })
    this.root.querySelector('[data-sell]')?.addEventListener('click', () => {
      const brokerArg = this.effectiveSellBrokerId()
      const before = this.engine.netWorth()
      const res = this.engine.sell(p.id, brokerArg)
      if (res.ok && typeof res.net === 'number') {
        const profit = res.net - p.basePrice
        this.engine.markFlipIfBig(profit)
      }
      this.close()
      void before
    })
    this.root.querySelector('[data-rent-hike]')?.addEventListener('click', () => this.openRentHike(p))
  }

  private openRentHike(p: Property, unitId?: string) {
    const u = unitId ? p.units.find(x => x.id === unitId) : p.units.find(x => x.tenant)
    const t = u?.tenant
    if (!t) return
    const minNew = t.agreedKaltMiete + 10
    const maxNew = Math.round(p.mietspiegelKalt * 1.5)
    let value = Math.round((t.agreedKaltMiete + p.mietspiegelKalt * 1.10) / 2)
    if (value < minNew) value = minNew
    if (value > maxNew) value = maxNew

    const overlay = document.createElement('div')
    overlay.className = 'rent-hike-overlay'
    overlay.innerHTML = `
      <div class="rent-hike-card">
        <div class="card-title">MIETE ERHOEHEN</div>
        <div class="micro" style="margin-bottom:8px">${escape(t.name)} zahlt aktuell <b>${formatEuro(t.agreedKaltMiete)}</b> kalt. Mietspiegel: <b>${formatEuro(p.mietspiegelKalt)}</b>.</div>
        <input type="range" id="hike-slider" min="${minNew}" max="${maxNew}" step="10" value="${value}">
        <div class="hike-summary">
          <b id="hike-value">${formatEuro(value)}</b>
          <span class="micro" id="hike-vs-spiegel"></span>
          <div id="hike-risk"></div>
        </div>
        <div class="rent-hike-buttons">
          <button class="primary" data-confirm-hike>Erhoehen</button>
          <button class="ghost" data-cancel-hike>Abbrechen</button>
        </div>
      </div>
    `
    this.root.appendChild(overlay)
    const slider = overlay.querySelector<HTMLInputElement>('#hike-slider')!
    const valueEl = overlay.querySelector<HTMLElement>('#hike-value')!
    const vsEl = overlay.querySelector<HTMLElement>('#hike-vs-spiegel')!
    const riskEl = overlay.querySelector<HTMLElement>('#hike-risk')!

    const updateRisk = () => {
      const v = Number(slider.value)
      const r = this.engine.rentHikeRisk(p.id, v)
      valueEl.textContent = formatEuro(v)
      vsEl.textContent = ` (${(r.ratio * 100 - 100).toFixed(0)}% ueber Mietspiegel)`
      const pct = Math.round(r.lawsuitChance * 100)
      const cls = r.lawsuitChance < 0.10 ? 'good' : r.lawsuitChance < 0.30 ? 'mid' : 'bad'
      riskEl.innerHTML = `<span class="${cls}">Klagerisiko: ${pct}%</span>`
    }
    slider.addEventListener('input', updateRisk)
    updateRisk()

    overlay.querySelector('[data-confirm-hike]')!.addEventListener('click', () => {
      this.engine.raiseRent(p.id, Number(slider.value), unitId)
      overlay.remove()
      this.refresh()
    })
    overlay.querySelector('[data-cancel-hike]')!.addEventListener('click', () => overlay.remove())
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
