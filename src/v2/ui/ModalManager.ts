/**
 * Central modal stack: ESC closes the top modal, backdrop clicks only act on
 * the top modal, only the top modal is visually shown (lower modals keep
 * their state but are hidden so backdrops don't compound).
 *
 * Each modal registers a `ManagedModal` once and calls `push` / `pop` to
 * open and close. The manager owns the `.show` class and `z-index`.
 */
export interface ManagedModal {
  /** stable id, used for debugging */
  id: string
  /** root element of the modal */
  el: HTMLElement
  /**
   * Called when ESC is pressed or the backdrop is clicked while this modal is
   * on top. Should perform whatever cleanup the modal needs (callbacks to
   * parents, state reset) and finally call `pop(this)` — typically by routing
   * through the modal's existing cancel/close method.
   */
  onCancel: () => void
}

const BASE_Z = 7000
const STEP = 100

export class ModalManager {
  private static _instance: ModalManager | null = null
  static get(): ModalManager {
    if (!this._instance) this._instance = new ModalManager()
    return this._instance
  }

  private stack: ManagedModal[] = []
  private wired = new WeakSet<ManagedModal>()

  private constructor() {
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return
      if (this.stack.length === 0) return
      e.stopPropagation()
      e.preventDefault()
      this.cancelTop()
    }, true) // capture so we run before Phaser's keyboard input
  }

  push(modal: ManagedModal) {
    if (!this.wired.has(modal)) {
      modal.el.addEventListener('click', (e) => {
        // backdrop click only — direct hits on the root, not bubbled from children
        if (e.target !== modal.el) return
        if (this.top() !== modal) return
        modal.onCancel()
      })
      this.wired.add(modal)
    }

    // re-promote if already in the stack (defensive)
    const existing = this.stack.indexOf(modal)
    if (existing >= 0) this.stack.splice(existing, 1)

    // hide previous top so backdrops don't compound
    const prev = this.top()
    if (prev) prev.el.classList.remove('show')

    this.stack.push(modal)
    modal.el.style.zIndex = String(BASE_Z + (this.stack.length - 1) * STEP)
    modal.el.classList.add('show')
  }

  pop(modal: ManagedModal) {
    const i = this.stack.indexOf(modal)
    if (i < 0) return
    this.stack.splice(i, 1)
    modal.el.classList.remove('show')
    modal.el.style.zIndex = ''
    const newTop = this.top()
    if (newTop) {
      newTop.el.classList.add('show')
      newTop.el.style.zIndex = String(BASE_Z + (this.stack.length - 1) * STEP)
    }
  }

  /** Cancel the top modal (used by ESC and backdrop). */
  cancelTop() {
    const t = this.top()
    if (!t) return
    t.onCancel()
  }

  top(): ManagedModal | undefined { return this.stack[this.stack.length - 1] }
  isTop(m: ManagedModal): boolean { return this.top() === m }
  has(m: ManagedModal): boolean { return this.stack.indexOf(m) >= 0 }
  size(): number { return this.stack.length }
}
