import type { Engine } from '../sim/Engine'
import { formatEuro } from '../sim/Engine'
import type { BankNegotiationState, BankOfferTerms, Property, SellerNegotiationState } from '../sim/types'

type SellerCallbacks = {
  onAccepted: (negotiatedPrice: number) => void
  onCancelled: () => void
}

type BankCallbacks = {
  onAccepted: (terms: BankOfferTerms) => void
  onCancelled: () => void
}

export class NegotiationModal {
  private engine: Engine
  private root: HTMLDivElement
  private sellerNeg: SellerNegotiationState | null = null
  private bankNeg: BankNegotiationState | null = null
  private sellerCb: SellerCallbacks | null = null
  private bankCb: BankCallbacks | null = null
  private property: Property | null = null

  constructor(engine: Engine, mountIn: HTMLElement) {
    this.engine = engine
    this.root = document.createElement('div')
    this.root.id = 'neg-modal'
    this.root.style.display = 'none'
    mountIn.appendChild(this.root)
    this.root.addEventListener('click', (e) => { if (e.target === this.root) this.cancel() })
  }

  isOpen(): boolean { return this.sellerNeg !== null || this.bankNeg !== null }

  openSeller(p: Property, cb: SellerCallbacks) {
    this.property = p
    this.sellerCb = cb
    this.bankCb = null; this.bankNeg = null
    this.sellerNeg = this.engine.startSellerNegotiation(p.id)
    if (!this.sellerNeg) { cb.onCancelled(); return }
    this.show()
    this.renderSeller()
  }

  openBank(bankId: string, p: Property, cb: BankCallbacks) {
    this.property = p
    this.bankCb = cb
    this.sellerCb = null; this.sellerNeg = null
    this.bankNeg = this.engine.startBankNegotiation(bankId, p.id)
    if (!this.bankNeg) { cb.onCancelled(); return }
    this.show()
    this.renderBank()
  }

  private show() {
    // Apply final visible state directly — no transition dependency.
    this.root.style.display = 'flex'
    this.root.style.opacity = '1'
    this.root.classList.add('show')
  }

  private cancel() {
    if (this.sellerCb) this.sellerCb.onCancelled()
    if (this.bankCb) this.bankCb.onCancelled()
    this.close()
  }

  private close() {
    this.root.classList.remove('show')
    this.root.style.opacity = ''
    setTimeout(() => {
      this.root.style.display = 'none'
      this.sellerNeg = null
      this.bankNeg = null
      this.sellerCb = null
      this.bankCb = null
      this.property = null
    }, 200)
  }

