import { Property as PropertyInterface, PropertyType, Location, Tenant, MarketTrend, RenovationType, Renovation, PropertyComponent, PropertyComponentState } from '../types/GameTypes'

/**
 * Property Class - Represents a real estate property in the game
 * Handles all property-related calculations, maintenance, tenant management, and market dynamics
 */
export class Property implements PropertyInterface {
  // Core Properties
  public id: string
  public name: string
  public type: PropertyType
  public price: number
  public originalPrice: number
  public monthlyRent: number
  public condition: number
  public location: Location
  public tenant: Tenant | undefined
  public isRented: boolean
  public maintenanceCost: number
  public x: number
  public y: number

  // Advanced Properties
  public lastRenovationMonth: number
  public yearBuilt: number
  public conditionDecayRate: number
  public appreciationRate: number
  public marketTrend: MarketTrend
  public marketEntryMonth: number
  public marketLifetime: number
  public components: PropertyComponentState[]

  // Calculated Properties (not saved)
  private _lastMaintenanceMonth: number = 0
  private _totalRentCollected: number = 0
  private _totalMaintenancePaid: number = 0

  constructor(data: PropertyInterface) {
    // Initialize all interface properties
    this.id = data.id
    this.name = data.name
    this.type = data.type
    this.price = data.price
    this.originalPrice = data.originalPrice
    this.monthlyRent = data.monthlyRent
    this.condition = data.condition
    this.location = data.location
    this.tenant = data.tenant
    this.isRented = data.isRented
    this.maintenanceCost = data.maintenanceCost
    this.x = data.x
    this.y = data.y
    this.lastRenovationMonth = data.lastRenovationMonth
    this.yearBuilt = data.yearBuilt
    this.conditionDecayRate = data.conditionDecayRate
    this.appreciationRate = data.appreciationRate
    this.marketTrend = data.marketTrend
    this.marketEntryMonth = data.marketEntryMonth
    this.marketLifetime = data.marketLifetime
    this.components = data.components || this.initializeDefaultComponents()
  }

  // ===== COMPONENT SYSTEM =====

  /**
   * Initialize default component states for a new property
   */
  private initializeDefaultComponents(): PropertyComponentState[] {
    const baseCondition = this.condition || 70 // Fallback if condition not set
    const components: PropertyComponentState[] = []

    // Define component weights and characteristics
    const componentData = [
      { component: PropertyComponent.HEATING, weight: 0.20, maintenanceCost: 150, replacementCost: 8000, rentImpact: 0.15, valueImpact: 0.18 },
      { component: PropertyComponent.WINDOWS, weight: 0.15, maintenanceCost: 80, replacementCost: 6000, rentImpact: 0.12, valueImpact: 0.15 },
      { component: PropertyComponent.DOORS, weight: 0.10, maintenanceCost: 50, replacementCost: 4000, rentImpact: 0.08, valueImpact: 0.10 },
      { component: PropertyComponent.WALLS, weight: 0.15, maintenanceCost: 100, replacementCost: 7500, rentImpact: 0.10, valueImpact: 0.12 },
      { component: PropertyComponent.KITCHEN, weight: 0.20, maintenanceCost: 120, replacementCost: 25000, rentImpact: 0.25, valueImpact: 0.20 },
      { component: PropertyComponent.FLOORING, weight: 0.12, maintenanceCost: 70, replacementCost: 8000, rentImpact: 0.15, valueImpact: 0.15 },
      { component: PropertyComponent.ELECTRICAL, weight: 0.08, maintenanceCost: 90, replacementCost: 10000, rentImpact: 0.10, valueImpact: 0.10 }
    ]

    for (const data of componentData) {
      // Add some randomness to initial condition (+/- 15%)
      const variation = (Math.random() - 0.5) * 30
      const componentCondition = Math.max(20, Math.min(100, baseCondition + variation))

      components.push({
        component: data.component,
        condition: componentCondition,
        lastMaintenanceMonth: this.lastRenovationMonth,
        decayRate: this.calculateDecayRate(data.component),
        maintenanceCost: data.maintenanceCost,
        replacementCost: data.replacementCost,
        impactOnRent: data.rentImpact,
        impactOnValue: data.valueImpact
      })
    }

    return components
  }

