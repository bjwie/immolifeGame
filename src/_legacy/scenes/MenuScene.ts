import Phaser from 'phaser'
import { GameManager } from '../managers/GameManager'

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' })
  }

  preload() {
    // Einfache farbige Rechtecke als Platzhalter für Buttons erstellen
    this.load.image('button', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==')
  }

  create() {
    const { width, height } = this.cameras.main

    // Hintergrund mit Gradient-Effekt
    this.createBackground(width, height)

    // Header-Bereich
    this.createHeader(width, height)

    // Haupt-Menü Bereich
    this.createMainMenu(width, height)

    // Info-Bereich
    this.createInfoSection(width, height)

    // Footer
    this.createFooter(width, height)
  }

  private createBackground(width: number, height: number) {
    // Dunkler Hintergrund
    this.add.rectangle(width / 2, height / 2, width, height, 0x2c3e50)
    
    // Dekorative Elemente
    for (let i = 0; i < 20; i++) {
      const x = Phaser.Math.Between(0, width)
      const y = Phaser.Math.Between(0, height)
      const size = Phaser.Math.Between(2, 8)
      const alpha = Phaser.Math.FloatBetween(0.1, 0.3)
      
      const star = this.add.circle(x, y, size, 0x3498db, alpha)
    }
  }

  private createHeader(width: number, height: number) {
    // Header-Container
    const headerY = height * 0.15

    // Titel mit Schatten-Effekt
    const titleShadow = this.add.text(width / 2 + 3, headerY + 3, 'ImmoLife', {
      fontSize: '48px',
      color: '#000000',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    })
    titleShadow.setOrigin(0.5)
    titleShadow.setAlpha(0.3)

    const title = this.add.text(width / 2, headerY, 'ImmoLife', {
      fontSize: '48px',
      color: '#ecf0f1',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    })
    title.setOrigin(0.5)

    // Untertitel
    const subtitle = this.add.text(width / 2, headerY + 60, 'Immobilien-Simulation', {
      fontSize: '20px',
      color: '#3498db',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'italic'
    })
    subtitle.setOrigin(0.5)

    // Trennlinie
    const line = this.add.rectangle(width / 2, headerY + 90, width * 0.6, 2, 0x3498db)
  }

  private createMainMenu(width: number, height: number) {
    const menuY = height * 0.45
    const buttonWidth = 300
    const buttonHeight = 60
    const buttonSpacing = 80

    // Menü-Container Hintergrund - größer für 4 Buttons
    const menuBg = this.add.rectangle(width / 2, menuY, buttonWidth + 40, buttonSpacing * 4, 0x34495e, 0.8)
    menuBg.setStrokeStyle(2, 0x3498db)

    // Neues Spiel Button
    const newGameButton = this.createMenuButton(
      width / 2, 
      menuY - buttonSpacing * 1.5, 
      buttonWidth, 
      buttonHeight,
      '🆕 Neues Spiel',
      0xe74c3c,
      0xc0392b,
      () => {
        // GameManager neues Spiel starten und dann zur GameScene wechseln
        const gameManager = GameManager.getInstance()
        gameManager.startNewGame()
        this.scene.start('GameScene')
      }
    )

    // Spiel fortsetzen Button (alter "Spiel starten")
    const continueButton = this.createMenuButton(
      width / 2, 
      menuY - buttonSpacing * 0.5, 
      buttonWidth, 
      buttonHeight,
      '▶️ Spiel fortsetzen',
      0x27ae60,
      0x2ecc71,
      () => this.scene.start('GameScene')
    )

    // Laden Button
    const loadButton = this.createMenuButton(
      width / 2, 
      menuY + buttonSpacing * 0.5, 
      buttonWidth, 
      buttonHeight,
      '📁 Spiel laden',
      0x3498db,
      0x5dade2,
      () => this.showLoadDialog()
    )

    // Einstellungen Button
    const settingsButton = this.createMenuButton(
      width / 2, 
      menuY + buttonSpacing * 1.5, 
      buttonWidth, 
      buttonHeight,
      '⚙️ Einstellungen',
      0x9b59b6,
      0xbb7bd6,
      () => this.showSettingsDialog()
    )
  }

  private createInfoSection(width: number, height: number) {
    const infoY = height * 0.75

    // Info-Container Hintergrund
    const infoBg = this.add.rectangle(width / 2, infoY, width * 0.8, 120, 0x2c3e50, 0.6)
    infoBg.setStrokeStyle(1, 0x34495e)

    // Spiel-Beschreibung
    const description = this.add.text(width / 2, infoY - 30, 
      'Kaufe Immobilien, finde Mieter und baue dein Immobilien-Imperium auf!', {
      fontSize: '16px',
      color: '#ecf0f1',
      fontFamily: 'Arial, sans-serif',
      align: 'center'
    })
    description.setOrigin(0.5)

    // Steuerung-Hinweise in zwei Spalten
    const controlsLeft = this.add.text(width / 2 - 150, infoY + 20, 
      '🎮 Steuerung:\n• F5 - Quick Save\n• F9 - Quick Load\n• Strg+S - Speichern/Laden', {
      fontSize: '12px',
      color: '#bdc3c7',
      fontFamily: 'Arial, sans-serif',
      align: 'left'
    })
    controlsLeft.setOrigin(0, 0.5)

    const controlsRight = this.add.text(width / 2 + 150, infoY + 20, 
      '⌨️ Weitere Tasten:\n• Leertaste - Pause\n• ESC - Dialoge schließen\n• Maus - Interaktion', {
      fontSize: '12px',
      color: '#bdc3c7',
      fontFamily: 'Arial, sans-serif',
      align: 'left'
    })
    controlsRight.setOrigin(1, 0.5)
  }

  private createFooter(width: number, height: number) {
    const footerY = height * 0.95

    // Version/Copyright
    const footer = this.add.text(width / 2, footerY, 
      'ImmoLife v1.0 - Ein Immobilien-Simulationsspiel', {
      fontSize: '10px',
      color: '#7f8c8d',
      fontFamily: 'Arial, sans-serif',
      align: 'center'
    })
    footer.setOrigin(0.5)
  }

  private createMenuButton(
    x: number, 
    y: number, 
    width: number, 
    height: number, 
    text: string, 
    color: number, 
    hoverColor: number, 
    callback: () => void
  ) {
    // Button-Container
    const container = this.add.container(x, y)

    // Button-Hintergrund
    const bg = this.add.rectangle(0, 0, width, height, color)
    bg.setStrokeStyle(3, 0xffffff, 0.3)
    bg.setInteractive({ useHandCursor: true })

    // Button-Text
    const buttonText = this.add.text(0, 0, text, {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    })
    buttonText.setOrigin(0.5)

    // Container zusammenbauen
    container.add([bg, buttonText])

    // Hover-Effekte
    bg.on('pointerover', () => {
      bg.setFillStyle(hoverColor)
      bg.setStrokeStyle(3, 0xffffff, 0.8)
      
      // Smooth Scale-Animation
      this.tweens.add({
        targets: container,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 200,
        ease: 'Back.easeOut'
      })
    })

    bg.on('pointerout', () => {
      bg.setFillStyle(color)
      bg.setStrokeStyle(3, 0xffffff, 0.3)
      
      // Zurück zur normalen Größe
      this.tweens.add({
        targets: container,
        scaleX: 1.0,
        scaleY: 1.0,
        duration: 200,
        ease: 'Back.easeOut'
      })
    })

    // Click-Event
    bg.on('pointerdown', () => {
      // Click-Animation
      this.tweens.add({
        targets: container,
        scaleX: 0.95,
        scaleY: 0.95,
        duration: 100,
        yoyo: true,
        ease: 'Power2',
        onComplete: callback
      })
    })

    return container
  }

  private showLoadDialog() {
    const { width, height } = this.cameras.main
    const gameManager = GameManager.getInstance()
    const saveSlots = gameManager.getSaveSlots()

    // Dialog Overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
    overlay.setInteractive()
    overlay.setName('loadDialog')
    overlay.setDepth(1000)

    // Dialog Box
    const dialog = this.add.rectangle(width / 2, height / 2, 600, 400, 0x34495e)
    dialog.setStrokeStyle(3, 0x3498db)
    dialog.setName('loadDialogBox')
    dialog.setDepth(1001)

    // Dialog Title
    const title = this.add.text(width / 2, height / 2 - 160, '📁 Spiel laden', {
      fontSize: '24px',
      color: '#ecf0f1',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    })
    title.setOrigin(0.5)
    title.setName('loadTitle')
    title.setDepth(1002)

    // Save Slots anzeigen (4x2 Grid)
    const maxSlots = 8
    const slotsPerRow = 4
    const slotWidth = 120
    const slotHeight = 80
    const startX = width / 2 - (slotsPerRow * slotWidth) / 2 + slotWidth / 2
    const startY = height / 2 - 60

    for (let i = 0; i < maxSlots; i++) {
      const row = Math.floor(i / slotsPerRow)
      const col = i % slotsPerRow
      const x = startX + col * (slotWidth + 10)
      const y = startY + row * (slotHeight + 10)

      const slot = saveSlots[i]
      const isEmpty = !slot

      // Slot Box
      const slotBox = this.add.rectangle(x, y, slotWidth, slotHeight, isEmpty ? 0x2c3e50 : 0x27ae60)
      slotBox.setStrokeStyle(2, isEmpty ? 0x7f8c8d : 0x2ecc71)
      if (!isEmpty) {
        slotBox.setInteractive({ useHandCursor: true })
      }
      slotBox.setName(`loadSlot_${i}`)
      slotBox.setDepth(1002)

      if (isEmpty) {
        // Leerer Slot
        const emptyText = this.add.text(x, y, `Slot ${i + 1}\nLeer`, {
          fontSize: '12px',
          color: '#7f8c8d',
          fontFamily: 'Arial, sans-serif',
          align: 'center'
        })
        emptyText.setOrigin(0.5)
        emptyText.setName(`emptyLoadText_${i}`)
        emptyText.setDepth(1003)
      } else {
        // Belegter Slot
        const slotText = this.add.text(x, y - 20, `Slot ${i + 1}`, {
          fontSize: '12px',
          color: '#ffffff',
          fontFamily: 'Arial, sans-serif',
          fontStyle: 'bold'
        })
        slotText.setOrigin(0.5)
        slotText.setName(`loadSlotText_${i}`)
        slotText.setDepth(1003)

        const dateText = this.add.text(x, y, slot.formattedDate, {
          fontSize: '9px',
          color: '#ecf0f1',
          fontFamily: 'Arial, sans-serif',
          align: 'center'
        })
        dateText.setOrigin(0.5)
        dateText.setName(`loadDateText_${i}`)
        dateText.setDepth(1003)

        const loadText = this.add.text(x, y + 20, 'Laden', {
          fontSize: '10px',
          color: '#ffffff',
          fontFamily: 'Arial, sans-serif',
          fontStyle: 'bold'
        })
        loadText.setOrigin(0.5)
        loadText.setName(`loadActionText_${i}`)
        loadText.setDepth(1003)

        // Load Event
        slotBox.on('pointerdown', () => {
          if (gameManager.loadGame(slot.name)) {
            this.scene.start('GameScene')
          }
        })

        // Hover effects
        slotBox.on('pointerover', () => {
          slotBox.setFillStyle(0x2ecc71)
        })

        slotBox.on('pointerout', () => {
          slotBox.setFillStyle(0x27ae60)
        })
      }
    }

    // Schließen Button
    const closeButton = this.add.rectangle(width / 2, height / 2 + 140, 120, 40, 0xe74c3c)
    closeButton.setInteractive({ useHandCursor: true })
    closeButton.setStrokeStyle(2, 0xc0392b)
    closeButton.setName('loadCloseButton')
    closeButton.setDepth(1003)

    const closeText = this.add.text(width / 2, height / 2 + 140, 'Schließen', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    })
    closeText.setOrigin(0.5)
    closeText.setName('loadCloseText')
    closeText.setDepth(1004)

    closeButton.on('pointerdown', () => {
      this.closeLoadDialog()
    })

    closeButton.on('pointerover', () => {
      closeButton.setFillStyle(0xc0392b)
    })

    closeButton.on('pointerout', () => {
      closeButton.setFillStyle(0xe74c3c)
    })

    overlay.on('pointerdown', () => {
      this.closeLoadDialog()
    })
  }

  private closeLoadDialog() {
    // Alle Load Dialog Elemente entfernen
    const elementsToRemove = [
      'loadDialog', 'loadDialogBox', 'loadTitle', 'loadCloseButton', 'loadCloseText'
    ]

    // Dynamische Slot-Elemente
    for (let i = 0; i < 8; i++) {
      elementsToRemove.push(
        `loadSlot_${i}`, `emptyLoadText_${i}`, `loadSlotText_${i}`, 
        `loadDateText_${i}`, `loadActionText_${i}`
      )
    }

    elementsToRemove.forEach(name => {
      const element = this.children.getByName(name)
      if (element) element.destroy()
    })
  }

  private showSettingsDialog() {
    const { width, height } = this.cameras.main

    // Dialog Overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
    overlay.setInteractive()
    overlay.setName('settingsDialog')
    overlay.setDepth(1000)

    // Dialog Box
    const dialog = this.add.rectangle(width / 2, height / 2, 500, 300, 0x34495e)
    dialog.setStrokeStyle(3, 0x9b59b6)
    dialog.setName('settingsDialogBox')
    dialog.setDepth(1001)

    // Dialog Title
    const title = this.add.text(width / 2, height / 2 - 120, '⚙️ Einstellungen', {
      fontSize: '24px',
      color: '#ecf0f1',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    })
    title.setOrigin(0.5)
    title.setName('settingsTitle')
    title.setDepth(1002)

    // Einstellungen-Inhalt
    const content = this.add.text(width / 2, height / 2 - 20, 
      'Grafik-Verbesserungen:\n\n• Lade Sprites in den assets/ Ordner\n• Siehe assets/README.md für Anweisungen\n• Empfohlene Quellen: Kenney.nl, LimeZu, CraftPix\n\nDas Spiel funktioniert bereits perfekt\nmit den aktuellen Fallback-Grafiken!', {
      fontSize: '14px',
      color: '#bdc3c7',
      fontFamily: 'Arial, sans-serif',
      align: 'center'
    })
    content.setOrigin(0.5)
    content.setName('settingsContent')
    content.setDepth(1002)

    // Schließen Button
    const closeButton = this.add.rectangle(width / 2, height / 2 + 100, 120, 40, 0xe74c3c)
    closeButton.setInteractive({ useHandCursor: true })
    closeButton.setStrokeStyle(2, 0xc0392b)
    closeButton.setName('settingsCloseButton')
    closeButton.setDepth(1003)

    const closeText = this.add.text(width / 2, height / 2 + 100, 'Schließen', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    })
    closeText.setOrigin(0.5)
    closeText.setName('settingsCloseText')
    closeText.setDepth(1004)

    closeButton.on('pointerdown', () => {
      this.closeSettingsDialog()
    })

    closeButton.on('pointerover', () => {
      closeButton.setFillStyle(0xc0392b)
    })

    closeButton.on('pointerout', () => {
      closeButton.setFillStyle(0xe74c3c)
    })

    overlay.on('pointerdown', () => {
      this.closeSettingsDialog()
    })
  }

  private closeSettingsDialog() {
    const elementsToRemove = [
      'settingsDialog', 'settingsDialogBox', 'settingsTitle', 
      'settingsContent', 'settingsCloseButton', 'settingsCloseText'
    ]

    elementsToRemove.forEach(name => {
      const element = this.children.getByName(name)
      if (element) element.destroy()
    })
  }
} 