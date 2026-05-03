export class DisplayUtils {
  /**
   * Optimiert das Canvas für High-DPI Displays
   */
  static optimizeCanvasForHighDPI(game: Phaser.Game): void {
    const canvas = game.canvas
    if (!canvas) return

    const devicePixelRatio = window.devicePixelRatio || 1
    
    // Nur optimieren wenn nötig
    if (devicePixelRatio === 1) return

    const rect = canvas.getBoundingClientRect()
    const context = canvas.getContext('webgl') || canvas.getContext('2d')
    
    if (context) {
      // Canvas interne Auflösung erhöhen
      canvas.width = rect.width * devicePixelRatio
      canvas.height = rect.height * devicePixelRatio
      
      // CSS Größe beibehalten
      canvas.style.width = rect.width + 'px'
      canvas.style.height = rect.height + 'px'
      
      // WebGL Viewport anpassen
      if (context instanceof WebGLRenderingContext || context instanceof WebGL2RenderingContext) {
        context.viewport(0, 0, canvas.width, canvas.height)
      }
    }
  }

  /**
   * Setzt optimale Canvas-Eigenschaften für scharfe Darstellung
   */
  static setCanvasSharpness(canvas: HTMLCanvasElement): void {
    // CSS Eigenschaften für scharfe Darstellung
    canvas.style.imageRendering = 'auto'
    canvas.style.imageRendering = 'smooth'
    canvas.style.imageRendering = 'high-quality'
    canvas.style.imageRendering = '-webkit-optimize-contrast'
    
    // Weitere Optimierungen
    canvas.style.transform = 'translateZ(0)' // Hardware-Beschleunigung
    canvas.style.backfaceVisibility = 'hidden'
    canvas.style.perspective = '1000px'
  }

  /**
   * Überwacht Fenster-Größenänderungen und passt das Canvas an
   */
  static setupResponsiveCanvas(game: Phaser.Game): void {
    const resizeHandler = () => {
      const canvas = game.canvas
      if (canvas) {
        DisplayUtils.optimizeCanvasForHighDPI(game)
        DisplayUtils.setCanvasSharpness(canvas)
      }
    }

    window.addEventListener('resize', resizeHandler)
    
    // Initial ausführen
    setTimeout(resizeHandler, 100)
  }

  /**
   * Aktiviert alle Display-Optimierungen
   */
  static enableAllOptimizations(game: Phaser.Game): void {
    game.events.once('ready', () => {
      const canvas = game.canvas
      if (canvas) {
        DisplayUtils.setCanvasSharpness(canvas)
        DisplayUtils.optimizeCanvasForHighDPI(game)
        DisplayUtils.setupResponsiveCanvas(game)
      }
    })
  }
} 