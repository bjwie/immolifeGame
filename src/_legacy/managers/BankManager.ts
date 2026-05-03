import { 
  BankingSystemState, AdvancedBank, BankType, LoanType, InterestType, BankRelationship, EconomicFactors, 
  CreditHistoryEntry, CreditProfile, AdvancedLoan, PaymentHistoryEntry, LoanStatus, LoanApplication, 
  ApplicationStatus, LoanDecision, MarketEventType, MarketEvent, ForeclosureProcess, ForeclosureStage,
  Player, Property
} from '../types/GameTypes'

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

export class BankManager extends SimpleEventEmitter {
  private bankingSystem: BankingSystemState
  private gameStartMonth: number

  constructor(gameStartMonth: number) {
    super()
    this.gameStartMonth = gameStartMonth
    this.bankingSystem = this.initializeBankingSystem()
  }

  // ===== BANK SYSTEM INITIALIZATION =====

  private initializeBankingSystem(): BankingSystemState {
    return {
      banks: this.createAdvancedBanks(),
      economicFactors: this.initializeEconomicFactors(),
      marketEvents: [],
      creditProfile: this.initializeCreditProfile(),
      activeLoans: [],
      loanApplications: [],
      foreclosureProcesses: []
    }
  }

  private createAdvancedBanks(): AdvancedBank[] {
    return [
      {
        id: 'sparkasse_muenchen',
        name: 'Sparkasse München',
        type: BankType.SPARKASSE,
        description: 'Traditionell, sicher und bürgernah',
        minCreditScore: 600,
        maxLoanAmount: 2000000,
        specialties: [LoanType.MORTGAGE, LoanType.RENOVATION],
        baseInterestRates: {
          [LoanType.MORTGAGE]: 3.2,
          [LoanType.RENOVATION]: 4.5,
          [LoanType.BRIDGE]: 9.0,
          [LoanType.CONSTRUCTION]: 4.0,
          [LoanType.BUSINESS]: 6.5,
          [LoanType.REFINANCING]: 2.8
        },
        riskTolerance: 0.3,
        approvalSpeed: 14,
        relationship: BankRelationship.NEW,
        totalLoansGiven: 1250,
        averageApprovalRate: 0.75,
        digitalService: false,
        personalAdvisor: true,
        offersCreditInsurance: true,
        relationshipBonuses: {
          [BankRelationship.PREFERRED]: -0.2,
          [BankRelationship.PREMIUM]: -0.4,
          [BankRelationship.VIP]: -0.6
        }
      },
      {
        id: 'deutsche_bank',
        name: 'Deutsche Bank',
        type: BankType.DEUTSCHE_BANK,
        description: 'Premium Banking für anspruchsvolle Kunden',
        minCreditScore: 700,
        maxLoanAmount: 5000000,
        specialties: [LoanType.MORTGAGE, LoanType.BUSINESS, LoanType.CONSTRUCTION],
        baseInterestRates: {
          [LoanType.MORTGAGE]: 2.9,
          [LoanType.RENOVATION]: 4.2,
          [LoanType.BRIDGE]: 8.5,
          [LoanType.CONSTRUCTION]: 3.7,
          [LoanType.BUSINESS]: 5.8,
          [LoanType.REFINANCING]: 2.5
        },
        riskTolerance: 0.6,
        approvalSpeed: 10,
        relationship: BankRelationship.NEW,
        totalLoansGiven: 3200,
        averageApprovalRate: 0.65,
        digitalService: true,
        personalAdvisor: true,
        offersCreditInsurance: true,
        relationshipBonuses: {
          [BankRelationship.PREFERRED]: -0.3,
          [BankRelationship.PREMIUM]: -0.5,
          [BankRelationship.VIP]: -0.8
        }
      },
      {
        id: 'ing_diba',
        name: 'ING Bank',
        type: BankType.ONLINE_BANK,
        description: 'Digital first, günstige Konditionen',
        minCreditScore: 650,
        maxLoanAmount: 1500000,
        specialties: [LoanType.MORTGAGE, LoanType.REFINANCING],
        baseInterestRates: {
          [LoanType.MORTGAGE]: 2.7,
          [LoanType.RENOVATION]: 3.9,
          [LoanType.BRIDGE]: 8.8,
          [LoanType.CONSTRUCTION]: 3.5,
          [LoanType.BUSINESS]: 6.2,
          [LoanType.REFINANCING]: 2.2
        },
        riskTolerance: 0.4,
        approvalSpeed: 7,
        relationship: BankRelationship.NEW,
        totalLoansGiven: 850,
        averageApprovalRate: 0.80,
        digitalService: true,
        personalAdvisor: false,
        offersCreditInsurance: false,
        relationshipBonuses: {
          [BankRelationship.PREFERRED]: -0.15,
          [BankRelationship.PREMIUM]: -0.25,
          [BankRelationship.VIP]: -0.4
        }
      },
      {
        id: 'metzler_private',
        name: 'Metzler Private Bank',
        type: BankType.PRIVATE_BANK,
        description: 'Exklusives Private Banking',
        minCreditScore: 750,
        maxLoanAmount: 10000000,
        specialties: [LoanType.MORTGAGE, LoanType.BUSINESS, LoanType.CONSTRUCTION],
        baseInterestRates: {
          [LoanType.MORTGAGE]: 2.5,
          [LoanType.RENOVATION]: 3.8,
          [LoanType.BRIDGE]: 7.5,
          [LoanType.CONSTRUCTION]: 3.2,
          [LoanType.BUSINESS]: 5.2,
          [LoanType.REFINANCING]: 2.0
        },
        riskTolerance: 0.8,
        approvalSpeed: 5,
        relationship: BankRelationship.NEW,
        totalLoansGiven: 420,
        averageApprovalRate: 0.90,
        digitalService: true,
        personalAdvisor: true,
        offersCreditInsurance: true,
        relationshipBonuses: {
          [BankRelationship.PREFERRED]: -0.4,
          [BankRelationship.PREMIUM]: -0.7,
          [BankRelationship.VIP]: -1.0
        }
      },
      {
        id: 'volksbank_raiffeisenbank',
        name: 'Volksbank Raiffeisenbank',
        type: BankType.COOPERATIVE_BANK,
        description: 'Genossenschaftlich, regional verwurzelt',
        minCreditScore: 580,
        maxLoanAmount: 1800000,
        specialties: [LoanType.MORTGAGE, LoanType.RENOVATION, LoanType.CONSTRUCTION],
        baseInterestRates: {
          [LoanType.MORTGAGE]: 3.1,
          [LoanType.RENOVATION]: 4.3,
          [LoanType.BRIDGE]: 9.2,
          [LoanType.CONSTRUCTION]: 3.8,
          [LoanType.BUSINESS]: 6.0,
          [LoanType.REFINANCING]: 2.7
        },
        riskTolerance: 0.5,
        approvalSpeed: 12,
        relationship: BankRelationship.NEW,
        totalLoansGiven: 980,
        averageApprovalRate: 0.85,
        digitalService: false,
        personalAdvisor: true,
        offersCreditInsurance: true,
        relationshipBonuses: {
          [BankRelationship.PREFERRED]: -0.25,
          [BankRelationship.PREMIUM]: -0.45,
          [BankRelationship.VIP]: -0.7
        }
      }
    ]
  }