  /**
   * Calculate decay rate for specific component based on property age and type
   */
  private calculateDecayRate(component: PropertyComponent): number {
    const baseDecay = {
      [PropertyComponent.HEATING]: 0.8,
      [PropertyComponent.WINDOWS]: 0.3,
      [PropertyComponent.DOORS]: 0.2,
      [PropertyComponent.WALLS]: 0.4,
      [PropertyComponent.KITCHEN]: 0.6,
      [PropertyComponent.FLOORING]: 0.5,
      [PropertyComponent.ELECTRICAL]: 0.7
    }

    const age = this.getAge()
    const ageMultiplier = 1 + (age / 100) // Older properties decay faster
    
    return baseDecay[component] * ageMultiplier
  }

  /**
   * Calculate overall property condition from components
   */
  public calculateOverallCondition(): number {
    if (!this.components || this.components.length === 0) {
      return this.condition // Fallback to existing condition
    }

    const weights = {
      [PropertyComponent.HEATING]: 0.20,
      [PropertyComponent.WINDOWS]: 0.15,
      [PropertyComponent.DOORS]: 0.10,
      [PropertyComponent.WALLS]: 0.15,
      [PropertyComponent.KITCHEN]: 0.20,
      [PropertyComponent.FLOORING]: 0.12,
      [PropertyComponent.ELECTRICAL]: 0.08
    }

    let weightedSum = 0
    let totalWeight = 0

    for (const component of this.components) {
      const weight = weights[component.component] || 0.1
      weightedSum += component.condition * weight
      totalWeight += weight
    }

    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : this.condition
  }

  /**
   * Update all component conditions based on time passage
   */
  public updateComponentConditions(currentMonth: number): void {
    for (const component of this.components) {
      const monthsSinceUpdate = currentMonth - component.lastMaintenanceMonth
      if (monthsSinceUpdate > 0) {
        const decay = component.decayRate * monthsSinceUpdate
        component.condition = Math.max(0, component.condition - decay)
      }
    }

    // Update overall condition
    this.condition = this.calculateOverallCondition()
  }

  /**
   * Perform maintenance on a specific component
   */
  public maintainComponent(component: PropertyComponent, level: 'basic' | 'thorough' = 'basic'): number {
    const componentState = this.components.find(c => c.component === component)
    if (!componentState) return 0

    const multiplier = level === 'thorough' ? 1.5 : 1.0
    const cost = componentState.maintenanceCost * multiplier
    const improvement = level === 'thorough' ? 15 : 8

    componentState.condition = Math.min(100, componentState.condition + improvement)
    componentState.lastMaintenanceMonth = new Date().getMonth()
    
    // Update overall condition
    this.condition = this.calculateOverallCondition()
    this._totalMaintenancePaid += cost

    return cost
  }

  /**
   * Replace/renovate a specific component
   */
  public renovateComponent(component: PropertyComponent, currentMonth: number): number {
    const componentState = this.components.find(c => c.component === component)
    if (!componentState) return 0

    const cost = componentState.replacementCost
    componentState.condition = 95 // Nearly perfect after replacement
    componentState.lastMaintenanceMonth = currentMonth

    // Update overall condition and rent based on component impact
    this.condition = this.calculateOverallCondition()
    this.monthlyRent = Math.round(this.monthlyRent * (1 + componentState.impactOnRent * 0.1))
    
    this.lastRenovationMonth = currentMonth
    this._totalMaintenancePaid += cost

    return cost
  }

  /**
   * Get component that needs most urgent attention
   */
  public getMostUrgentComponent(): { component: PropertyComponent, condition: number, estimatedCost: number } | null {
    if (!this.components || this.components.length === 0) return null

    let worstComponent = this.components[0]
    for (const component of this.components) {
      if (component.condition < worstComponent.condition) {
        worstComponent = component
      }
    }

    if (worstComponent.condition > 30) return null // Not urgent if above 30%

    return {
      component: worstComponent.component,
      condition: worstComponent.condition,
      estimatedCost: worstComponent.condition < 15 ? worstComponent.replacementCost : worstComponent.maintenanceCost
    }
  }

  // ===== MARKET VALUE CALCULATIONS =====

