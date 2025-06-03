import Phaser from 'phaser'

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' })
  }

  preload() {
    // Einfache farbige Rechtecke als Platzhalter für Buttons erstellen
    this.load.image('button', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==')
  }

  create() {
    // Resize Event Listener hinzufügen
    this.scale.on('resize', this.handleResize, this)
    
    this.setupMenu()
  }

  private setupMenu() {
    const { width, height } = this.cameras.main

    // Hintergrund
    this.add.rectangle(width / 2, height / 2, width, height, 0x2c3e50)

    // Titel
    const title = this.add.text(width / 2, height / 4, 'ImmoLife', {
      fontSize: '64px',
      color: '#ecf0f1',
      fontFamily: 'Arial, sans-serif'
    })
    title.setOrigin(0.5)

    // Untertitel
    const subtitle = this.add.text(width / 2, height / 4 + 80, 'Immobilien Simulation', {
      fontSize: '24px',
      color: '#bdc3c7',
      fontFamily: 'Arial, sans-serif'
    })
    subtitle.setOrigin(0.5)

    // Spiel starten Button
    const startButton = this.add.rectangle(width / 2, height / 2, 200, 60, 0x27ae60)
    startButton.setInteractive()
    startButton.setStrokeStyle(2, 0x2ecc71)

    const startText = this.add.text(width / 2, height / 2, 'Spiel starten', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    })
    startText.setOrigin(0.5)

    // Anleitung Button
    const instructionButton = this.add.rectangle(width / 2, height / 2 + 80, 200, 60, 0x3498db)
    instructionButton.setInteractive()
    instructionButton.setStrokeStyle(2, 0x5dade2)

    const instructionText = this.add.text(width / 2, height / 2 + 80, 'Anleitung', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    })
    instructionText.setOrigin(0.5)

    // Spiel-Informationen
    const infoText = this.add.text(width / 2, height / 2 + 50, 
      'Kaufe Immobilien, finde Mieter und baue dein Immobilien-Imperium auf!\n\nSteuerung:\nF5 - Quick Save | F9 - Quick Load | Strg+S - Speichern/Laden\nLeertaste - Pause | ESC - Dialoge schließen', {
      fontSize: '14px',
      color: '#bdc3c7',
      fontFamily: 'Arial, sans-serif',
      align: 'center'
    })
    infoText.setOrigin(0.5)

    // Credits
    const credits = this.add.text(width / 2, height - 50, 'Erstellt mit Phaser.js & TypeScript', {
      fontSize: '14px',
      color: '#7f8c8d',
      fontFamily: 'Arial, sans-serif'
    })
    credits.setOrigin(0.5)

    // Button Hover Effekte
    startButton.on('pointerover', () => {
      startButton.setFillStyle(0x2ecc71)
      this.input.setDefaultCursor('pointer')
    })

    startButton.on('pointerout', () => {
      startButton.setFillStyle(0x27ae60)
      this.input.setDefaultCursor('default')
    })

    instructionButton.on('pointerover', () => {
      instructionButton.setFillStyle(0x5dade2)
      this.input.setDefaultCursor('pointer')
    })

    instructionButton.on('pointerout', () => {
      instructionButton.setFillStyle(0x3498db)
      this.input.setDefaultCursor('default')
    })

    // Button Click Events
    startButton.on('pointerdown', () => {
      this.scene.start('GameScene')
    })

    instructionButton.on('pointerdown', () => {
      this.showInstructions()
    })
  }

  private handleResize(gameSize: any) {
    const { width, height } = gameSize
    
    // Kamera anpassen
    this.cameras.main.setViewport(0, 0, width, height)
    
    // Menü komplett neu aufbauen
    this.children.removeAll(true)
    this.setupMenu()
  }

  private showInstructions() {
    const { width, height } = this.cameras.main

    // Overlay für Anleitung
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
    overlay.setInteractive()

    // Anleitung Box
    const instructionBox = this.add.rectangle(width / 2, height / 2, width * 0.8, height * 0.8, 0x34495e)
    instructionBox.setStrokeStyle(3, 0x3498db)

    // Anleitung Text
    const instructionContent = `
IMMOBILIEN SIMULATION - ANLEITUNG

🎯 ZIEL:
Baue dein Immobilien-Imperium auf und werde reich!

🏠 IMMOBILIEN KAUFEN:
• Klicke auf verfügbare Immobilien auf der Karte
• Verhandle den Preis mit dem Verkäufer
• Kaufe nur, wenn du genug Geld hast

💰 FINANZIERUNG:
• Beantrage Kredite bei verschiedenen Banken
• Achte auf Zinssätze und deine Bonität
• Zahle pünktlich zurück, um deine Kreditwürdigkeit zu erhalten

👥 MIETER FINDEN:
• Suche Mieter für deine Immobilien
• Verhandle Mietpreise
• Achte auf die Zuverlässigkeit der Mieter

📈 STRATEGIE:
• Kaufe in guten Lagen für höhere Mieten
• Halte deine Immobilien in gutem Zustand
• Diversifiziere dein Portfolio

⏰ ZEIT:
• Das Spiel läuft in Monaten
• Jeden Monat erhältst du Mieteinnahmen
• Jeden Monat zahlst du Kreditraten und Wartungskosten

VIEL ERFOLG!
    `

    const instructionTextObj = this.add.text(width / 2, height / 2, instructionContent, {
      fontSize: '16px',
      color: '#ecf0f1',
      fontFamily: 'Arial, sans-serif',
      align: 'left',
      wordWrap: { width: width * 0.7 }
    })
    instructionTextObj.setOrigin(0.5)

    // Schließen Button
    const closeButton = this.add.rectangle(width / 2, height * 0.85, 120, 40, 0xe74c3c)
    closeButton.setInteractive()
    closeButton.setStrokeStyle(2, 0xc0392b)

    const closeText = this.add.text(width / 2, height * 0.85, 'Schließen', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    })
    closeText.setOrigin(0.5)

    // Schließen Event
    const closeInstruction = () => {
      overlay.destroy()
      instructionBox.destroy()
      instructionTextObj.destroy()
      closeButton.destroy()
      closeText.destroy()
    }

    closeButton.on('pointerdown', closeInstruction)
    overlay.on('pointerdown', closeInstruction)

    // Hover Effekt für Schließen Button
    closeButton.on('pointerover', () => {
      closeButton.setFillStyle(0xc0392b)
      this.input.setDefaultCursor('pointer')
    })

    closeButton.on('pointerout', () => {
      closeButton.setFillStyle(0xe74c3c)
      this.input.setDefaultCursor('default')
    })
  }
} 