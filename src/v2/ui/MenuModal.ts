import type { Engine } from '../sim/Engine'
import { ModalManager, type ManagedModal } from './ModalManager'

const MAIN_MENU_HTML = `
  <div class="menu-card">
    <div class="menu-title">Menue</div>
    <button data-act="resume">▶ Weiterspielen</button>
    <button data-act="save">💾 Spiel manuell sichern</button>
    <button data-act="achievements">★ Erfolge ansehen</button>
    <button data-act="help">❓ Hilfe / Tutorial</button>
    <button data-act="new" class="danger-text">⟲ Neues Spiel (Fortschritt loeschen)</button>
  </div>
`

export class MenuModal {
  private engine: Engine
  private root: HTMLDivElement
  private onNew: () => void
  private view: 'main' | 'achievements' | 'help' = 'main'
  private modal: ManagedModal

  constructor(engine: Engine, mountIn: HTMLElement, onNew: () => void) {
    this.engine = engine
    this.onNew = onNew
    this.root = document.createElement('div')
    this.root.id = 'menu-modal'
    this.renderMain()
    mountIn.appendChild(this.root)
    this.root.addEventListener('click', (e) => this.handleClick(e))
    this.modal = { id: 'menu', el: this.root, onCancel: () => this.close() }
  }

  private handleClick(e: Event) {
    const target = e.target as HTMLElement
    if (target === this.root) return // backdrop handled by ModalManager
    const act = target.dataset?.act
    if (!act) return

    if (act === 'resume') {
      // If on subview, go back to main; otherwise close
      if (this.view !== 'main') { this.renderMain(); return }
      this.close()
    } else if (act === 'save') {
      this.engine.autoSave()
      ;(this.engine as any).emit?.('toast', { kind: 'success', text: 'Gespeichert' })
      this.close()
    } else if (act === 'new') {
      const ok = confirmReset()
      if (ok) {
        this.engine.resetToFresh()
        this.onNew()
        this.close()
      }
    } else if (act === 'achievements') {
      this.renderAchievements()
    } else if (act === 'help') {
      this.renderHelp()
    }
  }

  open() {
    // Always reset to main menu when opening fresh
    this.renderMain()
    ModalManager.get().push(this.modal)
  }

  close() {
    ModalManager.get().pop(this.modal)
    // Reset to main view for next open
    this.view = 'main'
  }

  private renderMain() {
    this.view = 'main'
    this.root.innerHTML = MAIN_MENU_HTML
  }

  private renderAchievements() {
    this.view = 'achievements'
    const all = (this.engine as any).achievementDefs?.() ?? []
    const unlocked = new Set(this.engine.state.player.achievements)
    this.root.innerHTML = `
      <div class="menu-card">
        <div class="menu-title">Erfolge</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:10px">${unlocked.size} / ${all.length} freigeschaltet</div>
        ${all.map((a: any) => `
          <div style="background:var(--bg-2);border:1px solid var(--line);border-radius:8px;padding:10px;margin-bottom:6px;${unlocked.has(a.id) ? '' : 'opacity:0.45'}">
            <div style="font-weight:700">${unlocked.has(a.id) ? '★ ' : '☆ '}${escapeHtml(a.title)}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">${escapeHtml(a.desc)}</div>
          </div>`).join('')}
        <button data-act="resume" style="margin-top:10px">← Zurueck zum Menue</button>
      </div>
    `
  }

  private renderHelp() {
    this.view = 'help'
    this.root.innerHTML = `
      <div class="menu-card">
        <div class="menu-title">Wie spielt man?</div>
        <div style="font-size:13px;line-height:1.6;color:var(--text)">
          <p><b>Ziel:</b> Baue ein Immobilienportfolio auf. Vermoegen ist alles.</p>
          <p><b>Klick auf eine Immobilie</b> um Details zu sehen. Goldene Krone = bereits dein.</p>
          <p><b>Hypotheken:</b> Mit Eigenkapital allein wirst du nicht gross. Nutze Banken — pro Bank andere LTV / Zinsen / Score-Anforderungen.</p>
          <p><b>Cap Rate ≥ 5%</b> ist gut. <b>Cash-on-Cash ≥ 8%</b> ist top.</p>
          <p><b>Renoviere</b> alte Immobilien — der Wertsprung kann gross sein.</p>
          <p><b>Mieter</b> ziehen automatisch ein wenn Zustand und Reputation hoch sind. Schlechter Zustand → Mieter ziehen aus.</p>
          <p><b>Steuerung:</b> Klick = Auswahl · Rechtsklick/Shift+Drag = Pan · Mausrad = Zoom · Leertaste = Pause · ESC = Menue</p>
          <p><b>Distrikte:</b> Mitte/Charlottenburg sind teuer mit hoher Miete. Wedding/Neukoelln guenstig — perfekt fuer Gentrifizierungs-Trades.</p>
        </div>
        <button data-act="resume" style="margin-top:14px">← Zurueck zum Menue</button>
      </div>
    `
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function confirmReset(): boolean {
  // window.confirm is blocked in some embedded contexts; fall back gracefully
  try { return window.confirm('Wirklich neu starten? Alle Fortschritte gehen verloren.') }
  catch { return true }
}
