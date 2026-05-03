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
  | 'nomad'      // Mietnomade — zahlt NIE, ignoriert Kuendigung, nur per Raeumungsklage entfernbar

export interface Tenant {
  id: string
  name: string
  occupation: string
  personality: TenantPersonality
  /** What the UI shows. For 'nomad', this is set to a benign persona until the
   *  cover blows (3+ months without payment). */
  disguisePersonality?: TenantPersonality
  reliability: number       // 0-100 — chance to pay rent on time
  income: number            // monthly euros
  satisfaction: number      // 0-100 — drops if condition bad
  monthsRemaining: number   // months left on lease
  monthsBehind: number      // unpaid months
  agreedKaltMiete: number   // Kaltmiete — the part the player books as income
  agreedNebenkosten: number // Heizung/Wasser/Hausgeld; tenant pays on top, doesn't enter player's books
  deposit: number           // security deposit held
  /** Game-month of the last successful rent hike. Used by raiseRent for the
   *  Kappungsgrenze (12-month cooldown per tenant). */
  lastRentHikeMonth?: number
}

export interface Applicant {
  id: string
  name: string
  occupation: string
  /** Visible persona shown in the applicant list. For nomads this is a disguise
   *  (quiet/tidy/family). The actual tenant persona is taken from secretPersonality
   *  on lease signing if present. */
  personality: TenantPersonality
  /** Hidden true persona, set only for impersonators (Mietnomaden). When the
   *  player signs the lease, this overrides personality on the resulting Tenant. */
  secretPersonality?: TenantPersonality
  reliability: number      // 0-100
  income: number           // monthly euros
  maxRentBudget: number    // what they're willing to pay
  preferredLeaseMonths: number  // 12 / 24 / 36
  blurb: string            // flavour text shown in UI
}

export type ListingState = 'forSale' | 'owned' | 'renting'

/**
 * A single rentable unit inside a Property. Single-family properties have exactly
 * one unit (kept in sync with the Property's headline `tenant`/`baseRent`/`nebenkosten`).
 * MFH have several; WG-converted properties have many small ones.
 */
export interface Unit {
  id: string
  label: string                 // "EG", "1.OG links", "Zimmer 1"
  sqm: number
  baseKalt: number              // Kaltmiete at perfect condition
  nebenkosten: number
  tenant?: Tenant
  vacantMonths: number
  /** Per-unit applicant search budget. Reset on month change in the engine. */
  applicantSearches?: { month: number; remaining: number }
  /** Last tenant's agreedKaltMiete (set when they leave). Used by Hausverwaltung
   *  rent-strategy 'last' to re-let at the previous price. */
  lastKaltMiete?: number
}

export type BuildingForm = 'single' | 'mfh' | 'wg'

export interface WEGMembership {
  /** how many units in the building the player owns */
  unitsOwned: number
  /** total units in the building (the rest belong to other simulated owners) */
  totalUnits: number
  /** monthly Hausgeld the player owes for shared upkeep */
  hausgeldMonthly: number
  /** game-month of the next assembly (next Eigentuemerversammlung) */
  nextAssemblyMonth: number
}

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
  /** Per-month applicant search budget. Initialised lazily; reset on month change.
   *  For MFH this acts as a fallback if a unit has none of its own — primary state lives on `Unit`. */
  applicantSearches?: { month: number; remaining: number }
  /** Pending major repair (Steigstrang/Heizung/Dach etc.). Max 1 at a time per property. */
  pendingCapex?: CapexEvent
  /** Active renovation contract — tenant gets Mietminderung, no other contract until done. */
  activeRenovation?: RenovationContract
  /** True after a modern/luxury renovation completes; lets player invoke Modernisierungsumlage once. */
  modernizationUmlageAvailable?: boolean
  /** Multi-unit support (M5). For single-family properties this is a 1-element array
   *  whose values mirror the Property's headline `tenant`/`baseRent`/`nebenkosten`. */
  units: Unit[]
  buildingForm: BuildingForm
  /** When this property is just one unit inside a larger building (= player only owns part),
   *  this membership info enables Hausgeld + Eigentuemerversammlung. */
  wegMembership?: WEGMembership
  /** Optional Hausverwaltung (M8). When hired, the property auto-pays capex (if
   *  cash allows), auto-finds tenants for vacant units, and auto-starts eviction
   *  on chronic non-payers — at the cost of a monthly fee. */
  management?: PropertyManagement
}

