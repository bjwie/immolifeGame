import Toastify from 'toastify-js'
import Swal from 'sweetalert2'
import { Chart, registerables, ChartConfiguration } from 'chart.js'
import tippy, { Instance as TippyInstance } from 'tippy.js'
import { Property, Player } from '../types/GameTypes'

// Chart.js registrieren
Chart.register(...registerables)

export class UILibraries {
  private static portfolioChart: Chart | null = null
  private static portfolioHistory: number[] = []
  private static monthLabels: string[] = []
  private static activePopovers: Map<string, TippyInstance> = new Map()

  /**
   * Zeigt moderne Toast-Benachrichtigungen
   */
  static showToast(
    message: string, 
    type: 'success' | 'error' | 'info' | 'warning' = 'info',
    duration: number = 4000
  ) {
    const className = `toastify ${type}`
    
    Toastify({
      text: message,
      duration: duration,
      close: true,
      gravity: "top",
      position: "center",
      className: className,
      stopOnFocus: true,
      onClick: () => {} // Verhindert Auto-Close beim Click
    }).showToast()
  }

  /**
   * Zeigt schöne Property-Dialogs mit SweetAlert2
   */
  static async showPropertyDialog(property: Property, isOwned: boolean = false): Promise<'buy' | 'sell' | 'renovate' | 'tenant' | 'cancel'> {
    const isAffordable = true // TODO: Check if player can afford

    let html = `
      <div style="text-align: left; font-size: 14px; line-height: 1.6;">
        <div style="display: flex; align-items: center; margin-bottom: 15px;">
          <div style="font-size: 24px; margin-right: 10px;">${this.getPropertyIcon(property.type)}</div>
          <div>
            <h4 style="margin: 0; color: #2c3e50;">${property.name}</h4>
            <p style="margin: 0; color: #7f8c8d; font-size: 12px;">${property.location.district}</p>
          </div>
        </div>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div><strong>💰 Preis:</strong> €${property.price.toLocaleString('de-DE')}</div>
            <div><strong>🏠 Miete:</strong> €${property.monthlyRent.toLocaleString('de-DE')}/M</div>
            <div><strong>🔧 Zustand:</strong> ${Math.round(property.condition)}%</div>
            <div><strong>📍 Status:</strong> ${property.isRented ? '👥 Vermietet' : '🔍 Leer'}</div>
          </div>
        </div>
        
        ${!isOwned ? `
          <div style="background: #e8f5e8; padding: 10px; border-radius: 6px; border-left: 4px solid #27ae60;">
            <strong>💵 Monatliches Netto-Einkommen:</strong> €${(property.monthlyRent - property.maintenanceCost).toLocaleString('de-DE')}
          </div>
        ` : `
          <div style="background: #e3f2fd; padding: 10px; border-radius: 6px; border-left: 4px solid #2196f3;">
            <strong>📈 Aktueller Wert:</strong> €${Math.round(property.price).toLocaleString('de-DE')}<br>
            <strong>💼 Wartungskosten:</strong> €${property.maintenanceCost}/Monat
          </div>
        `}
      </div>
    `

    if (!isOwned) {
      // Kauf-Dialog
      const result = await Swal.fire({
        title: '🏠 Immobilie kaufen',
        html: html,
        showCancelButton: true,
        confirmButtonText: isAffordable ? '💰 Kaufen' : '❌ Zu teuer',
        cancelButtonText: 'Abbrechen',
        confirmButtonColor: isAffordable ? '#27ae60' : '#95a5a6',
        cancelButtonColor: '#e74c3c',
        width: 500,
        customClass: {
          popup: 'property-dialog'
        }
      })

      return result.isConfirmed ? 'buy' : 'cancel'
    } else {
      // Eigentümer-Dialog mit mehreren Optionen
      const result = await Swal.fire({
        title: '🏠 Meine Immobilie',
        html: html,
        showCancelButton: true,
        showDenyButton: true,
        showConfirmButton: true,
        confirmButtonText: '🔨 Renovieren',
        denyButtonText: property.isRented ? '👥 Verwalten' : '🔍 Mieter suchen',
        cancelButtonText: '💸 Verkaufen',
        confirmButtonColor: '#9b59b6',
        denyButtonColor: '#f39c12',
        cancelButtonColor: '#e74c3c',
        width: 500,
        customClass: {
          popup: 'property-dialog'
        }
      })

      if (result.isConfirmed) return 'renovate'
      if (result.isDenied) return 'tenant'
      if (result.isDismissed && result.dismiss === Swal.DismissReason.cancel) return 'sell'
      return 'cancel'
    }
  }

