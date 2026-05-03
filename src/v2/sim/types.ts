import type { BuildingKind } from '../render/BuildingRenderer'
import type { DistrictId } from '../render/CityRenderer'

export type PropertyType = BuildingKind  // alias — we use the renderer's typing throughout

export type TenantPersonality =
  | 'tidy'        // hohes Satisfaction-Boost durch Property-Pflege, keine Schaeden
  | 'partyer'    // hoeheres Einkommen, aber riskiert Kondition-Schaeden
  | 'quiet'      // sehr zuverlaessig, niedrige Forderungen
  | 'demanding'  // verlangt Top-Zustand, sehr unzufrieden bei Maengel
  | 'family'     // langfristig, stabil, mittelmaessige Reliability
  | 'student'    // billig, weniger zuverlaessig

export interface Tenant {
  id: string
  name: string
  occupation: string
  personality: TenantPersonality
  reliability: number       // 0-100 — chance to pay rent on time
  income: number            // monthly euros
  satisfaction: number      // 0-100 — drops if condition bad
  monthsRemaining: number   // months left on lease
  monthsBehind: number      // unpaid months
  agreedKaltMiete: number   // Kaltmiete — the part the player books as income
  agreedNebenkosten: number // Heizung/Wasser/Hausgeld; tenant pays on top, doesn't enter player's books
  deposit: number           // security deposit held
}

export interface Applicant {
  id: string
  name: string
  occupation: string
  personality: TenantPersonality
  reliability: number      // 0-100
  income: number           // monthly euros
  maxRentBudget: number    // what they're willing to pay
  preferredLeaseMonths: number  // 12 / 24 / 36
  blurb: string            // flavour text shown in UI
}

export type ListingState = 'forSale' | 'owned' | 'renting'

export interface Property {
  id: string
  type: PropertyType
  district: DistrictId
  tileX: number
  tileY: number
  styleSeed: number

  /** asking price OR purchase price after buy */
  price: number
  marketValue: number       // current market value (drifts with district trend)
  basePrice: number         // original generation baseline

  baseRent: number          // Kaltmiete at perfect condition (monthly)
  nebenkosten: number       // typical Nebenkosten for this unit (info only — paid by tenant on top)
  mietspiegelKalt: number   // local-comparable Kaltmiete (Mietpreisbremse reference)
  condition: number         // 0-100

  yearBuilt: number
  monthsOnMarket: number    // counts since put on market
  marketLifetimeMonths: number  // when this expires while forSale, it leaves

  state: ListingState
  tenant?: Tenant
  vacantMonths: number      // months without a tenant while owned

  loanId?: string
  ownedSince?: number       // gameMonth when bought
  lastRenovationMonth?: number
  seller?: SellerInfo      // who's selling (private or agent-listed)
  /** Per-month applicant search budget. Initialised lazily; reset on month change. */
  applicantSearches?: { month: number; remaining: number }
  /** Pending major repair (Steigstrang/Heizung/Dach etc.). Max 1 at a time per property. */
  pendingCapex?: CapexEvent
}

export interface Loan {
  id: string
  bankId: string
  propertyId: string
  principal: number             // remaining principal
  originalPrincipal: number
  monthlyRate: number           // monthly interest rate (annual / 12)
  monthlyPayment: number
  monthsRemaining: number
  totalMonths: number
  paymentsMissed: number
}

export interface Bank {
  id: string
  name: string
  annualRate: number          // base annual interest %
  maxLTV: number              // 0..1 — max loan-to-value
  minCreditScore: number
  origination: number         // 0..1 — fee on principal at origination
  blurb: string
  color: number
  /** Personality of the bank advisor — flavours dialogue and behavior */
  personality: BankPersonality
  advisorName: string
}

export type BankPersonality =
  | 'conservative'   // says no often, small concessions, polite
  | 'aggressive'     // pushes higher LTV, big concessions when you push, but penalizes bluffs
  | 'bureaucratic'   // slow, only by-the-book, but reliable concessions on fees
  | 'relationship'   // big bonuses if relation high, indifferent otherwise
  | 'digital'        // formula-based, always same response, little drama

export interface Player {
  cash: number
  creditScore: number       // 300..900
  reputation: number        // 0..100 — affects tenant attraction
  netWorthHistory: { month: number; netWorth: number }[]
  achievements: string[]
  negotiationSkill: number  // 0..100 — base skill, grows with practice
  bankRelations: Record<string, number>  // bankId -> relation score 0..100
  /** id of currently hired broker, or null */
  brokerId: string | null
}

export type BrokerSpecialty = 'residential' | 'commercial' | 'luxury' | 'budget'

export type BrokerPersonality =
  | 'charming'      // gets seller to drop more
  | 'pushy'         // big push but seller may walk
  | 'analytical'    // best on data-driven deals (high condition properties)
  | 'discreet'      // luxury bonus
  | 'enthusiastic' // small bonus, always positive