  // ============ SELLER ============
  private renderSeller() {
    if (!this.sellerNeg || !this.property) return
    const neg = this.sellerNeg
    const p = this.property
    const broker = this.engine.currentBroker()
    const strength = this.engine.negotiationStrength(p)

    // Decide offer slider min/max
    const minOffer = Math.round(p.marketValue * 0.65)
    const maxOffer = neg.askingPrice
    const suggested = Math.round(neg.currentSellerOffer * 0.92)

    const messagesHtml = neg.messages.map(m => `<div class="neg-msg neg-${m.from}">${escape(m.text)}</div>`).join('')

    const finalOffer = neg.currentSellerOffer
    const acceptable = neg.outcome !== 'rejected'

    const seller = p.seller!
    const ownerPersonaName = personaLabel(seller.ownerPersona)
    const ownerAvatar = sellerAvatar(seller.ownerPersona)
    const channelTag = seller.channel === 'agent' ? '🏢 via Verkaufs-Makler' : '🏠 Privatverkauf'

    const agentCard = seller.channel === 'agent' ? `
      <div class="persona-card">
        <div class="persona-avatar" style="background:linear-gradient(135deg,#2c4d56,#16a085)">🤝</div>
        <div class="persona-info">
          <div class="persona-name">${escape(seller.agentName!)}</div>
          <div class="persona-tag persona-${seller.agentPersonality}">Verkaufs-Makler · ${brokerPersonalityLabel(seller.agentPersonality!)}</div>
          <div class="persona-flavor">${escape(seller.agentBlurb!)}</div>
          <div class="persona-reason"><b>Provision:</b> ${(seller.agentCommissionPct! * 100).toFixed(1)}% (zahlt der Verkaeufer)</div>
        </div>
      </div>` : ''

    this.root.innerHTML = `
      <div class="neg-modal">
        <div class="neg-head">
          <div class="neg-title">Verhandlung — ${channelTag}</div>
          <div class="neg-sub">${escape(this.engine.nameFor(p))} · Asking ${formatEuro(neg.askingPrice)} · Marktwert ${formatEuro(p.marketValue)}</div>
          <button class="ds-close" data-cancel>×</button>
        </div>

        <div class="neg-body">
          <div class="neg-left">
            ${agentCard}
            <div class="persona-card">
              <div class="persona-avatar" style="background:${ownerAvatar.color}">${ownerAvatar.emoji}</div>
              <div class="persona-info">
                <div class="persona-name">${escape(seller.ownerName)}<span class="micro" style="margin-left:6px">Eigentuemer</span></div>
                <div class="persona-tag persona-${seller.ownerPersona}">${ownerPersonaName}</div>
                <div class="persona-flavor">${escape(seller.flavor)}</div>
                <div class="persona-reason"><b>Verkaufsgrund:</b> ${escape(seller.reason)}</div>
              </div>
            </div>
            <div class="neg-broker-card">
              <div class="card-title">DEIN MAKLER</div>
              ${broker ? `
                <div class="bk-row">
                  <div>
                    <b>${escape(broker.name)}</b>
                    <div class="micro">${escape(broker.title)} · <span class="persona-tag persona-${broker.personality}">${brokerPersonalityLabel(broker.personality)}</span></div>
                    <div class="micro" style="font-style:italic">${escape(broker.catchphrase)}</div>
                  </div>
                  <div style="text-align:right">
                    <div>Provision <b>${(broker.commissionPct * 100).toFixed(1)}%</b></div>
                    <div class="micro">+${broker.negotiationBonus} Verhandlungs-Bonus</div>
                  </div>
                </div>
              ` : `<div class="micro">Du verhandelst selbst — keine Provision, kein Bonus.</div>`}
              <button class="ghost small" data-change-broker>Makler waehlen / wechseln</button>
            </div>
            <div class="neg-strength">
              <label>Verhandlungs-Staerke</label>
              <div class="strength-bar"><span style="width:${strength}%"></span></div>
              <div class="micro">${strength.toFixed(0)} / 100 — beeinflusst was der Verkaeufer akzeptiert</div>
            </div>
          </div>

          <div class="neg-right">
            <div class="neg-messages">${messagesHtml}</div>

            <div class="neg-state">
              <div class="fin-row"><span>Aktuelles Angebot vom Verkaeufer</span><b>${formatEuro(finalOffer)}</b></div>
              <div class="fin-row"><span>Runde</span><b>${neg.rounds} / ${neg.maxRounds}</b></div>
              <div class="fin-row"><span>Du sparst</span><b class="${neg.askingPrice - finalOffer > 0 ? 'good' : ''}">${formatEuro(neg.askingPrice - finalOffer)}</b></div>
            </div>

            ${neg.done ? `
              <div class="neg-result ${neg.outcome === 'accepted' ? 'ok' : 'fail'}">
                ${neg.outcome === 'accepted' ? `Deal! Du kaufst fuer ${formatEuro(finalOffer)}.` : 'Verhandlung gescheitert.'}
              </div>
              ${neg.outcome === 'accepted' ? `<button class="primary big" data-finalize>Weiter zur Finanzierung →</button>` : ''}
              <button class="ghost" data-cancel>Schliessen</button>
            ` : `
              <div class="neg-offer">
                <label>Dein Gegenangebot</label>
                <input type="range" id="offer-slider" min="${minOffer}" max="${maxOffer}" step="1000" value="${suggested}">
                <div class="offer-display"><b id="offer-value">${formatEuro(suggested)}</b></div>
              </div>
              <div class="neg-actions">
                <button class="primary" data-make-offer>Angebot abgeben</button>
                ${acceptable ? `<button class="ghost" data-accept-current>Aktuelles akzeptieren (${formatEuro(finalOffer)})</button>` : ''}
                <button class="ghost danger-text" data-cancel>Verhandlung abbrechen</button>
              </div>
            `}
          </div>
        </div>
      </div>
    `

    const slider = this.root.querySelector<HTMLInputElement>('#offer-slider')
    const display = this.root.querySelector<HTMLElement>('#offer-value')
    slider?.addEventListener('input', () => { if (display) display.textContent = formatEuro(Number(slider.value)) })

    this.root.querySelector('[data-cancel]')?.addEventListener('click', () => this.cancel())
    this.root.querySelector('[data-change-broker]')?.addEventListener('click', () => this.renderBrokerPicker())
    this.root.querySelector('[data-make-offer]')?.addEventListener('click', () => {
      const offer = Number(slider?.value ?? suggested)
      this.engine.submitSellerOffer(neg, offer)
      this.renderSeller()
    })
    this.root.querySelector('[data-accept-current]')?.addEventListener('click', () => {
      // accept the seller's current offer outright
      if (this.sellerCb) this.sellerCb.onAccepted(finalOffer)
      this.close()
    })
    this.root.querySelector('[data-finalize]')?.addEventListener('click', () => {
      if (this.sellerCb) this.sellerCb.onAccepted(neg.currentSellerOffer)
      this.close()
    })
  }

