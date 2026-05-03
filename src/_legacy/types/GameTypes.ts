import { Property as PropertyClass } from '../objects/Property'

// Spieler Interface
export interface Player {
  money: number
  properties: PropertyClass[]
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

// Property Component System
export enum PropertyComponent {
  HEATING = 'heating',         // Heizung
  WINDOWS = 'windows',         // Fenster
  DOORS = 'doors',            // Türen
  WALLS = 'walls',            // Wände
  KITCHEN = 'kitchen',        // Küche
  FLOORING = 'flooring',      // Boden
  ELECTRICAL = 'electrical'   // Elektrik
}

export interface PropertyComponentState {
  component: PropertyComponent
  condition: number           // 0-100
  lastMaintenanceMonth: number
  decayRate: number          // Monatlicher Verschleiß
  maintenanceCost: number    // Kosten für Wartung
  replacementCost: number    // Kosten für kompletten Austausch
  impactOnRent: number       // Einfluss auf Miete (0-1)
  impactOnValue: number      // Einfluss auf Immobilienwert (0-1)
}

// Immobilien Interface
export interface Property {
  id: string
  name: string
  type: PropertyType
  price: number
  originalPrice: number // Ursprünglicher Kaufpreis
  monthlyRent: number
  condition: number // 0-100 (wird aus Komponenten berechnet)
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
  // Komponenten-System
  components: PropertyComponentState[] // Detaillierte Zustände der Komponenten
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
  priceMultiplier: number,
  crimeRate: number,
  safetyRating: number,
  educationLevel: number,
  healthCareQuality: number,
  publicTransport: number,
  greenSpace: number,
  culturalAttractions: number,
  jobMarket: number,
  incomeDistribution: number,
  populationDensity: number,
  propertyTaxRate: number,
  propertyTaxes: number,
  propertyTaxesPaid: number,
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
  availableProperties: PropertyClass[]
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
  // Neue Felder für Komponenten-System
  targetComponent?: PropertyComponent // Spezifische Komponente (falls null = alle)
  componentImprovement?: number // Verbesserung für spezifische Komponente
}

// Renovierungs-Typen
export enum RenovationType {
  BASIC_MAINTENANCE = 'basic_maintenance',     // €5.000, +10 Zustand, +5% Miete
  MODERNIZATION = 'modernization',             // €15.000, +25 Zustand, +15% Miete
  LUXURY_UPGRADE = 'luxury_upgrade',           // €35.000, +40 Zustand, +30% Miete
  ENERGY_EFFICIENCY = 'energy_efficiency',    // €20.000, +20 Zustand, +10% Miete, -20% Wartung
  // Komponenten-spezifische Renovierungen
  HEATING_REPAIR = 'heating_repair',           // €3.000, Heizung +30
  HEATING_REPLACEMENT = 'heating_replacement', // €8.000, Heizung +80
  WINDOW_REPAIR = 'window_repair',             // €2.500, Fenster +25
  WINDOW_REPLACEMENT = 'window_replacement',   // €6.000, Fenster +90
  DOOR_REPAIR = 'door_repair',                 // €1.500, Türen +30
  DOOR_REPLACEMENT = 'door_replacement',       // €4.000, Türen +85
  WALL_REPAIR = 'wall_repair',                 // €3.500, Wände +35
  WALL_RENOVATION = 'wall_renovation',         // €7.500, Wände +75
  KITCHEN_MODERNIZATION = 'kitchen_modernization', // €12.000, Küche +60
  KITCHEN_REPLACEMENT = 'kitchen_replacement', // €25.000, Küche +95
  FLOORING_REPAIR = 'flooring_repair',         // €2.000, Boden +25
  FLOORING_REPLACEMENT = 'flooring_replacement', // €8.000, Boden +85
  ELECTRICAL_REPAIR = 'electrical_repair',     // €4.000, Elektrik +40
  ELECTRICAL_MODERNIZATION = 'electrical_modernization' // €10.000, Elektrik +90
}

// ===== MEGA BANK SYSTEM =====

// Erweiterte Bank-Typen
export enum BankType {
  SPARKASSE = 'sparkasse',           // Konservativ, lokaler Service
  DEUTSCHE_BANK = 'deutsche_bank',   // Premium, große Kredite
  ONLINE_BANK = 'online_bank',       // Digital, niedrige Zinsen
  PRIVATE_BANK = 'private_bank',     // Exklusiv, VIP Service
  COOPERATIVE_BANK = 'cooperative_bank' // Regional, faire Konditionen
}

// Kreditarten
export enum LoanType {
  MORTGAGE = 'mortgage',           // Immobilienkredit (2-4%)
  RENOVATION = 'renovation',       // Renovierungskredit (3-6%)
  BRIDGE = 'bridge',              // Zwischenfinanzierung (8-12%)
  CONSTRUCTION = 'construction',   // Baukredit (3-5%)
  BUSINESS = 'business',          // Geschäftskredit (4-8%)
  REFINANCING = 'refinancing'     // Umschuldung (1-3%)
}

// Zinsarten
export enum InterestType {
  FIXED = 'fixed',                // Fest
  VARIABLE = 'variable',          // Variabel
  MIXED = 'mixed'                // Gemischt (5 Jahre fest, dann variabel)
}

// Bank-Beziehungsebenen
export enum BankRelationship {
  NEW = 'new',                    // 0% Rabatt
  REGULAR = 'regular',            // 0.1% Rabatt
  PREFERRED = 'preferred',        // 0.2% Rabatt
  PREMIUM = 'premium',            // 0.3% Rabatt
  VIP = 'vip'                    // 0.5% Rabatt + Sonderkonditionen
}

// Wirtschaftsfaktoren
export interface EconomicFactors {
  ecbRate: number                 // EZB-Zinssatz (0-5%)
  inflation: number               // Inflation (0-10%)
  unemployment: number            // Arbeitslosigkeit (3-15%)
  gdpGrowth: number              // BIP-Wachstum (-5% bis +8%)
  propertyMarketHealth: number    // Immobilienmarkt-Gesundheit (0-100)
}

// Kreditgeschichte-Eintrag
export interface CreditHistoryEntry {
  id: string
  loanId: string
  month: number
  year: number
  action: 'payment' | 'missed_payment' | 'early_payment' | 'default'
  amount: number
  impact: number                  // Impact auf Credit Score (-50 bis +5)
}

// Erweiterte Bank
export interface AdvancedBank {
  id: string
  name: string
  type: BankType
  description: string
  
