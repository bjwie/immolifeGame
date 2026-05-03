import { Player } from '../types/GameTypes'

// Simple browser-compatible EventEmitter
class SimpleEventEmitter {
  private events: Map<string, Function[]> = new Map()

  on(event: string, callback: Function): void {
    if (!this.events.has(event)) {
      this.events.set(event, [])
    }
    this.events.get(event)!.push(callback)
  }

  emit(event: string, data?: any): void {
    const callbacks = this.events.get(event)
    if (callbacks) {
      callbacks.forEach(callback => callback(data))
    }
  }

  off(event: string, callback?: Function): void {
    if (!callback) {
      this.events.delete(event)
      return
    }
    
    const callbacks = this.events.get(event)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }
}

// Simplified types for browser compatibility
interface SimpleLoan {
  id: string
  amount: number
  monthlyPayment: number
  remainingMonths: number
  interestRate: number
}

interface SimpleBank {
  id: string
  name: string
  type: string
  description: string
  minCreditScore: number
  maxLoanAmount: number
  baseInterestRate: number
}

interface LoanApplication {
  id: string
  bankId: string
  loanType: string
  amount: number
  propertyId?: string
}

interface LoanDecision {
  approved: boolean
  amount: number
  interestRate: number
  termMonths: number
  monthlyPayment: number
  reason: string
  dtiRatio: number
  maxAffordableAmount: number
}

export class SimpleBankManager extends SimpleEventEmitter {
  private activeLoans: SimpleLoan[] = []
  private creditScore: number = 720

  constructor() {
    super()
  }

  // ===== INCOME VS LOAN PAYMENT CALCULATIONS =====

  /**
   * Berechnet die Debt-to-Income Ratio (DTI)
   */
  public calculateDebtToIncomeRatio(player: Player, additionalLoanPayment: number = 0): {
    monthlyIncome: number,
    totalMonthlyDebt: number,
    newMonthlyDebt: number,
    dtiRatio: number,
    maxAffordableLoanPayment: number,
    canAffordLoan: boolean
  } {
    // Monatliche Einnahmen aus Immobilien berechnen
    const monthlyIncome = this.calculateMonthlyIncome(player)
    
    // Bestehende monatliche Schulden berechnen
    const totalMonthlyDebt = this.activeLoans.reduce((sum, loan) => {
      return sum + loan.monthlyPayment
    }, 0)
    
    // Neue monatliche Belastung mit zusätzlichem Kredit
    const newMonthlyDebt = totalMonthlyDebt + additionalLoanPayment
    
    // DTI-Ratio berechnen (sollte unter 40% sein für gute Bonität)
    const dtiRatio = monthlyIncome > 0 ? (newMonthlyDebt / monthlyIncome) : 1
    
    // Maximale erschwingliche Kreditrate (40% der Einnahmen minus bestehende Schulden)
    const maxAffordableLoanPayment = Math.max(0, (monthlyIncome * 0.4) - totalMonthlyDebt)
    
    // Kann sich den Kredit leisten?
    const canAffordLoan = dtiRatio <= 0.4 && additionalLoanPayment <= maxAffordableLoanPayment
    
    return {
      monthlyIncome,
      totalMonthlyDebt,
      newMonthlyDebt,
      dtiRatio,
      maxAffordableLoanPayment,
      canAffordLoan
    }
  }

  /**
   * Berechnet die monatlichen Einnahmen des Spielers
   */
  private calculateMonthlyIncome(player: Player): number {
    // Einnahmen aus vermieteten Immobilien
    const propertyIncome = player.properties.reduce((sum, property) => {
      return sum + (property.isRented ? property.monthlyRent : 0)
    }, 0)
    
    return propertyIncome
  }

  /**
   * Berechnet die maximale Kreditsumme basierend auf Einkommen
   */
  public calculateMaxLoanAmount(
    player: Player, 
    interestRate: number = 3.5,
    termMonths: number = 240
  ): {
    maxAmount: number,
    maxMonthlyPayment: number,
    recommendedAmount: number,
    reasoning: string[]
  } {
    const incomeAnalysis = this.calculateDebtToIncomeRatio(player)
    
    // Maximale monatliche Rate die sich der Spieler leisten kann
    const maxMonthlyPayment = incomeAnalysis.maxAffordableLoanPayment
    
    // Maximale Kreditsumme basierend auf dieser Rate
    const maxAmount = this.calculateLoanAmount(maxMonthlyPayment, interestRate, termMonths)
    
    // Empfohlene Kreditsumme (75% des Maximums für Sicherheit)
    const recommendedAmount = maxAmount * 0.75
    
    const reasoning: string[] = []
    
    if (incomeAnalysis.monthlyIncome === 0) {
      reasoning.push('⚠️ Keine regelmäßigen Einnahmen nachgewiesen')
    }
    
    if (incomeAnalysis.dtiRatio > 0.3) {
      reasoning.push('⚠️ Hohe bestehende Verschuldung')
    }
    
    if (incomeAnalysis.monthlyIncome > 0) {
      reasoning.push(`💰 Monatseinkommen: €${Math.round(incomeAnalysis.monthlyIncome).toLocaleString('de-DE')}`)
    }
    
    if (incomeAnalysis.totalMonthlyDebt > 0) {
      reasoning.push(`📊 Bestehende Kreditraten: €${Math.round(incomeAnalysis.totalMonthlyDebt).toLocaleString('de-DE')}`)
    }
    
    reasoning.push(`🎯 Empfohlene DTI-Ratio: max. 40% (aktuell: ${(incomeAnalysis.dtiRatio * 100).toFixed(1)}%)`)
    
    return {
      maxAmount: Math.max(0, maxAmount),
      maxMonthlyPayment,
      recommendedAmount: Math.max(0, recommendedAmount),
      reasoning
    }
  }

