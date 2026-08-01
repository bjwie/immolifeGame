import Phaser from 'phaser'
import { CityScene } from './scenes/CityScene'
import type { Difficulty } from './sim/types'
import './ui/styles.css'

const SAVE_KEY = 'immolife_v2_save'
const DIFFICULTY_KEY = 'immolife_v2_difficulty'

type StartChoice = { fresh: boolean; difficulty: Difficulty }

function buildStartScreen(onStart: (choice: StartChoice) => void) {
  const root = document.createElement('div')
  root.id = 'start-screen'
  const hasSave = !!localStorage.getItem(SAVE_KEY)
  let selectedDifficulty: Difficulty = (localStorage.getItem(DIFFICULTY_KEY) as Difficulty) || 'standard'
  root.innerHTML = `
    <h1>IMMOLIFE</h1>
    <div class="tagline">Berliner Immobilien-Tycoon</div>
    <div class="difficulty-row">
      <div class="diff-title">Schwierigkeit (nur fuer "Neues Spiel")</div>
      <div class="diff-options">
        <label class="diff-opt ${selectedDifficulty === 'easy' ? 'sel' : ''}" data-diff="easy">
          <input type="radio" name="diff" value="easy" ${selectedDifficulty === 'easy' ? 'checked' : ''}>
          <div class="diff-name">Anfaenger</div>
          <div class="diff-desc">€400.000 · halbe Capex-Risiken · 6M Honeymoon · sanfte Mieter</div>
        </label>
        <label class="diff-opt ${selectedDifficulty === 'standard' ? 'sel' : ''}" data-diff="standard">
          <input type="radio" name="diff" value="standard" ${selectedDifficulty === 'standard' ? 'checked' : ''}>
          <div class="diff-name">Standard</div>
          <div class="diff-desc">€320.000 · 70% Capex-Risiko · 3M Honeymoon · ausgewogen</div>
        </label>
        <label class="diff-opt ${selectedDifficulty === 'hardcore' ? 'sel' : ''}" data-diff="hardcore">
          <input type="radio" name="diff" value="hardcore" ${selectedDifficulty === 'hardcore' ? 'checked' : ''}>
          <div class="diff-name">Hardcore</div>
          <div class="diff-desc">€250.000 · volle Risiken · keine Schonzeit · gnadenlos</div>
        </label>
      </div>
    </div>
    <div class="start-buttons">
      ${hasSave ? `<button class="primary" data-act="continue">▶ Weiterspielen</button>` : ''}
      <button class="${hasSave ? '' : 'primary'}" data-act="new">⊕ Neues Spiel</button>
      <button data-act="help">❓ Wie spielt man?</button>
    </div>
    <div class="footer">Steuerung: Klick = Auswahl · Rechtsklick/Shift+Drag = Pan · Mausrad = Zoom · Leertaste = Pause</div>
  `
  document.body.appendChild(root)

  function go(fresh: boolean) {
    console.log('[ImmoLife] starting game (fresh=', fresh, 'difficulty=', selectedDifficulty, ')')
    if (fresh) {
      localStorage.removeItem(SAVE_KEY)
      localStorage.setItem(DIFFICULTY_KEY, selectedDifficulty)
    }
    root.remove()
    onStart({ fresh, difficulty: selectedDifficulty })
  }

  // Difficulty radio handling — clicking the label updates selection + UI.
  root.querySelectorAll<HTMLElement>('.diff-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      const v = opt.dataset.diff as Difficulty
      selectedDifficulty = v
      root.querySelectorAll('.diff-opt').forEach(o => o.classList.toggle('sel', (o as HTMLElement).dataset.diff === v))
      const radio = opt.querySelector<HTMLInputElement>('input')
      if (radio) radio.checked = true
    })
  })

  root.querySelectorAll<HTMLButtonElement>('.start-buttons button').forEach(btn => {
    btn.addEventListener('click', () => {
      const act = btn.dataset.act
      if (act === 'continue') go(false)
      else if (act === 'new') go(true)
      else if (act === 'help') showHelp()
    })
  })

  function showHelp() {
    const card = root.querySelector('.start-buttons')!
    card.innerHTML = `
      <div style="background:rgba(0,0,0,0.4);border:1px solid #2c3a4d;border-radius:10px;padding:18px;text-align:left;font-size:13px;line-height:1.6;color:#e6ecf3">
        <p>Du bist ein junger Investor in Berlin. Startkapital je nach Schwierigkeit (€250k - €400k).</p>
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

function startGame(choice?: StartChoice) {
  console.log('[ImmoLife] startGame() called', choice)
  // Stash the chosen difficulty on a window field so CityScene picks it up.
  // (We don't pass scene data here because Phaser's scene constructor isn't
  // aware of our typed flow.)
  if (choice && choice.fresh) {
    ;(window as any).__immolife_difficulty = choice.difficulty
  } else {
    delete (window as any).__immolife_difficulty
  }
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
    buildStartScreen((choice) => startGame(choice))
  }
}
boot()