  private renderBrokerPicker() {
    if (!this.property) return
    const brokers = this.engine.state.brokers
    const current = this.engine.state.player.brokerId
    const rows = brokers.map(b => `
      <div class="broker-row ${current === b.id || (current === null && b.id === 'do_it_yourself') ? 'sel' : ''}" data-broker-id="${b.id}">
        <div class="broker-avatar" style="background:#${b.color.toString(16).padStart(6, '0')}">${brokerAvatar(b.personality)}</div>
        <div class="broker-info">
          <div class="bk-row">
            <b>${escape(b.name)}</b>
            <span class="persona-tag persona-${b.personality}">${brokerPersonalityLabel(b.personality)}</span>
          </div>
          <div class="micro">${escape(b.title)} · Spezialist: ${escape(b.specialty)}</div>
          <div class="micro">${escape(b.blurb)}</div>
          ${b.catchphrase ? `<div class="catchphrase">${escape(b.catchphrase)}</div>` : ''}
        </div>
        <div class="broker-numbers">
          <div>${(b.commissionPct * 100).toFixed(1)}% Provision</div>
          <div class="micro">+${b.negotiationBonus} Bonus</div>
        </div>
      </div>
    `).join('')

    this.root.innerHTML = `
      <div class="neg-modal">
        <div class="neg-head">
          <div class="neg-title">Makler waehlen</div>
          <div class="neg-sub">Wirkt auf alle weiteren Verhandlungen — Synergie mit Verkaeufer-Persoenlichkeit beachten</div>
          <button class="ds-close" data-cancel>×</button>
        </div>
        <div class="neg-body single">
          <div class="broker-list">${rows}</div>
          <button class="primary" data-back>← Zurueck zur Verhandlung</button>
        </div>
      </div>
    `
    this.root.querySelectorAll<HTMLElement>('[data-broker-id]').forEach(el => {
      el.addEventListener('click', () => {
        this.engine.hireBroker(el.dataset.brokerId!)
        this.renderBrokerPicker()
      })
    })
    this.root.querySelector('[data-back]')?.addEventListener('click', () => {
      // restart seller negotiation so the new broker bonus applies
      if (this.property && this.sellerCb) {
        this.sellerNeg = this.engine.startSellerNegotiation(this.property.id)
      }
      this.renderSeller()
    })
    this.root.querySelector('[data-cancel]')?.addEventListener('click', () => this.cancel())
  }