  /**
   * Zeigt Renovierungs-Dialog
   */
  static async showRenovationDialog(renovations: any[]): Promise<string | null> {
    const options = renovations.map(renovation => ({
      value: renovation.id,
      text: `
        <div style="text-align: left; padding: 10px; border: 1px solid #ddd; border-radius: 6px; margin: 5px 0;">
          <strong>${renovation.name}</strong> - €${renovation.cost.toLocaleString('de-DE')}<br>
          <small style="color: #666;">+${renovation.conditionImprovement}% Zustand | +${renovation.rentIncrease}% Miete</small><br>
          <small style="color: #888;">${renovation.description}</small>
        </div>
      `
    }))

    const { value } = await Swal.fire({
      title: '🔨 Renovierung wählen',
      html: `
        <div style="max-height: 400px; overflow-y: auto;">
          ${options.map(option => `
            <label style="display: block; cursor: pointer; margin: 5px 0;">
              <input type="radio" name="renovation" value="${option.value}" style="margin-right: 10px;">
              ${option.text}
            </label>
          `).join('')}
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '🔨 Renovieren',
      cancelButtonText: 'Abbrechen',
      confirmButtonColor: '#9b59b6',
      cancelButtonColor: '#6c757d',
      width: 600,
      preConfirm: () => {
        const selected = document.querySelector('input[name="renovation"]:checked') as HTMLInputElement
        return selected ? selected.value : null
      }
    })

    return value || null
  }

  /**
   * Zeigt Bestätigungs-Dialog
   */
  static async showConfirmDialog(
    title: string, 
    message: string, 
    confirmText: string = 'Ja', 
    cancelText: string = 'Nein'
  ): Promise<boolean> {
    const result = await Swal.fire({
      title: title,
      text: message,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33'
    })

    return result.isConfirmed
  }

  /**
   * Portfolio Chart erstellen/aktualisieren
   */
  static updatePortfolioChart(player: Player, gameMonth: number) {
    const container = document.getElementById('portfolio-chart-container') as HTMLElement
    const canvas = document.getElementById('portfolio-chart') as HTMLCanvasElement
    
    if (!container || !canvas) return

    // Portfolio-Wert berechnen
    const portfolioValue = player.properties.reduce((total, property) => total + property.price, 0)
    
    // Historie aktualisieren
    this.portfolioHistory.push(portfolioValue)
    this.monthLabels.push(`Monat ${gameMonth}`)
    
    // Nur die letzten 12 Monate behalten
    if (this.portfolioHistory.length > 12) {
      this.portfolioHistory.shift()
      this.monthLabels.shift()
    }

    // Chart erstellen oder aktualisieren
    if (this.portfolioChart) {
      this.portfolioChart.data.labels = this.monthLabels
      this.portfolioChart.data.datasets[0].data = this.portfolioHistory
      this.portfolioChart.update()
    } else {
      const config: ChartConfiguration = {
        type: 'line',
        data: {
          labels: this.monthLabels,
          datasets: [{
            label: 'Portfolio Wert (€)',
            data: this.portfolioHistory,
            borderColor: '#2ecc71',
            backgroundColor: 'rgba(46, 204, 113, 0.1)',
            tension: 0.4,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: {
                color: 'white',
                font: { size: 11 }
              }
            }
          },
          scales: {
            x: {
              ticks: { color: 'white', font: { size: 10 } },
              grid: { color: 'rgba(255, 255, 255, 0.1)' }
            },
            y: {
              ticks: { 
                color: 'white',
                font: { size: 10 },
                callback: function(value) {
                  return '€' + (value as number).toLocaleString('de-DE')
                }
              },
              grid: { color: 'rgba(255, 255, 255, 0.1)' }
            }
          }
        }
      }

      this.portfolioChart = new Chart(canvas, config)
    }

    // Chart anzeigen
    container.style.display = 'block'
  }

  /**
   * Portfolio Chart verstecken
   */
  static hidePortfolioChart() {
    const container = document.getElementById('portfolio-chart-container') as HTMLElement
    if (container) {
      container.style.display = 'none'
    }
  }

  /**
   * Hilfsmethode für Property Icons
   */
  private static getPropertyIcon(type: string): string {
    const icons: { [key: string]: string } = {
      apartment: '🏠',
      house: '🏡', 
      commercial: '🏢',
      office: '🏬'
    }
    return icons[type] || '🏠'
  }

  /**
   * Zeigt Loading-Dialog
   */
  static showLoading(title: string = 'Laden...') {
    Swal.fire({
      title: title,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading()
      }
    })
  }

  /**
   * Schließt Loading-Dialog
   */
  static hideLoading() {
    Swal.close()
  }

  /**
   * Zeigt Erfolgs-Dialog
   */
  static showSuccess(title: string, message: string) {
    Swal.fire({
      icon: 'success',
      title: title,
      text: message,
      confirmButtonColor: '#27ae60'
    })
  }

  /**
   * Zeigt Fehler-Dialog
   */
  static showError(title: string, message: string) {
    Swal.fire({
      icon: 'error',
      title: title,
      text: message,
      confirmButtonColor: '#e74c3c'
    })
  }

  // ===== POPOVER METHODEN =====

  /**
   * Erstellt ein Property-Popover für Immobilien
   */
  static createPropertyPopover(element: HTMLElement, property: Property, isOwned: boolean = false): TippyInstance {
    const icon = this.getPropertyIcon(property.type)
    const roi = ((property.monthlyRent * 12) / property.price * 100).toFixed(1)
    const netIncome = property.monthlyRent - property.maintenanceCost
    
    // Markt-Info berechnen - korrekte Berechnung der verfügbaren Zeit
    const currentMonth = Date.now() // Vereinfacht - sollte vom GameManager kommen
    const monthsOnMarket = currentMonth - property.marketEntryMonth
    const monthsRemaining = property.marketLifetime - monthsOnMarket
    const marketTimeInfo = monthsRemaining > 0 ? `${monthsRemaining}M` : 'Bald weg'
    
    const content = `
      <div class="property-popover">
        <div class="header">
          <span class="icon">${icon}</span>
          <div>
            <strong style="color: white;">${property.name}</strong><br>
            <small style="opacity: 0.8;">${property.location.district}</small>
          </div>
        </div>
        
        <div class="stats">
          <div class="stat">💰 <strong>€${property.price.toLocaleString('de-DE')}</strong></div>
          <div class="stat">🏠 <strong>€${property.monthlyRent.toLocaleString('de-DE')}/M</strong></div>
          <div class="stat">🔧 <strong>${Math.round(property.condition)}%</strong></div>
          <div class="stat">📊 <strong>${roi}% ROI</strong></div>
          ${!isOwned ? `
            <div class="stat">⏰ <strong>${marketTimeInfo}</strong></div>
            <div class="stat">📈 <strong>€${netIncome.toLocaleString('de-DE')} Netto</strong></div>
          ` : `
            <div class="stat">👥 <strong>${property.isRented ? 'Vermietet' : 'Leer'}</strong></div>
            <div class="stat">🔧 <strong>€${property.maintenanceCost}/M</strong></div>
          `}
        </div>
        
        ${!isOwned ? `
          <div class="highlight">
            💡 ${netIncome > 0 ? 'Profitabel!' : 'Verlust!'} ${Math.abs(netIncome).toLocaleString('de-DE')}€/Monat
          </div>
        ` : `
          <div class="highlight">
            ${property.isRented ? '✅ Stabile Einnahmen' : '⚠️ Kein Einkommen'}
          </div>
        `}
      </div>
    `

    const instance = tippy(element, {
      content: content,
      allowHTML: true,
      theme: 'property',
      placement: 'top',
      arrow: true,
      animation: 'shift-away',
      duration: [200, 150],
      delay: [400, 200],
      hideOnClick: false,
      trigger: 'mouseenter focus',
      interactive: false,
      maxWidth: 300
    })

    return instance
  }

  /**
   * Erstellt ein einfaches Info-Popover
   */
  static createInfoPopover(
    element: HTMLElement, 
    title: string, 
    content: string, 
    theme: 'success' | 'warning' | 'info' | 'game' = 'info'
  ): TippyInstance {
    const html = `
      <div style="text-align: center;">
        <strong style="display: block; margin-bottom: 8px;">${title}</strong>
        <div style="font-size: 12px; opacity: 0.9;">${content}</div>
      </div>
    `

    const instance = tippy(element, {
      content: html,
      allowHTML: true,
      theme: theme,
      placement: 'top',
      arrow: true,
      animation: 'scale',
      duration: 200,
      delay: [300, 100],
      hideOnClick: true,
      trigger: 'mouseenter focus',
      interactive: false
    })

    return instance
  }

  /**
   * Erstellt ein interaktives Popover mit Buttons
   */
  static createInteractivePopover(
    element: HTMLElement,
    title: string,
    content: string,
    buttons: Array<{ text: string, action: () => void, color?: string }>
  ): TippyInstance {
    const buttonHtml = buttons.map((btn, index) => `
      <button 
        id="popover-btn-${index}" 
        style="
          background: ${btn.color || '#3498db'}; 
          color: white; 
          border: none; 
          padding: 6px 12px; 
          margin: 2px; 
          border-radius: 4px; 
          cursor: pointer;
          font-size: 11px;
        "
      >${btn.text}</button>
    `).join('')

    const html = `
      <div style="text-align: center; min-width: 200px;">
        <strong style="display: block; margin-bottom: 10px;">${title}</strong>
        <div style="font-size: 12px; margin-bottom: 10px;">${content}</div>
        <div>${buttonHtml}</div>
      </div>
    `

    const instance = tippy(element, {
      content: html,
      allowHTML: true,
      theme: 'game',
      placement: 'bottom',
      arrow: true,
      animation: 'shift-away',
      duration: 300,
      hideOnClick: false,
      trigger: 'click',
      interactive: true,
      onShown: () => {
        // Event-Listener für Buttons hinzufügen
        buttons.forEach((btn, index) => {
          const buttonEl = document.getElementById(`popover-btn-${index}`)
          if (buttonEl) {
            buttonEl.addEventListener('click', () => {
              btn.action()
              instance.hide()
            })
          }
        })
      }
    })

    return instance
  }

  /**
   * Erstellt ein Tooltip für UI-Elemente
   */
  static createTooltip(
    element: HTMLElement,
    text: string,
    placement: 'top' | 'bottom' | 'left' | 'right' = 'top'
  ): TippyInstance {
    const instance = tippy(element, {
      content: text,
      theme: 'game',
      placement: placement,
      arrow: true,
      animation: 'fade',
      duration: 150,
      delay: [500, 0],
      hideOnClick: true
    })

    return instance
  }

  /**
   * Entfernt ein Popover
   */
  static removePopover(id: string) {
    const instance = this.activePopovers.get(id)
    if (instance) {
      instance.destroy()
      this.activePopovers.delete(id)
    }
  }

  /**
   * Entfernt alle Popovers
   */
  static removeAllPopovers() {
    this.activePopovers.forEach(instance => instance.destroy())
    this.activePopovers.clear()
  }

  /**
   * Speichert ein Popover zur späteren Verwaltung
   */
  static registerPopover(id: string, instance: TippyInstance) {
    this.activePopovers.set(id, instance)
  }
} 