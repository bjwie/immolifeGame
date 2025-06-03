// Spieler Interface
export interface Player {
  money: number
  properties: Property[]
  creditScore: number
  monthlyIncome: number
  loans: Loan[]
}

// Zeit-System Interface
export interface GameTime {
  day: number
  month: number
  year: number
  totalDays: number
}

export interface TimeSettings {
  speed: number // 1 = normal, 2 = doppelt, 0.5 = halb, etc.
  isPaused: boolean
  dayDuration: number // Millisekunden pro Spieltag
}

export enum TimeSpeed {
  PAUSED = 0,
  SLOW = 0.5,
  NORMAL = 1,
  FAST = 2,
  VERY_FAST = 4,
  ULTRA_FAST = 8
}

// Immobilien Interface
export interface Property {
  id: string
  name: string
  type: PropertyType
  price: number
  originalPrice: number // Ursprünglicher Kaufpreis
  monthlyRent: number
  condition: number // 0-100
  location: Location
  tenant?: Tenant
  isRented: boolean
  maintenanceCost: number
  x: number
  y: number
  // Neue Felder für Wertsteigerung und Zustand
  lastRenovationMonth: number // Monat der letzten Renovierung
  yearBuilt: number // Baujahr
  conditionDecayRate: number // Wie schnell der Zustand abnimmt (pro Monat)
  appreciationRate: number // Jährliche Wertsteigerung in %
  marketTrend: MarketTrend // Aktueller Markttrend
  // Markt-Dynamik
  marketEntryMonth: number // Monat, in dem die Immobilie auf den Markt kam
  marketLifetime: number // Wie lange die Immobilie auf dem Markt bleibt (in Monaten)
}

// Immobilientypen
export enum PropertyType {
  APARTMENT = 'apartment',
  HOUSE = 'house',
  COMMERCIAL = 'commercial',
  OFFICE = 'office'
}

// Standort Interface
export interface Location {
  district: string
  desirability: number // 0-100
  priceMultiplier: number
}

// Mieter Interface
export interface Tenant {
  id: string
  name: string
  reliability: number // 0-100
  monthlyIncome: number
  rentBudget: number
}

// Bank Interface
export interface Bank {
  id: string
  name: string
  interestRate: number
  maxLoanAmount: number
  minCreditScore: number
}

// Kredit Interface
export interface Loan {
  id: string
  bankId: string
  amount: number
  interestRate: number
  monthlyPayment: number
  remainingMonths: number
  propertyId?: string
}

// Verhandlungs Interface
export interface Negotiation {
  id: string
  type: NegotiationType
  originalOffer: number
  counterOffer: number
  status: NegotiationStatus
  rounds: number
  maxRounds: number
}

export enum NegotiationType {
  PROPERTY_PURCHASE = 'property_purchase',
  RENT_AGREEMENT = 'rent_agreement',
  LOAN_APPLICATION = 'loan_application'
}

export enum NegotiationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  COUNTER_OFFERED = 'counter_offered'
}

// Game State Interface
export interface GameState {
  player: Player
  availableProperties: Property[]
  banks: Bank[]
  gameTime: GameTime
  timeSettings: TimeSettings
  lastMarketUpdate?: number // Monat des letzten Markt-Updates
}

// Event Interface für Spielereignisse
export interface GameEvent {
  id: string
  type: GameEventType
  title: string
  description: string
  choices: EventChoice[]
}

export enum GameEventType {
  MARKET_CRASH = 'market_crash',
  PROPERTY_DAMAGE = 'property_damage',
  TENANT_ISSUE = 'tenant_issue',
  OPPORTUNITY = 'opportunity'
}

export interface EventChoice {
  id: string
  text: string
  consequences: {
    money?: number
    creditScore?: number
    propertyCondition?: number
  }
}

// Markttrends
export enum MarketTrend {
  DECLINING = 'declining',     // -2% bis -5% pro Jahr
  STABLE = 'stable',          // -1% bis +2% pro Jahr  
  GROWING = 'growing',        // +2% bis +5% pro Jahr
  BOOMING = 'booming'         // +5% bis +10% pro Jahr
}

// Renovierungs-Interface
export interface Renovation {
  id: string
  name: string
  cost: number
  conditionImprovement: number // Wie viel der Zustand verbessert wird
  rentIncrease: number // Prozentuale Mieterhöhung
  duration: number // Dauer in Tagen
  description: string
}

// Renovierungs-Typen
export enum RenovationType {
  BASIC_MAINTENANCE = 'basic_maintenance',     // €5.000, +10 Zustand, +5% Miete
  MODERNIZATION = 'modernization',             // €15.000, +25 Zustand, +15% Miete
  LUXURY_UPGRADE = 'luxury_upgrade',           // €35.000, +40 Zustand, +30% Miete
  ENERGY_EFFICIENCY = 'energy_efficiency'     // €20.000, +20 Zustand, +10% Miete, -20% Wartung
} 