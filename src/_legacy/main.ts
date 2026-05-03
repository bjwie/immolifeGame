import Phaser from 'phaser'
import { GameScene } from './scenes/GameScene'
import { MenuScene } from './scenes/MenuScene'
import { GameManager } from './managers/GameManager'

// Game Konfiguration
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'game-container',
  backgroundColor: '#2c3e50',
  scene: [MenuScene, GameScene],
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  render: {
    antialias: true,
    pixelArt: true,
    roundPixels: true
  }
}

// Game Manager initialisieren
const gameManager = GameManager.getInstance()

// Spiel starten
const game = new Phaser.Game(config)

// Einfache Resize-Behandlung ohne komplexe Display-Optimierungen
window.addEventListener('resize', () => {
  const newWidth = window.innerWidth
  const newHeight = window.innerHeight
  game.scale.resize(newWidth, newHeight)
})

// UI Updates
function updateUI() {
  const moneyElement = document.getElementById('money')
  const propertiesElement = document.getElementById('properties')
  const incomeElement = document.getElementById('income')
  
  if (moneyElement) {
    moneyElement.textContent = `€${gameManager.getPlayer().money.toLocaleString('de-DE')}`
  }
  
  if (propertiesElement) {
    propertiesElement.textContent = gameManager.getPlayer().properties.length.toString()
  }
  
  if (incomeElement) {
    const monthlyIncome = gameManager.getPlayer().properties.reduce((sum, prop) => sum + prop.monthlyRent, 0)
    incomeElement.textContent = `€${monthlyIncome.toLocaleString('de-DE')}`
  }
}

// UI alle 100ms aktualisieren
setInterval(updateUI, 100)

// Globale Referenz für andere Module
;(window as any).gameManager = gameManager
;(window as any).updateUI = updateUI

export { game, gameManager } 