export interface PropertyManagement {
  hiredMonth: number
  /** Auto-pay pendingCapex when cash >= cost. */
  autoCapex: boolean
  /** Auto-pick & sign a tenant for vacant units after 1+ month of vacancy. */
  autoTenant: boolean
  /** Auto-startEviction once a tenant is 3+ months behind / outed nomad. */
  autoEviction: boolean
  /**
   * What asking-Kaltmiete to set when re-letting:
   *  - 'last'        — previous tenant's Kaltmiete (or baseKalt if none recorded)
   *  - 'mietspiegel' — district+type Mietspiegel × 1.05 (legal top-of-market, no Mietpreisbremse risk)
   *  - 'max'         — unit.baseKalt (perfect-condition headline)
   */
  rentStrategy: 'last' | 'mietspiegel' | 'max'
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
  /** Persistent contractor loyalty — discount of 5% per repeat job, capped at -15%. */
  contractorRelations: ContractorRelation[]
  /** Schwarzarbeit counters — used by the annual audit roll. */
  schwarzJobsThisYear: number
  totalSchwarzJobs: number
  taxAuditsExperienced: number
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

// =========== RENOVATION ===========

export type GewerkKind =
  | 'abbruch'        // Demolition / Entkernung
  | 'rohbau'         // Walls / structural
  | 'sanitaer'       // Plumbing rough-in
  | 'elektrik'       // Electrical rough-in
  | 'heizung_install' // Heating install
  | 'fenster_install' // Window install
  | 'dach_decken'    // Roofing
  | 'fassade_putz'   // Facade plaster
  | 'estrich'        // Floor screed
  | 'trockenbau'     // Drywall
  | 'fliesen'        // Tiles (bath/kitchen)
  | 'maler'          // Painting
  | 'boden'          // Flooring
  | 'endmontage'     // Final fittings

export type RenovationScope = 'capex' | 'basic' | 'modern' | 'luxury'

export type ContractorTier = 'cheap' | 'standard' | 'premium' | 'gu'

export interface ContractorOffer {
  /** offer id (unique per generation), used to identify the chosen offer */
  id: string
  /** stable contractor identity — same person across multiple jobs/properties for loyalty */
  contractorId: string
  contractorName: string
  tier: ContractorTier
  /** Specialty area for flavour text — not strictly enforced */
  specialty?: GewerkKind | 'gu'
  /** Multipliers vs base cost/duration */
  costMultiplier: number
  durationMultiplier: number
  /** Risk knobs */
  overrunChance: number     // 0..1 — chance of mid-project Nachforderung (+20-40%)
  pfuschChance: number      // 0..1 — chance of bad work that triggers a delayed capex
  insolvencyChance: number  // 0..1 — chance to bail mid-project (only realistic for cheap)
  /** Quality bonus added to the property's condition gain on completion */
  qualityBonus: number
  /** Flavour blurb for the offer card */
  blurb: string
}

export interface GewerkStep {
  id: string
  gewerk: GewerkKind
  contractorId: string
  contractorName: string
  contractorTier: ContractorTier
  baseCost: number          // pre-Schwarz, pre-Material, pre-Loyalty
  agreedCost: number        // what was contracted (after all discounts/markups)
  paidSoFar: number         // for partial payments / Nachträge
  durationDays: number
  daysRemaining: number
  status: 'pending' | 'active' | 'done'
  isSchwarz: boolean
  /** Premium materials (€-tier upgrade) — only meaningful for finishing trades */
  material: 'standard' | 'premium'
  /** Warranty months remaining after completion (0 for Schwarz) */
  warrantyMonths: number
  /** If true, this step suffered Pfusch and a follow-up capex was scheduled */
  pfuschTriggered?: boolean
  /** If true, this step suffered a Nachforderung */
  overrunTriggered?: boolean
}

export interface RenovationContract {
  id: string
  propertyId: string
  scope: RenovationScope
  isGU: boolean
  guMarkup: number          // e.g. 0.20 for 20%
  steps: GewerkStep[]
  /** index of the currently-active step (or -1 if all done) */
  currentStepIndex: number
  startMonth: number
  totalAgreedCost: number
  totalPaidSoFar: number
  /** Mietminderung applied to tenant's Kalt during build (0..1) */
  rentReductionPct: number
  /** Effects applied on completion */
  conditionGainOnComplete: number
  rentMultOnComplete: number
  valueMultOnComplete: number
  /** Eligible for §559 BGB Modernisierungsumlage (modern/luxury only, with tenant) */
  modernizationEligible: boolean
  /** KfW subsidy percentage if energetic combo qualifies (heizung+fenster+fassade) */
  kfwSubsidyPct: number
  status: 'active' | 'done' | 'cancelled'
}

export interface ContractorRelation {
  contractorId: string
  contractorName: string
  jobsCompleted: number
  totalSpent: number
  lastJobMonth: number
}

export interface ContractorPoolEntry {
  id: string
  name: string
  tier: ContractorTier
  specialty: GewerkKind | 'gu'
  baseOverrunChance: number
  basePfuschChance: number
  baseInsolvencyChance: number
  baseQualityBonus: number
  blurb: string
}

export interface PfuschPending {
  id: string
  propertyId: string
  /** when the manifestation hits — converted to a CapexEvent at that point */
  triggerMonth: number
  capexKind: CapexKind
  costEstimate: number
}

export interface KfwRefundPending {
  id: string
  triggerMonth: number
  amount: number
}

// =========== WEG (M5) ===========

export type WEGAgendaTopic =
  | 'fassade-sanierung' | 'dach-sanierung' | 'heizung-tausch'
  | 'hausordnung' | 'hausverwaltung-wechsel' | 'aufzug-modernisierung' | 'fahrradraum'

export interface WEGProposal {
  id: string
  topic: WEGAgendaTopic
  title: string
  body: string
  /** Sonderumlage for the entire WEG (player pays a share proportional to ownership) */
  totalCost: number
  /** What happens after the vote, applied to the player's property */
  conditionImpactIfYes: number
  conditionImpactIfNo: number
  /** UI hints */
  consequenceIfYes: string
  consequenceIfNo: string
}

export interface WEGAssembly {
  id: string
  propertyId: string
  scheduledMonth: number
  proposals: WEGProposal[]
  /** Player's ownership share at the time of the vote (0..1) */
  playerShare: number
  /** Player vote per proposal id */
  playerVotes: Record<string, 'yes' | 'no' | 'abstain'>
  decided: boolean
  /** Per-proposal final result after the rest of the WEG votes */
  outcomes: Record<string, 'passed' | 'rejected'>
}

export type CapexKind2 = CapexKind  // re-export marker for clarity

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
  reason: 'rent-hike' | 'eviction'
  monthsRemaining: number
  totalMonths: number
  monthlyCost: number        // Anwaltskosten — drains every month while active
  totalSpent: number
  successChance: number      // 0..1 — player's chance to win
  /** rent-hike only: if won, the new rent stays; if lost, rent reverts to this Kaltmiete */
  revertToKalt?: number
  /** eviction only: id of the tenant being evicted, for context if they get replaced mid-suit */
  tenantId?: string
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
  /** Pfusch from cheap/Schwarz work that materialises later as capex. */
  pfuschPending: PfuschPending[]
  /** KfW-Förderung refunds queued for delayed payout (2 months bureaucracy). */
  kfwPending: KfwRefundPending[]
  /** Persistent pool of contractors so loyalty across jobs/properties works. */
  contractorPool: ContractorPoolEntry[]
  /** Pending Eigentuemerversammlungen (M5) — surfaced via HUD when scheduledMonth hits. */
  wegAssemblies: WEGAssembly[]
  /** Difficulty tier picked at game start (M7). Acts as a multiplier on costs/risks. */
  difficulty: Difficulty
  rngSeed: number
}

export type Difficulty = 'easy' | 'standard' | 'hardcore'

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