export interface Broker {
  id: string
  name: string
  title: string                    // displayed sub-line
  commissionPct: number            // % of final price (0.02 .. 0.05)
  negotiationBonus: number         // pp added to player's negotiation strength (5 .. 25)
  specialty: BrokerSpecialty       // gets +5 extra bonus when negotiating that type
  personality: BrokerPersonality
  blurb: string
  color: number
  catchphrase: string             // sample dialogue line
}

export type SellerPersona =
  | 'desperate'    // lowMin, accepts low quickly, makes big concessions
  | 'stubborn'     // high min, small concessions, easily insulted
  | 'greedy'       // very high min, only sells near asking
  | 'pragmatic'    // moderate min, fair concessions
  | 'rushed'       // moderate min but accepts faster (sells need to move)
  | 'sentimental'  // wants high price, takes offense easily, but if you appeal nicely, may yield

export type ListingChannel = 'private' | 'agent'

/** Either the seller themselves OR a listing agent represents the property */
export interface SellerInfo {
  channel: ListingChannel
  // Private seller details (always present — these are the "real" owner)
  ownerName: string
  ownerPersona: SellerPersona
  reason: string
  flavor: string
  // Agent details (only when channel === 'agent')
  agentName?: string
  agentPersonality?: BrokerPersonality   // reuse broker personality types
  agentBlurb?: string
  agentCommissionPct?: number  // paid by SELLER, doesn't affect player price; affects floor
}

export interface MarketState {
  /** -3 .. +3 — multiplier on price drift across the city */
  cycle: number
  /** months until next event roll */
  nextEventCheck: number
  /** active events */
  events: MarketEvent[]
  /** ECB-style rate, percent (affects new mortgages) */
  baseRate: number
}

export interface MarketEvent {
  id: string
  title: string
  body: string
  expiresMonth: number
  /** apply to a property; modifies price/rent in-place */
  apply: (p: Property) => void
  affects?: DistrictId | 'all'
}

export interface GameTime {
  day: number          // 1..30
  month: number        // 1..12
  year: number
  total: number        // total elapsed days
}

export interface Achievement {
  id: string
  title: string
  description: string
  test: (state: GameState) => boolean
}

export type CapexKind = 'elektrik' | 'fenster' | 'steigstrang' | 'fassade' | 'heizung' | 'dach'

export interface CapexEvent {
  id: string
  propertyId: string
  kind: CapexKind
  title: string
  body: string
  cost: number
  /** how much condition drops if the player ignores this until the deadline */
  conditionImpactIfIgnored: number
  /** how much condition GAINS if the player pays (counts as mini-renovation) */
  conditionGainIfPaid: number
  appearedMonth: number
  deadlineMonth: number
  state: 'pending' | 'paid' | 'expired'
}

export interface Lawsuit {
  id: string
  propertyId: string
  reason: 'rent-hike'        // future: 'eviction', 'damage'
  monthsRemaining: number
  totalMonths: number
  monthlyCost: number        // Anwaltskosten — drains every month while active
  totalSpent: number
  successChance: number      // 0..1 — player's chance to win
  /** if won, the new rent stays; if lost, rent reverts to this Kaltmiete */
  revertToKalt: number
  outcome: 'pending' | 'won' | 'lost'
}

export interface GameState {
  player: Player
  time: GameTime
  banks: Bank[]
  brokers: Broker[]
  market: MarketState
  listings: Property[]
  owned: Property[]
  loans: Loan[]
  lawsuits: Lawsuit[]
  capexHistory: CapexEvent[]
  rngSeed: number
}

export interface SellerNegotiationState {
  propertyId: string
  askingPrice: number          // original asking
  sellerMin: number            // hidden minimum the seller will accept
  currentSellerOffer: number   // most recent seller-side number
  rounds: number               // rounds used so far
  maxRounds: number            // total rounds allowed
  brokerHired: string | null
  done: boolean
  outcome: 'pending' | 'accepted' | 'rejected'
  messages: { from: 'seller' | 'broker' | 'player' | 'system'; text: string }[]
}

export interface BankOfferTerms {
  annualRate: number   // %
  ltv: number          // 0..1
  origination: number  // 0..1
}

export interface BankNegotiationState {
  bankId: string
  propertyId: string
  base: BankOfferTerms          // bank's original offer
  current: BankOfferTerms       // current best from bank
  rounds: number
  maxRounds: number
  bestPossible: BankOfferTerms  // hard floor
  done: boolean
  outcome: 'pending' | 'accepted' | 'rejected'
  messages: { from: 'bank' | 'player' | 'system'; text: string }[]
}

export const SPEEDS = [0, 1, 2, 4, 8] as const
export type Speed = (typeof SPEEDS)[number]