  /**
   * Calculate current market value based on condition, location, and market trends
   */
  public getCurrentMarketValue(): number {
    let value = this.originalPrice
    
    // Apply appreciation over time
    const monthsOwned = this.getMonthsOwned()
    const yearlyAppreciation = 1 + (this.appreciationRate / 100)
    value *= Math.pow(yearlyAppreciation, monthsOwned / 12)
    
    // Apply condition factor (linear scaling from 50% to 120%)
    const conditionMultiplier = 0.5 + (this.condition / 100) * 0.7
    value *= conditionMultiplier
    
    // Apply location desirability
    value *= this.location.priceMultiplier
    
    // Apply market trend
    value *= this.getMarketTrendMultiplier()
    
    return Math.round(value)
  }

  /**
   * Get estimated rental value based on current market conditions
   */
  public getEstimatedRentalValue(): number {
    const baseRent = this.monthlyRent
    
    // Adjust for condition (between 70% and 130%)
    const conditionFactor = 0.7 + (this.condition / 100) * 0.6
    
    // Adjust for location desirability
    const locationFactor = this.location.priceMultiplier
    
    // Market trend affects rental prices too
    const marketFactor = this.getMarketTrendMultiplier()
    
    return Math.round(baseRent * conditionFactor * locationFactor * marketFactor)
  }

  // ===== CONDITION & MAINTENANCE =====

  /**
   * Update property condition based on time passage and maintenance
   */
  public updateCondition(currentMonth: number): void {
    // Use new component system if available
    if (this.components && this.components.length > 0) {
      this.updateComponentConditions(currentMonth)
    } else {
      // Fallback to old system
      const monthsSinceLastUpdate = currentMonth - this._lastMaintenanceMonth
      if (monthsSinceLastUpdate <= 0) return

      // Natural decay
      const decay = this.conditionDecayRate * monthsSinceLastUpdate
      this.condition = Math.max(0, this.condition - decay)
    }
    
    this._lastMaintenanceMonth = currentMonth
  }

  /**
   * Perform maintenance on the property
   */
  public performMaintenance(maintenanceLevel: 'basic' | 'thorough' | 'professional'): number {
    const costs = {
      basic: this.maintenanceCost * 0.8,
      thorough: this.maintenanceCost * 1.2,
      professional: this.maintenanceCost * 2.0
    }
    
    const improvements = {
      basic: 5,
      thorough: 12,
      professional: 25
    }

    const cost = costs[maintenanceLevel]
    const improvement = improvements[maintenanceLevel]
    
    this.condition = Math.min(100, this.condition + improvement)
    this._totalMaintenancePaid += cost
    
    return cost
  }

  /**
   * Renovate the property
   */
  public renovate(renovation: Renovation, currentMonth: number): number {
    this.condition = Math.min(100, this.condition + renovation.conditionImprovement)
    this.monthlyRent = Math.round(this.monthlyRent * (1 + renovation.rentIncrease / 100))
    this.lastRenovationMonth = currentMonth
    this._totalMaintenancePaid += renovation.cost
    
    return renovation.cost
  }

  // ===== TENANT MANAGEMENT =====

  /**
   * Add a tenant to the property
   */
  public addTenant(tenant: Tenant): boolean {
    if (this.isRented || this.condition < 30) {
      return false // Cannot rent in poor condition
    }
    
    this.tenant = tenant
    this.isRented = true
    return true
  }

  /**
   * Remove tenant from property
   */
  public removeTenant(): void {
    this.tenant = undefined
    this.isRented = false
  }

  /**
   * Collect monthly rent (returns actual amount collected)
   */
  public collectRent(): number {
    if (!this.tenant || !this.isRented) return 0
    
    const actualRent = this.getEstimatedRentalValue()
    
    // Factor in tenant reliability
    const reliabilityFactor = this.tenant.reliability / 100
    const chanceOfPayment = Math.random() < reliabilityFactor
    
    if (chanceOfPayment) {
      this._totalRentCollected += actualRent
      return actualRent
    }
    
    return 0 // Tenant didn't pay
  }

  // ===== INVESTMENT CALCULATIONS =====

  /**
   * Calculate return on investment (ROI) percentage
   */
  public getROI(): number {
    if (this.originalPrice === 0) return 0
    
    const totalIncome = this._totalRentCollected
    const totalCosts = this.originalPrice + this._totalMaintenancePaid
    const currentValue = this.getCurrentMarketValue()
    
    const totalReturn = totalIncome + currentValue - totalCosts
    return (totalReturn / this.originalPrice) * 100
  }

