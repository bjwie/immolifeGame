import Phaser from 'phaser'
import { CityScene } from './scenes/CityScene'
import './ui/styles.css'

const SAVE_KEY = 'immolife_v2_save'

function buildStartScreen(onStart: (fresh: boolean) => void) {
  const root = document.createElement('div')
  root.id = 'start-screen'
  const hasSave = !!localStorage.getItem(SAVE_KEY)
  root.innerHTML = `
    <h1>IMMOLIFE</h1>
    <div class="tagline">Berliner Immobilien-Tycoon</div>
    <div class="start-buttons">
      ${hasSave ? `<button class="primary" data-act="continue">▶ Weiterspielen</button>` : ''}
      <button class="${hasSave ? '' : 'primary'}" data-act="new">⊕ Neues Spiel</button>
      <button data-act="help">❓ Wie spielt man?</button>
    </div>
    <div class="footer">Steuerung: Klick = Auswahl · Rechtsklick/Shift+Drag = Pan · Mausrad = Zoom · Leertaste = Pause</div>
  `
  document.body.appendChild(root)

  function go(fresh: boolean) {
    console.log('[ImmoLife] starting game (fresh=', fresh, ')')
    if (fresh) localStorage.removeItem(SAVE_KEY)
    root.remove()
    onStart(fresh)
  }

  root.querySelectorAll<HTMLButtonElement>('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const act = btn.dataset.act
      console.log('[ImmoLife] button click', act)
      if (act === 'continue') go(false)
      else if (act === 'new') go(true)
      else if (act === 'help') showHelp()
    })
  })

  function showHelp() {
    const card = root.querySelector('.start-buttons')!
    card.innerHTML = `
      <div style="background:rgba(0,0,0,0.4);border:1px solid #2c3a4d;border-radius:10px;padding:18px;text-align:left;font-size:13px;line-height:1.6;color:#e6ecf3">
        <p>Du bist ein junger Investor in Berlin mit <b>€250.000</b> Startkapital.</p>
        <p>Klick auf Gebaeude um <b>Cap Rate, Cashflow und Hypotheken-Optionen</b> zu sehen.</p>
        <p>Banken bieten unterschiedliche Konditionen — leveraged kaufen ist der Schluessel zum Skalieren.</p>
        <p>Renoviere Bruchbuden, jage Gentrifizierungs-Wellen, halte Mieter zufrieden.</p>
        <p><b>Ziel:</b> Mogul werden. Erste Stufe: 1 Mio Vermoegen.</p>
      </div>
      <button class="primary" data-act="back-from-help">Zurueck</button>
    `
    card.querySelector('[data-act="back-from-help"]')?.addEventListener('click', () => location.reload())
  }
}

function startGame() {
  console.log('[ImmoLife] startGame() called')
  const overlay = document.createElement('div')
  overlay.id = 'overlay-root'
  overlay.style.position = 'absolute'
  overlay.style.inset = '0'
  overlay.style.pointerEvents = 'none'
  document.body.appendChild(overlay)
  ;(window as any).__overlayRoot = overlay

  const w = Math.max(800, window.innerWidth || 1280)
  const h = Math.max(600, window.innerHeight || 720)
  const game = new Phaser.Game({
    type: Phaser.CANVAS,
    width: w,
    height: h,
    parent: 'game-container',
    backgroundColor: '#3a5a3e',
    scene: [CityScene],
    scale: { mode: Phaser.Scale.NONE, width: w, height: h },
    render: { antialias: false, pixelArt: true, roundPixels: true },
    fps: { target: 60, forceSetTimeOut: true },
    autoFocus: false,
  })
  ;(window as any).__game = game
  console.log('[ImmoLife] Phaser game created')

  // Resize handler — Phaser handles canvas resize via Scale.RESIZE
  window.addEventListener('resize', () => game.scale.resize(window.innerWidth, window.innerHeight))
}

// Boot — idempotent (HMR safe)
function boot() {
  if ((window as any).__immolife_booted) return
  ;(window as any).__immolife_booted = true

  const container = document.getElementById('game-container') ?? (() => {
    const d = document.createElement('div'); d.id = 'game-container'; document.body.appendChild(d); return d
  })()
  void container

  // Auto-skip start screen if user pressed "skip" in URL (?skip=1) — useful for tests
  // Otherwise show start menu.
  const skip = new URLSearchParams(location.search).get('skip') === '1' || (window as any).__immolife_autostart === true
  if (skip) {
    startGame()
  } else {
    buildStartScreen((fresh) => {
      if (fresh) localStorage.removeItem(SAVE_KEY)
      startGame()
    })
  }
}
boot()