  // Basis-Konditionen
  baseInterestRates: Map<LoanType, { min: number, max: number }>
  maxLoanAmounts: Map<LoanType, number>
  minCreditScore: number
  
  // Spezialisierungen
  specialties: LoanType[]         // Beste Konditionen für diese Kreditarten
  relationship: BankRelationship  // Spieler-Beziehungsebene
  totalLoansGiven: number         // Anzahl vergebener Kredite
  totalVolumeGiven: number        // Gesamtvolumen der Kredite
  
  // Features
  offersCreditInsurance: boolean
  offersFlexiblePayments: boolean
  offersEarlyRepayment: boolean
  digitalService: boolean
  personalAdvisor: boolean
  
  // Risiko-Assessment
  riskTolerance: number           // 1-10 (10 = sehr risikofreudig)
  approvalSpeed: number           // Tage bis zur Entscheidung
}

// Erweiterte Kredit-Informationen
export interface AdvancedLoan {
  id: string
  bankId: string
  type: LoanType
  
  // Kredit-Details
  amount: number
  originalAmount: number
  interestType: InterestType
  currentInterestRate: number
  originalInterestRate: number
  
  // Laufzeit
  totalMonths: number
  remainingMonths: number
  monthlyPayment: number
  
  // Sicherheiten
  propertyId?: string             // Immobilie als Sicherheit
  collateralValue: number         // Wert der Sicherheit
  loanToValueRatio: number        // Beleihungsauslauf (0-100%)
  
  // Versicherung
  hasCreditInsurance: boolean
  insuranceCost: number           // Monatliche Versicherungskosten
  
  // Payment-History
  paymentHistory: PaymentHistoryEntry[]
  missedPayments: number
  latePayments: number
  
  // Wirtschaftliche Faktoren
  economicFactorsAtOrigin: EconomicFactors
  
  // Status
  status: LoanStatus
  nextPaymentDue: Date
  totalPaid: number
  totalInterestPaid: number
}

export interface PaymentHistoryEntry {
  month: number
  year: number
  amountDue: number
  amountPaid: number
  daysPastDue: number
  status: 'on_time' | 'late' | 'missed' | 'partial'
}

export enum LoanStatus {
  ACTIVE = 'active',
  OVERDUE = 'overdue',
  DEFAULT = 'default',
  PAID_OFF = 'paid_off',
  FORECLOSURE = 'foreclosure'
}

// Kredit-Antrag
export interface LoanApplication {
  id: string
  bankId: string
  loanType: LoanType
  requestedAmount: number
  propertyId?: string
  
  // Finanzielle Situation
  monthlyIncome: number
  monthlyExpenses: number
  existingDebt: number
  assets: number
  