  /**
   * Berechnet Kreditsumme basierend auf monatlicher Rate
   */
  private calculateLoanAmount(monthlyPayment: number, annualRate: number, months: number): number {
    const monthlyRate = annualRate / 100 / 12
    if (monthlyRate === 0) return monthlyPayment * months
    
    return (monthlyPayment * (Math.pow(1 + monthlyRate, months) - 1)) / 
           (monthlyRate * Math.pow(1 + monthlyRate, months))
  }

  /**
   * Erstellt die verfügbaren Banken
   */
  public getAvailableBanks(): SimpleBank[] {
    return [
      {
        id: 'sparkasse',
        name: 'Sparkasse München',
        type: 'sparkasse',
        description: 'Traditionell, sicher und bürgernah',
        minCreditScore: 600,
        maxLoanAmount: 2000000,
        baseInterestRate: 3.2
      },
      {
        id: 'deutsche_bank',
        name: 'Deutsche Bank',
        type: 'deutsche_bank',
        description: 'Premium Banking für anspruchsvolle Kunden',
        minCreditScore: 700,
        maxLoanAmount: 5000000,
        baseInterestRate: 2.9
      },
      {
        id: 'ing_diba',
        name: 'ING Bank',
        type: 'online_bank',
        description: 'Digital first, günstige Konditionen',
        minCreditScore: 650,
        maxLoanAmount: 1500000,
        baseInterestRate: 2.7
      }
    ]
  }

  /**
   * Evaluiert Kreditantrag basierend auf Einkommen
   */
  public evaluateLoanApplication(
    player: Player,
    bankId: string,
    requestedAmount: number,
    loanType: string = 'mortgage'
  ): LoanDecision {
    const bank = this.getAvailableBanks().find(b => b.id === bankId)
    if (!bank) {
      return {
        approved: false,
        amount: 0,
        interestRate: 0,
        termMonths: 0,
        monthlyPayment: 0,
        reason: 'Bank nicht gefunden',
        dtiRatio: 0,
        maxAffordableAmount: 0
      }
    }

    const interestRate = bank.baseInterestRate
    const termMonths = 240 // 20 Jahre Standard
    const monthlyPayment = this.calculateMonthlyPayment(requestedAmount, interestRate, termMonths)
    
    // Income-Check: Kann sich der Spieler den Kredit leisten?
    const incomeAnalysis = this.calculateDebtToIncomeRatio(player, monthlyPayment)
    const maxLoanInfo = this.calculateMaxLoanAmount(player, interestRate, termMonths)
    
    // Bewertungskriterien
    const reasons: string[] = []
    let approved = true
    
    // 1. Credit Score Check
    if (this.creditScore < bank.minCreditScore) {
      approved = false
      reasons.push(`Credit Score zu niedrig (${this.creditScore} < ${bank.minCreditScore})`)
    }
    
    // 2. Kreditsumme Check
    if (requestedAmount > bank.maxLoanAmount) {
      approved = false
      reasons.push(`Kreditsumme zu hoch (max. €${bank.maxLoanAmount.toLocaleString('de-DE')})`)
    }
    
    // 3. Income Check - WICHTIG!
    if (!incomeAnalysis.canAffordLoan) {
      approved = false
      reasons.push(`Einkommen reicht nicht aus (DTI: ${(incomeAnalysis.dtiRatio * 100).toFixed(1)}% > 40%)`)
    }
    
    if (requestedAmount > maxLoanInfo.maxAmount) {
      approved = false
      reasons.push(`Kreditsumme übersteigt Zahlungsfähigkeit (max. €${Math.round(maxLoanInfo.maxAmount).toLocaleString('de-DE')})`)
    }
    
    // Positive Faktoren
    if (approved) {
      if (this.creditScore >= 750) {
        reasons.push('✅ Ausgezeichnete Bonität')
      }
      if (incomeAnalysis.dtiRatio <= 0.3) {
        reasons.push('✅ Geringe Verschuldung')
      }
      if (incomeAnalysis.monthlyIncome > 0) {
        reasons.push('✅ Stabiles Einkommen')
      }
    }
    
    return {
      approved,
      amount: requestedAmount,
      interestRate,
      termMonths,
      monthlyPayment,
      reason: reasons.join(', '),
      dtiRatio: incomeAnalysis.dtiRatio,
      maxAffordableAmount: maxLoanInfo.maxAmount
    }
  }

  /**
   * Berechnet monatliche Zahlung für Kredit
   */
  private calculateMonthlyPayment(principal: number, annualRate: number, months: number): number {
    const monthlyRate = annualRate / 100 / 12
    if (monthlyRate === 0) return principal / months
    
    return (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / 
           (Math.pow(1 + monthlyRate, months) - 1)
  }

  /**
   * Erstellt aktiven Kredit
   */
  public createLoan(amount: number, interestRate: number, termMonths: number): string {
    const loanId = `loan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const monthlyPayment = this.calculateMonthlyPayment(amount, interestRate, termMonths)
    
    const loan: SimpleLoan = {
      id: loanId,
      amount,
      monthlyPayment,
      remainingMonths: termMonths,
      interestRate
    }
    
    this.activeLoans.push(loan)
    return loanId
  }

  /**
   * Gibt aktive Kredite zurück
   */
  public getActiveLoans(): SimpleLoan[] {
    return this.activeLoans
  }

  /**
   * Credit Score getter
   */
  public getCreditScore(): number {
    return this.creditScore
  }
} 