  // ============ BANK ============
  private renderBank() {
    if (!this.bankNeg || !this.property) return
    const neg = this.bankNeg
    const p = this.property
    const bank = this.engine.state.banks.find(b => b.id === neg.bankId)!
    const rel = this.engine.state.player.bankRelations[neg.bankId] ?? 0

    const messagesHtml = neg.messages.map(m => `<div class="neg-msg neg-${m.from}">${escape(m.text)}</div>`).join('')

    // Compare current vs base
    const rateGain = (neg.base.annualRate - neg.current.annualRate)
    const ltvGain = (neg.current.ltv - neg.base.ltv) * 100
    const feeGain = (neg.base.origination - neg.current.origination) * 100

    const bankAvatar = bankAvatarFor(bank.personality, bank.color)

    this.root.innerHTML = `
      <div class="neg-modal">
        <div class="neg-head">
          <div class="neg-title">Verhandlung mit ${escape(bank.name)}</div>
          <div class="neg-sub">Beziehungsstaerke: ${rel.toFixed(0)}/100 · Bonitaet: ${this.engine.state.player.creditScore}</div>
          <button class="ds-close" data-cancel>×</button>
        </div>

        <div class="neg-body">
          <div class="neg-left">
            <div class="persona-card">
              <div class="persona-avatar" style="background:${bankAvatar.color}">${bankAvatar.emoji}</div>
              <div class="persona-info">
                <div class="persona-name">${escape(bank.advisorName)}</div>
                <div class="persona-tag persona-bank-${bank.personality}">${bankPersonalityLabel(bank.personality)}</div>
                <div class="persona-flavor">${escape(bankPersonalityFlavor(bank.personality))}</div>
              </div>
            </div>
            <div class="neg-state">
              <div class="card-title">Aktuelles Angebot</div>
              <div class="fin-row"><span>Zinssatz</span><b>${neg.current.annualRate.toFixed(2)}% ${rateGain > 0 ? `<span class="good micro">(-${rateGain.toFixed(2)}pp)</span>` : ''}</b></div>
              <div class="fin-row"><span>Beleihungsauslauf</span><b>${(neg.current.ltv * 100).toFixed(0)}% ${ltvGain > 0 ? `<span class="good micro">(+${ltvGain.toFixed(0)}pp)</span>` : ''}</b></div>
              <div class="fin-row"><span>Bearbeitungsgebuehr</span><b>${(neg.current.origination * 100).toFixed(2)}% ${feeGain > 0 ? `<span class="good micro">(-${feeGain.toFixed(2)}pp)</span>` : ''}</b></div>
              <div class="fin-row"><span>Runde</span><b>${neg.rounds} / ${neg.maxRounds}</b></div>
            </div>
          </div>

          <div class="neg-right">
            <div class="neg-messages">${messagesHtml}</div>

            ${neg.done && neg.outcome !== 'accepted' ? `
              <div class="neg-result ${neg.outcome === 'rejected' ? 'fail' : ''}">
                ${neg.outcome === 'rejected' ? 'Du hast abgebrochen.' : 'Maximalrunden erreicht. Akzeptieren oder ablehnen.'}
              </div>
            ` : ''}

            ${!neg.done ? `
              <div class="card-title">Was willst du verhandeln?</div>
              <div class="neg-actions">
                <button class="primary" data-push="rate">↓ Zinssatz druecken</button>
                <button class="primary" data-push="ltv">↑ LTV erhoehen</button>
                <button class="primary" data-push="fee">↓ Gebuehr senken</button>
              </div>
            ` : ''}

            <div style="margin-top:14px">
              <button class="primary big" data-accept-bank>Angebot akzeptieren →</button>
              <button class="ghost danger-text" data-cancel>Abbrechen</button>
            </div>
          </div>
        </div>
      </div>
    `

    this.root.querySelector('[data-cancel]')?.addEventListener('click', () => {
      this.engine.rejectBankOffer(neg)
      this.cancel()
    })
    this.root.querySelectorAll<HTMLElement>('[data-push]').forEach(b => {
      b.addEventListener('click', () => {
        const ask = b.dataset.push as 'rate' | 'ltv' | 'fee'
        this.engine.pushBank(neg, ask)
        this.renderBank()
      })
    })
    this.root.querySelector('[data-accept-bank]')?.addEventListener('click', () => {
      this.engine.acceptBankOffer(neg)
      if (this.bankCb) this.bankCb.onAccepted(neg.current)
      this.close()
    })

    void p
  }
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

import type { BankPersonality, BrokerPersonality, SellerPersona } from '../sim/types'

function personaLabel(p: SellerPersona): string {
  return ({
    desperate: 'Verzweifelt', stubborn: 'Stur', greedy: 'Gierig',
    pragmatic: 'Pragmatisch', rushed: 'Eilig', sentimental: 'Sentimental',
  } as Record<SellerPersona, string>)[p]
}

function brokerPersonalityLabel(p: BrokerPersonality): string {
  return ({
    charming: 'Charmant', pushy: 'Druckvoll', analytical: 'Analytisch',
    discreet: 'Diskret', enthusiastic: 'Enthusiastisch',
  } as Record<BrokerPersonality, string>)[p]
}

function bankPersonalityLabel(p: BankPersonality): string {
  return ({
    conservative: 'Konservativ', aggressive: 'Aggressiv', bureaucratic: 'Buerokratisch',
    relationship: 'Beziehungs-orientiert', digital: 'Algorithmisch',
  } as Record<BankPersonality, string>)[p]
}

function bankPersonalityFlavor(p: BankPersonality): string {
  return ({
    conservative: 'Hoeflich, vorsichtig — geht selten von der Linie ab',
    aggressive: 'Pusht hohe LTV, mag mutige Kunden',
    bureaucratic: 'Geht nach Vorschrift, gibt aber bei Gebuehren nach',
    relationship: 'Belohnt langjaehrige Beziehungen massiv',
    digital: 'Reagiert formelhaft — keine Emotionen, keine Spiele',
  } as Record<BankPersonality, string>)[p]
}

function sellerAvatar(p: SellerPersona): { emoji: string; color: string } {
  return ({
    desperate:   { emoji: '😰', color: 'linear-gradient(135deg,#7d3c3c,#e74c3c)' },
    stubborn:    { emoji: '😠', color: 'linear-gradient(135deg,#4d3a2c,#8b6c3a)' },
    greedy:      { emoji: '🤑', color: 'linear-gradient(135deg,#5a4c20,#c2a042)' },
    pragmatic:   { emoji: '🤝', color: 'linear-gradient(135deg,#2c4d56,#3498db)' },
    rushed:      { emoji: '⏰', color: 'linear-gradient(135deg,#5a4030,#e67e22)' },
    sentimental: { emoji: '🥺', color: 'linear-gradient(135deg,#5a3050,#9b59b6)' },
  } as Record<SellerPersona, { emoji: string; color: string }>)[p]
}

function brokerAvatar(p: BrokerPersonality): string {
  return ({
    charming: '😊', pushy: '😤', analytical: '🤓', discreet: '🎩', enthusiastic: '✨',
  } as Record<BrokerPersonality, string>)[p]
}

function bankAvatarFor(p: BankPersonality, _color: number): { emoji: string; color: string } {
  return ({
    conservative: { emoji: '👔', color: 'linear-gradient(135deg,#2c3e50,#7f8c8d)' },
    aggressive:   { emoji: '💼', color: 'linear-gradient(135deg,#c0392b,#e67e22)' },
    bureaucratic: { emoji: '📋', color: 'linear-gradient(135deg,#34495e,#95a5a6)' },
    relationship: { emoji: '🤲', color: 'linear-gradient(135deg,#16a085,#27ae60)' },
    digital:      { emoji: '🤖', color: 'linear-gradient(135deg,#8e44ad,#3498db)' },
  } as Record<BankPersonality, { emoji: string; color: string }>)[p]
}
