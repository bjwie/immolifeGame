import { GameManager } from './GameManager'
import { BankManager } from './BankManager'

/**
 * Bank-System Integration für GameManager
 * Delegiert alle Bank-Operationen an den separaten BankManager
 */
export class GameManagerBankAdapter {
  private gameManager: GameManager
  private bankManager: BankManager

  constructor(gameManager: GameManager) {
    this.gameManager = gameManager
    this.bankManager = new BankManager(gameManager.getGameTime().totalDays)
    
    // Events weiterleiten
    this.bankManager.on('loanApplicationProcessed', (data: any) => {
      gameManager.emit('loanApplicationProcessed', data)
    })
  }

  // ===== DELEGATION METHODS =====

  public getAdvancedBanks() {
    return this.bankManager.getAdvancedBanks()
  }

  public getCreditProfile() {
    return this.bankManager.getCreditProfile()
  }

  public getEconomicFactors() {
    return this.bankManager.getEconomicFactors()
  }

  public getActiveLoans() {
    return this.bankManager.getActiveLoans()
  }

  public getLoanApplications() {
    return this.bankManager.getLoanApplications()
  }

  public submitLoanApplication(bankId: string, loanType: any, amount: number, propertyId?: string) {
    return this.bankManager.submitLoanApplication(bankId, loanType, amount, propertyId)
  }

  public acceptLoanOffer(applicationId: string) {
    return this.bankManager.acceptLoanOffer(applicationId)
  }

  public calculateDebtToIncomeRatio(additionalLoanPayment: number = 0) {
    return this.bankManager.calculateDebtToIncomeRatio(this.gameManager.getPlayer(), additionalLoanPayment)
  }

  public calculateMaxLoanAmount(loanType: any, bankId: string, termMonths: number = 240) {
    return this.bankManager.calculateMaxLoanAmount(this.gameManager.getPlayer(), loanType, bankId, termMonths)
  }

  // ===== INCOME ANALYSIS METHODS =====

  /**
   * Erweiterte Einkommens-vs-Kredit Analyse für UI
   */
  public getAffordabilityAnalysis(requestedAmount: number, bankId: string, loanType: any) {
    const player = this.gameManager.getPlayer()
    const bank = this.bankManager.getAdvancedBanks().find(b => b.id === bankId)
    
    if (!bank) {
      return {
        canAfford: false,
        reason: 'Bank nicht gefunden',
        monthlyIncome: 0,
        maxAffordableAmount: 0,
        recommendedAmount: 0,
        dtiRatio: 0,
        monthlyPayment: 0
      }
    }

    const maxLoanInfo = this.bankManager.calculateMaxLoanAmount(player, loanType, bankId)
    const creditScore = this.bankManager.getCreditProfile().score
    
    // Zinssatz schätzen (vereinfacht)
    const rateRange = bank.baseInterestRates.get(loanType)
    const estimatedRate = rateRange ? (rateRange.min + rateRange.max) / 2 : 4.0
    const monthlyPayment = this.calculateMonthlyPayment(requestedAmount, estimatedRate, 240)
    
    const dtiAnalysis = this.bankManager.calculateDebtToIncomeRatio(player, monthlyPayment)
    
    return {
      canAfford: dtiAnalysis.canAffordLoan && requestedAmount <= maxLoanInfo.maxAmount,
      reason: dtiAnalysis.canAffordLoan ? 'Finanzierbar' : 'Einkommen zu niedrig',
      monthlyIncome: dtiAnalysis.monthlyIncome,
      maxAffordableAmount: maxLoanInfo.maxAmount,
      recommendedAmount: maxLoanInfo.recommendedAmount,
      dtiRatio: dtiAnalysis.dtiRatio,
      monthlyPayment: monthlyPayment,
      reasoning: maxLoanInfo.reasoning
    }
  }

  /**
   * Hilfsmethode für monatliche Zahlungsberechnung
   */
  private calculateMonthlyPayment(principal: number, annualRate: number, months: number): number {
    const monthlyRate = annualRate / 100 / 12
    if (monthlyRate === 0) return principal / months
    
    return (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / 
           (Math.pow(1 + monthlyRate, months) - 1)
  }

  /**
   * Update-Methode für monatliche Events
   */
  public updateMonthly() {
    // Hier könnten Bank-spezifische monatliche Updates stehen
    // z.B. Credit Score Updates, Zinssatz-Änderungen, etc.
  }
} 