  /**
   * Calculate annual rental yield
   */
  public getRentalYield(): number {
    const annualRent = this.getEstimatedRentalValue() * 12
    const currentValue = this.getCurrentMarketValue()
    
    return (annualRent / currentValue) * 100
  }

  /**
   * Calculate cash flow (monthly)
   */
  public getMonthlyCashFlow(): number {
    const rental = this.isRented ? this.getEstimatedRentalValue() : 0
    const maintenance = this.maintenanceCost
    
    return rental - maintenance
  }

  // ===== MARKET ANALYSIS =====

  /**
   * Get property investment grade (A+ to F)
   */
  public getInvestmentGrade(): string {
    const roi = this.getROI()
    const yield_ = this.getRentalYield()
    const condition = this.condition
    const location = this.location.desirability
    
    // Weighted score
    const score = (roi * 0.3) + (yield_ * 0.3) + (condition * 0.2) + (location * 0.2)
    
    if (score >= 80) return 'A+'
    if (score >= 70) return 'A'
    if (score >= 60) return 'B+'
    if (score >= 50) return 'B'
    if (score >= 40) return 'C'
    if (score >= 30) return 'D'
    return 'F'
  }

  /**
   * Check if property needs urgent attention
   */
  public needsUrgentAttention(): { urgent: boolean, reasons: string[] } {
    const reasons: string[] = []
    
    if (this.condition < 20) reasons.push('Condition critically low')
    if (this.tenant && this.tenant.reliability < 30) reasons.push('Unreliable tenant')
    if (this.getMonthlyCashFlow() < 0) reasons.push('Negative cash flow')
    if (this.getAge() > 50 && this.condition < 60) reasons.push('Old property needs renovation')
    
    return {
      urgent: reasons.length > 0,
      reasons
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Get property age in years
   */
  public getAge(): number {
    const currentYear = new Date().getFullYear()
    return currentYear - this.yearBuilt
  }

  /**
   * Get months owned (since original purchase)
   */
  private getMonthsOwned(): number {
    const currentMonth = new Date().getMonth() + (new Date().getFullYear() * 12)
    const purchaseMonth = this.marketEntryMonth
    return Math.max(0, currentMonth - purchaseMonth)
  }

  /**
   * Get market trend multiplier
   */
  private getMarketTrendMultiplier(): number {
    switch (this.marketTrend) {
      case MarketTrend.DECLINING: return 0.90
      case MarketTrend.STABLE: return 1.00
      case MarketTrend.GROWING: return 1.10
      case MarketTrend.BOOMING: return 1.25
      default: return 1.00
    }
  }

  /**
   * Get property summary for UI display
   */
  public getSummary() {
    const urgentComponent = this.getMostUrgentComponent()
    
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      currentValue: this.getCurrentMarketValue(),
      monthlyRent: this.getEstimatedRentalValue(),
      condition: this.condition,
      location: this.location.district,
      isRented: this.isRented,
      tenantName: this.tenant?.name || null,
      cashFlow: this.getMonthlyCashFlow(),
      roi: this.getROI(),
      grade: this.getInvestmentGrade(),
      needsAttention: this.needsUrgentAttention(),
      components: this.components.map(c => ({
        component: c.component,
        condition: c.condition,
        needsMaintenance: c.condition < 50,
        needsReplacement: c.condition < 20
      })),
      urgentComponent: urgentComponent
    }
  }

  /**
   * Serialize property to interface format for saving
   */
  public toInterface(): PropertyInterface {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      price: this.price,
      originalPrice: this.originalPrice,
      monthlyRent: this.monthlyRent,
      condition: this.condition,
      location: this.location,
      tenant: this.tenant,
      isRented: this.isRented,
      maintenanceCost: this.maintenanceCost,
      x: this.x,
      y: this.y,
      lastRenovationMonth: this.lastRenovationMonth,
      yearBuilt: this.yearBuilt,
      conditionDecayRate: this.conditionDecayRate,
      appreciationRate: this.appreciationRate,
      marketTrend: this.marketTrend,
      marketEntryMonth: this.marketEntryMonth,
      marketLifetime: this.marketLifetime,
      components: this.components
    }
  }

  /**
   * Create Property instance from interface data
   */
  public static fromInterface(data: PropertyInterface): Property {
    return new Property(data)
  }
}