  // Kreditwürdigkeit
  creditScore: number
  employmentYears: number
  hasGuarantor: boolean
  
  // Status
  status: ApplicationStatus
  submissionDate: Date
  reviewDate?: Date
  decision?: LoanDecision
  
  // Angebotene Konditionen
  offeredAmount?: number
  offeredRate?: number
  offeredTerms?: number
  counterOfferCount: number
}

export enum ApplicationStatus {
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  COUNTER_OFFER = 'counter_offer'
}

export interface LoanDecision {
  approved: boolean
  amount: number
  interestRate: number
  termMonths: number
  conditions: string[]
  reason?: string
}

// Credit Score System
export interface CreditProfile {
  score: number                   // 300-850 (wie SCHUFA)
  history: CreditHistoryEntry[]
  
  // Score-Faktoren
  paymentHistory: number          // 35% - Zahlungshistorie
  creditUtilization: number       // 30% - Kreditausnutzung
  creditHistoryLength: number     // 15% - Länge der Kredithistorie
  creditMix: number              // 10% - Kredit-Mix
  newCredit: number              // 10% - Neue Kredite
  
  // Zusätzliche Faktoren
  totalDebt: number
  debtToIncomeRatio: number
  numberOfActiveLoans: number
  lastCreditCheck: Date
}

// Markt-Events
export enum MarketEventType {
  INTEREST_RATE_CHANGE = 'interest_rate_change',
  ECONOMIC_BOOM = 'economic_boom',
  RECESSION = 'recession',
  INFLATION_SPIKE = 'inflation_spike',
  BANK_MERGER = 'bank_merger',
  REGULATORY_CHANGE = 'regulatory_change',
  PROPERTY_BUBBLE = 'property_bubble'
}

export interface MarketEvent {
  id: string
  type: MarketEventType
  title: string
  description: string
  
  // Auswirkungen
  ecbRateChange?: number
  inflationChange?: number
  propertyMarketImpact?: number
  bankRiskToleranceChange?: number
  
  // Dauer
  startMonth: number
  endMonth: number
  intensity: number               // 0-100 (Stärke des Events)
  
  // Betroffene Banken
  affectedBanks?: string[]
  affectedLoanTypes?: LoanType[]
}

// Foreclosure (Zwangsversteigerung) System
export interface ForeclosureProcess {
  id: string
  propertyId: string
  loanId: string
  
  // Status
  stage: ForeclosureStage
  startDate: Date
  expectedAuctionDate: Date
  
  // Finanzen
  outstandingDebt: number
  legalCosts: number
  minimumBid: number
  marketValue: number
  
  // Optionen für Spieler
  canPayOff: boolean
  canNegotiate: boolean
  timeRemaining: number           // Tage bis zur Zwangsversteigerung
}

export enum ForeclosureStage {
  WARNING = 'warning',            // 30 Tage Mahnung
  NOTICE = 'notice',             // 60 Tage rechtliche Schritte
  PROCEEDINGS = 'proceedings',    // 90 Tage Verfahren läuft
  AUCTION = 'auction'            // Zwangsversteigerung
}

// Bank-Beratung und Services
export interface BankingService {
  id: string
  bankId: string
  name: string
  description: string
  cost: number
  benefit: string
  requirements: BankRelationship
  available: boolean
}

// Spezielle Bank-Angebote
export interface SpecialOffer {
  id: string
  bankId: string
  title: string
  description: string
  
  // Konditionen
  discountRate: number            // Zinssatz-Rabatt
  feeWaiver: boolean             // Gebührenerlass
  extendedTerms: boolean         // Längere Laufzeiten
  
  // Gültigkeit
  validUntil: Date
  usageLimit: number
  requiresLoyalty: BankRelationship
  
  // Bedingungen
  minAmount: number
  maxAmount: number
  applicableLoanTypes: LoanType[]
}

// Bank-System State
export interface BankingSystemState {
  banks: AdvancedBank[]
  economicFactors: EconomicFactors
  creditProfile: CreditProfile
  activeLoans: AdvancedLoan[]
  loanApplications: LoanApplication[]
  marketEvents: MarketEvent[]
  foreclosureProcesses: ForeclosureProcess[]
  specialOffers: SpecialOffer[]
  
  // Historische Daten
  monthlyEconomicHistory: EconomicFactors[]
  interestRateHistory: { month: number, year: number, ecbRate: number }[]
}

// Erweiterte GameState mit Bank-System
export interface ExtendedGameState extends GameState {
  bankingSystem: BankingSystemState
} 