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
  private static popoverTimestamps: Map<string, number> = new Map()
  private static cleanupInterval: NodeJS.Timeout | null = null

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
  static createPropertyPopover(
    element: HTMLElement, 
    property: Property, 
    isOwned: boolean = false,
    cashFlow?: { monthlyRent: number, maintenance: number, loanPayments: number, netCashFlow: number }
  ): TippyInstance {
    const icon = this.getPropertyIcon(property.type)
    const roi = ((property.monthlyRent * 12) / property.price * 100).toFixed(1)
    
    // Cash Flow verwenden (falls übergeben) oder berechnen
    const monthlyRent = cashFlow?.monthlyRent || (property.isRented ? property.monthlyRent : 0)
    const maintenance = cashFlow?.maintenance || property.maintenanceCost
    const loanPayment = cashFlow?.loanPayments || 0
    const netCashFlow = cashFlow?.netCashFlow || (monthlyRent - maintenance - loanPayment)
    
    // Wertsteigerung berechnen
    const valueChange = property.price - property.originalPrice
    const valueChangePercent = ((valueChange / property.originalPrice) * 100).toFixed(1)
    
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
        
        ${isOwned ? `
          <div class="stats">
            <div class="stat">🏠 <strong>€${monthlyRent.toLocaleString('de-DE')}/M Miete</strong></div>
            <div class="stat">👥 <strong>${property.isRented ? 'Vermietet' : 'Leer'}</strong></div>
            <div class="stat">🔧 <strong>€${maintenance}/M Wartung</strong></div>
            <div class="stat">💳 <strong>€${loanPayment}/M Kredit</strong></div>
            <div class="stat">🔧 <strong>${Math.round(property.condition)}% Zustand</strong></div>
            <div class="stat">📊 <strong>${roi}% ROI</strong></div>
          </div>
          
          <div class="highlight" style="background: ${netCashFlow >= 0 ? 'rgba(46, 204, 113, 0.2)' : 'rgba(231, 76, 60, 0.2)'};">
            ${netCashFlow >= 0 ? '📈' : '📉'} <strong>€${Math.round(netCashFlow)}/M Netto Cash Flow</strong>
          </div>
          
          ${Math.abs(valueChange) > 100 ? `
            <div class="highlight" style="background: ${valueChange >= 0 ? 'rgba(241, 196, 15, 0.2)' : 'rgba(155, 89, 182, 0.2)'};">
              ${valueChange >= 0 ? '🏆' : '📊'} <strong>${valueChange > 0 ? '+' : ''}€${Math.round(valueChange).toLocaleString('de-DE')} (${valueChangePercent}%)</strong><br>
              <small>Wertsteigerung seit Kauf</small>
            </div>
          ` : ''}
          
        ` : `
          <div class="stats">
            <div class="stat">💰 <strong>€${property.price.toLocaleString('de-DE')}</strong></div>
            <div class="stat">🏠 <strong>€${property.monthlyRent.toLocaleString('de-DE')}/M</strong></div>
            <div class="stat">🔧 <strong>${Math.round(property.condition)}%</strong></div>
            <div class="stat">📊 <strong>${roi}% ROI</strong></div>
            <div class="stat">⏰ <strong>${marketTimeInfo}</strong></div>
            <div class="stat">📈 <strong>€${netCashFlow.toLocaleString('de-DE')} Netto</strong></div>
          </div>
          
          <div class="highlight">
            💡 ${netCashFlow > 0 ? 'Profitabel!' : 'Verlust!'} ${Math.abs(netCashFlow).toLocaleString('de-DE')}€/Monat
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
      hideOnClick: true,
      trigger: 'mouseenter focus',
      interactive: false,
      maxWidth: 320,
      onShow: () => {
        // Auto-hide after 10 seconds for safety
        setTimeout(() => {
          if (instance && !instance.state.isDestroyed) {
            instance.hide()
          }
        }, 10000)
      }
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
        
        // Auto-hide after 15 seconds for interactive popovers
        setTimeout(() => {
          if (instance && !instance.state.isDestroyed) {
            instance.hide()
          }
        }, 15000)
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
      try {
        // Check if instance is still valid before destroying
        if (!instance.state.isDestroyed) {
          instance.hide()
          instance.destroy()
        }
      } catch (error) {
        console.warn(`Error destroying popover ${id}:`, error)
      } finally {
        this.activePopovers.delete(id)
        this.popoverTimestamps.delete(id)
      }
    }
  }

  /**
   * Entfernt alle Popovers
   */
  static removeAllPopovers() {
    this.activePopovers.forEach((instance, id) => {
      try {
        if (!instance.state.isDestroyed) {
          instance.hide()
          instance.destroy()
        }
      } catch (error) {
        console.warn(`Error destroying popover ${id}:`, error)
      }
    })
    this.activePopovers.clear()
    this.popoverTimestamps.clear()
  }

  /**
   * Speichert ein Popover zur späteren Verwaltung
   */
  static registerPopover(id: string, instance: TippyInstance) {
    // Remove existing popover with same ID first
    this.removePopover(id)
    this.activePopovers.set(id, instance)
    this.popoverTimestamps.set(id, Date.now())
  }

  /**
   * Auto-cleanup for popovers that have been open too long
   */
  static cleanupStalePopovers() {
    this.activePopovers.forEach((instance, id) => {
      try {
        // If popover has been shown for more than 30 seconds, clean it up
        const timestamp = this.popoverTimestamps.get(id)
        if (instance.state.isShown && timestamp && Date.now() - timestamp > 30000) {
          console.warn(`Cleaning up stale popover: ${id}`)
          this.removePopover(id)
        }
      } catch (error) {
        console.warn(`Error checking popover ${id}:`, error)
        this.removePopover(id)
      }
    })
  }

  /**
   * Start periodic cleanup of stale popovers
   */
  static startPopoverCleanup() {
    if (this.cleanupInterval === null) {
      this.cleanupInterval = setInterval(() => {
        this.cleanupStalePopovers()
      }, 5000) // Check every 5 seconds
    }
  }

  /**
   * Stop periodic cleanup
   */
  static stopPopoverCleanup() {
    if (this.cleanupInterval !== null) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }
  
    // ===== MEGA BANK SYSTEM UI =====
  
    /**
     * Zeigt das Haupt-Bank-Dashboard
     */
    static async showBankDashboard(
      banks: any[], 
      creditProfile: any, 
      economicFactors: any, 
      activeLoans: any[],
      loanApplications: any[]
    ): Promise<string> {
      const bankCards = banks.map(bank => {
        const relationshipBadge = this.getRelationshipBadge(bank.relationship)
        const specialtiesText = bank.specialties.map((s: string) => this.getLoanTypeText(s)).join(', ')
        
        return `
          <div class="bank-card" style="
            border: 2px solid #ddd; 
            border-radius: 12px; 
            padding: 15px; 
            margin: 10px 0; 
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
          " onclick="selectBank('${bank.id}')">
            <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 10px;">
              <h4 style="margin: 0; color: #2c3e50; font-size: 16px;">${this.getBankIcon(bank.type)} ${bank.name}</h4>
              ${relationshipBadge}
            </div>
            <p style="margin: 5px 0; font-size: 12px; color: #6c757d;">${bank.description}</p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0;">
              <div><strong>Min. Credit Score:</strong> ${bank.minCreditScore}</div>
              <div><strong>Approval Speed:</strong> ${bank.approvalSpeed} Tage</div>
              <div><strong>Spezialisiert auf:</strong> ${specialtiesText}</div>
              <div><strong>Kredite vergeben:</strong> ${bank.totalLoansGiven}</div>
            </div>
            <div style="margin-top: 10px;">
              ${bank.digitalService ? '💻 Digital' : ''} 
              ${bank.personalAdvisor ? '👤 Berater' : ''} 
              ${bank.offersCreditInsurance ? '🛡️ Versicherung' : ''}
            </div>
          </div>
        `
      }).join('')
  
      const economicDashboard = `
        <div style="background: #f1f3f4; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <h4 style="margin: 0 0 10px 0; color: #2c3e50;">📊 Wirtschaftslage</h4>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 12px;">
            <div><strong>EZB-Zins:</strong> ${economicFactors.ecbRate.toFixed(2)}%</div>
            <div><strong>Inflation:</strong> ${economicFactors.inflation.toFixed(1)}%</div>
            <div><strong>Arbeitslosigkeit:</strong> ${economicFactors.unemployment.toFixed(1)}%</div>
            <div><strong>BIP-Wachstum:</strong> ${economicFactors.gdpGrowth.toFixed(1)}%</div>
            <div><strong>Immobilienmarkt:</strong> ${Math.round(economicFactors.propertyMarketHealth)}/100</div>
            <div><strong>Markttrend:</strong> ${this.getMarketHealthText(economicFactors.propertyMarketHealth)}</div>
          </div>
        </div>
      `
  
      const creditScoreWidget = `
        <div style="background: ${this.getCreditScoreColor(creditProfile.score)}; padding: 15px; border-radius: 8px; margin: 15px 0; color: white;">
          <h4 style="margin: 0 0 10px 0;">🏆 Credit Score</h4>
          <div style="font-size: 28px; font-weight: bold; text-align: center;">${creditProfile.score}</div>
          <div style="text-align: center; font-size: 12px; opacity: 0.9;">${this.getCreditScoreText(creditProfile.score)}</div>
          <div style="margin-top: 10px; font-size: 11px;">
            <div>Zahlungshistorie: ${creditProfile.paymentHistory.toFixed(0)}/35</div>
            <div>Kreditnutzung: ${creditProfile.creditUtilization.toFixed(0)}/30</div>
            <div>Aktive Kredite: ${creditProfile.numberOfActiveLoans}</div>
          </div>
        </div>
      `
  
      const loansOverview = activeLoans.length > 0 ? `
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <h4 style="margin: 0 0 10px 0; color: #856404;">💳 Aktive Kredite (${activeLoans.length})</h4>
          ${activeLoans.slice(0, 3).map(loan => `
            <div style="font-size: 11px; margin: 5px 0; padding: 5px; background: rgba(255,255,255,0.5); border-radius: 4px;">
              <strong>${this.getLoanTypeText(loan.type)}</strong> - €${Math.round(loan.amount).toLocaleString('de-DE')} 
              (${loan.remainingMonths}M verbleibend, ${loan.currentInterestRate}%)
            </div>
          `).join('')}
          ${activeLoans.length > 3 ? `<div style="font-size: 10px; opacity: 0.7;">...und ${activeLoans.length - 3} weitere</div>` : ''}
        </div>
      ` : ''
  
      const result = await Swal.fire({
        title: '🏦 Banking Center',
        html: `
          <div style="text-align: left; max-height: 600px; overflow-y: auto;">
            ${creditScoreWidget}
            ${economicDashboard}
            ${loansOverview}
            <h4 style="color: #2c3e50; margin: 20px 0 10px 0;">🏦 Verfügbare Banken</h4>
            ${bankCards}
          </div>
          
          <script>
            function selectBank(bankId) {
              window.selectedBankId = bankId;
              Swal.close();
            }
          </script>
        `,
        showCancelButton: true,
        showConfirmButton: true,
        confirmButtonText: '💰 Kredit beantragen',
        cancelButtonText: '📊 Details anzeigen',
        width: 700,
        customClass: {
          popup: 'bank-dashboard'
        }
      })
  
      if (result.isConfirmed) {
        return 'apply_loan'
      } else if (result.isDismissed && result.dismiss === Swal.DismissReason.cancel) {
        return 'show_details'
      }
      return 'cancel'
    }
  
    /**
     * Zeigt Kredit-Antrags-Dialog
     */
    static async showLoanApplicationDialog(banks: any[], properties: any[]): Promise<{
      bankId: string,
      loanType: string,
      amount: number,
      propertyId?: string
    } | null> {
      const bankOptions = banks.map(bank => 
        `<option value="${bank.id}">${bank.name} (Min Score: ${bank.minCreditScore})</option>`
      ).join('')
  
      const propertyOptions = properties.length > 0 ? 
        '<option value="">Ohne Sicherheit</option>' + 
        properties.map(prop => 
          `<option value="${prop.id}">${prop.name} - €${Math.round(prop.price).toLocaleString('de-DE')}</option>`
        ).join('') : '<option value="">Keine Immobilien verfügbar</option>'
  
      const loanTypeOptions = [
        { value: 'mortgage', text: '🏠 Immobilienkredit (2-4%)', desc: 'Für Immobilienkäufe, bis zu 30 Jahre' },
        { value: 'renovation', text: '🔨 Renovierungskredit (3-6%)', desc: 'Für Modernisierungen, bis zu 10 Jahre' },
        { value: 'bridge', text: '⚡ Zwischenfinanzierung (8-12%)', desc: 'Kurzfristig, bis zu 2 Jahre' },
        { value: 'construction', text: '🏗️ Baukredit (3-5%)', desc: 'Für Neubauten, bis zu 20 Jahre' },
        { value: 'business', text: '💼 Geschäftskredit (4-8%)', desc: 'Für Gewerbeimmobilien, bis zu 7 Jahre' },
        { value: 'refinancing', text: '♻️ Umschuldung (1-3%)', desc: 'Bestehende Kredite ablösen, bis zu 30 Jahre' }
      ].map(option => `
        <div style="margin: 8px 0; padding: 8px; border: 1px solid #ddd; border-radius: 6px; cursor: pointer;"
             onclick="selectLoanType('${option.value}')">
          <label style="cursor: pointer;">
            <input type="radio" name="loanType" value="${option.value}" style="margin-right: 8px;">
            <strong>${option.text}</strong><br>
            <small style="color: #666;">${option.desc}</small>
          </label>
        </div>
      `).join('')
  
      const { value: formData } = await Swal.fire({
        title: '💰 Kredit beantragen',
        html: `
          <div style="text-align: left;">
            <div style="margin: 15px 0;">
              <label style="display: block; margin-bottom: 5px; font-weight: bold;">Bank auswählen:</label>
              <select id="bankSelect" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                ${bankOptions}
              </select>
            </div>
            
            <div style="margin: 15px 0;">
              <label style="display: block; margin-bottom: 5px; font-weight: bold;">Kreditart:</label>
              <div id="loanTypeSelection">
                ${loanTypeOptions}
              </div>
            </div>
            
            <div style="margin: 15px 0;">
              <label style="display: block; margin-bottom: 5px; font-weight: bold;">Kreditsumme (€):</label>
              <input id="amountInput" type="number" min="10000" max="5000000" step="1000" value="300000"
                     style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            
            <div style="margin: 15px 0;">
              <label style="display: block; margin-bottom: 5px; font-weight: bold;">Sicherheit (optional):</label>
              <select id="propertySelect" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                ${propertyOptions}
              </select>
            </div>
            
            <div style="background: #e3f2fd; padding: 10px; border-radius: 6px; margin: 15px 0; font-size: 12px;">
              <strong>💡 Tipp:</strong> Ein höherer Credit Score und eine Immobilie als Sicherheit verbessern Ihre Konditionen erheblich.
            </div>
          </div>
          
          <script>
            function selectLoanType(type) {
              document.querySelectorAll('input[name="loanType"]').forEach(radio => {
                radio.checked = radio.value === type;
              });
            }
          </script>
        `,
        showCancelButton: true,
        confirmButtonText: '📄 Antrag stellen',
        cancelButtonText: 'Abbrechen',
        width: 600,
        preConfirm: () => {
          const bankId = (document.getElementById('bankSelect') as HTMLSelectElement).value
          const loanType = document.querySelector('input[name="loanType"]:checked') as HTMLInputElement
          const amount = parseInt((document.getElementById('amountInput') as HTMLInputElement).value)
          const propertyId = (document.getElementById('propertySelect') as HTMLSelectElement).value || undefined
  
          if (!bankId || !loanType || !amount) {
            Swal.showValidationMessage('Bitte alle Felder ausfüllen')
            return false
          }
  
          return {
            bankId,
            loanType: loanType.value,
            amount,
            propertyId
          }
        }
      })
  
      return formData || null
    }
  
    /**
     * Zeigt Kredit-Angebots-Dialog
     */
    static async showLoanOfferDialog(application: any, decision: any): Promise<boolean> {
      const statusIcon = decision.approved ? '✅' : '❌'
      const statusColor = decision.approved ? '#27ae60' : '#e74c3c'
      
      if (!decision.approved) {
        await Swal.fire({
          icon: 'error',
          title: `${statusIcon} Kreditantrag abgelehnt`,
          text: decision.reason,
          confirmButtonColor: '#e74c3c'
        })
        return false
      }
  
      const monthlyPayment = this.calculateMonthlyPayment(decision.amount, decision.interestRate, decision.termMonths)
      const totalCost = monthlyPayment * decision.termMonths
      const totalInterest = totalCost - decision.amount
  
      const result = await Swal.fire({
        title: `${statusIcon} Kreditangebot erhalten`,
        html: `
          <div style="text-align: left;">
            <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
              <h4 style="margin: 0 0 10px 0; color: #155724;">🎉 Ihr Antrag wurde genehmigt!</h4>
              <div style="font-size: 14px; color: #155724;">
                Bank: <strong>${application.bankId}</strong><br>
                Kreditart: <strong>${this.getLoanTypeText(application.loanType)}</strong>
              </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 15px 0;">
              <div style="background: #f8f9fa; padding: 10px; border-radius: 6px;">
                <strong>Kreditsumme</strong><br>
                <span style="font-size: 18px; color: #27ae60;">€${decision.amount.toLocaleString('de-DE')}</span>
              </div>
              <div style="background: #f8f9fa; padding: 10px; border-radius: 6px;">
                <strong>Zinssatz</strong><br>
                <span style="font-size: 18px; color: #f39c12;">${decision.interestRate}% p.a.</span>
              </div>
              <div style="background: #f8f9fa; padding: 10px; border-radius: 6px;">
                <strong>Laufzeit</strong><br>
                <span style="font-size: 18px; color: #3498db;">${decision.termMonths} Monate</span>
              </div>
              <div style="background: #f8f9fa; padding: 10px; border-radius: 6px;">
                <strong>Monatliche Rate</strong><br>
                <span style="font-size: 18px; color: #e74c3c;">€${Math.round(monthlyPayment).toLocaleString('de-DE')}</span>
              </div>
            </div>
            
            <div style="background: #fff3cd; padding: 12px; border-radius: 6px; margin: 15px 0;">
              <strong>📊 Kreditübersicht:</strong><br>
              <div style="font-size: 12px; margin-top: 5px;">
                Gesamtkosten: €${Math.round(totalCost).toLocaleString('de-DE')}<br>
                Davon Zinsen: €${Math.round(totalInterest).toLocaleString('de-DE')}<br>
                Effektiver Zinssatz: ${((totalInterest / decision.amount) * 100).toFixed(2)}%
              </div>
            </div>
            
            ${decision.conditions.length > 0 ? `
              <div style="background: #f0f8ff; padding: 12px; border-radius: 6px; margin: 15px 0;">
                <strong>📋 Bedingungen:</strong>
                <ul style="margin: 5px 0; padding-left: 20px; font-size: 12px;">
                  ${decision.conditions.map((condition: string) => `<li>${condition}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            
            <div style="background: #f8d7da; padding: 10px; border-radius: 6px; margin: 15px 0; font-size: 11px; color: #721c24;">
              <strong>⚠️ Wichtiger Hinweis:</strong> 
              Ein Kredit ist eine finanzielle Verpflichtung. Stellen Sie sicher, dass Sie die monatlichen Raten dauerhaft zahlen können.
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: '✅ Kredit annehmen',
        cancelButtonText: '❌ Ablehnen',
        confirmButtonColor: '#27ae60',
        cancelButtonColor: '#6c757d',
        width: 650
      })
  
      return result.isConfirmed
    }
  
    /**
     * Zeigt Kredit-Übersicht für aktive Kredite
     */
    static async showLoanManagementDialog(activeLoans: any[]): Promise<string> {
      if (activeLoans.length === 0) {
        await Swal.fire({
          icon: 'info',
          title: '💳 Keine aktiven Kredite',
          text: 'Sie haben derzeit keine laufenden Kredite.',
          confirmButtonColor: '#3498db'
        })
        return 'cancel'
      }
  
      const loanCards = activeLoans.map(loan => {
        const statusColor = loan.status === 'active' ? '#27ae60' : 
                           loan.status === 'overdue' ? '#e74c3c' : '#f39c12'
        
        const progressPercent = ((loan.totalMonths - loan.remainingMonths) / loan.totalMonths) * 100
        
        return `
          <div style="
            border: 2px solid ${statusColor}; 
            border-radius: 12px; 
            padding: 15px; 
            margin: 10px 0; 
            background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
          ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <h4 style="margin: 0; color: #2c3e50;">${this.getLoanTypeText(loan.type)} - ${loan.bankId}</h4>
              <span style="
                background: ${statusColor}; 
                color: white; 
                padding: 4px 8px; 
                border-radius: 12px; 
                font-size: 10px; 
                font-weight: bold;
              ">${this.getLoanStatusText(loan.status)}</span>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 10px 0; font-size: 12px;">
              <div><strong>Verbleibend:</strong> €${Math.round(loan.amount).toLocaleString('de-DE')}</div>
              <div><strong>Monatliche Rate:</strong> €${Math.round(loan.monthlyPayment).toLocaleString('de-DE')}</div>
              <div><strong>Zinssatz:</strong> ${loan.currentInterestRate}%</div>
              <div><strong>Restlaufzeit:</strong> ${loan.remainingMonths} Monate</div>
              <div><strong>Bezahlt:</strong> €${Math.round(loan.totalPaid).toLocaleString('de-DE')}</div>
              <div><strong>Zinsen gesamt:</strong> €${Math.round(loan.totalInterestPaid).toLocaleString('de-DE')}</div>
            </div>
            
            <div style="background: #e9ecef; border-radius: 10px; height: 8px; margin: 10px 0;">
              <div style="
                background: ${statusColor}; 
                height: 100%; 
                width: ${progressPercent}%; 
                border-radius: 10px; 
                transition: width 0.3s ease;
              "></div>
            </div>
            <div style="text-align: center; font-size: 10px; color: #6c757d;">
              ${Math.round(progressPercent)}% abgezahlt
            </div>
            
            ${loan.hasCreditInsurance ? `
              <div style="background: #d1ecf1; padding: 8px; border-radius: 6px; margin: 8px 0; font-size: 11px;">
                🛡️ Kreditversicherung: €${loan.insuranceCost}/Monat
              </div>
            ` : ''}
            
            ${loan.missedPayments > 0 ? `
              <div style="background: #f8d7da; padding: 8px; border-radius: 6px; margin: 8px 0; font-size: 11px; color: #721c24;">
                ⚠️ ${loan.missedPayments} verpasste Zahlungen
              </div>
            ` : ''}
          </div>
        `
      }).join('')
  
      const totalDebt = activeLoans.reduce((sum, loan) => sum + loan.amount, 0)
      const totalMonthlyPayments = activeLoans.reduce((sum, loan) => sum + loan.monthlyPayment + (loan.insuranceCost || 0), 0)
  
      const result = await Swal.fire({
        title: '💳 Kredit-Management',
        html: `
          <div style="text-align: left; max-height: 600px; overflow-y: auto;">
            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
              <h4 style="margin: 0 0 10px 0; color: #1976d2;">📊 Übersicht</h4>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div>
                  <strong>Gesamtschuld:</strong><br>
                  <span style="font-size: 18px; color: #e74c3c;">€${Math.round(totalDebt).toLocaleString('de-DE')}</span>
                </div>
                <div>
                  <strong>Monatliche Belastung:</strong><br>
                  <span style="font-size: 18px; color: #f39c12;">€${Math.round(totalMonthlyPayments).toLocaleString('de-DE')}</span>
                </div>
              </div>
            </div>
            
            <h4 style="color: #2c3e50; margin: 20px 0 10px 0;">🏦 Aktive Kredite (${activeLoans.length})</h4>
            ${loanCards}
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: '💰 Sondertilgung',
        cancelButtonText: 'Schließen',
        width: 700,
        customClass: {
          popup: 'loan-management'
        }
      })
  
      return result.isConfirmed ? 'early_payment' : 'cancel'
    }
  
    // ===== HILFSMETHODEN FÜR BANK-SYSTEM =====
  
    private static getBankIcon(bankType: string): string {
      const icons: { [key: string]: string } = {
        sparkasse: '🏛️',
        deutsche_bank: '🏦',
        online_bank: '💻',
        private_bank: '👔',
        cooperative_bank: '🤝'
      }
      return icons[bankType] || '🏦'
    }
  
    private static getRelationshipBadge(relationship: string): string {
      const badges: { [key: string]: { text: string, color: string } } = {
        new: { text: 'Neu', color: '#6c757d' },
        regular: { text: 'Kunde', color: '#17a2b8' },
        preferred: { text: 'Bevorzugt', color: '#28a745' },
        premium: { text: 'Premium', color: '#ffc107' },
        vip: { text: 'VIP', color: '#dc3545' }
      }
      
      const badge = badges[relationship] || badges.new
      return `<span style="
        background: ${badge.color}; 
        color: white; 
        padding: 2px 6px; 
        border-radius: 10px; 
        font-size: 10px; 
        font-weight: bold;
      ">${badge.text}</span>`
    }
  
    private static getLoanTypeText(loanType: string): string {
      const types: { [key: string]: string } = {
        mortgage: 'Immobilienkredit',
        renovation: 'Renovierungskredit',
        bridge: 'Zwischenfinanzierung',
        construction: 'Baukredit',
        business: 'Geschäftskredit',
        refinancing: 'Umschuldung'
      }
      return types[loanType] || 'Kredit'
    }
  
    private static getLoanStatusText(status: string): string {
      const statuses: { [key: string]: string } = {
        active: 'Aktiv',
        overdue: 'Überfällig',
        default: 'Ausfall',
        paid_off: 'Abgezahlt',
        foreclosure: 'Zwangsvollstreckung'
      }
      return statuses[status] || 'Unbekannt'
    }
  
    private static getCreditScoreColor(score: number): string {
      if (score >= 750) return '#27ae60'
      if (score >= 700) return '#2ecc71'
      if (score >= 650) return '#f39c12'
      if (score >= 600) return '#e67e22'
      return '#e74c3c'
    }
  
    private static getCreditScoreText(score: number): string {
      if (score >= 800) return 'Ausgezeichnet'
      if (score >= 750) return 'Sehr gut'
      if (score >= 700) return 'Gut'
      if (score >= 650) return 'Befriedigend'
      if (score >= 600) return 'Ausreichend'
      return 'Mangelhaft'
    }
  
    private static getMarketHealthText(health: number): string {
      if (health >= 80) return '🚀 Sehr stark'
      if (health >= 60) return '📈 Stark'
      if (health >= 40) return '➡️ Stabil'
      if (health >= 20) return '📉 Schwach'
      return '💔 Sehr schwach'
    }
  
    private static calculateMonthlyPayment(principal: number, annualRate: number, months: number): number {
      const monthlyRate = annualRate / 100 / 12
      if (monthlyRate === 0) return principal / months
      
      return (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / 
             (Math.pow(1 + monthlyRate, months) - 1)
    }
  
    /**
     * Zeigt Zwangsversteigerungs-Dialog
     */
    static async showForeclosureDialog(foreclosure: any): Promise<string> {
      const timeLeftDays = Math.max(0, foreclosure.timeRemaining)
      const urgencyColor = timeLeftDays < 30 ? '#e74c3c' : timeLeftDays < 60 ? '#f39c12' : '#3498db'
      
      const result = await Swal.fire({
        icon: 'warning',
        title: '⚠️ Zwangsversteigerung',
        html: `
          <div style="text-align: left;">
            <div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin-bottom: 15px; color: #721c24;">
              <strong>🚨 Warnung: Ihre Immobilie steht vor der Zwangsversteigerung!</strong>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 15px 0;">
              <div style="background: #f8f9fa; padding: 10px; border-radius: 6px;">
                <strong>Ausstehende Schulden</strong><br>
                <span style="font-size: 18px; color: #e74c3c;">€${Math.round(foreclosure.outstandingDebt).toLocaleString('de-DE')}</span>
              </div>
              <div style="background: #f8f9fa; padding: 10px; border-radius: 6px;">
                <strong>Rechtskosten</strong><br>
                <span style="font-size: 18px; color: #f39c12;">€${foreclosure.legalCosts.toLocaleString('de-DE')}</span>
              </div>
              <div style="background: #f8f9fa; padding: 10px; border-radius: 6px;">
                <strong>Marktwert</strong><br>
                <span style="font-size: 18px; color: #27ae60;">€${Math.round(foreclosure.marketValue).toLocaleString('de-DE')}</span>
              </div>
              <div style="background: ${urgencyColor}; color: white; padding: 10px; border-radius: 6px;">
                <strong>Zeit verbleibt</strong><br>
                <span style="font-size: 18px;">${timeLeftDays} Tage</span>
              </div>
            </div>
            
            <div style="background: #fff3cd; padding: 12px; border-radius: 6px; margin: 15px 0;">
              <strong>💡 Ihre Optionen:</strong>
              <ul style="margin: 8px 0; padding-left: 20px;">
                <li><strong>Sofortige Zahlung:</strong> €${Math.round(foreclosure.outstandingDebt + foreclosure.legalCosts).toLocaleString('de-DE')}</li>
                <li><strong>Verhandlung:</strong> Ratenzahlung oder Teilzahlung</li>
                <li><strong>Nichts tun:</strong> Versteigerung erfolgt automatisch</li>
              </ul>
            </div>
            
            <div style="background: #d1ecf1; padding: 10px; border-radius: 6px; margin: 15px 0; font-size: 12px;">
              <strong>ℹ️ Information:</strong> 
              Bei einer Versteigerung wird das Mindestgebot bei €${Math.round(foreclosure.minimumBid).toLocaleString('de-DE')} liegen. 
              Überschüsse werden Ihnen ausgezahlt.
            </div>
          </div>
        `,
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: foreclosure.canPayOff ? '💰 Sofort bezahlen' : '❌ Nicht möglich',
        denyButtonText: foreclosure.canNegotiate ? '🤝 Verhandeln' : '❌ Nicht möglich',
        cancelButtonText: '😞 Akzeptieren',
        confirmButtonColor: foreclosure.canPayOff ? '#27ae60' : '#6c757d',
        denyButtonColor: foreclosure.canNegotiate ? '#f39c12' : '#6c757d',
        cancelButtonColor: '#e74c3c',
        width: 650
      })
  
      if (result.isConfirmed) return 'pay_off'
      if (result.isDenied) return 'negotiate'
      return 'accept'
    }
  
    /**
     * Zeigt Markt-Event Dialog
     */
    static async showMarketEventDialog(event: any): Promise<void> {
      const eventIcons: { [key: string]: string } = {
        interest_rate_change: '📊',
        economic_boom: '🚀',
        recession: '📉',
        inflation_spike: '📈',
        bank_merger: '🏦',
        regulatory_change: '⚖️',
        property_bubble: '🏠'
      }
  
      const icon = eventIcons[event.type] || '📰'
      const intensityColor = event.intensity > 75 ? '#e74c3c' : event.intensity > 50 ? '#f39c12' : '#3498db'
  
      await Swal.fire({
        icon: 'info',
        title: `${icon} Markt-News`,
        html: `
          <div style="text-align: left;">
            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
              <h4 style="margin: 0 0 10px 0; color: #1976d2;">${event.title}</h4>
              <p style="margin: 0; color: #424242;">${event.description}</p>
            </div>
            
            <div style="background: ${intensityColor}; color: white; padding: 10px; border-radius: 6px; margin: 15px 0;">
              <strong>📊 Intensität:</strong> ${event.intensity}/100
            </div>
            
            <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; margin: 15px 0;">
              <strong>🎯 Auswirkungen:</strong>
              <ul style="margin: 8px 0; padding-left: 20px; font-size: 14px;">
                ${event.ecbRateChange ? `<li>EZB-Zinssatz: ${event.ecbRateChange > 0 ? '+' : ''}${event.ecbRateChange.toFixed(2)}%</li>` : ''}
                ${event.inflationChange ? `<li>Inflation: ${event.inflationChange > 0 ? '+' : ''}${event.inflationChange.toFixed(1)}%</li>` : ''}
                ${event.gdpGrowthChange ? `<li>BIP-Wachstum: ${event.gdpGrowthChange > 0 ? '+' : ''}${event.gdpGrowthChange.toFixed(1)}%</li>` : ''}
                ${event.propertyMarketImpact ? `<li>Immobilienmarkt: ${event.propertyMarketImpact > 0 ? '+' : ''}${event.propertyMarketImpact.toFixed(1)}</li>` : ''}
                ${event.bankRiskToleranceChange ? `<li>Bank-Risikobereitschaft: ${event.bankRiskToleranceChange > 0 ? '+' : ''}${event.bankRiskToleranceChange.toFixed(1)}</li>` : ''}
              </ul>
            </div>
            
            <div style="background: #fff3cd; padding: 10px; border-radius: 6px; font-size: 12px;">
              <strong>⏰ Dauer:</strong> ${event.endMonth - event.startMonth} Monate
            </div>
          </div>
        `,
        confirmButtonText: 'Verstanden',
        confirmButtonColor: '#3498db',
        width: 600
      })
    }
}