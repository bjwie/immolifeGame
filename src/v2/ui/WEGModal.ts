import type { Engine } from '../sim/Engine'
import { formatEuro } from '../sim/Engine'
import type { WEGAssembly } from '../sim/types'
import { ModalManager, type ManagedModal } from './ModalManager'

export class WEGModal {
  private engine: Engine
  private root: HTMLDivElement
  private assembly: WEGAssembly | null = null
  private modal: ManagedModal

  constructor(engine: Engine, mountIn: HTMLElement) {
    this.engine = engine
    this.root = document.createElement('div')
    this.root.id = 'weg-modal'
    mountIn.appendChild(this.root)
    this.modal = { id: 'weg', el: this.root, onCancel: () => this.close() }
  }

  open(assemblyId: string) {
    const a = this.engine.state.wegAssemblies.find(x => x.id === assemblyId)
    if (!a) return
    this.assembly = a
    this.render()
    ModalManager.get().push(this.modal)
  }

  close() {
    ModalManager.get().pop(this.modal)
    this.assembly = null
  }

  private render() {
    if (!this.assembly) return
    const a = this.assembly
    const p = this.engine.state.owned.find(pp => pp.id === a.propertyId)
    if (!p) return

    const decided = a.decided
    const proposalsHtml = a.proposals.map(prop => {
      const playerCost = Math.round(prop.totalCost * a.playerShare)
      const myVote = a.playerVotes[prop.id] ?? null
      const outcome = a.outcomes[prop.id]
      const outcomeBadge = decided && outcome
        ? (outcome === 'passed' ? '<span class="weg-out passed">✓ Beschlossen</span>' : '<span class="weg-out rejected">✗ Abgelehnt</span>')
        : ''
      const votingDisabled = decided ? 'disabled' : ''
      return `
        <div class="weg-proposal">
          <div class="weg-prop-head">
            <b>${escape(prop.title)}</b>
            ${outcomeBadge}
          </div>
          <div class="weg-prop-body">${escape(prop.body)}</div>
          ${prop.totalCost > 0 ? `
            <div class="fin-row"><span>Gesamtkosten WEG</span><b>${formatEuro(prop.totalCost)}</b></div>
            <div class="fin-row"><span>Dein Anteil bei "ja"</span><b class="bad">${formatEuro(playerCost)}</b></div>
          ` : `<div class="micro">Keine Sonderumlage</div>`}
          <div class="weg-consequences">
            <div class="micro">✓ ${escape(prop.consequenceIfYes)}</div>
            <div class="micro">✗ ${escape(prop.consequenceIfNo)}</div>
          </div>
          <div class="weg-vote-row">
            <button class="weg-vote ${myVote === 'yes' ? 'sel' : ''}" data-vote="yes" data-prop="${prop.id}" ${votingDisabled}>Ja</button>
            <button class="weg-vote ${myVote === 'no' ? 'sel' : ''}" data-vote="no" data-prop="${prop.id}" ${votingDisabled}>Nein</button>
            <button class="weg-vote ${myVote === 'abstain' ? 'sel' : ''}" data-vote="abstain" data-prop="${prop.id}" ${votingDisabled}>Enthaltung</button>
          </div>
        </div>
      `
    }).join('')

    this.root.innerHTML = `
      <div class="weg-modal">
        <div class="rental-head">
          <div class="neg-title">Eigentuemerversammlung — ${escape(this.engine.nameFor(p))}</div>
          <div class="neg-sub">Dein Stimmenanteil: ${(a.playerShare * 100).toFixed(0)}% · ${a.proposals.length} Tagesordnungspunkte</div>
          <button class="ds-close" data-close>×</button>
        </div>
        <div class="weg-body">
          ${proposalsHtml}
          <div class="weg-actions">
            ${decided
              ? '<button class="primary" data-close>Schliessen</button>'
              : '<button class="primary big" data-finalize>Abstimmung beenden</button>'}
          </div>
        </div>
      </div>
    `

    this.root.querySelectorAll<HTMLElement>('[data-vote]').forEach(b => {
      b.addEventListener('click', () => {
        const propId = b.dataset.prop!
        const v = b.dataset.vote as 'yes' | 'no' | 'abstain'
        this.engine.castWegVote(a.id, propId, v)
        this.render()
      })
    })
    this.root.querySelector('[data-finalize]')?.addEventListener('click', () => {
      this.engine.finalizeWegAssembly(a.id)
      this.render()
    })
    this.root.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => this.close()))
  }
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
