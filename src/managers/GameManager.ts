import { Player, Property, Bank, GameState, PropertyType, Location, Tenant, Loan, GameTime, TimeSettings, TimeSpeed, MarketTrend, Renovation, RenovationType } from '../types/GameTypes'

export class GameManager {
  private static instance: GameManager
  private gameState!: GameState
  private eventCallbacks: Map<string, Function[]> = new Map()
  private timeInterval: NodeJS.Timeout | null = null

  private constructor() {
    // Versuche zuerst einen gespeicherten Spielstand zu laden
    if (!this.loadGame('autosave')) {
      // Falls kein Autosave vorhanden, neues Spiel starten
      this.gameState = this.initializeGameState()
    }
    this.startTimeSystem()
    
    // Automatisches Speichern alle 5 Minuten
    setInterval(() => this.autoSave(), 5 * 60 * 1000)
  }

  public static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager()
    }
    return GameManager.instance
  }

  private initializeGameState(): GameState {
    const player: Player = {
      money: 500000,
      properties: [],
      creditScore: 750,
      monthlyIncome: 3500,
      loans: []
    }

    const banks: Bank[] = [
      {
        id: 'sparkasse',
        name: 'Sparkasse',
        interestRate: 3.5,
        maxLoanAmount: 500000,
        minCreditScore: 650
      },
      {
        id: 'deutsche-bank',
        name: 'Deutsche Bank',
        interestRate: 3.2,
        maxLoanAmount: 800000,
        minCreditScore: 700
      },
      {
        id: 'volksbank',
        name: 'Volksbank',
        interestRate: 3.8,
        maxLoanAmount: 400000,
        minCreditScore: 600
      }
    ]

    const availableProperties: Property[] = this.generateInitialProperties()

    const gameTime: GameTime = {
      day: 1,
      month: 1,
      year: 2024,
      totalDays: 1
    }

    const timeSettings: TimeSettings = {
      speed: TimeSpeed.NORMAL,
      isPaused: false,
      dayDuration: 2000 // 2 Sekunden pro Tag standardmäßig
    }

    return {
      player,
      availableProperties,
      banks,
      gameTime,
      timeSettings
    }
  }

  private generateInitialProperties(): Property[] {
    const locations: Location[] = [
      { district: 'Mitte', desirability: 90, priceMultiplier: 1.5 },
      { district: 'Prenzlauer Berg', desirability: 85, priceMultiplier: 1.3 },
      { district: 'Kreuzberg', desirability: 80, priceMultiplier: 1.2 },
      { district: 'Charlottenburg', desirability: 75, priceMultiplier: 1.1 },
      { district: 'Wedding', desirability: 60, priceMultiplier: 0.8 },
      { district: 'Neukölln', desirability: 65, priceMultiplier: 0.9 }
    ]

    const properties: Property[] = []
    const propertyNames = [
      'Gemütliche 2-Zimmer Wohnung',
      'Moderne 3-Zimmer Wohnung',
      'Luxus Penthouse',
      'Einfamilienhaus mit Garten',
      'Bürogebäude',
      'Ladenlokal',
      'Altbau Wohnung',
      'Neubau Apartment'
    ]

    for (let i = 0; i < 20; i++) {
      const location = locations[Math.floor(Math.random() * locations.length)]
      const type = Object.values(PropertyType)[Math.floor(Math.random() * Object.values(PropertyType).length)]
      const basePrice = this.getBasePriceForType(type)
      const price = Math.round(basePrice * location.priceMultiplier * (0.8 + Math.random() * 0.4))
      const monthlyRent = Math.round(price * 0.004 * (0.8 + Math.random() * 0.4))

      const isRented = Math.random() > 0.3 // 70% chance of being rented
      let tenant: Tenant | undefined = undefined

      // If property is rented, create a tenant
      if (isRented) {
        tenant = {
          id: `tenant_initial_${i}`,
          name: this.generateRandomName(),
          reliability: 60 + Math.random() * 40,
          monthlyIncome: monthlyRent * (2 + Math.random() * 2),
          rentBudget: monthlyRent * (0.9 + Math.random() * 0.2)
        }
      }

      const currentYear = this.gameState?.gameTime?.year || 2024
      const buildYear = currentYear - Math.floor(Math.random() * 50) // 0-50 Jahre alt
      const condition = Math.max(20, 100 - (currentYear - buildYear) * 1.5 + Math.random() * 20)

      properties.push({
        id: `prop_${i}`,
        name: propertyNames[Math.floor(Math.random() * propertyNames.length)],
        type,
        price,
        originalPrice: price,
        monthlyRent,
        condition,
        location,
        isRented,
        tenant,
        maintenanceCost: Math.round(monthlyRent * 0.1),
        x: 0, // Wird dynamisch gesetzt
        y: 0, // Wird dynamisch gesetzt
        // Neue Felder
        lastRenovationMonth: 0,
        yearBuilt: buildYear,
        conditionDecayRate: 0.5 + Math.random() * 1.0, // 0.5-1.5% pro Monat
        appreciationRate: this.getBaseAppreciationRate(location, type),
        marketTrend: this.getRandomMarketTrend(),
        // Markt-Dynamik
        marketEntryMonth: 0, // Startet bei Monat 0
        marketLifetime: 1 + Math.floor(Math.random() * 6) // 1-6 Monate auf dem Markt
      })
    }

    return properties
  }

  private getBasePriceForType(type: PropertyType): number {
    switch (type) {
      case PropertyType.APARTMENT:
        return 200000
      case PropertyType.HOUSE:
        return 400000
      case PropertyType.COMMERCIAL:
        return 600000
      case PropertyType.OFFICE:
        return 800000
      default:
        return 200000
    }
  }

  private getBaseAppreciationRate(location: Location, type: PropertyType): number {
    // Basis-Wertsteigerung basierend auf Standort und Typ
    let baseRate = 2.0 // 2% pro Jahr als Basis
    
    // Standort-Bonus
    if (location.desirability > 80) baseRate += 1.5
    else if (location.desirability > 60) baseRate += 0.5
    else if (location.desirability < 40) baseRate -= 1.0
    
    // Typ-Bonus
    switch (type) {
      case PropertyType.COMMERCIAL:
        baseRate += 0.5
        break
      case PropertyType.OFFICE:
        baseRate += 1.0
        break
      case PropertyType.APARTMENT:
        baseRate += 0.2
        break
    }
    
    return Math.max(0.5, baseRate + (Math.random() - 0.5) * 2) // 0.5% bis 6% möglich
  }

  private getRandomMarketTrend(): MarketTrend {
    const rand = Math.random()
    if (rand < 0.1) return MarketTrend.DECLINING
    if (rand < 0.4) return MarketTrend.STABLE
    if (rand < 0.8) return MarketTrend.GROWING
    return MarketTrend.BOOMING
  }

  // Dynamisches Markt-System
  private generateNewProperty(currentMonth: number): Property {
    const locations: Location[] = [
      { district: 'Mitte', desirability: 90, priceMultiplier: 1.5 },
      { district: 'Prenzlauer Berg', desirability: 85, priceMultiplier: 1.3 },
      { district: 'Kreuzberg', desirability: 80, priceMultiplier: 1.2 },
      { district: 'Charlottenburg', desirability: 75, priceMultiplier: 1.1 },
      { district: 'Wedding', desirability: 60, priceMultiplier: 0.8 },
      { district: 'Neukölln', desirability: 65, priceMultiplier: 0.9 }
    ]

    const propertyNames = [
      'Gemütliche 2-Zimmer Wohnung',
      'Moderne 3-Zimmer Wohnung',
      'Luxus Penthouse',
      'Einfamilienhaus mit Garten',
      'Bürogebäude',
      'Ladenlokal',
      'Altbau Wohnung',
      'Neubau Apartment',
      'Loft im Industriegebiet',
      'Villa am Stadtrand',
      'Studentenwohnung',
      'Maisonette-Wohnung',
      'Dachgeschoss-Apartment',
      'Erdgeschoss mit Terrasse',
      'Renovierungsbedürftige Wohnung',
      'Luxus-Loft',
      'Familienhaus',
      'Gewerbeimmobilie',
      'Büroetage',
      'Laden mit Wohnung'
    ]

    const location = locations[Math.floor(Math.random() * locations.length)]
    const type = Object.values(PropertyType)[Math.floor(Math.random() * Object.values(PropertyType).length)]
    const basePrice = this.getBasePriceForType(type)
    const price = Math.round(basePrice * location.priceMultiplier * (0.8 + Math.random() * 0.4))
    const monthlyRent = Math.round(price * 0.004 * (0.8 + Math.random() * 0.4))

    const isRented = Math.random() > 0.4 // 60% chance of being rented
    let tenant: Tenant | undefined = undefined

    if (isRented) {
      tenant = {
        id: `tenant_new_${Date.now()}`,
        name: this.generateRandomName(),
        reliability: 60 + Math.random() * 40,
        monthlyIncome: monthlyRent * (2 + Math.random() * 2),
        rentBudget: monthlyRent * (0.9 + Math.random() * 0.2)
      }
    }

    const currentYear = this.gameState.gameTime.year
    const buildYear = currentYear - Math.floor(Math.random() * 60) // 0-60 Jahre alt
    const condition = Math.max(15, 100 - (currentYear - buildYear) * 1.2 + Math.random() * 25)

    return {
      id: `prop_new_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: propertyNames[Math.floor(Math.random() * propertyNames.length)],
      type,
      price,
      originalPrice: price,
      monthlyRent,
      condition,
      location,
      isRented,
      tenant,
      maintenanceCost: Math.round(monthlyRent * 0.1),
      x: 0,
      y: 0,
      lastRenovationMonth: 0,
      yearBuilt: buildYear,
      conditionDecayRate: 0.08 + Math.random() * 0.12, // Rebalanciert: 0.08-0.2% pro Monat
      appreciationRate: this.getBaseAppreciationRate(location, type),
      marketTrend: this.getRandomMarketTrend(),
      marketEntryMonth: currentMonth,
      marketLifetime: 1 + Math.floor(Math.random() * 6) // 1-6 Monate
    }
  }

  private updatePropertyMarket(): void {
    const currentMonth = this.gameState.gameTime.month + (this.gameState.gameTime.year - 2024) * 12
    
    console.log('=== PROPERTY MARKET UPDATE ===')
    console.log('Current month:', currentMonth)
    console.log('Available properties before:', this.gameState.availableProperties.length)

    // Alte Immobilien entfernen
    const removedProperties: Property[] = []
    this.gameState.availableProperties = this.gameState.availableProperties.filter(property => {
      const monthsOnMarket = currentMonth - property.marketEntryMonth
      const shouldRemove = monthsOnMarket >= property.marketLifetime
      
      if (shouldRemove) {
        removedProperties.push(property)
        console.log(`Removing property: ${property.name} (${monthsOnMarket} months on market, lifetime: ${property.marketLifetime})`)
      }
      
      return !shouldRemove
    })

    // Neue Immobilien hinzufügen
    const newPropertiesCount = Math.floor(Math.random() * 4) + 2 // 2-5 neue Immobilien
    const newProperties: Property[] = []
    
    for (let i = 0; i < newPropertiesCount; i++) {
      const newProperty = this.generateNewProperty(currentMonth)
      newProperties.push(newProperty)
      this.gameState.availableProperties.push(newProperty)
    }

    console.log(`Removed ${removedProperties.length} old properties`)
    console.log(`Added ${newProperties.length} new properties`)
    console.log('Available properties after:', this.gameState.availableProperties.length)
    console.log('=== END PROPERTY MARKET UPDATE ===')

    // Events emittieren
    if (removedProperties.length > 0) {
      this.emit('propertiesRemoved', { properties: removedProperties, count: removedProperties.length })
    }
    
    if (newProperties.length > 0) {
      this.emit('newPropertiesAdded', { properties: newProperties, count: newProperties.length })
    }
  }

  private shouldUpdateMarket(): boolean {
    // Markt-Update alle 1-3 Monate (zufällig)
    const currentMonth = this.gameState.gameTime.month + (this.gameState.gameTime.year - 2024) * 12
    
    // Speichere letztes Market-Update im GameState (falls nicht vorhanden)
    if (!this.gameState.lastMarketUpdate) {
      this.gameState.lastMarketUpdate = 0
    }
    
    const monthsSinceLastUpdate = currentMonth - this.gameState.lastMarketUpdate
    const shouldUpdate = monthsSinceLastUpdate >= (1 + Math.floor(Math.random() * 3)) // 1-3 Monate
    
    if (shouldUpdate) {
      this.gameState.lastMarketUpdate = currentMonth
    }
    
    return shouldUpdate
  }

  // Getter Methods
  public getPlayer(): Player {
    return this.gameState.player
  }

  public getAvailableProperties(): Property[] {
    return this.gameState.availableProperties
  }

  public getBanks(): Bank[] {
    return this.gameState.banks
  }

  public getCurrentMonth(): number {
    return this.gameState.gameTime.month
  }

  public getGameTime(): GameTime {
    return this.gameState.gameTime
  }

  public getTimeSettings(): TimeSettings {
    return this.gameState.timeSettings
  }

  public setTimeSpeed(speed: TimeSpeed): void {
    this.gameState.timeSettings.speed = speed
    this.gameState.timeSettings.isPaused = speed === TimeSpeed.PAUSED
    
    // Zeit-System neu starten mit neuer Geschwindigkeit
    this.pauseTimeSystem()
    if (speed !== TimeSpeed.PAUSED) {
      this.gameState.timeSettings.dayDuration = 2000 / speed // Basis: 2 Sekunden pro Tag
      this.resumeTimeSystem()
    }
    
    this.emit('timeSpeedChanged', { speed, isPaused: this.gameState.timeSettings.isPaused })
  }

  public togglePause(): void {
    if (this.gameState.timeSettings.isPaused) {
      this.setTimeSpeed(this.gameState.timeSettings.speed || TimeSpeed.NORMAL)
    } else {
      this.setTimeSpeed(TimeSpeed.PAUSED)
    }
  }

  public getFormattedDate(): string {
    const { day, month, year } = this.gameState.gameTime
    const monthNames = [
      'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ]
    return `${day}. ${monthNames[month - 1]} ${year}`
  }

  // Game Actions
  public buyProperty(propertyId: string): boolean {
    const property = this.gameState.availableProperties.find(p => p.id === propertyId)
    if (!property || this.gameState.player.money < property.price) {
      console.log('Cannot buy property:', !property ? 'Property not found' : 'Not enough money')
      console.log('Player money:', this.gameState.player.money)
      console.log('Property price:', property?.price)
      return false
    }

    console.log('=== BUYING PROPERTY ===')
    console.log('Property:', property.name)
    console.log('Price:', property.price)
    console.log('Money before:', this.gameState.player.money)

    this.gameState.player.money -= property.price
    this.gameState.player.properties.push(property)
    this.gameState.availableProperties = this.gameState.availableProperties.filter(p => p.id !== propertyId)
    
    console.log('Money after:', this.gameState.player.money)
    console.log('Properties owned:', this.gameState.player.properties.length)
    console.log('=== PROPERTY BOUGHT ===')
    
    this.emit('propertyBought', property)
    this.triggerAutoSave()
    return true
  }

  public sellProperty(propertyId: string): boolean {
    const propertyIndex = this.gameState.player.properties.findIndex(p => p.id === propertyId)
    if (propertyIndex === -1) return false

    const property = this.gameState.player.properties[propertyIndex]
    const sellPrice = Math.round(property.price * 0.9) // 10% Verlust beim Verkauf
    
    this.gameState.player.money += sellPrice
    this.gameState.player.properties.splice(propertyIndex, 1)
    
    // Immobilie wieder auf den Markt bringen
    property.price = sellPrice
    this.gameState.availableProperties.push(property)
    
    this.emit('propertySold', property)
    this.triggerAutoSave()
    return true
  }

  public findTenant(propertyId: string): Tenant | null {
    const property = this.gameState.player.properties.find(p => p.id === propertyId)
    if (!property || property.isRented) return null

    // Zufälligen Mieter generieren
    const tenant: Tenant = {
      id: `tenant_${Date.now()}`,
      name: this.generateRandomName(),
      reliability: 60 + Math.random() * 40,
      monthlyIncome: property.monthlyRent * (2 + Math.random() * 2),
      rentBudget: property.monthlyRent * (0.9 + Math.random() * 0.2)
    }

    return tenant
  }

  public rentToTenant(propertyId: string, tenant: Tenant): boolean {
    const property = this.gameState.player.properties.find(p => p.id === propertyId)
    if (!property || property.isRented) return false

    property.tenant = tenant
    property.isRented = true
    
    this.emit('propertyRented', { property, tenant })
    return true
  }

  public applyForLoan(bankId: string, amount: number, propertyId?: string): boolean {
    const bank = this.gameState.banks.find(b => b.id === bankId)
    if (!bank || amount > bank.maxLoanAmount || this.gameState.player.creditScore < bank.minCreditScore) {
      return false
    }

    const monthlyPayment = this.calculateMonthlyPayment(amount, bank.interestRate, 240) // 20 Jahre
    
    const loan: Loan = {
      id: `loan_${Date.now()}`,
      bankId,
      amount,
      interestRate: bank.interestRate,
      monthlyPayment,
      remainingMonths: 240,
      propertyId
    }

    this.gameState.player.loans.push(loan)
    this.gameState.player.money += amount
    
    this.emit('loanApproved', loan)
    return true
  }

  private calculateMonthlyPayment(principal: number, annualRate: number, months: number): number {
    const monthlyRate = annualRate / 100 / 12
    return Math.round((principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / 
                     (Math.pow(1 + monthlyRate, months) - 1))
  }

  public advanceDay(): void {
    this.gameState.gameTime.day++
    this.gameState.gameTime.totalDays++
    
    // Monat wechseln (30 Tage pro Monat)
    if (this.gameState.gameTime.day > 30) {
      this.gameState.gameTime.day = 1
      this.gameState.gameTime.month++
      
      // Jahr wechseln
      if (this.gameState.gameTime.month > 12) {
        this.gameState.gameTime.month = 1
        this.gameState.gameTime.year++
        this.emit('yearAdvanced', {
          year: this.gameState.gameTime.year
        })
      }
      
      this.processMonthlyEvents()
    }
    
    this.emit('dayAdvanced', {
      day: this.gameState.gameTime.day,
      month: this.gameState.gameTime.month,
      year: this.gameState.gameTime.year,
      totalDays: this.gameState.gameTime.totalDays
    })
  }

  private processMonthlyEvents(): void {
    console.log('=== MONTHLY EVENTS PROCESSING ===')
    console.log('Current money before:', this.gameState.player.money)
    
    // Immobilien-Updates (Zustand, Wertsteigerung)
    this.updatePropertyValues()
    
    // Markt-Update (neue/alte Immobilien)
    if (this.shouldUpdateMarket()) {
      this.updatePropertyMarket()
    }
    
    // Mieteinnahmen
    let monthlyIncome = 0
    this.gameState.player.properties.forEach(property => {
      console.log(`Property: ${property.name}`)
      console.log(`- Is rented: ${property.isRented}`)
      console.log(`- Has tenant: ${!!property.tenant}`)
      console.log(`- Monthly rent: €${property.monthlyRent}`)
      console.log(`- Maintenance cost: €${property.maintenanceCost}`)
      console.log(`- Current value: €${Math.round(property.price)}`)
      console.log(`- Condition: ${Math.round(property.condition)}%`)
      
      if (property.isRented && property.tenant) {
        monthlyIncome += property.monthlyRent
        // Wartungskosten abziehen
        monthlyIncome -= property.maintenanceCost
        console.log(`- Net income from this property: €${property.monthlyRent - property.maintenanceCost}`)
      } else {
        console.log(`- No income (not rented or no tenant)`)
      }
    })
    
    // Kreditraten abziehen
    let loanPayments = 0
    this.gameState.player.loans.forEach(loan => {
      loanPayments += loan.monthlyPayment
      loan.remainingMonths--
      console.log(`Loan payment: €${loan.monthlyPayment}`)
    })
    
    // Abgezahlte Kredite entfernen
    this.gameState.player.loans = this.gameState.player.loans.filter(loan => loan.remainingMonths > 0)
    
    console.log(`Total monthly income: €${monthlyIncome}`)
    console.log(`Total loan payments: €${loanPayments}`)
    console.log(`Net change: €${monthlyIncome - loanPayments}`)
    
    this.gameState.player.money += monthlyIncome - loanPayments
    
    console.log('Current money after:', this.gameState.player.money)
    console.log('=== END MONTHLY EVENTS ===')

    this.emit('monthAdvanced', {
      month: this.gameState.gameTime.month,
      year: this.gameState.gameTime.year,
      income: monthlyIncome,
      expenses: loanPayments,
      netChange: monthlyIncome - loanPayments
    })
  }

  private updatePropertyValues(): void {
    const currentMonth = this.gameState.gameTime.month + (this.gameState.gameTime.year - 2024) * 12
    
    // Alle Immobilien aktualisieren (eigene und verfügbare)
    const allProperties = [...this.gameState.player.properties, ...this.gameState.availableProperties]
    
    allProperties.forEach(property => {
      // Zustand verschlechtern
      this.degradePropertyCondition(property)
      
      // Wertsteigerung anwenden (nur monatlich)
      this.appreciatePropertyValue(property)
      
      // Miete an Zustand anpassen
      this.adjustRentBasedOnCondition(property)
    })
  }

  private degradePropertyCondition(property: Property): void {
    // Zustand verschlechtert sich jeden Monat
    const decay = property.conditionDecayRate
    
    // Zusätzlicher Verfall bei schlechter Wartung
    const maintenanceRatio = property.maintenanceCost / (property.monthlyRent || 1)
    const maintenanceBonus = maintenanceRatio > 0.15 ? 0.5 : 0 // Gute Wartung verlangsamt Verfall
    
    property.condition = Math.max(0, property.condition - (decay - maintenanceBonus))
    
    // Bei sehr schlechtem Zustand steigen Wartungskosten
    if (property.condition < 30) {
      property.maintenanceCost = Math.round(property.monthlyRent * 0.2)
    } else if (property.condition < 50) {
      property.maintenanceCost = Math.round(property.monthlyRent * 0.15)
    }
  }

  private appreciatePropertyValue(property: Property): void {
    // Monatliche Wertsteigerung basierend auf jährlicher Rate
    let monthlyRate = property.appreciationRate / 12 / 100
    
    // Markttrend-Modifikator
    switch (property.marketTrend) {
      case MarketTrend.DECLINING:
        monthlyRate *= 0.3 // 70% Reduktion
        break
      case MarketTrend.STABLE:
        monthlyRate *= 0.8 // 20% Reduktion
        break
      case MarketTrend.GROWING:
        monthlyRate *= 1.2 // 20% Bonus
        break
      case MarketTrend.BOOMING:
        monthlyRate *= 1.8 // 80% Bonus
        break
    }
    
    // Zustand beeinflusst Wertsteigerung
    const conditionFactor = Math.max(0.5, property.condition / 100)
    monthlyRate *= conditionFactor
    
    // Wertsteigerung anwenden
    property.price *= (1 + monthlyRate)
    
    // Markttrend gelegentlich ändern (5% Chance pro Monat)
    if (Math.random() < 0.05) {
      property.marketTrend = this.getRandomMarketTrend()
    }
  }

  private adjustRentBasedOnCondition(property: Property): void {
    // Miete basierend auf Zustand anpassen
    const baseRent = property.originalPrice * 0.004 // 0.4% des ursprünglichen Preises
    const conditionMultiplier = Math.max(0.6, property.condition / 100)
    const locationMultiplier = property.location.priceMultiplier
    
    property.monthlyRent = Math.round(baseRent * conditionMultiplier * locationMultiplier)
  }

  // Renovierungs-System
  public getRenovationOptions(propertyId: string): Renovation[] {
    const property = this.gameState.player.properties.find(p => p.id === propertyId)
    if (!property) return []

    const renovations: Renovation[] = [
      {
        id: 'basic_maintenance',
        name: 'Grundwartung',
        cost: Math.round(property.originalPrice * 0.025), // 2.5% des ursprünglichen Preises
        conditionImprovement: 15,
        rentIncrease: 5,
        duration: 7,
        description: 'Kleine Reparaturen und Auffrischung'
      },
      {
        id: 'modernization',
        name: 'Modernisierung',
        cost: Math.round(property.originalPrice * 0.075), // 7.5%
        conditionImprovement: 30,
        rentIncrease: 15,
        duration: 21,
        description: 'Neue Küche, Bad-Renovierung, moderne Ausstattung'
      },
      {
        id: 'luxury_upgrade',
        name: 'Luxus-Ausbau',
        cost: Math.round(property.originalPrice * 0.175), // 17.5%
        conditionImprovement: 50,
        rentIncrease: 35,
        duration: 45,
        description: 'Hochwertige Materialien, Designer-Ausstattung'
      },
      {
        id: 'energy_efficiency',
        name: 'Energetische Sanierung',
        cost: Math.round(property.originalPrice * 0.1), // 10%
        conditionImprovement: 25,
        rentIncrease: 12,
        duration: 30,
        description: 'Dämmung, neue Heizung, Solarpanels - reduziert Wartungskosten um 25%'
      }
    ]

    return renovations
  }

  public renovateProperty(propertyId: string, renovationId: string): boolean {
    const property = this.gameState.player.properties.find(p => p.id === propertyId)
    const renovation = this.getRenovationOptions(propertyId).find(r => r.id === renovationId)
    
    if (!property || !renovation || this.gameState.player.money < renovation.cost) {
      return false
    }

    // Kosten abziehen
    this.gameState.player.money -= renovation.cost

    // Verbesserungen anwenden
    property.condition = Math.min(100, property.condition + renovation.conditionImprovement)
    property.monthlyRent = Math.round(property.monthlyRent * (1 + renovation.rentIncrease / 100))
    property.lastRenovationMonth = this.gameState.gameTime.month + (this.gameState.gameTime.year - 2024) * 12

    // Spezielle Effekte
    if (renovationId === 'energy_efficiency') {
      property.maintenanceCost = Math.round(property.maintenanceCost * 0.75) // 25% Reduktion
      property.conditionDecayRate *= 0.8 // Langsamerer Verfall
    }

    this.emit('propertyRenovated', { property, renovation })
    this.triggerAutoSave()
    return true
  }

  // Für Rückwärtskompatibilität
  public advanceMonth(): void {
    this.advanceDay()
  }

  // Debug method to manually advance to next month
  public forceAdvanceToNextMonth(): void {
    console.log('=== FORCING ADVANCE TO NEXT MONTH ===')
    console.log('Current day:', this.gameState.gameTime.day)
    
    // Set day to 30 so next advance will trigger month change
    this.gameState.gameTime.day = 30
    this.advanceDay()
  }

  // Get days until next monthly income
  public getDaysUntilNextIncome(): number {
    return 30 - this.gameState.gameTime.day + 1
  }

  private generateRandomName(): string {
    const firstNames = ['Max', 'Anna', 'Peter', 'Lisa', 'Tom', 'Sarah', 'Mike', 'Julia']
    const lastNames = ['Müller', 'Schmidt', 'Weber', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Koch']
    
    return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`
  }

  // Event System
  public on(event: string, callback: Function): void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, [])
    }
    this.eventCallbacks.get(event)!.push(callback)
  }

  public emit(event: string, data?: any): void {
    const callbacks = this.eventCallbacks.get(event)
    if (callbacks) {
      callbacks.forEach(callback => callback(data))
    }
  }

  // Save/Load System
  public saveGame(slotName: string = 'autosave'): boolean {
    try {
      const saveData = {
        gameState: this.gameState,
        timestamp: Date.now(),
        version: '1.0',
        slotName
      }
      
      localStorage.setItem(`immolife_save_${slotName}`, JSON.stringify(saveData))
      console.log(`Spiel gespeichert in Slot: ${slotName}`)
      this.emit('gameSaved', { slotName, timestamp: saveData.timestamp })
      return true
    } catch (error) {
      console.error('Fehler beim Speichern des Spielstands:', error)
      return false
    }
  }

  public startNewGame(): void {
    console.log('=== STARTING NEW GAME ===')
    
    // Zeit-System pausieren
    this.pauseTimeSystem()
    
    // Neuen GameState erstellen
    this.gameState = this.initializeGameState()
    
    // Zeit-System neu starten
    this.startTimeSystem()
    
    // Events emittieren
    this.emit('newGameStarted', this.gameState)
    
    console.log('=== NEW GAME STARTED ===')
  }

  public loadGame(slotName: string = 'autosave'): boolean {
    try {
      const saveDataString = localStorage.getItem(`immolife_save_${slotName}`)
      if (!saveDataString) {
        console.log(`Kein Spielstand gefunden in Slot: ${slotName}`)
        return false
      }

      const saveData = JSON.parse(saveDataString)
      
      // Version check (für zukünftige Kompatibilität)
      if (saveData.version !== '1.0') {
        console.warn('Spielstand-Version nicht kompatibel')
        return false
      }

      // Zeit-System pausieren vor dem Laden
      this.pauseTimeSystem()
      
      this.gameState = saveData.gameState
      
      // Fehlende Felder in geladenen Properties ergänzen
      this.fixLoadedProperties()
      
      // Zeit-System mit neuen Einstellungen neu starten
      this.resumeTimeSystem()
      
      console.log(`Spiel geladen aus Slot: ${slotName}`)
      this.emit('gameLoaded', { slotName, gameState: this.gameState })
      return true
    } catch (error) {
      console.error('Fehler beim Laden des Spielstands:', error)
      return false
    }
  }

  private fixLoadedProperties(): void {
    // Alle Properties (verfügbare und eigene) reparieren
    const allProperties = [...this.gameState.availableProperties, ...this.gameState.player.properties]
    
    allProperties.forEach(property => {
      // Fehlende Felder ergänzen
      if (property.marketEntryMonth === undefined) {
        property.marketEntryMonth = 0
      }
      if (property.marketLifetime === undefined) {
        property.marketLifetime = 1 + Math.floor(Math.random() * 6)
      }
      if (property.originalPrice === undefined) {
        property.originalPrice = property.price
      }
      if (property.lastRenovationMonth === undefined) {
        property.lastRenovationMonth = 0
      }
      if (property.yearBuilt === undefined) {
        property.yearBuilt = 2024 - Math.floor(Math.random() * 50)
      }
      if (property.conditionDecayRate === undefined) {
        property.conditionDecayRate = 0.08 + Math.random() * 0.12
      }
      if (property.appreciationRate === undefined) {
        property.appreciationRate = this.getBaseAppreciationRate(property.location, property.type)
      }
      if (property.marketTrend === undefined) {
        property.marketTrend = this.getRandomMarketTrend()
      }
    })
    
    // lastMarketUpdate ergänzen falls nicht vorhanden
    if (this.gameState.lastMarketUpdate === undefined) {
      this.gameState.lastMarketUpdate = 0
    }
    
    console.log('Geladene Properties repariert')
  }

  public getSaveSlots(): Array<{name: string, timestamp: number, formattedDate: string}> {
    const slots: Array<{name: string, timestamp: number, formattedDate: string}> = []
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('immolife_save_')) {
        try {
          const saveData = JSON.parse(localStorage.getItem(key)!)
          const slotName = key.replace('immolife_save_', '')
          const date = new Date(saveData.timestamp)
          
          slots.push({
            name: slotName,
            timestamp: saveData.timestamp,
            formattedDate: date.toLocaleString('de-DE')
          })
        } catch (error) {
          console.warn(`Korrupter Spielstand: ${key}`)
        }
      }
    }
    
    return slots.sort((a, b) => b.timestamp - a.timestamp)
  }

  public deleteSave(slotName: string): boolean {
    try {
      localStorage.removeItem(`immolife_save_${slotName}`)
      console.log(`Spielstand gelöscht: ${slotName}`)
      this.emit('saveDeleted', { slotName })
      return true
    } catch (error) {
      console.error('Fehler beim Löschen des Spielstands:', error)
      return false
    }
  }

  public autoSave(): void {
    // Automatisches Speichern alle 5 Minuten
    this.saveGame('autosave')
  }

  public quickSave(): boolean {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
    return this.saveGame(`quicksave_${timestamp}`)
  }

  // Automatisches Speichern bei wichtigen Events
  private triggerAutoSave(): void {
    setTimeout(() => this.autoSave(), 1000) // 1 Sekunde Verzögerung
  }

  private startTimeSystem(): void {
    this.timeInterval = setInterval(() => {
      if (!this.gameState.timeSettings.isPaused) {
        this.advanceDay()
      }
    }, this.gameState.timeSettings.dayDuration)
  }

  public pauseTimeSystem(): void {
    if (this.timeInterval) {
      clearInterval(this.timeInterval)
      this.timeInterval = null
    }
  }

  public resumeTimeSystem(): void {
    if (!this.timeInterval) {
      this.startTimeSystem()
    }
  }
} 