  private initializeEconomicFactors(): EconomicFactors {
    return {
      ecbRate: 4.25,
      inflation: 2.8,
      unemployment: 5.2,
      gdpGrowth: 1.4,
      propertyMarketHealth: 72,
      bankRiskTolerance: 65
    }
  }

  private initializeCreditProfile(): CreditProfile {
    return {
      score: 720,
      paymentHistory: 28,
      creditUtilization: 18,
      lengthOfCreditHistory: 0,
      numberOfActiveLoans: 0,
      totalDebt: 0,
      history: []
    }
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
    // Monatliche Einnahmen berechnen
    const monthlyIncome = this.calculateMonthlyIncome(player)
    
    // Bestehende monatliche Schulden berechnen
    const totalMonthlyDebt = this.bankingSystem.activeLoans.reduce((sum, loan) => {
      return sum + loan.monthlyPayment + (loan.insuranceCost || 0)
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
    // Einnahmen aus Immobilien
    const propertyIncome = player.properties.reduce((sum, property) => {
      return sum + (property.isRented ? property.monthlyRent : 0)
    }, 0)
    
    // TODO: Weitere Einkommensquellen hinzufügen
    // - Gehalt (falls implementiert)
    // - Dividenden (falls implementiert)
    // - Sonstige passive Einnahmen
    
    return propertyIncome
  }

  /**
   * Berechnet die maximale Kreditsumme basierend auf Einkommen
   */
  public calculateMaxLoanAmount(
    player: Player, 
    loanType: LoanType, 
    bankId: string,
    termMonths: number = 240
  ): {
    maxAmount: number,
    maxMonthlyPayment: number,
    recommendedAmount: number,
    reasoning: string[]
  } {
    const bank = this.bankingSystem.banks.find(b => b.id === bankId)
    if (!bank) throw new Error('Bank not found')
    
    const incomeAnalysis = this.calculateDebtToIncomeRatio(player)
    const interestRate = this.calculateLoanInterestRate(bank, loanType, this.bankingSystem.creditProfile.score)
    
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

  // ===== LOAN APPLICATION PROCESSING =====

  /**
   * Stellt Kreditantrag
   */
  public submitLoanApplication(
    bankId: string,
    loanType: LoanType,
    amount: number,
    propertyId?: string
  ): LoanApplication {
    const application: LoanApplication = {
      id: `loan_app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      bankId,
      loanType,
      amount,
      propertyId,
      status: ApplicationStatus.PENDING,
      submissionDate: this.gameStartMonth,
      creditScore: this.bankingSystem.creditProfile.score
    }

    this.bankingSystem.loanApplications.push(application)
    
    // Verarbeitung nach Delay starten
    setTimeout(() => this.processLoanApplication(application.id), 100)
    
    return application
  }

  /**
   * Verarbeitet Kreditantrag mit Income-Check
   */
  private processLoanApplication(applicationId: string) {
    const application = this.bankingSystem.loanApplications.find(app => app.id === applicationId)
    if (!application) return

    const bank = this.bankingSystem.banks.find(b => b.id === application.bankId)
    if (!bank) return

    // Fake Player für Demo - in echter Implementierung vom GameManager übergeben
    const player: Player = {
      id: 'player1',
      name: 'Player',
      cash: 100000,
      properties: [], // Würde echte Properties enthalten
      netWorth: 100000
    }

    const decision = this.evaluateLoanApplication(application, bank, player)
    
    application.status = decision.approved ? ApplicationStatus.APPROVED : ApplicationStatus.REJECTED
    
    this.emit('loanApplicationProcessed', { application, decision })
  }

  /**
   * Bewertet Kreditantrag basierend auf Einkommen und Kreditwürdigkeit
   */
  private evaluateLoanApplication(
    application: LoanApplication, 
    bank: AdvancedBank,
    player: Player
  ): LoanDecision {
    const creditScore = this.bankingSystem.creditProfile.score
    const interestRate = this.calculateLoanInterestRate(bank, application.loanType, creditScore)
    
    // Standardlaufzeit basierend auf Kreditart
    const termMonths = this.getStandardLoanTerm(application.loanType)
    const monthlyPayment = this.calculateMonthlyPayment(application.amount, interestRate, termMonths)
    
    // Income-Check: Kann sich der Spieler den Kredit leisten?
    const incomeAnalysis = this.calculateDebtToIncomeRatio(player, monthlyPayment)
    const maxLoanInfo = this.calculateMaxLoanAmount(player, application.loanType, bank.id, termMonths)
    
    // Bewertungskriterien
    const reasons: string[] = []
    let approved = true
    
    // 1. Credit Score Check
    if (creditScore < bank.minCreditScore) {
      approved = false
      reasons.push(`Credit Score zu niedrig (${creditScore} < ${bank.minCreditScore})`)
    }
    
    // 2. Kreditsumme Check
    if (application.amount > bank.maxLoanAmount) {
      approved = false
      reasons.push(`Kreditsumme zu hoch (max. €${bank.maxLoanAmount.toLocaleString('de-DE')})`)
    }
    
    // 3. Income Check - WICHTIG!
    if (!incomeAnalysis.canAffordLoan) {
      approved = false
      reasons.push(`Einkommen reicht nicht aus (DTI: ${(incomeAnalysis.dtiRatio * 100).toFixed(1)}% > 40%)`)
    }
    
    if (application.amount > maxLoanInfo.maxAmount) {
      approved = false
      reasons.push(`Kreditsumme übersteigt Zahlungsfähigkeit (max. €${Math.round(maxLoanInfo.maxAmount).toLocaleString('de-DE')})`)
    }
    
    // 4. Sicherheiten Check
    const hasCollateral = !!application.propertyId
    if (!hasCollateral && application.amount > 500000) {
      approved = false
      reasons.push('Sicherheiten erforderlich für hohe Kreditsummen')
    }
    
    // Positive Faktoren
    if (approved) {
      if (hasCollateral) {
        reasons.push('✅ Immobilie als Sicherheit')
      }
      if (creditScore >= 750) {
        reasons.push('✅ Ausgezeichnete Bonität')
      }
      if (incomeAnalysis.dtiRatio <= 0.3) {
        reasons.push('✅ Geringe Verschuldung')
      }
    }
    
    // Angepasste Konditionen bei Genehmigung
    let finalAmount = application.amount
    let finalInterestRate = interestRate
    let finalTermMonths = termMonths
    const conditions: string[] = []
    
    if (approved) {
      // Eventuell Kreditsumme reduzieren für bessere Konditionen
      if (application.amount > maxLoanInfo.recommendedAmount) {
        finalAmount = maxLoanInfo.recommendedAmount
        conditions.push(`Kreditsumme reduziert auf €${Math.round(finalAmount).toLocaleString('de-DE')} für bessere Konditionen`)
      }
      
      // Zinssatz-Adjustments
      if (hasCollateral) {
        finalInterestRate -= 0.5
        conditions.push('Zinssatz reduziert dank Sicherheiten')
      }
      
      if (creditScore >= 800) {
        finalInterestRate -= 0.2
        conditions.push('Premium-Zinssatz für exzellente Bonität')
      }
    }
    
    return {
      approved,
      amount: finalAmount,
      interestRate: Math.max(0.5, finalInterestRate), // Mindestens 0.5%
      termMonths: finalTermMonths,
      monthlyPayment: this.calculateMonthlyPayment(finalAmount, finalInterestRate, finalTermMonths),
      conditions,
      reason: reasons.join(', '),
      creditScore,
      dtiRatio: incomeAnalysis.dtiRatio,
      maxAffordableAmount: maxLoanInfo.maxAmount
    }
  }

  // ===== HELPER METHODS =====

  private calculateLoanInterestRate(bank: AdvancedBank, loanType: LoanType, creditScore: number): number {
    const baseRate = bank.baseInterestRates[loanType]
    const economicFactor = this.bankingSystem.economicFactors.ecbRate / 4.0 // ECB influence
    const creditScoreAdjustment = Math.max(0, (750 - creditScore) / 100) // Higher score = lower rate
    const relationshipBonus = bank.relationshipBonuses[bank.relationship] || 0
    
    return Math.max(0.5, baseRate + economicFactor + creditScoreAdjustment + relationshipBonus)
  }

  private getStandardLoanTerm(loanType: LoanType): number {
    const terms: { [key in LoanType]: number } = {
      [LoanType.MORTGAGE]: 240,        // 20 Jahre
      [LoanType.RENOVATION]: 120,     // 10 Jahre  
      [LoanType.BRIDGE]: 24,          // 2 Jahre
      [LoanType.CONSTRUCTION]: 180,   // 15 Jahre
      [LoanType.BUSINESS]: 84,        // 7 Jahre
      [LoanType.REFINANCING]: 300     // 25 Jahre
    }
    return terms[loanType]
  }

  private calculateMonthlyPayment(principal: number, annualRate: number, months: number): number {
    const monthlyRate = annualRate / 100 / 12
    if (monthlyRate === 0) return principal / months
    
    return (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / 
           (Math.pow(1 + monthlyRate, months) - 1)
  }

  /**
   * Nimmt Kredit an und erstellt aktiven Kredit
   */
  public acceptLoanOffer(applicationId: string): boolean {
    const application = this.bankingSystem.loanApplications.find(app => app.id === applicationId)
    if (!application || application.status !== ApplicationStatus.APPROVED) {
      return false
    }

    // TODO: Hier würde der echte Kredit erstellt und dem Spieler das Geld gegeben
    // const loan: AdvancedLoan = { ... }
    // this.bankingSystem.activeLoans.push(loan)
    
    return true
  }

  // ===== GETTERS =====

  public getBankingSystem(): BankingSystemState {
    return this.bankingSystem
  }

  public getAdvancedBanks(): AdvancedBank[] {
    return this.bankingSystem.banks
  }

  public getCreditProfile(): CreditProfile {
    return this.bankingSystem.creditProfile
  }

  public getEconomicFactors(): EconomicFactors {
    return this.bankingSystem.economicFactors
  }

  public getActiveLoans(): AdvancedLoan[] {
    return this.bankingSystem.activeLoans
  }

  public getLoanApplications(): LoanApplication[] {
    return this.bankingSystem.loanApplications
  }
} 