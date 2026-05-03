import type { Applicant, Bank, BankNegotiationState, BankOfferTerms, Broker, CapexEvent, CapexKind, ContractorOffer, ContractorTier, GameState, GameTime, GewerkKind, GewerkStep, Lawsuit, Loan, MarketEvent, Player, Property, PropertyType, RenovationContract, RenovationScope, SellerNegotiationState, Speed, Tenant, Unit, WEGProposal } from './types'
import type { CityLayout, DistrictDef, DistrictId } from '../render/CityRenderer'
import { generateApplicants, pickPropertyName, pickSeller } from './names'

type Listener = (data?: any) => void

const SAVE_KEY = 'immolife_v2_save'

export class Engine {
  state!: GameState
  private layout: CityLayout
  private listeners = new Map<string, Listener[]>()
  private timer: number | null = null
  private speed: Speed = 1
  private dayDurationMs = 1200       // base ms per game day at 1x

  constructor(layout: CityLayout, opts: { freshStart?: boolean; difficulty?: import('./types').Difficulty } = {}) {
    this.layout = layout
    if (!opts.freshStart && this.tryLoad()) {
      // loaded
    } else {
      this.state = this.freshState(opts.difficulty ?? 'standard')
      this.seedListings(18)
    }
  }

  // ============ INITIALIZATION ============

  /** Difficulty tuning — single source of truth for the rebalance dampeners (M7). */
  private static DIFFICULTY: Record<import('./types').Difficulty, {
    startingCash: number
    capexRiskMult: number       // multiplier on capex roll probability
    capexImpactMult: number     // multiplier on conditionImpactIfIgnored
    capexHoneymoonMonths: number  // skip capex rolls for the first N months of game time
    capexMinAgeBonus: number    // years added to min-age threshold (delays first capex)
    lawsuitMonthlyMult: number  // multiplier on Anwaltskosten
    satisfactionLeaveThreshold: number  // tenants below this leave
    overheadMonthly: number     // base monthly overhead per portfolio
  }> = {
    easy:     { startingCash: 400_000, capexRiskMult: 0.40, capexImpactMult: 0.65, capexHoneymoonMonths: 6, capexMinAgeBonus: 5, lawsuitMonthlyMult: 0.65, satisfactionLeaveThreshold: 15, overheadMonthly: 1100 },
    standard: { startingCash: 320_000, capexRiskMult: 0.70, capexImpactMult: 0.85, capexHoneymoonMonths: 3, capexMinAgeBonus: 2, lawsuitMonthlyMult: 0.85, satisfactionLeaveThreshold: 20, overheadMonthly: 1300 },
    hardcore: { startingCash: 250_000, capexRiskMult: 1.00, capexImpactMult: 1.00, capexHoneymoonMonths: 0, capexMinAgeBonus: 0, lawsuitMonthlyMult: 1.00, satisfactionLeaveThreshold: 25, overheadMonthly: 1500 },
  }

  private diffConfig() {
    return Engine.DIFFICULTY[this.state.difficulty ?? 'standard']
  }

  private freshState(difficulty: import('./types').Difficulty = 'standard'): GameState {
    const banks: Bank[] = [
      { id: 'sparkasse', name: 'Sparkasse Berlin', annualRate: 4.2, maxLTV: 0.7, minCreditScore: 600, origination: 0.015, blurb: 'Lokal & verlaesslich. Konservative Konditionen.', color: 0xc0392b, personality: 'conservative', advisorName: 'Herr Becker' },
      { id: 'deutsche', name: 'Deutsche Bank', annualRate: 3.6, maxLTV: 0.8, minCreditScore: 700, origination: 0.012, blurb: 'Premium-Bank, gute Konditionen ab 700 Score.', color: 0x2980b9, personality: 'aggressive', advisorName: 'Frau Dr. Roth' },
      { id: 'volksbank', name: 'Volksbank', annualRate: 4.5, maxLTV: 0.75, minCreditScore: 580, origination: 0.01, blurb: 'Genossenschaftlich, fair zu Einsteigern.', color: 0xf39c12, personality: 'relationship', advisorName: 'Frau Wagner' },
      { id: 'online', name: 'NeoBank Direct', annualRate: 3.2, maxLTV: 0.85, minCreditScore: 720, origination: 0.005, blurb: 'Vollstaendig digital. Bestkondition fuer Top-Bonitaet.', color: 0x9b59b6, personality: 'digital', advisorName: 'KI-Berater \"DIRA\"' },
    ]

    const player: Player = {
      cash: Engine.DIFFICULTY[difficulty].startingCash,
      creditScore: 720,
      reputation: 50,
      netWorthHistory: [],
      achievements: [],
      negotiationSkill: 25,
      bankRelations: { sparkasse: 10, deutsche: 10, volksbank: 10, online: 10 },
      brokerId: null,
      contractorRelations: [],
      schwarzJobsThisYear: 0,
      totalSchwarzJobs: 0,
      taxAuditsExperienced: 0,
    }

    const time: GameTime = { day: 1, month: 1, year: 2026, total: 0 }

    const brokers: Broker[] = [
      { id: 'do_it_yourself', name: 'Selbst verhandeln', title: 'Kein Makler', commissionPct: 0, negotiationBonus: 0, specialty: 'residential', personality: 'analytical', blurb: 'Du sparst die Provision aber kein Bonus. Du musst das alles selbst machen.', color: 0x7f8c8d, catchphrase: '' },
      { id: 'rookie', name: 'Lena Hoffmann', title: 'Junior-Maklerin', commissionPct: 0.025, negotiationBonus: 8, specialty: 'budget', personality: 'enthusiastic', blurb: 'Junge Maklerin, motiviert und freundlich. Verkaufer moegen sie. Spezialisiert auf Einsteiger-Objekte.', color: 0x16a085, catchphrase: '"Das wird super, ich mach das schon!"' },
      { id: 'pro', name: 'Markus Reichert', title: 'Etablierter Makler', commissionPct: 0.035, negotiationBonus: 15, specialty: 'residential', personality: 'charming', blurb: 'Charmant und gut vernetzt. Verkaeufer geben ihm gerne Rabatte.', color: 0x2980b9, catchphrase: '"Lassen Sie uns das in Ruhe besprechen, ja?"' },
      { id: 'sharp', name: 'Sabine Voss', title: 'Verhandlungs-Spezialistin', commissionPct: 0.04, negotiationBonus: 22, specialty: 'commercial', personality: 'pushy', blurb: 'Hart und direkt. Drueckt den Preis brutal — aber Verkaeufer brechen manchmal die Verhandlung ab.', color: 0xe67e22, catchphrase: '"Das ist ueberbewertet — und das wissen Sie auch!"' },
      { id: 'luxury', name: 'Friedrich von Berg', title: 'High-End-Berater', commissionPct: 0.05, negotiationBonus: 25, specialty: 'luxury', personality: 'discreet', blurb: 'Exklusiver Service fuer Villen & Towers. Diskret und elegant.', color: 0x8e44ad, catchphrase: '"Sehr verehrter Herr, wir finden eine Loesung."' },
    ]

    return {
      player,
      time,
      banks,
      brokers,
      market: { cycle: 0.4, nextEventCheck: 3, events: [], baseRate: 3.5 },
      listings: [],
      owned: [],
      loans: [],
      lawsuits: [],
      capexHistory: [],
      pfuschPending: [],
      kfwPending: [],
      contractorPool: this.generateContractorPool(),
      wegAssemblies: [],
      difficulty,
      rngSeed: Math.floor(Math.random() * 1_000_000),
    }
  }

  private rng(salt = 0): () => number {
    let s = (this.state.rngSeed + salt + this.state.time.total * 7919) >>> 0
    return () => {
      s = (s + 0x6D2B79F5) | 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  // ============ LISTING GENERATION ============

  private districtById(id: DistrictId): DistrictDef {
    return this.layout.districts.find(d => d.id === id)!
  }

  /**
   * Local Mietspiegel ("Berliner Mietspiegel"-style) — comparable Kaltmiete for a
   * given district + property type, deterministic so two apartments in Mitte have
   * the same reference. Per-property variance lives in the actual `baseRent`, which
   * already factors in condition + price; mietspiegelKalt is the LEGAL reference
   * for Mietpreisbremse (raiseRent uses it to compute lawsuit risk).
   */
  mietspiegelFor(district: DistrictId, type: PropertyType): number {
    const d = this.districtById(district)
    // Typical mid-market Kaltmiete per property type. Exact values are tuned so
    // newly-listed baseRent sits ~5-15% above mietspiegel (room to negotiate up)
    // and well-maintained properties can push 10-20% above before suing.
    const typical: Record<PropertyType, number> = {
      house: 1100, villa: 2400, apartment: 750, shop: 1400, office: 1800, tower: 1900,
    }
    return Math.round(typical[type] * d.rentMultiplier)
  }

  private propertyTypeForDistrict(rng: () => number, district: DistrictId): PropertyType {
    // Distribution flatter than the old defaults: apartments stay common in
    // residential districts but other types appear regularly so the player
    // sees variety in any given snapshot of 16 listings.
    const r = rng()
    if (district === 'mitte') {
      if (r < 0.18) return 'tower'
      if (r < 0.34) return 'office'
      if (r < 0.50) return 'shop'
      if (r < 0.70) return 'apartment'
      if (r < 0.85) return 'villa'
      return 'house'
    }
    if (district === 'charlottenburg') {
      if (r < 0.10) return 'tower'
      if (r < 0.28) return 'villa'
      if (r < 0.45) return 'office'
      if (r < 0.55) return 'shop'
      if (r < 0.85) return 'apartment'
      return 'house'
    }
    if (district === 'kreuzberg' || district === 'prenzlauer') {
      if (r < 0.38) return 'apartment'
      if (r < 0.58) return 'shop'
      if (r < 0.75) return 'house'
      if (r < 0.88) return 'office'
      if (r < 0.95) return 'villa'
      return 'tower'
    }
    if (district === 'neukoelln' || district === 'wedding') {
      if (r < 0.40) return 'apartment'
      if (r < 0.65) return 'house'
      if (r < 0.85) return 'shop'
      if (r < 0.95) return 'office'
      return 'villa'
    }
    return 'apartment'
  }

  private basePriceFor(type: PropertyType): number {
    switch (type) {
      case 'house': return 320_000
      case 'villa': return 720_000
      case 'apartment': return 220_000
      case 'shop': return 280_000
      case 'office': return 540_000
      case 'tower': return 1_400_000
    }
  }

  private occupiedSpot(tx: number, ty: number): boolean {
    const allP = [...this.state.listings, ...this.state.owned]
    return allP.some(p => p.tileX === tx && p.tileY === ty)
  }

  private genListing(rng: () => number, district?: DistrictId): Property | null {
    // pick a random district biased towards diversity
    const d = district ?? this.layout.districts[Math.floor(rng() * this.layout.districts.length)].id
    const districtDef = this.districtById(d)
    // find a free buildable spot in this district
    const candidates = this.layout.buildableSpots.filter(s => s.district === d && !this.occupiedSpot(s.tileX, s.tileY))
    if (candidates.length === 0) return null
    const spot = candidates[Math.floor(rng() * candidates.length)]

    const type = this.propertyTypeForDistrict(rng, d)
    const ageYears = Math.floor(rng() * 60)
    const yearBuilt = this.state.time.year - ageYears
    const condition = Math.max(20, 100 - ageYears * 1.1 + (rng() * 25))
    const base = this.basePriceFor(type)
    const variance = 0.75 + rng() * 0.5
    const price = Math.round(base * districtDef.priceMultiplier * variance * (0.6 + condition / 200))
    const baseRent = Math.round(price * 0.0048 * districtDef.rentMultiplier)
    const nebenkosten = Math.round(baseRent * (0.22 + rng() * 0.10))
    // Mietspiegel: deterministic per (district, type) — see mietspiegelFor.
    const mietspiegelKalt = this.mietspiegelFor(d, type)

    // M5: ~30% of apartment/tower listings are MFH (whole building, multiple units).
    // Everything else is single-unit. House/villa/shop/office stay 1-unit.
    const canBeMfh = type === 'apartment' || type === 'tower'
    const isMfh = canBeMfh && rng() < 0.30
    const buildingForm: 'single' | 'mfh' | 'wg' = isMfh ? 'mfh' : 'single'
    const unitCount = isMfh ? (3 + Math.floor(rng() * 8)) : 1  // 3-10 units for MFH
    const totalKalt = isMfh ? Math.round(baseRent * (0.85 + (unitCount - 4) * 0.08)) * unitCount / 4 : baseRent
    // For an MFH listing the asking price scales with total Kaltmiete (yield-based)
    const mfhPrice = isMfh ? Math.round(totalKalt * 12 * (16 + rng() * 6)) : price
    const finalPrice = isMfh ? mfhPrice : price
    const finalBaseRent = isMfh ? Math.round(totalKalt) : baseRent

    const units: Unit[] = []
    if (isMfh) {
      // Distribute total Kaltmiete across the units with some variance — top floor a bit
      // pricier, ground floor a bit less, etc.
      let remaining = Math.round(totalKalt)
      for (let i = 0; i < unitCount; i++) {
        const isLast = i === unitCount - 1
        const sqm = 38 + Math.floor(rng() * 60)
        const share = isLast ? remaining : Math.round(remaining / (unitCount - i) * (0.85 + rng() * 0.3))
        const uKalt = Math.max(280, share)
        const uNk = Math.round(uKalt * (0.20 + rng() * 0.10))
        const floor = Math.floor(i / 2)
        const side = i % 2 === 0 ? 'links' : 'rechts'
        const label = floor === 0 ? `EG ${side}` : `${floor}. OG ${side}`
        units.push({
          id: 'u_' + Math.random().toString(36).slice(2, 6),
          label,
          sqm,
          baseKalt: uKalt,
          nebenkosten: uNk,
          vacantMonths: 0,
        })
        remaining -= uKalt
      }
    } else {
      units.push({
        id: 'u_' + Math.random().toString(36).slice(2, 6),
        label: 'Einheit',
        sqm: 50 + Math.floor(rng() * 70),
        baseKalt: baseRent,
        nebenkosten,
        vacantMonths: 0,
      })
    }

    return {
      id: 'p_' + Math.random().toString(36).slice(2, 10),
      type,
      district: d,
      tileX: spot.tileX,
      tileY: spot.tileY,
      styleSeed: Math.floor(rng() * 1e6),
      price: finalPrice,
      marketValue: finalPrice,
      basePrice: finalPrice,
      baseRent: finalBaseRent,
      nebenkosten,
      mietspiegelKalt,
      condition,
      yearBuilt,
      monthsOnMarket: 0,
      marketLifetimeMonths: 2 + Math.floor(rng() * 5),
      state: 'forSale',
      vacantMonths: 0,
      seller: pickSeller(rng),
      units,
      buildingForm,
    }
  }

  private seedListings(count: number) {
    const rng = this.rng(1)
    let attempts = 0
    while (this.state.listings.length < count && attempts < count * 5) {
      const p = this.genListing(rng)
      if (p) this.state.listings.push(p)
      attempts++
    }
  }

  /** generate a custom name on demand (cheap, not stored) */
  nameFor(p: Property): string {
    const r = mulb(p.styleSeed)
    return pickPropertyName(p.type, r, p.buildingForm)
  }

  // ============ TIME ============

  setSpeed(s: Speed) {
    this.speed = s
    this.restartTimer()
    this.emit('speed', { speed: this.speed })
  }
  getSpeed(): Speed { return this.speed }

  start() { this.restartTimer() }

  stop() {
    if (this.timer != null) { window.clearInterval(this.timer); this.timer = null }
  }

  private restartTimer() {
    this.stop()
    if (this.speed === 0) return
    const interval = Math.max(40, this.dayDurationMs / this.speed)
    this.timer = window.setInterval(() => this.tick(), interval)
  }

  private tick() {
    this.state.time.day++
    this.state.time.total++
    if (this.state.time.day > 30) {
      this.state.time.day = 1
      this.state.time.month++
      if (this.state.time.month > 12) {
        this.state.time.month = 1
        this.state.time.year++
        this.emit('year')
      }
      this.processMonth()
      this.emit('month', { ...this.state.time })
    }
    this.emit('day', { ...this.state.time })
  }

  // ============ MONTHLY PROCESSING ============

  private processMonth() {
    const rng = this.rng(2)
    let income = 0
    let expenses = 0

    // age listings off market & age stale lifetime
    const remaining: Property[] = []
    let removed = 0
    for (const p of this.state.listings) {
      p.monthsOnMarket++
      // gentle decay for forSale stock too
      this.degradeProperty(p)
      this.appreciate(p)
      if (p.monthsOnMarket >= p.marketLifetimeMonths) { removed++ } else remaining.push(p)
    }
    this.state.listings = remaining

    // refill market — keep at least 16, add 2-4 new each month
    const targetCount = 16
    const add = Math.max(targetCount - this.state.listings.length, 2 + Math.floor(rng() * 3))
    let added = 0
    for (let i = 0; i < add * 6 && added < add; i++) {
      const np = this.genListing(rng)
      if (np) { this.state.listings.push(np); added++ }
    }

    // owned properties — degrade, collect rent, find/lose tenants
    for (const p of this.state.owned) {
      this.degradeProperty(p)
      this.appreciate(p)

      // M5: iterate over each unit. Single-unit properties have units.length === 1.
      for (const u of p.units) {
        const collected = this.processUnitTenancy(p, u, rng)
        income += collected
      }
      this.syncHeadlineFromUnits(p)

      // maintenance always due — scales with unit count for MFH
      const m = this.maintenanceCost(p)
      expenses += m

      // Hausgeld for WEG members (when player only owns part of the building)
      if (p.wegMembership) expenses += p.wegMembership.hausgeldMonthly

      // capex roll — major repairs based on age + condition
      this.tickCapex(p, rng)

      // active renovation — advance current step, complete steps, roll risks
      this.tickRenovation(p, rng)

      // WEG assemblies for properties where the player is just one of many owners
      this.maybeScheduleWegAssembly(p, rng)
    }

    // Pfusch maturing → convert to capex
    this.tickPfusch()
    // KfW refunds
    this.tickKfw()
    // Annual Schwarz audit (only triggers in January)
    this.maybeRollTaxAudit()

    // loans
    for (const ln of this.state.loans) {
      ln.monthsRemaining--
      const interest = ln.principal * ln.monthlyRate
      const principalReduction = Math.max(0, ln.monthlyPayment - interest)
      ln.principal = Math.max(0, ln.principal - principalReduction)
      const due = ln.monthlyPayment
      if (this.state.player.cash + income - expenses >= due) {
        expenses += due
      } else {
        ln.paymentsMissed++
        // half payment & damaged credit
        expenses += Math.min(this.state.player.cash + income - expenses, due / 2)
        this.state.player.creditScore = Math.max(300, this.state.player.creditScore - 25)
        this.emit('toast', { kind: 'error', text: `Kreditrate verpasst! Score -25` })
      }
      if (ln.monthsRemaining <= 0 || ln.principal <= 1) {
        // auto-payoff signal
        ln.principal = 0
        ln.monthsRemaining = 0
      }
    }
    // remove paid loans
    const paidOff = this.state.loans.filter(l => l.principal === 0)
    if (paidOff.length) {
      this.state.loans = this.state.loans.filter(l => l.principal > 0)
      for (const l of paidOff) {
        const p = this.state.owned.find(pp => pp.id === l.propertyId)
        if (p) p.loanId = undefined
        this.emit('toast', { kind: 'success', text: `Kredit getilgt!` })
      }
    }

    // lawsuits — Anwaltskosten laufen monatlich, Outcome am Ende
    for (const ls of this.state.lawsuits) {
      if (ls.outcome !== 'pending') continue
      expenses += ls.monthlyCost
      ls.totalSpent += ls.monthlyCost
      ls.monthsRemaining--
      if (ls.monthsRemaining <= 0) {
        const won = rng() < ls.successChance
        ls.outcome = won ? 'won' : 'lost'
        const p = this.state.owned.find(pp => pp.id === ls.propertyId)
        if (ls.reason === 'rent-hike') {
          if (won) {
            this.emit('toast', { kind: 'success', text: `Klage gewonnen — Mieterhoehung haelt. Kosten ${formatEuro(ls.totalSpent)}.` })
          } else {
            if (p && typeof ls.revertToKalt === 'number') {
              const targetUnit = p.units.find(u => u.tenant?.id === ls.tenantId) ?? p.units.find(u => u.tenant)
              if (targetUnit?.tenant) targetUnit.tenant.agreedKaltMiete = ls.revertToKalt
              this.syncHeadlineFromUnits(p)
            }
            this.state.player.reputation = Math.max(0, this.state.player.reputation - 10)
            this.emit('toast', { kind: 'error', text: `Klage verloren — Miete zurueckgesetzt, Reputation -10. Kosten ${formatEuro(ls.totalSpent)}.` })
          }
        } else if (ls.reason === 'eviction') {
          // Locate the tenant by id across this property's units.
          const targetUnit = p?.units.find(u => u.tenant?.id === ls.tenantId)
          if (won) {
            if (targetUnit?.tenant && p) {
              const tenantName = targetUnit.tenant.name
              targetUnit.tenant = undefined
              targetUnit.vacantMonths = 0
              this.syncHeadlineFromUnits(p)
              this.state.player.reputation = Math.max(0, this.state.player.reputation - 5)
              this.emit('toast', { kind: 'success', text: `Raeumung erfolgreich — ${tenantName} ist raus. Gesamtkosten ${formatEuro(ls.totalSpent)}.` })
            } else {
              this.emit('toast', { kind: 'success', text: `Raeumungsklage gewonnen — Mieter war bereits weg. Kosten ${formatEuro(ls.totalSpent)}.` })
            }
          } else {
            this.state.player.reputation = Math.max(0, this.state.player.reputation - 10)
            this.emit('toast', { kind: 'error', text: `Raeumungsklage verloren — Mieter bleibt. Kosten ${formatEuro(ls.totalSpent)}, Reputation -10.` })
          }
        }
      }
    }
    this.state.lawsuits = this.state.lawsuits.filter(l => l.outcome === 'pending')

    // taxes & overhead
    const overhead = this.diffConfig().overheadMonthly + Math.round(this.state.owned.length * 80)
    expenses += overhead

    // apply to cash
    this.state.player.cash += income - expenses

    // credit score gentle recovery if not behind
    const allTenants = this.state.owned.flatMap(o => o.units.map(u => u.tenant).filter(Boolean) as Tenant[])
    const anyBehind = allTenants.some(t => t.monthsBehind > 0) || this.state.loans.some(l => l.paymentsMissed > 0)
    if (!anyBehind && this.state.player.creditScore < 850) this.state.player.creditScore = Math.min(850, this.state.player.creditScore + 2)

    // reputation: depends on average condition and tenant satisfaction
    if (this.state.owned.length > 0) {
      const avgCond = this.state.owned.reduce((s, p) => s + p.condition, 0) / this.state.owned.length
      const avgSat = allTenants.length > 0 ? allTenants.reduce((s, t) => s + t.satisfaction, 0) / allTenants.length : 50
      const target = (avgCond * 0.4 + avgSat * 0.6)
      this.state.player.reputation += (target - this.state.player.reputation) * 0.15
      this.state.player.reputation = Math.max(0, Math.min(100, this.state.player.reputation))
    }

    // market events
    this.maybeRollEvent(rng)

    // record net worth history
    this.state.player.netWorthHistory.push({ month: this.gameMonth(), netWorth: this.netWorth() })
    if (this.state.player.netWorthHistory.length > 240) this.state.player.netWorthHistory.shift()

    if (removed) this.emit('toast', { kind: 'info', text: `${removed} Inserate vom Markt genommen` })
    if (added) this.emit('toast', { kind: 'info', text: `${added} neue Angebote auf dem Markt` })

    this.emit('financial', { income, expenses, net: income - expenses })
    this.checkAchievements()
    this.autoSave()
  }

  /**
   * Run a single unit through one month: legacy migration on the tenant, partyer/tidy
   * condition deltas (capped per building), willPay roll, monthsBehind tracking,
   * disguise reveal, satisfaction drift, lease end / cooperative auto-eviction.
   * Returns rent collected (for the player's books).
   */
  private processUnitTenancy(p: Property, u: Unit, rng: () => number): number {
    if (!u.tenant) {
      u.vacantMonths++
      if (u.vacantMonths === 1 || u.vacantMonths % 3 === 0) {
        const where = p.units.length > 1 ? `${this.nameFor(p)} (${u.label})` : this.nameFor(p)
        this.emit('toast', { kind: 'info', text: `${where} ist leer (${u.vacantMonths} Mon.) — Bewerber pruefen.` })
      }
      return 0
    }
    const t = u.tenant
    // Migration safety on legacy tenants without Kalt/NK split
    const legacy = t as Tenant & { agreedRent?: number }
    if (typeof t.agreedKaltMiete !== 'number') {
      t.agreedKaltMiete = typeof legacy.agreedRent === 'number' ? legacy.agreedRent : u.baseKalt
    }
    if (typeof t.agreedNebenkosten !== 'number') {
      t.agreedNebenkosten = u.nebenkosten
    }
    if (typeof t.deposit !== 'number') t.deposit = t.agreedKaltMiete * 2

    if (t.personality === 'partyer') p.condition = Math.max(0, p.condition - 0.6 / Math.max(1, p.units.length))
    if (t.personality === 'tidy') p.condition = Math.min(100, p.condition + 0.2 / Math.max(1, p.units.length))

    const isNomad = t.personality === 'nomad'
    const willPay = !isNomad && rng() < (t.reliability / 100)
    let income = 0
    if (willPay) {
      const reductionFactor = p.activeRenovation ? (1 - p.activeRenovation.rentReductionPct) : 1
      income = Math.round(t.agreedKaltMiete * reductionFactor)
      t.monthsBehind = Math.max(0, t.monthsBehind - 1)
    } else {
      t.monthsBehind++
      if (isNomad && t.disguisePersonality && t.monthsBehind >= 3) {
        t.disguisePersonality = undefined
        const where = p.units.length > 1 ? `${this.nameFor(p)} (${u.label})` : this.nameFor(p)
        this.emit('toast', { kind: 'error', text: `${t.name} in ${where} ist ein Mietnomade! Nur per Raeumungsklage entfernbar.` })
      }
    }

    const condTarget = t.personality === 'demanding' ? p.condition - 10 : p.condition + 10
    const targetSat = Math.min(100, condTarget)
    t.satisfaction += (targetSat - t.satisfaction) * 0.4
    t.satisfaction = Math.max(0, Math.min(100, t.satisfaction))
    t.monthsRemaining--

    const cooperativeLeave = !isNomad && (t.satisfaction < this.diffConfig().satisfactionLeaveThreshold || t.monthsRemaining <= 0 || t.monthsBehind >= 3)
    if (cooperativeLeave) {
      const refund = t.personality === 'partyer' && p.condition < 50 ? t.deposit * 0.4 : t.deposit
      this.state.player.cash -= refund
      const where = p.units.length > 1 ? `${this.nameFor(p)} (${u.label})` : this.nameFor(p)
      this.emit('toast', { kind: t.monthsBehind >= 3 ? 'warning' : 'info', text: `${t.name} zog aus (${where}). Kaution -${Math.round(refund)} EUR.` })
      u.tenant = undefined
      u.vacantMonths = 0
    }
    return income
  }

  /** Keep the headline `tenant`/`baseRent`/`nebenkosten`/`vacantMonths` in sync with
   *  units[0] for single-unit properties so existing UI keeps working. For MFH the
   *  headline becomes a building-level summary. */
  private syncHeadlineFromUnits(p: Property) {
    if (p.units.length === 0) return
    if (p.units.length === 1) {
      const u = p.units[0]
      p.tenant = u.tenant
      p.baseRent = u.baseKalt
      p.nebenkosten = u.nebenkosten
      p.vacantMonths = u.vacantMonths
      p.applicantSearches = u.applicantSearches
    } else {
      // Aggregate for MFH/WG: total Kaltmiete + sum NK; pretend the first occupied
      // unit is the "headline" tenant for any UI still reading p.tenant.
      const totalKalt = p.units.reduce((s, x) => s + x.baseKalt, 0)
      const totalNk = p.units.reduce((s, x) => s + x.nebenkosten, 0)
      p.baseRent = totalKalt
      p.nebenkosten = totalNk
      const firstWithTenant = p.units.find(x => x.tenant)
      p.tenant = firstWithTenant?.tenant
      const allVacant = p.units.every(x => !x.tenant)
      p.vacantMonths = allVacant ? Math.max(...p.units.map(x => x.vacantMonths)) : 0
    }
  }

  private maybeRollEvent(rng: () => number) {
    // expire old events
    this.state.market.events = this.state.market.events.filter(e => e.expiresMonth > this.gameMonth())

    this.state.market.nextEventCheck--
    if (this.state.market.nextEventCheck > 0) return
    this.state.market.nextEventCheck = 3 + Math.floor(rng() * 4)

    const r = rng()
    let event: MarketEvent | null = null
    const districts: DistrictId[] = ['mitte', 'prenzlauer', 'kreuzberg', 'charlottenburg', 'wedding', 'neukoelln']
    const target = districts[Math.floor(rng() * districts.length)]
    const targetName = this.districtById(target).name
    const expires = this.gameMonth() + 4 + Math.floor(rng() * 5)

    if (r < 0.18) {
      event = {
        id: 'gentrify_' + this.gameMonth(),
        title: `Gentrifizierungs-Welle: ${targetName}`,
        body: `Junge Kreative entdecken ${targetName}. Mieten und Preise steigen.`,
        expiresMonth: expires,
        affects: target,
        apply: (p) => {
          if (p.district === target) { p.marketValue *= 1.04; p.baseRent = Math.round(p.baseRent * 1.05); p.price = Math.round(p.price * 1.04) }
        },
      }
    } else if (r < 0.32) {
      event = {
        id: 'crash_' + this.gameMonth(),
        title: `Marktkorrektur in ${targetName}`,
        body: `Spekulationsblase platzt — Preise sinken voruebergehend.`,
        expiresMonth: expires,
        affects: target,
        apply: (p) => { if (p.district === target) { p.marketValue *= 0.93; p.price = Math.round(p.price * 0.93) } },
      }
    } else if (r < 0.46) {
      event = {
        id: 'rates_up_' + this.gameMonth(),
        title: 'EZB erhoeht Zinsen',
        body: 'Neue Hypotheken werden teurer.',
        expiresMonth: expires,
        affects: 'all',
        apply: () => { this.state.market.baseRate = Math.min(7, this.state.market.baseRate + 0.5) },
      }
      this.state.market.baseRate = Math.min(7, this.state.market.baseRate + 0.5)
    } else if (r < 0.6) {
      event = {
        id: 'rates_down_' + this.gameMonth(),
        title: 'EZB senkt Zinsen',
        body: 'Hypotheken werden guenstiger.',
        expiresMonth: expires,
        affects: 'all',
        apply: () => {},
      }
      this.state.market.baseRate = Math.max(1, this.state.market.baseRate - 0.5)
    } else if (r < 0.72) {
      event = {
        id: 'boom_' + this.gameMonth(),
        title: `Tech-Boom in ${targetName}`,
        body: `Konzern siedelt sich an — Mietnachfrage steigt deutlich.`,
        expiresMonth: expires,
        affects: target,
        apply: (p) => { if (p.district === target) { p.baseRent = Math.round(p.baseRent * 1.08); p.marketValue *= 1.06; p.price = Math.round(p.price * 1.06) } },
      }
    } else {
      // no event this round
      return
    }

    // apply to current properties
    const all = [...this.state.listings, ...this.state.owned]
    all.forEach(p => event!.apply(p))
    this.state.market.events.push(event)
    this.emit('event', event)
  }

  private degradeProperty(p: Property) {
    // older buildings degrade faster; renovation slows decay
    const ageYears = Math.max(0, this.state.time.year - p.yearBuilt)
    const ageFactor = 0.4 + Math.min(2.0, ageYears / 50)
    const sinceReno = p.lastRenovationMonth ? Math.max(0, this.gameMonth() - p.lastRenovationMonth) : 999
    const renoFactor = sinceReno < 12 ? 0.4 : sinceReno < 36 ? 0.7 : 1.0
    const decay = 0.25 * ageFactor * renoFactor
    p.condition = Math.max(0, p.condition - decay)
  }

  private appreciate(p: Property) {
    const districtDef = this.districtById(p.district)
    const districtAnnual = districtDef.trend // pp
    const cycleAnnual = this.state.market.cycle
    const conditionMod = (p.condition / 100 - 0.5) * 1.0  // -0.5 .. +0.5 pp/yr
    const annualRate = (1.5 + districtAnnual + cycleAnnual + conditionMod) / 100
    const monthly = Math.pow(1 + annualRate, 1 / 12) - 1
    p.marketValue = Math.max(1, p.marketValue * (1 + monthly))
    if (p.state === 'forSale') {
      // forSale price drifts toward marketValue
      p.price = Math.round(p.price + (p.marketValue - p.price) * 0.25)
    }
  }

  private maintenanceCost(p: Property): number {
    const baseline = p.baseRent * 0.12
    const condFactor = p.condition < 30 ? 2.5 : p.condition < 50 ? 1.6 : p.condition < 75 ? 1.0 : 0.7
    return Math.round(baseline * condFactor + 80)
  }

  private effectiveRent(p: Property): number {
    return p.baseRent * (0.55 + (p.condition / 100) * 0.45)
  }

  // ============ RENTAL MARKET (player-driven) ============

  /**
   * Generate a fresh pool of applicants for an owned, vacant property
   * given the asking rent the player wants to set.
   */
  /**
   * Initial pool of applicants for a vacant property, deterministic per (rent, month).
   * Use `tryRefreshApplicants` to roll a fresh pool (consumes the monthly search budget).
   */
  getApplicants(propertyId: string, askingRent: number, count: number = 5, salt: number = 0): Applicant[] {
    const p = this.state.owned.find(pp => pp.id === propertyId)
    if (!p) return []
    const districtPull = this.districtById(p.district).desirability / 100   // 0.5..0.95
    const reputationPull = 0.6 + this.state.player.reputation / 200          // 0.6..1.1
    const conditionPull = 0.5 + p.condition / 200                            // 0.5..1.0
    const baseCount = Math.max(1, Math.round(count * districtPull * reputationPull * conditionPull))
    const nk = typeof p.nebenkosten === 'number' ? p.nebenkosten : Math.round(p.baseRent * 0.25)
    const rng = this.rng(askingRent + this.gameMonth() * 31 + salt * 1009)
    return generateApplicants(rng, p.baseRent, p.condition, askingRent, nk, baseCount * 2, p.district)
  }

  /** UI helper: how many manual refreshes are still available this month? */
  applicantRefreshesLeft(propertyId: string): number {
    const p = this.state.owned.find(pp => pp.id === propertyId)
    if (!p) return 0
    const m = this.gameMonth()
    if (!p.applicantSearches || p.applicantSearches.month !== m) return 3
    return p.applicantSearches.remaining
  }

  /** Consume one refresh and return a freshly-rolled applicant list with a unique salt. */
  tryRefreshApplicants(propertyId: string, askingRent: number, count: number = 5): { ok: boolean; remaining: number; applicants: Applicant[] } {
    const p = this.state.owned.find(pp => pp.id === propertyId)
    if (!p) return { ok: false, remaining: 0, applicants: [] }
    const m = this.gameMonth()
    if (!p.applicantSearches || p.applicantSearches.month !== m) {
      p.applicantSearches = { month: m, remaining: 3 }
    }
    if (p.applicantSearches.remaining <= 0) {
      return { ok: false, remaining: 0, applicants: this.getApplicants(propertyId, askingRent, count) }
    }
    p.applicantSearches.remaining--
    // salt = how many refreshes used so far (1..3), so each pool is distinct
    const salt = 3 - p.applicantSearches.remaining
    const apps = this.getApplicants(propertyId, askingRent, count, salt)
    return { ok: true, remaining: p.applicantSearches.remaining, applicants: apps }
  }

  /** Sign a lease: applicant becomes tenant. `kaltMiete` is the negotiated Kaltmiete;
   *  Nebenkosten are taken from the unit and added on top (the tenant pays warm,
   *  but only Kaltmiete enters the player's books).
   *  For multi-unit properties pass the `unitId`; otherwise the first vacant unit is used. */
  signLease(propertyId: string, applicant: Applicant, kaltMiete: number, leaseMonths: number, unitId?: string): { ok: boolean; reason?: string } {
    const p = this.state.owned.find(pp => pp.id === propertyId)
    if (!p) return { ok: false, reason: 'Nicht im Besitz' }
    const u = unitId ? p.units.find(x => x.id === unitId) : p.units.find(x => !x.tenant)
    if (!u) return { ok: false, reason: 'Keine freie Wohneinheit' }
    if (u.tenant) return { ok: false, reason: 'Wohnung bereits vermietet' }
    const nk = u.nebenkosten
    const warm = kaltMiete + nk
    if (warm > applicant.maxRentBudget * 1.05) return { ok: false, reason: 'Bewerber kann sich diese Warmmiete nicht leisten' }

    const deposit = kaltMiete * 2
    // Secret persona (e.g. nomad masquerading as quiet) overrides the visible one,
    // and zero-out reliability so they will never pay.
    const truePersonality = applicant.secretPersonality ?? applicant.personality
    const trueReliability = truePersonality === 'nomad' ? 0 : applicant.reliability
    u.tenant = {
      id: applicant.id,
      name: applicant.name,
      occupation: applicant.occupation,
      personality: truePersonality,
      // disguise is what the UI shows until the cover blows
      ...(applicant.secretPersonality ? { disguisePersonality: applicant.personality } : {}),
      reliability: trueReliability,
      income: applicant.income,
      satisfaction: 75,
      monthsRemaining: leaseMonths,
      monthsBehind: 0,
      agreedKaltMiete: kaltMiete,
      agreedNebenkosten: nk,
      deposit,
    }
    u.vacantMonths = 0
    this.syncHeadlineFromUnits(p)
    // deposit goes into player's cash (held for tenant — simplified)
    this.state.player.cash += deposit
    this.emit('leaseSigned', { property: p, tenant: u.tenant, unit: u })
    this.emit('toast', { kind: 'success', text: `Vertrag mit ${applicant.name} (Kalt ${kaltMiete} + NK ${nk} EUR/M, ${leaseMonths} M, Kaution ${deposit} EUR)` })
    this.autoSave()
    return { ok: true }
  }

  // ============ ACTIONS ============

  buy(propertyId: string, withLoanFromBank?: string, ltv?: number, opts?: { extraCashCost?: number; bankTermsOverride?: BankOfferTerms }): { ok: boolean; reason?: string } {
    const idx = this.state.listings.findIndex(p => p.id === propertyId)
    if (idx < 0) return { ok: false, reason: 'Inserat nicht mehr verfuegbar' }
    const p = this.state.listings[idx]
    let cashNeeded = p.price
    let loan: Loan | undefined
    const extraCash = opts?.extraCashCost ?? 0

    if (withLoanFromBank) {
      const bank = this.state.banks.find(b => b.id === withLoanFromBank)
      if (!bank) return { ok: false, reason: 'Bank nicht gefunden' }
      if (this.state.player.creditScore < bank.minCreditScore) return { ok: false, reason: `Score zu niedrig (${bank.minCreditScore} verlangt)` }
      const override = opts?.bankTermsOverride
      const baseRatePct = override ? override.annualRate : (bank.annualRate + this.state.market.baseRate * 0.1)
      const effectiveLTV = override ? override.ltv : Math.min(ltv ?? bank.maxLTV, bank.maxLTV)
      const origination = override ? override.origination : bank.origination
      const principal = Math.round(p.price * effectiveLTV)
      const rate = baseRatePct / 100
      const months = 240
      const r = rate / 12
      const monthlyPayment = Math.round(principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1))
      const fees = Math.round(principal * origination)
      cashNeeded = p.price - principal + fees + extraCash
      if (this.state.player.cash < cashNeeded) return { ok: false, reason: `Eigenkapital reicht nicht (${formatEuro(cashNeeded)} benoetigt)` }
      loan = {
        id: 'l_' + Math.random().toString(36).slice(2, 9),
        bankId: bank.id,
        propertyId: p.id,
        principal,
        originalPrincipal: principal,
        monthlyRate: r,
        monthlyPayment,
        monthsRemaining: months,
        totalMonths: months,
        paymentsMissed: 0,
      }
    } else {
      cashNeeded += extraCash
      if (this.state.player.cash < cashNeeded) return { ok: false, reason: 'Nicht genug Cash' }
    }

    this.state.player.cash -= cashNeeded
    p.state = 'owned'
    p.ownedSince = this.gameMonth()
    if (loan) { this.state.loans.push(loan); p.loanId = loan.id }
    this.state.listings.splice(idx, 1)
    this.state.owned.push(p)
    this.emit('bought', { property: p, loan })
    this.emit('toast', { kind: 'success', text: `${this.nameFor(p)} gekauft fuer ${formatEuro(p.price)}` })
    this.checkAchievements()
    this.autoSave()
    return { ok: true }
  }

  /** Sell an owned property. Optionally engage a sell-broker per transaction —
   *  their commission is deducted from the sale price (M4: seller pays, not buyer).
   *  `sellBrokerId` is one of the broker IDs in `state.brokers` or null/undefined for DIY. */
  sell(propertyId: string, sellBrokerId?: string | null): { ok: boolean; reason?: string; net?: number; commission?: number } {
    const idx = this.state.owned.findIndex(p => p.id === propertyId)
    if (idx < 0) return { ok: false, reason: 'Nicht im Besitz' }
    const p = this.state.owned[idx]
    const sellPrice = Math.round(p.marketValue * 0.96)  // 4% transaction cost
    let payoff = 0
    if (p.loanId) {
      const ln = this.state.loans.find(l => l.id === p.loanId)
      if (ln) {
        payoff = Math.round(ln.principal * 1.01) // 1% prepayment penalty
        this.state.loans = this.state.loans.filter(l => l.id !== p.loanId)
      }
    }
    let commission = 0
    if (sellBrokerId) {
      const broker = this.state.brokers.find(b => b.id === sellBrokerId)
      if (broker && broker.id !== 'do_it_yourself') {
        commission = Math.round(sellPrice * broker.commissionPct)
      }
    }
    const net = sellPrice - payoff - commission
    this.state.player.cash += net
    this.state.owned.splice(idx, 1)
    this.emit('sold', { property: p, sellPrice, payoff, net, commission })
    const commTag = commission > 0 ? `, Provision -${formatEuro(commission)}` : ''
    this.emit('toast', { kind: 'success', text: `${this.nameFor(p)} verkauft (Netto ${formatEuro(net)}${commTag})` })
    this.autoSave()
    return { ok: true, net, commission }
  }

  // ============ RENOVATION (M2.5) ============

  /** Per-Gewerk baseline cost (pre-property-multiplier) and base duration in days. */
  private static GEWERK_SPEC: Record<GewerkKind, { label: string; baseCost: number; baseDays: number; rentBoost: number; conditionGain: number; finishing: boolean; capexLink?: CapexKind }> = {
    abbruch:         { label: 'Abbruch & Entkernung',  baseCost: 4500,  baseDays: 12, rentBoost: 0,    conditionGain: 0,  finishing: false },
    rohbau:          { label: 'Rohbau / Wanddurchbrueche', baseCost: 9000, baseDays: 18, rentBoost: 0.01, conditionGain: 4, finishing: false },
    sanitaer:        { label: 'Sanitaer-Rohinstallation', baseCost: 8500,  baseDays: 14, rentBoost: 0.02, conditionGain: 6,  finishing: false, capexLink: 'steigstrang' },
    elektrik:        { label: 'Elektrik-Rohinstallation', baseCost: 7500,  baseDays: 12, rentBoost: 0.02, conditionGain: 6,  finishing: false, capexLink: 'elektrik' },
    heizung_install: { label: 'Heizung einbauen',         baseCost: 14000, baseDays: 16, rentBoost: 0.03, conditionGain: 8,  finishing: false, capexLink: 'heizung' },
    fenster_install: { label: 'Fenster tauschen',         baseCost: 8000,  baseDays: 10, rentBoost: 0.03, conditionGain: 6,  finishing: false, capexLink: 'fenster' },
    dach_decken:     { label: 'Dach decken',              baseCost: 22000, baseDays: 22, rentBoost: 0.02, conditionGain: 8,  finishing: false, capexLink: 'dach' },
    fassade_putz:    { label: 'Fassade verputzen',        baseCost: 18000, baseDays: 20, rentBoost: 0.03, conditionGain: 7,  finishing: false, capexLink: 'fassade' },
    estrich:         { label: 'Estrich legen',            baseCost: 6000,  baseDays: 10, rentBoost: 0.01, conditionGain: 4,  finishing: false },
    trockenbau:      { label: 'Trockenbau / Putz',        baseCost: 5500,  baseDays: 12, rentBoost: 0.01, conditionGain: 3,  finishing: false },
    fliesen:         { label: 'Fliesen (Bad/Kueche)',     baseCost: 7000,  baseDays: 14, rentBoost: 0.04, conditionGain: 5,  finishing: true },
    maler:           { label: 'Maler',                     baseCost: 3500,  baseDays: 8,  rentBoost: 0.02, conditionGain: 4,  finishing: true },
    boden:           { label: 'Boden verlegen',           baseCost: 5500,  baseDays: 9,  rentBoost: 0.03, conditionGain: 5,  finishing: true },
    endmontage:      { label: 'Endmontage & Uebergabe',   baseCost: 2500,  baseDays: 6,  rentBoost: 0.01, conditionGain: 2,  finishing: true },
  }

  /** Default Gewerk sequence per scope. Player can re-order at their own risk. */
  private static SCOPE_PLAN: Record<RenovationScope, GewerkKind[]> = {
    capex: [],  // capex sequences are derived from CapexEvent.kind
    basic: ['maler', 'boden'],
    modern: ['abbruch', 'rohbau', 'sanitaer', 'elektrik', 'estrich', 'trockenbau', 'maler', 'boden', 'endmontage'],
    luxury: ['abbruch', 'rohbau', 'sanitaer', 'elektrik', 'heizung_install', 'fenster_install', 'estrich', 'trockenbau', 'fliesen', 'maler', 'boden', 'endmontage'],
  }

  /** Map a Capex kind to the single Gewerk that fixes it. */
  private static CAPEX_TO_GEWERK: Record<CapexKind, GewerkKind> = {
    elektrik: 'elektrik', fenster: 'fenster_install', steigstrang: 'sanitaer',
    fassade: 'fassade_putz', heizung: 'heizung_install', dach: 'dach_decken',
  }

  /** Tier multipliers — premium is more expensive but quality+lower risk. */
  private static TIER_PROFILE: Record<ContractorTier, { costMult: number; durMult: number; overrun: number; pfusch: number; insolv: number; quality: number }> = {
    cheap:    { costMult: 0.78, durMult: 1.30, overrun: 0.30, pfusch: 0.20, insolv: 0.020, quality: -2 },
    standard: { costMult: 1.00, durMult: 1.00, overrun: 0.10, pfusch: 0.08, insolv: 0.003, quality: 0  },
    premium:  { costMult: 1.30, durMult: 0.85, overrun: 0.04, pfusch: 0.02, insolv: 0.000, quality: 4  },
    gu:       { costMult: 1.20, durMult: 0.90, overrun: 0.00, pfusch: 0.05, insolv: 0.000, quality: 2  },
  }

  private static CONTRACTOR_FIRST_NAMES = ['Klaus', 'Heinz', 'Murat', 'Bogdan', 'Stefan', 'Goran', 'Ali', 'Jens', 'Mario', 'Andrzej', 'Dimitri', 'Hassan', 'Frank', 'Werner', 'Thomas', 'Dragan']
  private static CONTRACTOR_LAST_NAMES = ['Werk', 'Schmidt', 'Yilmaz', 'Kowalski', 'Maier', 'Petrovic', 'Hassan', 'Mueller', 'Ricci', 'Novak', 'Becker', 'Aydin', 'Vogel', 'Krause', 'Lehmann', 'Stojanovic']
  private static CONTRACTOR_BLURBS: Record<ContractorTier, string[]> = {
    cheap: ['kommt mit Sprinter und 2 Mann', 'macht alles in cash, fragt nicht viel', 'hat nicht viel zu sagen, kommt aber morgens'],
    standard: ['solides Mittelstands-Buero', 'redet wenig, arbeitet ordentlich', 'Meisterbetrieb mit Innungs-Schein'],
    premium: ['Fachbetrieb mit Architekten-Empfehlung', 'arbeitet auch fuer Denkmalschutz', 'jeden Tag Bauleiter vor Ort'],
    gu: ['kompletter Generalunternehmer-Service', 'einer fuer alles, garantiert Pauschalpreis', 'koordiniert alle Gewerke selbst'],
  }

  /** Generate ~30 contractors at game init — persistent so loyalty across jobs works. */
  private generateContractorPool(): import('./types').ContractorPoolEntry[] {
    const out: import('./types').ContractorPoolEntry[] = []
    const tiers: ContractorTier[] = ['cheap', 'cheap', 'standard', 'standard', 'standard', 'premium', 'gu']
    const gewerke = Object.keys(Engine.GEWERK_SPEC) as GewerkKind[]
    let seed = (Math.random() * 1_000_000) | 0
    const rnd = () => { seed = (seed + 0x9e3779b9) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
    for (let i = 0; i < 32; i++) {
      const tier = tiers[Math.floor(rnd() * tiers.length)]
      const fn = Engine.CONTRACTOR_FIRST_NAMES[Math.floor(rnd() * Engine.CONTRACTOR_FIRST_NAMES.length)]
      const ln = Engine.CONTRACTOR_LAST_NAMES[Math.floor(rnd() * Engine.CONTRACTOR_LAST_NAMES.length)]
      const specialty: GewerkKind | 'gu' = tier === 'gu' ? 'gu' : gewerke[Math.floor(rnd() * gewerke.length)]
      const profile = Engine.TIER_PROFILE[tier]
      const blurbs = Engine.CONTRACTOR_BLURBS[tier]
      out.push({
        id: 'c_' + i.toString(36) + '_' + (seed >>> 0).toString(36).slice(-3),
        name: `${fn} ${ln}`,
        tier,
        specialty,
        // small per-contractor jitter on top of tier baseline
        baseOverrunChance: Math.max(0, profile.overrun + (rnd() - 0.5) * 0.05),
        basePfuschChance: Math.max(0, profile.pfusch + (rnd() - 0.5) * 0.04),
        baseInsolvencyChance: Math.max(0, profile.insolv + (rnd() - 0.5) * 0.005),
        baseQualityBonus: profile.quality + Math.round((rnd() - 0.5) * 2),
        blurb: blurbs[Math.floor(rnd() * blurbs.length)],
      })
    }
    return out
  }

  /** Compute the player's loyalty discount for a contractor (0..0.15). */
  private loyaltyDiscount(contractorId: string): number {
    const rel = this.state.player.contractorRelations.find(r => r.contractorId === contractorId)
    if (!rel) return 0
    return Math.min(0.15, rel.jobsCompleted * 0.05)
  }

  /** Default plan for a scope OR the single-Gewerk plan for a capex. */
  plansForScope(p: Property, scope: RenovationScope): GewerkKind[] {
    if (scope === 'capex') {
      const cap = p.pendingCapex
      if (!cap) return []
      return [Engine.CAPEX_TO_GEWERK[cap.kind]]
    }
    return Engine.SCOPE_PLAN[scope].slice()
  }

  /** Generate 3 contractor offers for one Gewerk on one property. Includes the player's
   *  loyal contractors first when they fit. Use `costForOffer` to derive the actual €. */
  generateOffersForGewerk(propertyId: string, gewerk: GewerkKind): ContractorOffer[] {
    const p = this.state.owned.find(pp => pp.id === propertyId)
    if (!p) return []
    const pool = this.state.contractorPool.filter(c => c.tier !== 'gu')
    // Sort: loyal contractors first (they "make time" for repeat customers)
    pool.sort((a, b) => (this.loyaltyDiscount(b.id) - this.loyaltyDiscount(a.id)))
    // Pick 3 — one per non-gu tier ideally
    const byTier = new Map<ContractorTier, typeof pool[0]>()
    for (const c of pool) {
      if (!byTier.has(c.tier)) byTier.set(c.tier, c)
      if (byTier.size === 3) break
    }
    const picks = Array.from(byTier.values()).slice(0, 3)
    while (picks.length < 3 && pool[picks.length]) picks.push(pool[picks.length])

    return picks.map((c, i) => {
      const tierProfile = Engine.TIER_PROFILE[c.tier]
      const loyalty = this.loyaltyDiscount(c.id)
      const loyaltyTag = loyalty > 0 ? ` -${Math.round(loyalty * 100)}% Loyalitaet` : ''
      return {
        id: 'o_' + propertyId + '_' + gewerk + '_' + i,
        contractorId: c.id,
        contractorName: c.name + loyaltyTag,
        tier: c.tier,
        specialty: c.specialty === 'gu' ? gewerk : c.specialty,
        costMultiplier: tierProfile.costMult * (1 - loyalty),
        durationMultiplier: tierProfile.durMult,
        overrunChance: c.baseOverrunChance,
        pfuschChance: c.basePfuschChance,
        insolvencyChance: c.baseInsolvencyChance,
        qualityBonus: c.baseQualityBonus,
        blurb: c.blurb,
      } as ContractorOffer
    })
  }

  /** Single GU offer: covers the entire scope as one contract. */
  generateGUOffer(propertyId: string, scope: RenovationScope): ContractorOffer | null {
    const p = this.state.owned.find(pp => pp.id === propertyId)
    if (!p) return null
    const plan = this.plansForScope(p, scope)
    if (plan.length === 0) return null
    const sizeFactor = 0.85 + (p.baseRent / 2500)
    const totalBase = plan.reduce((s, g) => s + Engine.GEWERK_SPEC[g].baseCost * sizeFactor, 0)
    const totalDays = plan.reduce((s, g) => s + Engine.GEWERK_SPEC[g].baseDays, 0)
    // Pick the best loyalty-relevant GU from pool, otherwise generate a stable one
    const guPool = this.state.contractorPool.filter(c => c.tier === 'gu')
    guPool.sort((a, b) => this.loyaltyDiscount(b.id) - this.loyaltyDiscount(a.id))
    const c = guPool[0]
    if (!c) return null
    const profile = Engine.TIER_PROFILE.gu
    const loyalty = this.loyaltyDiscount(c.id)
    const markup = 0.20  // fixed GU markup
    const loyaltyTag = loyalty > 0 ? ` -${Math.round(loyalty * 100)}% Loyalitaet` : ''
    void totalBase; void totalDays
    return {
      id: 'gu_' + propertyId + '_' + scope,
      contractorId: c.id,
      contractorName: c.name + loyaltyTag,
      tier: 'gu' as ContractorTier,
      specialty: 'gu' as 'gu',
      costMultiplier: (1 + markup) * (1 - loyalty),
      durationMultiplier: profile.durMult,
      overrunChance: 0,
      pfuschChance: c.basePfuschChance,
      insolvencyChance: 0,
      qualityBonus: c.baseQualityBonus,
      blurb: c.blurb,
    } as ContractorOffer
  }

  /** Compute an offer's actual euros and duration for UI / startRenovation use. */
  costForOffer(offer: ContractorOffer, gewerk: GewerkKind, p: Property, isSchwarz: boolean, material: 'standard' | 'premium'): { cost: number; duration: number } {
    const spec = Engine.GEWERK_SPEC[gewerk]
    const sizeFactor = 0.85 + (p.baseRent / 2500)
    const baseCost = spec.baseCost * sizeFactor
    let cost = baseCost * offer.costMultiplier
    if (material === 'premium' && spec.finishing) cost *= 1.30
    if (isSchwarz) cost *= 0.65  // -35% for off-the-books
    return { cost: Math.round(cost), duration: Math.round(spec.baseDays * offer.durationMultiplier) }
  }

  /**
   * Plan for the player to commit. Each item names a Gewerk + chosen offer + flags.
   * For GU mode pass `gu: true` and a single offer; the engine will derive steps.
   */
  startRenovation(
    propertyId: string,
    scope: RenovationScope,
    plan: { gewerk: GewerkKind; offer: ContractorOffer; isSchwarz: boolean; material: 'standard' | 'premium' }[],
    isGU: boolean,
  ): { ok: boolean; reason?: string; contract?: RenovationContract } {
    const p = this.state.owned.find(pp => pp.id === propertyId)
    if (!p) return { ok: false, reason: 'Nicht im Besitz' }
    if (p.activeRenovation) return { ok: false, reason: 'Bereits eine Renovierung aktiv' }
    if (plan.length === 0) return { ok: false, reason: 'Kein Plan' }
    const steps: GewerkStep[] = plan.map((row, i) => {
      const { cost, duration } = this.costForOffer(row.offer, row.gewerk, p, row.isSchwarz, row.material)
      return {
        id: 's_' + i + '_' + row.gewerk,
        gewerk: row.gewerk,
        contractorId: row.offer.contractorId,
        contractorName: row.offer.contractorName.split(' -')[0],  // strip the loyalty tag
        contractorTier: row.offer.tier,
        baseCost: cost,
        agreedCost: cost,
        paidSoFar: 0,
        durationDays: duration,
        daysRemaining: duration,
        status: i === 0 ? 'active' : 'pending',
        isSchwarz: row.isSchwarz,
        material: row.material,
        warrantyMonths: row.isSchwarz ? 0 : 60,
      }
    })
    const totalCost = steps.reduce((s, st) => s + st.agreedCost, 0)
    if (this.state.player.cash < totalCost * 0.3) return { ok: false, reason: `Mindestens 30% Anzahlung (${formatEuro(Math.round(totalCost * 0.3))}) benoetigt.` }

    // KfW eligibility: must include heizung+fenster+fassade in the same project (energetic combo)
    const gewerkSet = new Set(plan.map(r => r.gewerk))
    const kfwEligible = gewerkSet.has('heizung_install') && gewerkSet.has('fenster_install') && gewerkSet.has('fassade_putz')
    const kfwSubsidyPct = kfwEligible ? 0.30 : 0

    // Modernisierung eligibility — at least one occupied unit must benefit
    const modernizationEligible = (scope === 'modern' || scope === 'luxury') && p.units.some(u => u.tenant)

    // Effects on completion (sum of gewerk contributions)
    const conditionGain = plan.reduce((s, r) => s + Engine.GEWERK_SPEC[r.gewerk].conditionGain + (r.material === 'premium' ? 2 : 0), 0)
    const rentMult = 1 + plan.reduce((s, r) => s + Engine.GEWERK_SPEC[r.gewerk].rentBoost + (r.material === 'premium' ? 0.01 : 0), 0)
    const valueMult = 1 + (rentMult - 1) * 0.6  // value follows rent boost dampened

    const contract: RenovationContract = {
      id: 'r_' + Math.random().toString(36).slice(2, 9),
      propertyId,
      scope,
      isGU,
      guMarkup: isGU ? 0.20 : 0,
      steps,
      currentStepIndex: 0,
      startMonth: this.gameMonth(),
      totalAgreedCost: totalCost,
      totalPaidSoFar: 0,
      rentReductionPct: scope === 'capex' || scope === 'basic' ? 0.05 : 0.15,
      conditionGainOnComplete: conditionGain,
      rentMultOnComplete: rentMult,
      valueMultOnComplete: valueMult,
      modernizationEligible,
      kfwSubsidyPct,
      status: 'active',
    }
    p.activeRenovation = contract

    // Anzahlung — 30% upfront, the rest accrues per step completion
    const downPayment = Math.round(totalCost * 0.3)
    this.state.player.cash -= downPayment
    contract.totalPaidSoFar = downPayment

    // Track Schwarz jobs immediately (regardless of completion — the work is happening)
    const schwarzCount = plan.filter(r => r.isSchwarz).length
    if (schwarzCount > 0) {
      this.state.player.schwarzJobsThisYear += schwarzCount
      this.state.player.totalSchwarzJobs += schwarzCount
    }

    this.emit('renovationStart', { contract })
    this.emit('toast', { kind: 'success', text: `Renovierung gestartet — Anzahlung ${formatEuro(downPayment)}, ${steps.length} Gewerke, ~${Math.round(steps.reduce((s, st) => s + st.durationDays, 0) / 30)} Monate.` })
    this.autoSave()
    return { ok: true, contract }
  }

  cancelRenovation(propertyId: string): { ok: boolean; refund?: number; reason?: string } {
    const p = this.state.owned.find(pp => pp.id === propertyId)
    if (!p?.activeRenovation) return { ok: false, reason: 'Keine aktive Renovierung' }
    const c = p.activeRenovation
    // Refund: 50% of unpaid, lose the rest as Vertragsstrafe
    const unpaid = c.totalAgreedCost - c.totalPaidSoFar
    const refund = Math.round(unpaid * 0.5)
    this.state.player.cash += refund
    c.status = 'cancelled'
    p.activeRenovation = undefined
    this.emit('toast', { kind: 'warning', text: `Renovierung abgebrochen — Restzahlung halbiert zurueck (${formatEuro(refund)}). Restkosten verloren.` })
    this.autoSave()
    return { ok: true, refund }
  }

  /** §559 BGB Modernisierungsumlage — 11% of agreedKaltMiete legally added once per modernization,
   *  no Mietspiegel-related lawsuit risk. Only after a 'modern' or 'luxury' renovation completed
   *  with a tenant in place. */
  applyModernisierungUmlage(propertyId: string): { ok: boolean; reason?: string; newKalt?: number } {
    const p = this.state.owned.find(pp => pp.id === propertyId)
    if (!p) return { ok: false, reason: 'Nicht im Besitz' }
    if (!p.modernizationUmlageAvailable) return { ok: false, reason: 'Keine Umlage verfuegbar — erst nach Modernisierung mit Mieter' }
    const occupied = p.units.filter(u => u.tenant)
    if (occupied.length === 0) return { ok: false, reason: 'Kein Mieter' }
    let totalNewKalt = 0
    for (const u of occupied) {
      const newKalt = Math.round(u.tenant!.agreedKaltMiete * 1.11)
      u.tenant!.agreedKaltMiete = newKalt
      totalNewKalt += newKalt
    }
    p.modernizationUmlageAvailable = false
    this.syncHeadlineFromUnits(p)
    this.emit('toast', { kind: 'success', text: `Modernisierungsumlage angewandt — alle Mieten +11% (Summe ${formatEuro(totalNewKalt)} kalt), ohne Klagerisiko.` })
    this.autoSave()
    return { ok: true, newKalt: totalNewKalt }
  }

  // ============ WG / MFH / WEG (M5) ============

  /** Convert a single-family property to a WG (Wohngemeinschaft) — splits the unit
   *  into 3-5 small rooms with shared kitchen, ~30% higher total Kalt potential. */
  convertToWG(propertyId: string): { ok: boolean; reason?: string; cost?: number } {
    const p = this.state.owned.find(pp => pp.id === propertyId)
    if (!p) return { ok: false, reason: 'Nicht im Besitz' }
    if (p.buildingForm !== 'single') return { ok: false, reason: 'Nur Einzelwohnungen koennen zur WG umgebaut werden' }
    if (p.units.some(u => u.tenant)) return { ok: false, reason: 'Wohnung muss leer sein' }
    if (p.condition < 60) return { ok: false, reason: 'Zustand muss mindestens 60% sein (sonst Umbau riskant)' }
    const oldUnit = p.units[0]
    const totalSqm = oldUnit.sqm
    const totalKalt = oldUnit.baseKalt
    const cost = Math.round(30000 * (totalSqm / 60))
    if (this.state.player.cash < cost) return { ok: false, reason: `Brauchst ${formatEuro(cost)}` }

    const roomCount = Math.max(3, Math.min(5, Math.floor(totalSqm / 18)))
    const newKaltTotal = Math.round(totalKalt * 1.30)
    const perRoomKalt = Math.round(newKaltTotal / roomCount)
    const perRoomNk = Math.round(perRoomKalt * 0.30)  // shared utilities a touch higher per head
    const perRoomSqm = Math.round(totalSqm / roomCount)

    p.units = []
    for (let i = 0; i < roomCount; i++) {
      p.units.push({
        id: 'u_' + Math.random().toString(36).slice(2, 6),
        label: `Zimmer ${i + 1}`,
        sqm: perRoomSqm,
        baseKalt: perRoomKalt,
        nebenkosten: perRoomNk,
        vacantMonths: 0,
      })
    }
    p.buildingForm = 'wg'
    p.condition = Math.min(100, p.condition + 8)  // small condition bump from rebuild
    this.state.player.cash -= cost
    this.syncHeadlineFromUnits(p)
    this.emit('renovated', { property: p, level: 'wg-conversion', cost })
    this.emit('toast', { kind: 'success', text: `${this.nameFor(p)} zur WG umgebaut — ${roomCount} Zimmer (-${formatEuro(cost)}, +30% Mietpotenzial).` })
    this.autoSave()
    return { ok: true, cost }
  }

  // ----- WEG: Eigentuemerversammlung -----

  private static WEG_PROPOSALS: Array<Omit<WEGProposal, 'id'>> = [
    {
      topic: 'fassade-sanierung',
      title: 'Fassaden-Sanierung beschliessen',
      body: 'Die Fassade broeckelt. Verwaltung schlaegt energetische Sanierung vor.',
      totalCost: 80000,
      conditionImpactIfYes: +12,
      conditionImpactIfNo: -8,
      consequenceIfYes: 'Sonderumlage anteilig, Zustand +12, langfristig weniger Capex',
      consequenceIfNo: 'Zustand -8 in 12 Monaten, Capex-Risiko steigt',
    },
    {
      topic: 'dach-sanierung',
      title: 'Dach erneuern',
      body: 'Bei Starkregen tropft es ins Treppenhaus. Komplette Eindeckung empfohlen.',
      totalCost: 120000,
      conditionImpactIfYes: +15,
      conditionImpactIfNo: -10,
      consequenceIfYes: 'Sonderumlage, Zustand +15, kein Dach-Capex 20 Jahre',
      consequenceIfNo: 'Risiko Dach-Capex in 12 Monaten',
    },
    {
      topic: 'heizung-tausch',
      title: 'Heizungstausch (Gas → Waermepumpe)',
      body: 'Die alte Heizung muss raus. Waermepumpe ist KfW-foerderbar.',
      totalCost: 95000,
      conditionImpactIfYes: +10,
      conditionImpactIfNo: -6,
      consequenceIfYes: 'Sonderumlage, Zustand +10, langfristig billiger',
      consequenceIfNo: 'Heizungs-Capex bleibt latent',
    },
    {
      topic: 'aufzug-modernisierung',
      title: 'Aufzug modernisieren',
      body: 'Steckenbleiben haeuft sich. Neuer Antrieb + Steuerung.',
      totalCost: 60000,
      conditionImpactIfYes: +6,
      conditionImpactIfNo: -3,
      consequenceIfYes: 'Sonderumlage, kleine Wertsteigerung',
      consequenceIfNo: 'Komfort sinkt — Mieter beschweren sich',
    },
    {
      topic: 'fahrradraum',
      title: 'Fahrradraum + Lastenrad-Stellplaetze',
      body: 'Nachfrage gross, Investition niedrig.',
      totalCost: 12000,
      conditionImpactIfYes: +2,
      conditionImpactIfNo: 0,
      consequenceIfYes: 'Kleine Sonderumlage, Mieter zufriedener',
      consequenceIfNo: 'Status quo',
    },
    {
      topic: 'hausordnung',
      title: 'Hausordnung verschaerfen (Ruhezeiten)',
      body: 'Beschwerden ueber Laerm. Strengere Regeln vorgeschlagen.',
      totalCost: 0,
      conditionImpactIfYes: +1,
      conditionImpactIfNo: 0,
      consequenceIfYes: 'Ruhigere Mieter ziehen ein, partyer ziehen weg',
      consequenceIfNo: 'Status quo',
    },
    {
      topic: 'hausverwaltung-wechsel',
      title: 'Hausverwaltung wechseln',
      body: 'Aktuelle Verwaltung schlampt mit Abrechnungen.',
      totalCost: 0,
      conditionImpactIfYes: +1,
      conditionImpactIfNo: -1,
      consequenceIfYes: 'Mehr Transparenz, kein Cash-Effekt',
      consequenceIfNo: 'Status quo, weiter Frustration',
    },
  ]

  /** Each month, check if any WEG-property of the player is due for an assembly.
   *  Frequency: every 12 game-months from `wegMembership.nextAssemblyMonth`. */
  private maybeScheduleWegAssembly(p: Property, rng: () => number) {
    if (!p.wegMembership) return
    if (this.gameMonth() < p.wegMembership.nextAssemblyMonth) return
    if (this.state.wegAssemblies.some(a => a.propertyId === p.id && !a.decided)) return  // one at a time

    const proposalCount = 2 + Math.floor(rng() * 3)
    const pool = Engine.WEG_PROPOSALS.slice()
    const proposals: WEGProposal[] = []
    for (let i = 0; i < proposalCount && pool.length > 0; i++) {
      const idx = Math.floor(rng() * pool.length)
      const tpl = pool.splice(idx, 1)[0]
      proposals.push({ ...tpl, id: 'pr_' + Math.random().toString(36).slice(2, 6) })
    }
    const playerShare = p.wegMembership.unitsOwned / p.wegMembership.totalUnits
    this.state.wegAssemblies.push({
      id: 'a_' + Math.random().toString(36).slice(2, 9),
      propertyId: p.id,
      scheduledMonth: this.gameMonth(),
      proposals,
      playerShare,
      playerVotes: {},
      decided: false,
      outcomes: {},
    })
    p.wegMembership.nextAssemblyMonth = this.gameMonth() + 12
    this.emit('wegAssembly', { propertyId: p.id })
    this.emit('toast', { kind: 'info', text: `📋 Eigentuemerversammlung in ${this.nameFor(p)} — ${proposals.length} Tagesordnungspunkte. Stimmenanteil ${(playerShare * 100).toFixed(0)}%.` })
  }

  castWegVote(assemblyId: string, proposalId: string, vote: 'yes' | 'no' | 'abstain') {
    const a = this.state.wegAssemblies.find(x => x.id === assemblyId)
    if (!a || a.decided) return
    a.playerVotes[proposalId] = vote
  }

  /** Apply the outcome of a finalized WEG assembly to the player's property. */
  finalizeWegAssembly(assemblyId: string): { ok: boolean; reason?: string } {
    const a = this.state.wegAssemblies.find(x => x.id === assemblyId)
    if (!a) return { ok: false, reason: 'Versammlung nicht gefunden' }
    if (a.decided) return { ok: false, reason: 'Bereits entschieden' }
    const p = this.state.owned.find(pp => pp.id === a.propertyId)
    if (!p) return { ok: false, reason: 'Property nicht mehr im Besitz' }

    for (const prop of a.proposals) {
      const playerVote = a.playerVotes[prop.id] ?? 'abstain'
      // Other owners vote based on the proposal's economic appeal — energetic/required
      // upgrades pass at 60-70% support, optional comfort items at 40-50%.
      const baselineSupport = (prop.topic === 'dach-sanierung' || prop.topic === 'fassade-sanierung' || prop.topic === 'heizung-tausch') ? 0.65
        : (prop.topic === 'aufzug-modernisierung' || prop.topic === 'fahrradraum') ? 0.45
        : 0.50
      const otherShare = 1 - a.playerShare
      const yesFromOthers = baselineSupport * otherShare
      const yesFromPlayer = playerVote === 'yes' ? a.playerShare : (playerVote === 'no' ? 0 : a.playerShare * 0.5)
      const totalYes = yesFromOthers + yesFromPlayer
      const passed = totalYes >= 0.5
      a.outcomes[prop.id] = passed ? 'passed' : 'rejected'

      if (passed) {
        const playerCost = Math.round(prop.totalCost * a.playerShare)
        if (playerCost > 0) this.state.player.cash -= playerCost
        p.condition = Math.max(0, Math.min(100, p.condition + prop.conditionImpactIfYes))
        if (playerCost > 0) {
          this.emit('toast', { kind: 'info', text: `WEG: "${prop.title}" beschlossen — Sonderumlage ${formatEuro(playerCost)}.` })
        } else {
          this.emit('toast', { kind: 'info', text: `WEG: "${prop.title}" beschlossen.` })
        }
      } else {
        p.condition = Math.max(0, Math.min(100, p.condition + prop.conditionImpactIfNo))
      }
    }
    a.decided = true
    this.autoSave()
    return { ok: true }
  }

  /** Tick the active renovation: advance current step, complete steps, roll risks. */
  private tickRenovation(p: Property, rng: () => number) {
    if (!p.activeRenovation) return
    const c = p.activeRenovation
    if (c.status !== 'active') return
    const step = c.steps[c.currentStepIndex]
    if (!step) return
    // 1 month = 30 days of work
    step.daysRemaining -= 30

    // Insolvency roll mid-step (cheap only, very rare)
    if (step.status === 'active' && step.contractorTier === 'cheap') {
      const insolveProb = Engine.TIER_PROFILE.cheap.insolv
      if (rng() < insolveProb) {
        const lost = step.paidSoFar
        this.emit('toast', { kind: 'error', text: `${step.contractorName} ist pleite! Anzahlung ${formatEuro(lost)} verloren — Auftrag fuer ${Engine.GEWERK_SPEC[step.gewerk].label} wird neu vergeben.` })
        // Replace with a standard-tier emergency contractor at +20% cost
        const replacement = this.state.contractorPool.find(c2 => c2.tier === 'standard') || this.state.contractorPool[0]
        if (replacement) {
          step.contractorId = replacement.id
          step.contractorName = replacement.name + ' (Notfall +20%)'
          step.contractorTier = 'standard'
          const extra = Math.round(step.agreedCost * 0.2)
          step.agreedCost += extra
          c.totalAgreedCost += extra
          step.daysRemaining = step.durationDays  // restart duration
        }
      }
    }

    // Mid-project Nachforderung roll (once per step, after ~50% done)
    if (step.status === 'active' && !step.overrunTriggered && step.daysRemaining < step.durationDays * 0.5) {
      const profile = Engine.TIER_PROFILE[step.contractorTier]
      if (rng() < profile.overrun) {
        step.overrunTriggered = true
        const factor = 0.20 + rng() * 0.20  // +20-40%
        const extra = Math.round(step.agreedCost * factor)
        step.agreedCost += extra
        c.totalAgreedCost += extra
        // Auto-approved but visible — could become a player-decision modal later
        this.emit('toast', { kind: 'warning', text: `Nachforderung von ${step.contractorName}: +${formatEuro(extra)} fuer ${Engine.GEWERK_SPEC[step.gewerk].label}.` })
      }
    }

    // Completion?
    if (step.daysRemaining <= 0) {
      // Final payment for this step (remaining unpaid portion, proportional)
      const stepShare = step.agreedCost - step.paidSoFar
      this.state.player.cash -= stepShare
      step.paidSoFar = step.agreedCost
      c.totalPaidSoFar += stepShare
      step.status = 'done'

      // Pfusch roll on completion (delayed capex 6-18 months out)
      if (!step.isSchwarz && step.warrantyMonths > 0) {
        // official work — pfusch chance reduced by warranty
        const profile = Engine.TIER_PROFILE[step.contractorTier]
        if (rng() < profile.pfusch * 0.5) {
          step.pfuschTriggered = true
          this.schedulePfusch(p, step.gewerk, rng)
        }
      } else {
        // Schwarz — full pfusch chance
        const profile = Engine.TIER_PROFILE[step.contractorTier]
        if (rng() < profile.pfusch * 1.5) {
          step.pfuschTriggered = true
          this.schedulePfusch(p, step.gewerk, rng)
        }
      }

      // Update loyalty — completed jobs count
      this.bumpLoyalty(step.contractorId, step.contractorName, step.agreedCost)

      this.emit('toast', { kind: 'info', text: `${Engine.GEWERK_SPEC[step.gewerk].label} fertig (${step.contractorName}).` })

      // Advance to next step or finish
      c.currentStepIndex++
      if (c.currentStepIndex >= c.steps.length) {
        this.completeRenovation(p)
      } else {
        c.steps[c.currentStepIndex].status = 'active'
      }
    }
  }

  private completeRenovation(p: Property) {
    if (!p.activeRenovation) return
    const c = p.activeRenovation
    p.condition = Math.min(100, p.condition + c.conditionGainOnComplete)
    p.baseRent = Math.round(p.baseRent * c.rentMultOnComplete)
    p.marketValue = Math.round(p.marketValue * c.valueMultOnComplete)
    p.lastRenovationMonth = this.gameMonth()
    if (c.modernizationEligible) p.modernizationUmlageAvailable = true
    if (c.kfwSubsidyPct > 0) {
      const refund = Math.round(c.totalAgreedCost * c.kfwSubsidyPct)
      this.state.kfwPending.push({ id: 'kfw_' + Math.random().toString(36).slice(2, 9), triggerMonth: this.gameMonth() + 2, amount: refund })
      this.emit('toast', { kind: 'success', text: `Renovierung abgeschlossen. KfW-Foerderung ${formatEuro(refund)} kommt in 2 Monaten.` })
    } else {
      this.emit('toast', { kind: 'success', text: `Renovierung abgeschlossen — Zustand +${c.conditionGainOnComplete}, Miete +${Math.round((c.rentMultOnComplete - 1) * 100)}%.` })
    }
    c.status = 'done'
    p.activeRenovation = undefined
    this.emit('renovationDone', { property: p, contract: c })
  }

  private schedulePfusch(p: Property, gewerk: GewerkKind, rng: () => number) {
    const spec = Engine.GEWERK_SPEC[gewerk]
    const capexKind: CapexKind = spec.capexLink ?? 'elektrik'
    const trigger = this.gameMonth() + 6 + Math.floor(rng() * 12)
    this.state.pfuschPending.push({
      id: 'pf_' + Math.random().toString(36).slice(2, 9),
      propertyId: p.id,
      triggerMonth: trigger,
      capexKind,
      costEstimate: spec.baseCost * 1.5,
    })
  }

  private bumpLoyalty(contractorId: string, contractorName: string, jobAmount: number) {
    let rel = this.state.player.contractorRelations.find(r => r.contractorId === contractorId)
    if (!rel) {
      rel = { contractorId, contractorName, jobsCompleted: 0, totalSpent: 0, lastJobMonth: this.gameMonth() }
      this.state.player.contractorRelations.push(rel)
    }
    rel.jobsCompleted++
    rel.totalSpent += jobAmount
    rel.lastJobMonth = this.gameMonth()
  }

  /** Tick scheduled pfusch — convert to a proper CapexEvent when its month arrives. */
  private tickPfusch() {
    const m = this.gameMonth()
    const due = this.state.pfuschPending.filter(pf => pf.triggerMonth <= m)
    for (const pf of due) {
      const p = this.state.owned.find(pp => pp.id === pf.propertyId)
      if (!p || p.pendingCapex) continue  // skip if property already has a pending capex
      const cost = Math.round(pf.costEstimate * (0.8 + Math.random() * 0.4))
      p.pendingCapex = {
        id: 'cx_' + Math.random().toString(36).slice(2, 9),
        propertyId: p.id,
        kind: pf.capexKind,
        title: `Pfusch-Folgeschaden: ${pf.capexKind}`,
        body: 'Frueherer Pfusch eines Handwerkers macht sich jetzt bemerkbar. Alles muss nochmal saniert werden.',
        cost,
        conditionImpactIfIgnored: 25,
        conditionGainIfPaid: 12,
        appearedMonth: m,
        deadlineMonth: m + 5,
        state: 'pending',
      }
      this.emit('toast', { kind: 'error', text: `Pfusch-Folgeschaden in ${this.nameFor(p)}: ${formatEuro(cost)} faellig.` })
    }
    this.state.pfuschPending = this.state.pfuschPending.filter(pf => pf.triggerMonth > m)
  }

  /** Tick scheduled KfW refunds — pay out when bureaucracy completes. */
  private tickKfw() {
    const m = this.gameMonth()
    const due = this.state.kfwPending.filter(k => k.triggerMonth <= m)
    for (const k of due) {
      this.state.player.cash += k.amount
      this.emit('toast', { kind: 'success', text: `KfW-Foerderung eingegangen: ${formatEuro(k.amount)}.` })
    }
    this.state.kfwPending = this.state.kfwPending.filter(k => k.triggerMonth > m)
  }

  /** Once a year (January), roll for a tax audit. Probability depends on Schwarz job count,
   *  property portfolio size (more visibility), and district mix (Mitte = high enforcement). */
  private maybeRollTaxAudit() {
    if (this.state.time.month !== 1) return
    if (this.state.player.schwarzJobsThisYear === 0) {
      this.state.player.schwarzJobsThisYear = 0
      return
    }
    // base risk: 4% per Schwarz job this year, modulated by district enforcement
    const properties = this.state.owned
    const enforcement = properties.length === 0 ? 1 : properties.reduce((s, p) => {
      const factor = p.district === 'mitte' ? 1.5 : p.district === 'charlottenburg' ? 1.2
        : p.district === 'wedding' ? 0.5 : p.district === 'neukoelln' ? 0.7 : 1.0
      return s + factor
    }, 0) / properties.length
    const auditProb = Math.min(0.85, 0.04 * this.state.player.schwarzJobsThisYear * enforcement)
    if (Math.random() < auditProb) {
      // Rough penalty: 3x what you "saved" by going Schwarz this year
      // We approximate the saved amount as ~35% of an average Gewerk cost (~6000) per job
      const savedEstimate = this.state.player.schwarzJobsThisYear * 0.35 * 6000
      const fine = Math.round(savedEstimate * 3)
      this.state.player.cash -= fine
      this.state.player.reputation = Math.max(0, this.state.player.reputation - 15)
      this.state.player.creditScore = Math.max(300, this.state.player.creditScore - 50)
      this.state.player.taxAuditsExperienced++
      this.emit('toast', { kind: 'error', text: `🚨 Zoll-Pruefung! ${this.state.player.schwarzJobsThisYear} Schwarz-Jobs entdeckt. Strafe ${formatEuro(fine)}, Reputation -15, Score -50.` })
    }
    this.state.player.schwarzJobsThisYear = 0
  }

  /**
   * Raise the Kaltmiete on an existing tenant.
   * Returns lawsuit risk so the UI can warn before committing.
   * Above Mietspiegel × 1.10 ("Mietpreisbremse"), the tenant may sue:
   *   1.10 → ~0% risk; 1.20 → ~50%; 1.30+ → ~95%.
   * If a suit is filed, raise still applies immediately, but a Lawsuit
   * runs for 4-6 months. Won → keep new rent; lost → revert + Reputation -10.
   */
  raiseRent(propertyId: string, newKalt: number, unitId?: string): { ok: boolean; reason?: string; lawsuitFiled?: boolean; lawsuitChance?: number } {
    const p = this.state.owned.find(pp => pp.id === propertyId)
    if (!p) return { ok: false, reason: 'Nicht im Besitz' }
    const u = unitId ? p.units.find(x => x.id === unitId) : p.units.find(x => x.tenant)
    if (!u || !u.tenant) return { ok: false, reason: 'Kein Mieter — Miete im naechsten Vertrag setzen' }
    const t = u.tenant
    if (newKalt <= t.agreedKaltMiete) return { ok: false, reason: 'Neue Miete muss hoeher sein' }
    // Kappungsgrenze: 12-month cooldown per tenant (BGB §558: max 20% in 3y; we
    // approximate with one hike per 12 months which is the practical equivalent).
    const COOLDOWN_MONTHS = 12
    if (typeof t.lastRentHikeMonth === 'number') {
      const elapsed = this.gameMonth() - t.lastRentHikeMonth
      if (elapsed < COOLDOWN_MONTHS) {
        return { ok: false, reason: `Mieterhoehungs-Sperre noch ${COOLDOWN_MONTHS - elapsed} Monate (Kappungsgrenze).` }
      }
    }

    const ratio = newKalt / Math.max(1, p.mietspiegelKalt)
    const lawsuitChance = ratio <= 1.10 ? 0
      : ratio >= 1.30 ? 0.95
      : (ratio - 1.10) * 5

    const hikePct = (newKalt - t.agreedKaltMiete) / Math.max(1, t.agreedKaltMiete)
    t.satisfaction = Math.max(0, t.satisfaction - hikePct * 60)

    const oldKalt = t.agreedKaltMiete
    t.agreedKaltMiete = newKalt
    t.lastRentHikeMonth = this.gameMonth()
    u.baseKalt = Math.max(u.baseKalt, newKalt)
    this.syncHeadlineFromUnits(p)

    let lawsuitFiled = false
    if (lawsuitChance > 0 && Math.random() < lawsuitChance) {
      lawsuitFiled = true
      const months = 4 + Math.floor(Math.random() * 3)
      const monthlyCost = Math.round((800 + Math.floor(Math.random() * 700)) * this.diffConfig().lawsuitMonthlyMult)
      const successChance = Math.max(0.05, 1 - lawsuitChance)
      this.state.lawsuits.push({
        id: 'ls_' + Math.random().toString(36).slice(2, 9),
        propertyId: p.id,
        reason: 'rent-hike',
        monthsRemaining: months,
        totalMonths: months,
        monthlyCost,
        totalSpent: 0,
        successChance,
        revertToKalt: oldKalt,
        tenantId: t.id,
        outcome: 'pending',
      })
      this.emit('toast', { kind: 'warning', text: `${t.name} reicht Klage gegen Mieterhoehung ein. Anwaltskosten ${formatEuro(monthlyCost)}/M, ${months} Monate.` })
    } else {
      this.emit('toast', { kind: 'success', text: `Miete bei ${this.nameFor(p)} auf ${formatEuro(newKalt)} kalt erhoeht.` })
    }
    this.autoSave()
    return { ok: true, lawsuitFiled, lawsuitChance }
  }

  /** UI helper: show the player the lawsuit risk before they commit */
  rentHikeRisk(propertyId: string, newKalt: number): { ratio: number; lawsuitChance: number } {
    const p = this.state.owned.find(pp => pp.id === propertyId)
    if (!p) return { ratio: 1, lawsuitChance: 0 }
    const ratio = newKalt / Math.max(1, p.mietspiegelKalt)
    const lawsuitChance = ratio <= 1.10 ? 0 : ratio >= 1.30 ? 0.95 : Math.min(1, (ratio - 1.10) * 5)
    return { ratio, lawsuitChance }
  }

  /**
   * Cooperative termination — works only for tenants who'll actually leave when asked
   * (i.e. not Mietnomaden, not deeply in arrears). Costs -5 Reputation.
   * Suggest startEviction() for problem tenants.
   */
  evictTenant(propertyId: string, unitId?: string): { ok: boolean; reason?: string } {
    const p = this.state.owned.find(pp => pp.id === propertyId)
    if (!p) return { ok: false, reason: 'Nicht im Besitz' }
    const u = unitId ? p.units.find(x => x.id === unitId) : p.units.find(x => x.tenant)
    if (!u || !u.tenant) return { ok: false, reason: 'Kein Mieter' }
    const t = u.tenant
    if (t.personality === 'nomad') {
      this.emit('toast', { kind: 'error', text: `${t.name} ignoriert die Kuendigung — nur Raeumungsklage hilft.` })
      return { ok: false, reason: 'Mieter ignoriert Kuendigung — Raeumungsklage einleiten' }
    }
    if (t.monthsBehind >= 2) {
      this.emit('toast', { kind: 'error', text: `${t.name} verweigert Auszug bei Mietrueckstand. Raeumungsklage erforderlich.` })
      return { ok: false, reason: 'Mieter im Rueckstand zieht nicht freiwillig aus' }
    }
    const tenantName = t.name
    u.tenant = undefined
    u.vacantMonths = 0
    this.syncHeadlineFromUnits(p)
    this.state.player.reputation = Math.max(0, this.state.player.reputation - 5)
    this.emit('toast', { kind: 'warning', text: `${tenantName} gekuendigt — Reputation -5` })
    this.autoSave()
    return { ok: true }
  }

  /** UI helper: how good is the eviction case before the player commits? */
  evictionEstimate(propertyId: string, unitId?: string): { months: number; monthlyCost: number; totalCost: number; successChance: number } | null {
    const p = this.state.owned.find(pp => pp.id === propertyId)
    if (!p) return null
    const u = unitId ? p.units.find(x => x.id === unitId) : p.units.find(x => x.tenant)
    if (!u?.tenant) return null
    const t = u.tenant
    const months = 4 + Math.floor(Math.random() * 3)
    const monthlyCost = Math.round((1000 + Math.floor(Math.random() * 500)) * this.diffConfig().lawsuitMonthlyMult)
    const isNomad = t.personality === 'nomad' && !t.disguisePersonality
    const grounds =
      (isNomad ? 0.5 : 0) +
      Math.min(0.4, t.monthsBehind * 0.1) +
      (t.satisfaction < 25 ? 0.05 : 0)
    const successChance = Math.min(0.95, 0.45 + grounds)
    return { months, monthlyCost, totalCost: months * monthlyCost, successChance }
  }

  /** Start a Raeumungsklage. Tenant remains in the property until the suit ends. */
  startEviction(propertyId: string, unitId?: string): { ok: boolean; reason?: string; lawsuit?: Lawsuit } {
    const p = this.state.owned.find(pp => pp.id === propertyId)
    if (!p) return { ok: false, reason: 'Nicht im Besitz' }
    const u = unitId ? p.units.find(x => x.id === unitId) : p.units.find(x => x.tenant)
    if (!u?.tenant) return { ok: false, reason: 'Kein Mieter' }
    const tenantId = u.tenant.id
    if (this.state.lawsuits.some(l => l.propertyId === propertyId && l.reason === 'eviction' && l.tenantId === tenantId && l.outcome === 'pending')) {
      return { ok: false, reason: 'Klage laeuft bereits' }
    }
    const est = this.evictionEstimate(propertyId, u.id)!
    const months = 4 + Math.floor(Math.random() * 3)
    const monthlyCost = Math.round((1000 + Math.floor(Math.random() * 500)) * this.diffConfig().lawsuitMonthlyMult)
    const lawsuit: Lawsuit = {
      id: 'ev_' + Math.random().toString(36).slice(2, 9),
      propertyId,
      reason: 'eviction',
      monthsRemaining: months,
      totalMonths: months,
      monthlyCost,
      totalSpent: 0,
      successChance: est.successChance,
      tenantId,
      outcome: 'pending',
    }
    this.state.lawsuits.push(lawsuit)
    this.emit('toast', { kind: 'warning', text: `Raeumungsklage gegen ${u.tenant.name} eingereicht — ${months} M, ${formatEuro(monthlyCost)}/M, Erfolg ${(est.successChance * 100).toFixed(0)}%.` })
    this.autoSave()
    return { ok: true, lawsuit }
  }

  // ============ CAPEX ============

  /**
   * Major repair roll — building parts wear out by age, accelerated by poor
   * condition. Each property holds at most one pending capex at a time, so we
   * also handle the "deadline reached without payment" branch here.
   */
  private tickCapex(p: Property, rng: () => number) {
    if (p.pendingCapex) {
      // expired?
      if (this.gameMonth() >= p.pendingCapex.deadlineMonth) {
        const cap = p.pendingCapex
        cap.state = 'expired'
        p.condition = Math.max(0, p.condition - cap.conditionImpactIfIgnored)
        for (const u of p.units) if (u.tenant) u.tenant.satisfaction = Math.max(0, u.tenant.satisfaction - 20)
        this.state.capexHistory.push(cap)
        p.pendingCapex = undefined
        this.emit('toast', { kind: 'error', text: `${cap.title} bei ${this.nameFor(p)} ignoriert — Zustand -${cap.conditionImpactIfIgnored}, Mieter sauer.` })
      }
      return
    }
    // Honeymoon: skip capex rolls during the player's first N months.
    if (this.gameMonth() < this.diffConfig().capexHoneymoonMonths) return
    const ev = this.rollCapex(p, rng)
    if (ev) {
      p.pendingCapex = ev
      this.emit('capex', ev)
      this.emit('toast', { kind: 'warning', text: `⚠ ${ev.title} in ${this.nameFor(p)} — ${formatEuro(ev.cost)} binnen ${ev.deadlineMonth - this.gameMonth()} Monaten` })
    }
  }

  /** Tuned probabilities and cost ranges per capex kind. */
  private static CAPEX_TABLE: Record<CapexKind, {
    minAgeYears: number
    baseRiskAtCond50: number    // monthly probability when condition = 50
    minCost: number
    maxCost: number
    impact: number              // condition drop if ignored
    gain: number                // condition rise if paid
    title: string
    body: string
    deadlineMonths: [number, number]  // [min, max] grace period
  }> = {
    elektrik: {
      minAgeYears: 30, baseRiskAtCond50: 0.005, minCost: 4000, maxCost: 9000,
      impact: 22, gain: 12, title: 'Elektrik defekt',
      body: 'Sicherungen fliegen regelmaessig. Stromleitungen muessen erneuert werden.',
      deadlineMonths: [4, 8],
    },
    fenster: {
      minAgeYears: 30, baseRiskAtCond50: 0.006, minCost: 5000, maxCost: 12000,
      impact: 18, gain: 12, title: 'Fenster undicht',
      body: 'Holzfenster aus dem Bestand sind zugig. Mieter beschweren sich ueber Heizkosten.',
      deadlineMonths: [6, 10],
    },
    steigstrang: {
      minAgeYears: 40, baseRiskAtCond50: 0.008, minCost: 8000, maxCost: 15000,
      impact: 25, gain: 15, title: 'Steigstrang muss saniert werden',
      body: 'Das Wassersteigrohr ist marode. Wenn es bricht, gibt es einen Wasserschaden.',
      deadlineMonths: [4, 7],
    },
    fassade: {
      minAgeYears: 40, baseRiskAtCond50: 0.005, minCost: 15000, maxCost: 30000,
      impact: 22, gain: 14, title: 'Fassade broeckelt',
      body: 'Putz fault ab, Fugen gehen auf. Spaetestens jetzt teure Sanierung faellig.',
      deadlineMonths: [8, 14],
    },
    heizung: {
      minAgeYears: 25, baseRiskAtCond50: 0.010, minCost: 12000, maxCost: 25000,
      impact: 28, gain: 16, title: 'Heizung ausgefallen',
      body: 'Der Brenner gibt auf. Im Winter ohne Heizung droht Mietminderung.',
      deadlineMonths: [3, 6],
    },
    dach: {
      minAgeYears: 50, baseRiskAtCond50: 0.004, minCost: 20000, maxCost: 40000,
      impact: 35, gain: 18, title: 'Dach undicht',
      body: 'Bei Starkregen tropft es ins Treppenhaus. Komplette Eindeckung empfohlen.',
      deadlineMonths: [6, 12],
    },
  }

  private rollCapex(p: Property, rng: () => number): CapexEvent | null {
    const cfg = this.diffConfig()
    const ageYears = this.state.time.year - p.yearBuilt
    if (ageYears < 25 + cfg.capexMinAgeBonus) return null
    // condition multiplier — bad shape doubles the risk, top shape halves it
    const condMult = Math.max(0.4, 1.5 - p.condition / 100)
    const candidates: CapexKind[] = []
    for (const kind of Object.keys(Engine.CAPEX_TABLE) as CapexKind[]) {
      const e = Engine.CAPEX_TABLE[kind]
      if (ageYears < e.minAgeYears + cfg.capexMinAgeBonus) continue
      const risk = e.baseRiskAtCond50 * condMult * cfg.capexRiskMult
      if (rng() < risk) candidates.push(kind)
    }
    if (candidates.length === 0) return null
    candidates.sort((a, b) => Engine.CAPEX_TABLE[b].minCost - Engine.CAPEX_TABLE[a].minCost)
    const kind = candidates[0]
    const e = Engine.CAPEX_TABLE[kind]
    const cost = Math.round(e.minCost + rng() * (e.maxCost - e.minCost))
    const grace = e.deadlineMonths[0] + Math.floor(rng() * (e.deadlineMonths[1] - e.deadlineMonths[0] + 1))
    return {
      id: 'cx_' + Math.random().toString(36).slice(2, 9),
      propertyId: p.id,
      kind,
      title: e.title,
      body: e.body,
      cost,
      conditionImpactIfIgnored: Math.round(e.impact * cfg.capexImpactMult),
      conditionGainIfPaid: e.gain,
      appearedMonth: this.gameMonth(),
      deadlineMonth: this.gameMonth() + grace,
      state: 'pending',
    }
  }

  payCapex(propertyId: string): { ok: boolean; reason?: string } {
    const p = this.state.owned.find(pp => pp.id === propertyId)
    if (!p?.pendingCapex) return { ok: false, reason: 'Keine offene Reparatur' }
    const cap = p.pendingCapex
    if (this.state.player.cash < cap.cost) return { ok: false, reason: `Brauchst ${formatEuro(cap.cost)}` }
    this.state.player.cash -= cap.cost
    cap.state = 'paid'
    p.condition = Math.min(100, p.condition + cap.conditionGainIfPaid)
    this.state.capexHistory.push(cap)
    p.pendingCapex = undefined
    this.emit('capexPaid', { property: p, capex: cap })
    this.emit('toast', { kind: 'success', text: `${cap.title} repariert (-${formatEuro(cap.cost)}, +${cap.conditionGainIfPaid} Zustand).` })
    this.autoSave()
    return { ok: true }
  }

  // ============ DERIVED ============

  gameMonth(): number {
    return (this.state.time.year - 2026) * 12 + this.state.time.month
  }

  netWorth(): number {
    const propValue = this.state.owned.reduce((s, p) => s + p.marketValue, 0)
    const debt = this.state.loans.reduce((s, l) => s + l.principal, 0)
    return Math.round(this.state.player.cash + propValue - debt)
  }

  monthlyCashflow(): { rent: number; maintenance: number; loanPayments: number; overhead: number; net: number } {
    let rent = 0, maintenance = 0, loanPayments = 0
    for (const p of this.state.owned) {
      const reductionFactor = p.activeRenovation ? (1 - p.activeRenovation.rentReductionPct) : 1
      for (const u of p.units) {
        if (u.tenant) rent += u.tenant.agreedKaltMiete * (u.tenant.reliability / 100) * reductionFactor
      }
      maintenance += this.maintenanceCost(p)
      if (p.wegMembership) maintenance += p.wegMembership.hausgeldMonthly
    }
    for (const l of this.state.loans) loanPayments += l.monthlyPayment
    const overhead = this.diffConfig().overheadMonthly + Math.round(this.state.owned.length * 80)
    return { rent: Math.round(rent), maintenance, loanPayments, overhead, net: Math.round(rent - maintenance - loanPayments - overhead) }
  }

  capRate(p: Property): number {
    const noi = (this.effectiveRent(p) - this.maintenanceCost(p)) * 12
    return (noi / Math.max(1, p.price)) * 100
  }

  /** monthly cashflow if leveraged at given LTV */
  hypotheticalLeveragedCashflow(p: Property, bank: Bank, ltv: number): { downPayment: number; monthlyPayment: number; netMonthly: number; cashOnCash: number } {
    const principal = Math.round(p.price * Math.min(ltv, bank.maxLTV))
    const fees = Math.round(principal * bank.origination)
    const downPayment = p.price - principal + fees
    const r = (bank.annualRate + this.state.market.baseRate * 0.1) / 100 / 12
    const months = 240
    const monthlyPayment = Math.round(principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1))
    const grossRent = this.effectiveRent(p)
    const maintenance = this.maintenanceCost(p)
    const netMonthly = Math.round(grossRent - maintenance - monthlyPayment)
    const cashOnCash = (netMonthly * 12) / Math.max(1, downPayment) * 100
    return { downPayment, monthlyPayment, netMonthly, cashOnCash }
  }

  // ============ ACHIEVEMENTS ============

  private achievementDefs(): { id: string; title: string; desc: string; test: () => boolean }[] {
    return [
      { id: 'first_buy', title: 'Erster Deal', desc: 'Kaufe deine erste Immobilie', test: () => this.state.owned.length >= 1 },
      { id: 'five_props', title: 'Portfolio aufgebaut', desc: 'Besitze 5 Immobilien', test: () => this.state.owned.length >= 5 },
      { id: 'ten_props', title: 'Imperium', desc: 'Besitze 10 Immobilien', test: () => this.state.owned.length >= 10 },
      { id: 'million', title: 'Millionaer', desc: '1 Mio. Euro Vermoegen', test: () => this.netWorth() >= 1_000_000 },
      { id: 'ten_million', title: 'Mogul', desc: '10 Mio. Euro Vermoegen', test: () => this.netWorth() >= 10_000_000 },
      { id: 'mortgage_master', title: 'Hebelmeister', desc: 'Habe 3+ Hypotheken gleichzeitig', test: () => this.state.loans.length >= 3 },
      { id: 'flip', title: 'House Flipper', desc: 'Verkaufe mit 50k+ Profit', test: () => false }, // set via emit('sold')
      { id: 'reputation', title: 'Top Vermieter', desc: 'Reputation >= 90', test: () => this.state.player.reputation >= 90 },
      { id: 'all_districts', title: 'Stadtweit', desc: 'Besitze in allen 6 Distrikten', test: () => new Set(this.state.owned.map(p => p.district)).size >= 6 },
      { id: 'gentrifier', title: 'Friedrichshain-Fluester', desc: 'Halte 12 Monate in Wedding/Neukoelln', test: () => this.state.owned.some(o => (o.district === 'wedding' || o.district === 'neukoelln') && o.ownedSince !== undefined && (this.gameMonth() - o.ownedSince) >= 12) },
    ]
  }

  private flipFlag = false
  private checkAchievements() {
    for (const a of this.achievementDefs()) {
      if (this.state.player.achievements.includes(a.id)) continue
      const done = a.id === 'flip' ? this.flipFlag : a.test()
      if (done) {
        this.state.player.achievements.push(a.id)
        this.emit('achievement', a)
      }
    }
  }

  /** call externally on sale gain */
  markFlipIfBig(net: number) {
    if (net >= 50_000) { this.flipFlag = true; this.checkAchievements() }
  }

  // ============ EVENTS ============

  on(ev: string, fn: Listener) {
    if (!this.listeners.has(ev)) this.listeners.set(ev, [])
    this.listeners.get(ev)!.push(fn)
  }
  off(ev: string, fn: Listener) {
    const arr = this.listeners.get(ev); if (!arr) return
    const i = arr.indexOf(fn); if (i >= 0) arr.splice(i, 1)
  }
  private emit(ev: string, data?: any) {
    const arr = this.listeners.get(ev); if (!arr) return
    for (const fn of arr.slice()) fn(data)
  }

  // ============ SAVE / LOAD ============

  autoSave() {
    try {
      const slim = {
        state: this.state,
        v: 2,
        ts: Date.now(),
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify(slim))
    } catch (e) { /* swallow quota */ }
  }
  tryLoad(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return false
      const data = JSON.parse(raw)
      if (data.v !== 2 || !data.state) return false
      this.state = data.state as GameState
      // sanity defaults
      if (!Array.isArray(this.state.player.netWorthHistory)) this.state.player.netWorthHistory = []
      if (!Array.isArray(this.state.player.achievements)) this.state.player.achievements = []
      if (!this.state.market) this.state.market = { cycle: 0.4, nextEventCheck: 3, events: [], baseRate: 3.5 }
      // event functions are not restored; clear them
      this.state.market.events = []
      // migration for new fields
      if (typeof this.state.player.negotiationSkill !== 'number') this.state.player.negotiationSkill = 25
      if (!this.state.player.bankRelations) this.state.player.bankRelations = { sparkasse: 10, deutsche: 10, volksbank: 10, online: 10 }
      if (this.state.player.brokerId === undefined) this.state.player.brokerId = null
      if (!this.state.brokers || this.state.brokers.length === 0) {
        // re-seed brokers from fresh state
        const fresh = this.freshState()
        this.state.brokers = fresh.brokers
      }
      // M1: Kalt/Warm split — give every Property a nebenkosten + mietspiegel value,
      // and split legacy Tenant.agreedRent into agreedKaltMiete / agreedNebenkosten.
      const migrateProperty = (p: Property) => {
        if (typeof p.nebenkosten !== 'number') p.nebenkosten = Math.round(p.baseRent * 0.25)
        if (typeof p.mietspiegelKalt !== 'number') p.mietspiegelKalt = this.mietspiegelFor(p.district, p.type)
        if (p.tenant) {
          const t = p.tenant as Tenant & { agreedRent?: number }
          if (typeof t.agreedKaltMiete !== 'number') {
            t.agreedKaltMiete = typeof t.agreedRent === 'number' ? t.agreedRent : p.baseRent
          }
          if (typeof t.agreedNebenkosten !== 'number') {
            t.agreedNebenkosten = p.nebenkosten
          }
          delete t.agreedRent
        }
      }
      this.state.listings.forEach(migrateProperty)
      this.state.owned.forEach(migrateProperty)
      // M1: lawsuits array
      if (!Array.isArray(this.state.lawsuits)) this.state.lawsuits = []
      // M2: capex history (pendingCapex on individual properties is fine as undef)
      if (!Array.isArray(this.state.capexHistory)) this.state.capexHistory = []
      // M2.5: renovation/contractor state
      if (!Array.isArray(this.state.player.contractorRelations)) this.state.player.contractorRelations = []
      if (typeof this.state.player.schwarzJobsThisYear !== 'number') this.state.player.schwarzJobsThisYear = 0
      if (typeof this.state.player.totalSchwarzJobs !== 'number') this.state.player.totalSchwarzJobs = 0
      if (typeof this.state.player.taxAuditsExperienced !== 'number') this.state.player.taxAuditsExperienced = 0
      if (!Array.isArray(this.state.pfuschPending)) this.state.pfuschPending = []
      if (!Array.isArray(this.state.kfwPending)) this.state.kfwPending = []
      if (!Array.isArray(this.state.contractorPool) || this.state.contractorPool.length === 0) {
        this.state.contractorPool = this.generateContractorPool()
      }
      // M5: multi-unit support — every Property must have `units` and `buildingForm`.
      // Old saves get a single synthetic unit synthesised from the legacy headline fields.
      const ensureUnits = (p: Property) => {
        if (!Array.isArray(p.units) || p.units.length === 0) {
          p.units = [{
            id: 'u_' + Math.random().toString(36).slice(2, 6),
            label: 'Einheit',
            sqm: 60,
            baseKalt: p.baseRent,
            nebenkosten: typeof p.nebenkosten === 'number' ? p.nebenkosten : Math.round(p.baseRent * 0.25),
            tenant: p.tenant,
            vacantMonths: p.vacantMonths,
            applicantSearches: p.applicantSearches,
          }]
        }
        if (!p.buildingForm) p.buildingForm = 'single'
      }
      this.state.listings.forEach(ensureUnits)
      this.state.owned.forEach(ensureUnits)
      if (!Array.isArray(this.state.wegAssemblies)) this.state.wegAssemblies = []
      // M7: difficulty default for old saves
      if (!this.state.difficulty) this.state.difficulty = 'standard'
      return true
    } catch { return false }
  }
  resetToFresh() {
    this.stop()
    localStorage.removeItem(SAVE_KEY)
    this.state = this.freshState()
    this.seedListings(18)
    this.flipFlag = false
    this.start()
    this.emit('reset')
  }

  // ============ BROKER ============

  hireBroker(brokerId: string | null) {
    this.state.player.brokerId = brokerId === 'do_it_yourself' ? null : brokerId
    this.autoSave()
    this.emit('brokerChanged', { brokerId: this.state.player.brokerId })
  }

  currentBroker(): Broker | null {
    const id = this.state.player.brokerId
    if (!id) return null
    return this.state.brokers.find(b => b.id === id) ?? null
  }

  /** Strength = how much the player can push the seller down. Higher = better deals. 0..100
   *  Buy-side has no player broker any more (M4 refactor) — only player skill + reputation
   *  count, plus the listing-agent (if `Property.seller.channel === 'agent'`) influences
   *  the seller's floor inside the negotiation flow elsewhere. */
  negotiationStrength(_p?: Property): number {
    const player = this.state.player
    let s = player.negotiationSkill
    s += player.reputation * 0.15
    return Math.max(0, Math.min(100, s))
  }

  // ============ SELLER NEGOTIATION ============

  startSellerNegotiation(propertyId: string): SellerNegotiationState | null {
    const p = this.state.listings.find(pp => pp.id === propertyId)
    if (!p) return null
    if (!p.seller) p.seller = pickSeller(() => Math.random())  // safety for old saves
    const seller = p.seller
    const strength = this.negotiationStrength(p)
    const monthsOnMarket = Math.max(0, p.monthsOnMarket)
    const stalenessDiscount = Math.min(0.15, monthsOnMarket * 0.025)

    // owner persona modifies floor
    const personaMod = personaFloorMod(seller.ownerPersona)
    // listing agent (if any) tightens or loosens floor
    const agentFloorMod = seller.channel === 'agent' ? listingAgentFloorMod(seller.agentPersonality!) : 0

    const baseMin = p.marketValue * (personaMod + agentFloorMod - stalenessDiscount)
    const minMargin = baseMin * (1 - (strength / 100) * 0.10)
    const sellerMin = Math.max(p.marketValue * 0.65, Math.round(minMargin))

    const persona = seller.ownerPersona
    const maxRounds = seller.channel === 'agent' ? (seller.agentPersonality === 'pushy' ? 3 : 4)
                      : persona === 'rushed' ? 3
                      : persona === 'stubborn' ? 5
                      : 4

    const intro: SellerNegotiationState['messages'] = []
    if (seller.channel === 'private') {
      intro.push({ from: 'system', text: `Privat-Verkauf: ${seller.ownerName} (${escapeFlavor(seller.flavor)}). Grund: ${escapeFlavor(seller.reason)}.` })
      intro.push({ from: 'seller', text: `${seller.ownerName}: "${openingLine(persona, p.price)}"` })
    } else {
      intro.push({ from: 'system', text: `Vermittelt von ${seller.agentName!} — ${escapeFlavor(seller.agentBlurb!)}. Eigentuemer: ${seller.ownerName} (${escapeFlavor(seller.flavor)}). Grund: ${escapeFlavor(seller.reason)}.` })
      intro.push({ from: 'seller', text: `${seller.agentName}: "${listingAgentOpening(seller.agentPersonality!, p.price, p.marketValue)}"` })
    }

    return {
      propertyId,
      askingPrice: p.price,
      sellerMin,
      currentSellerOffer: p.price,
      rounds: 0,
      maxRounds,
      brokerHired: null,
      done: false,
      outcome: 'pending',
      messages: intro,
    }
  }

  /** Player makes an offer. Returns updated negotiation state. */
  submitSellerOffer(neg: SellerNegotiationState, offerPrice: number): SellerNegotiationState {
    if (neg.done) return neg
    const p = this.state.listings.find(pp => pp.id === neg.propertyId)
    if (!p || !p.seller) { neg.done = true; neg.outcome = 'rejected'; neg.messages.push({ from: 'system', text: 'Inserat nicht mehr verfuegbar.' }); return neg }
    const seller = p.seller
    const persona = seller.ownerPersona
    const speaker = seller.channel === 'agent' ? seller.agentName! : seller.ownerName

    neg.rounds++
    neg.messages.push({ from: 'player', text: `Du bietest ${formatEuro(offerPrice)}.` })

    // Persona-tuned thresholds (modified slightly when via agent — agents more by-the-book)
    const acceptShift = seller.channel === 'agent' ? 0.005 : 0
    const acceptThreshold = (persona === 'desperate' ? 0.93 : persona === 'rushed' ? 0.95 : persona === 'greedy' ? 0.995 : persona === 'stubborn' ? 0.98 : 0.985) + acceptShift
    // Agents have thicker skin — harder to insult
    const insultBase = (persona === 'sentimental' ? 0.95 : persona === 'stubborn' ? 0.92 : persona === 'desperate' ? 0.7 : 0.82)
    const insultThreshold = seller.channel === 'agent' ? insultBase * 0.85 : insultBase

    const walkRiskMult = 1.0

    if (offerPrice >= neg.currentSellerOffer * acceptThreshold) {
      neg.done = true; neg.outcome = 'accepted'
      neg.currentSellerOffer = offerPrice
      const line = seller.channel === 'agent'
        ? listingAgentAccept(seller.agentPersonality!, offerPrice)
        : acceptLine(persona, offerPrice)
      neg.messages.push({ from: 'seller', text: `${speaker}: "${line}"` })
      return neg
    }
    if (offerPrice < neg.sellerMin * insultThreshold * walkRiskMult) {
      neg.done = true; neg.outcome = 'rejected'
      const line = seller.channel === 'agent'
        ? listingAgentInsult(seller.agentPersonality!)
        : insultLine(persona, undefined)
      neg.messages.push({ from: 'seller', text: `${speaker}: "${line}"` })
      return neg
    }

    if (offerPrice >= neg.sellerMin) {
      // Agent concessions are more measured
      const concessionFactor = seller.channel === 'agent'
        ? (seller.agentPersonality === 'pushy' ? 0.93 : 0.95)
        : (persona === 'desperate' ? 0.85 : persona === 'rushed' ? 0.9 : persona === 'pragmatic' ? 0.92 : persona === 'sentimental' ? 0.94 : persona === 'stubborn' ? 0.97 : 0.98)
      const counter = Math.round(Math.max(neg.sellerMin, (offerPrice + neg.currentSellerOffer) / 2 * concessionFactor))
      neg.currentSellerOffer = counter
      const line = seller.channel === 'agent'
        ? listingAgentCounter(seller.agentPersonality!, counter)
        : counterLine(persona, counter)
      neg.messages.push({ from: 'seller', text: `${speaker}: "${line}"` })
    } else {
      const counter = Math.round(neg.currentSellerOffer * (persona === 'desperate' ? 0.95 : seller.channel === 'agent' ? 0.99 : 0.985))
      neg.currentSellerOffer = Math.max(counter, neg.sellerMin)
      const line = seller.channel === 'agent'
        ? listingAgentSticky(seller.agentPersonality!, neg.currentSellerOffer)
        : stickyLine(persona, neg.currentSellerOffer)
      neg.messages.push({ from: 'seller', text: `${speaker}: "${line}"` })
    }

    if (neg.rounds >= neg.maxRounds) {
      neg.done = true; neg.outcome = 'rejected'
      neg.messages.push({ from: 'system', text: 'Geduld ist zu Ende — Verhandlung beendet.' })
    }
    return neg
  }

  /** Player accepts the seller's current offer — finalizes via buy. */
  acceptSellerOffer(neg: SellerNegotiationState, withLoanFromBank?: string, ltv?: number, bankTermsOverride?: BankOfferTerms): { ok: boolean; reason?: string } {
    const p = this.state.listings.find(pp => pp.id === neg.propertyId)
    if (!p) return { ok: false, reason: 'Inserat nicht mehr verfuegbar' }
    // Mutate the listing's price to the negotiated value, then buy.
    // M4: no buyer-side broker commission any more.
    const negotiatedPrice = neg.currentSellerOffer

    const oldPrice = p.price
    p.price = negotiatedPrice
    const res = this.buy(p.id, withLoanFromBank, ltv, { bankTermsOverride })
    if (!res.ok) {
      p.price = oldPrice  // rollback
      return res
    }

    // Successful negotiation grows skill
    this.state.player.negotiationSkill = Math.min(100, this.state.player.negotiationSkill + 1)
    this.emit('toast', { kind: 'success', text: `Verhandelt: ${formatEuro(oldPrice - negotiatedPrice)} gespart!` })
    return { ok: true }
  }

  // ============ BANK NEGOTIATION ============

  startBankNegotiation(bankId: string, propertyId: string): BankNegotiationState | null {
    const bank = this.state.banks.find(b => b.id === bankId)
    if (!bank) return null
    const relation = this.state.player.bankRelations[bankId] ?? 0
    const baseRate = bank.annualRate + this.state.market.baseRate * 0.1
    const base: BankOfferTerms = { annualRate: baseRate, ltv: bank.maxLTV, origination: bank.origination }

    const scoreBoost = Math.max(0, (this.state.player.creditScore - bank.minCreditScore) / 200)
    const relationBoost = relation / 100

    // Personality scales the headroom available
    const headroom = bankHeadroom(bank.personality, relationBoost)  // {rate, ltv, fee}
    const maxRateCut = (0.3 + scoreBoost * 0.4 + relationBoost * 0.5) * headroom.rate
    const maxLtvBump = (0.04 + relationBoost * 0.06) * headroom.ltv
    const maxFeeCut = bank.origination * (0.3 + relationBoost * 0.4) * headroom.fee

    const bestPossible: BankOfferTerms = {
      annualRate: Math.max(0.5, base.annualRate - maxRateCut),
      ltv: Math.min(0.95, base.ltv + maxLtvBump),
      origination: Math.max(0, base.origination - maxFeeCut),
    }

    const maxRounds = bank.personality === 'bureaucratic' ? 5 : bank.personality === 'digital' ? 2 : 3
    const intro: BankNegotiationState['messages'] = [
      { from: 'bank', text: `${bank.advisorName}: "${bankIntro(bank.personality, baseRate, bank.maxLTV, bank.origination)}"` },
      { from: 'system', text: relation < 20 ? `Beziehung neu — ${bank.personality === 'relationship' ? 'die Bank ist hier vorsichtig' : 'wenig Spielraum'}.` : relation < 60 ? 'Etablierte Beziehung.' : 'Premium-Kunde — gute Verhandlungsposition.' },
    ]
    return {
      bankId, propertyId,
      base, current: { ...base }, bestPossible,
      rounds: 0, maxRounds,
      done: false, outcome: 'pending',
      messages: intro,
    }
  }

  pushBank(neg: BankNegotiationState, ask: 'rate' | 'ltv' | 'fee'): BankNegotiationState {
    if (neg.done) return neg
    neg.rounds++
    const bank = this.state.banks.find(b => b.id === neg.bankId)!
    const relation = this.state.player.bankRelations[neg.bankId] ?? 0
    let willingness = 0.3 + (relation / 100) * 0.5 + this.negotiationStrength() / 200
    // personality bias
    if (bank.personality === 'aggressive' && ask === 'ltv') willingness += 0.2
    if (bank.personality === 'bureaucratic' && ask === 'fee') willingness += 0.2
    if (bank.personality === 'conservative') willingness -= 0.15
    if (bank.personality === 'digital') willingness = 0.7  // formula-based, deterministic-ish
    if (bank.personality === 'relationship' && relation > 50) willingness += 0.2

    const got = Math.random() < willingness

    neg.messages.push({ from: 'player', text: `Du: "${playerAskLine(ask)}"` })

    if (!got) {
      neg.messages.push({ from: 'bank', text: `${bank.advisorName}: "${bankRefuseLine(bank.personality, ask)}"` })
    } else {
      const baseFraction = bank.personality === 'aggressive' ? 0.7 : bank.personality === 'bureaucratic' ? 0.4 : bank.personality === 'digital' ? 0.5 : bank.personality === 'relationship' ? 0.6 : 0.55
      const moveFraction = baseFraction + Math.random() * 0.3
      if (ask === 'rate') {
        const gap = neg.current.annualRate - neg.bestPossible.annualRate
        neg.current.annualRate = +(neg.current.annualRate - gap * moveFraction).toFixed(3)
        neg.messages.push({ from: 'bank', text: `${bank.advisorName}: "${bankConcessionLine(bank.personality, 'rate')} ${neg.current.annualRate.toFixed(2)}%."` })
      } else if (ask === 'ltv') {
        const gap = neg.bestPossible.ltv - neg.current.ltv
        neg.current.ltv = +(neg.current.ltv + gap * moveFraction).toFixed(3)
        neg.messages.push({ from: 'bank', text: `${bank.advisorName}: "${bankConcessionLine(bank.personality, 'ltv')} ${(neg.current.ltv * 100).toFixed(0)}%."` })
      } else {
        const gap = neg.current.origination - neg.bestPossible.origination
        neg.current.origination = +(neg.current.origination - gap * moveFraction).toFixed(4)
        neg.messages.push({ from: 'bank', text: `${bank.advisorName}: "${bankConcessionLine(bank.personality, 'fee')} ${(neg.current.origination * 100).toFixed(2)}%."` })
      }
    }
    if (neg.rounds >= neg.maxRounds) { neg.done = true; neg.outcome = 'pending'; neg.messages.push({ from: 'system', text: 'Maximalrunden erreicht.' }) }
    return neg
  }

  acceptBankOffer(neg: BankNegotiationState) {
    neg.done = true; neg.outcome = 'accepted'
    // grow relationship slightly
    this.state.player.bankRelations[neg.bankId] = Math.min(100, (this.state.player.bankRelations[neg.bankId] ?? 0) + 3)
  }
  rejectBankOffer(neg: BankNegotiationState) {
    neg.done = true; neg.outcome = 'rejected'
    // small relationship hit
    this.state.player.bankRelations[neg.bankId] = Math.max(0, (this.state.player.bankRelations[neg.bankId] ?? 0) - 1)
  }
}

function escapeFlavor(s: string): string { return s.replace(/"/g, "'") }

import type { SellerPersona, BrokerPersonality } from './types'

function personaFloorMod(p: SellerPersona): number {
  // multiplier of marketValue used as starting floor (lower = more willing to drop)
  switch (p) {
    case 'desperate': return 0.78
    case 'rushed': return 0.85
    case 'pragmatic': return 0.88
    case 'sentimental': return 0.92
    case 'stubborn': return 0.95
    case 'greedy': return 0.97
  }
}

function openingLine(p: SellerPersona, asking: number): string {
  switch (p) {
    case 'desperate': return `${formatEuro(asking)}. Sagen Sie was, ich bin offen.`
    case 'rushed': return `${formatEuro(asking)}. Hab nicht viel Zeit — was ist Ihr Angebot?`
    case 'pragmatic': return `Ich rufe ${formatEuro(asking)} auf. Was bieten Sie?`
    case 'sentimental': return `${formatEuro(asking)} — und Sie versprechen mir, dass Sie das pflegen?`
    case 'stubborn': return `${formatEuro(asking)}. Das ist mein Preis. Ich warte.`
    case 'greedy': return `${formatEuro(asking)} — und das ist schon ein Schnaeppchen.`
  }
}
function acceptLine(p: SellerPersona, finalPrice: number): string {
  switch (p) {
    case 'desperate': return `Ja! Ja, ${formatEuro(finalPrice)} — danke, danke.`
    case 'rushed': return `${formatEuro(finalPrice)}, deal. Wann unterschreiben wir?`
    case 'pragmatic': return `Fair. ${formatEuro(finalPrice)} es ist.`
    case 'sentimental': return `${formatEuro(finalPrice)}... gut. Ich vertraue Ihnen.`
    case 'stubborn': return `${formatEuro(finalPrice)}. Sie haben mich ueberzeugt.`
    case 'greedy': return `Naja, ${formatEuro(finalPrice)}, abgemacht. Aber ich verkaufe unter Wert!`
  }
}
function insultLine(p: SellerPersona, broker?: BrokerPersonality): string {
  const brokerJab = broker === 'pushy' ? ' Und Ihr Makler ist eine Frechheit.' : ''
  switch (p) {
    case 'desperate': return `Das ist zu wenig, das ueberlebt mich nicht.${brokerJab}`
    case 'rushed': return `Vergessen Sie's. Naechster Interessent.${brokerJab}`
    case 'pragmatic': return `Das liegt deutlich unter dem Wert. Wir sind hier fertig.${brokerJab}`
    case 'sentimental': return `Wie koennen Sie es wagen? Raus aus meiner Wohnung.${brokerJab}`
    case 'stubborn': return `Ich sagte mein Preis steht.${brokerJab}`
    case 'greedy': return `Eine Frechheit. Verschwenden Sie meine Zeit nicht.${brokerJab}`
  }
}
function counterLine(p: SellerPersona, counter: number): string {
  switch (p) {
    case 'desperate': return `${formatEuro(counter)}? Ja, ich kann da hin gehen, ja.`
    case 'rushed': return `${formatEuro(counter)}, mehr geht nicht — entscheiden Sie sich.`
    case 'pragmatic': return `Mein Gegenangebot: ${formatEuro(counter)}.`
    case 'sentimental': return `Wenn Sie sich gut um es kuemmern... ${formatEuro(counter)}.`
    case 'stubborn': return `${formatEuro(counter)}, mehr nicht.`
    case 'greedy': return `${formatEuro(counter)} — und das ist schon zu wenig.`
  }
}
// === LISTING AGENT (seller-side broker) ===

function listingAgentFloorMod(p: BrokerPersonality): number {
  // pp added to baseMin/marketValue. Negative = lower floor = better for buyer
  switch (p) {
    case 'charming':     return -0.01
    case 'pushy':        return +0.03  // pushy listing agents inflate
    case 'analytical':   return +0.01  // sticks to comps
    case 'discreet':     return +0.02  // luxury, holds firm
    case 'enthusiastic': return -0.01
  }
}
function listingAgentOpening(p: BrokerPersonality, asking: number, mv: number): string {
  const ratio = asking / mv
  switch (p) {
    case 'charming':     return `Wir haben hier eine wunderbare Gelegenheit. Aufruf ${formatEuro(asking)} — sprechen Sie mit mir.`
    case 'pushy':        return `${formatEuro(asking)}. Bereits 4 Anfragen heute, Sie muessen sich entscheiden.`
    case 'analytical':   return `Aufruf ${formatEuro(asking)}, das entspricht ${(ratio * 100).toFixed(0)}% des Vergleichswerts. Markt zeigt klar diese Spanne.`
    case 'discreet':     return `Diskret vermittelt. ${formatEuro(asking)}. Ich rede nur mit Interessenten, die wissen, was sie tun.`
    case 'enthusiastic': return `Top-Objekt! ${formatEuro(asking)} — und das ist fair angesetzt, glauben Sie mir!`
  }
}
function listingAgentAccept(p: BrokerPersonality, finalPrice: number): string {
  switch (p) {
    case 'charming':     return `${formatEuro(finalPrice)}, abgemacht. War mir ein Vergnuegen.`
    case 'pushy':        return `${formatEuro(finalPrice)}. Sie haben Glueck, dass ich heute gut drauf bin.`
    case 'analytical':   return `${formatEuro(finalPrice)} liegt im akzeptablen Korridor. Deal.`
    case 'discreet':     return `${formatEuro(finalPrice)} — der Eigentuemer hat zugestimmt.`
    case 'enthusiastic': return `${formatEuro(finalPrice)}! Das wird grossartig fuer Sie!`
  }
}
function listingAgentInsult(p: BrokerPersonality): string {
  switch (p) {
    case 'charming':     return 'Das ist leider deutlich unter dem, was wir umsetzen koennen. Schade.'
    case 'pushy':        return 'Lustig. Naechster Interessent.'
    case 'analytical':   return 'Liegt 25%+ unter Vergleichswert. Der Eigentuemer wird nicht reagieren.'
    case 'discreet':     return 'Das wird der Eigentuemer nicht akzeptieren. Wir beenden hier.'
    case 'enthusiastic': return 'Oh, das ist aber wirklich zu wenig. Schade!'
  }
}
function listingAgentCounter(p: BrokerPersonality, counter: number): string {
  switch (p) {
    case 'charming':     return `${formatEuro(counter)} koennte ich beim Eigentuemer durchsetzen.`
    case 'pushy':        return `${formatEuro(counter)}. Akzeptieren Sie oder Sie sind raus.`
    case 'analytical':   return `Wir koennen auf ${formatEuro(counter)} runter — das ist der Kompromiss.`
    case 'discreet':     return `Der Eigentuemer wuerde ${formatEuro(counter)} in Erwaegung ziehen.`
    case 'enthusiastic': return `Wie waere es mit ${formatEuro(counter)}? Das waere fantastisch!`
  }
}
function listingAgentSticky(p: BrokerPersonality, current: number): string {
  switch (p) {
    case 'charming':     return `Unter ${formatEuro(current)} darf ich gar nicht erst fragen.`
    case 'pushy':        return `${formatEuro(current)}. Letzte Ansage.`
    case 'analytical':   return `${formatEuro(current)} ist die analytische Untergrenze.`
    case 'discreet':     return `${formatEuro(current)} — der Eigentuemer ist hart.`
    case 'enthusiastic': return `${formatEuro(current)} ist wirklich das Aeusserste!`
  }
}

// === BANK PERSONALITY ===

import type { BankPersonality } from './types'

function bankHeadroom(p: BankPersonality, relationBoost: number): { rate: number; ltv: number; fee: number } {
  switch (p) {
    case 'conservative': return { rate: 0.6, ltv: 0.5, fee: 0.7 }
    case 'aggressive':   return { rate: 1.0, ltv: 1.4, fee: 0.8 }
    case 'bureaucratic': return { rate: 0.7, ltv: 0.6, fee: 1.3 }
    case 'relationship': return { rate: 0.6 + relationBoost * 1.0, ltv: 0.6 + relationBoost * 0.6, fee: 0.6 + relationBoost * 0.6 }
    case 'digital':      return { rate: 0.9, ltv: 0.9, fee: 0.5 }
  }
}

function bankIntro(p: BankPersonality, rate: number, ltv: number, fee: number): string {
  const stats = `${rate.toFixed(2)}% Zins, ${(ltv * 100).toFixed(0)}% LTV, ${(fee * 100).toFixed(2)}% Bearbeitung`
  switch (p) {
    case 'conservative': return `Schoenen guten Tag. Unser Standardangebot waere ${stats}. Wir sind hier eher zurueckhaltend.`
    case 'aggressive':   return `Hi! ${stats}. Aber ich glaube, wir koennen mehr! Wieviel wollen Sie?`
    case 'bureaucratic': return `Gemaess Konditionentafel: ${stats}. Aenderungen erfordern Pruefung.`
    case 'relationship': return `Schoen, dass Sie wieder hier sind. ${stats} — wir schauen, was wir tun koennen.`
    case 'digital':      return `Angebot berechnet: ${stats}. Optimierung verfuegbar.`
  }
}

function playerAskLine(ask: 'rate' | 'ltv' | 'fee'): string {
  return ask === 'rate' ? 'Geht der Zins runter?' : ask === 'ltv' ? 'Mehr LTV, bitte.' : 'Bei der Gebuehr muss noch was gehen.'
}

function bankRefuseLine(p: BankPersonality, ask: 'rate' | 'ltv' | 'fee'): string {
  const _ = ask  // shut linter
  void _
  switch (p) {
    case 'conservative': return 'Tut mir leid, das ist unsere Linie.'
    case 'aggressive':   return 'Hmmm, da machen wir nichts. Versuchen Sie was anderes!'
    case 'bureaucratic': return 'Nicht im Rahmen der Vorgaben.'
    case 'relationship': return 'Ich wuerde gerne, aber bei Ihrer Beziehungsstaerke geht da nichts.'
    case 'digital':      return 'Algorithmus liefert keine bessere Kondition.'
  }
}

function bankConcessionLine(p: BankPersonality, _ask: 'rate' | 'ltv' | 'fee'): string {
  switch (p) {
    case 'conservative': return 'Ausnahmsweise koennen wir gehen auf'
    case 'aggressive':   return 'Klar! Wir gehen auf'
    case 'bureaucratic': return 'Nach Pruefung — genehmigt:'
    case 'relationship': return 'Fuer Sie als Stammkunde:'
    case 'digital':      return 'Optimiert auf'
  }
}

function stickyLine(p: SellerPersona, current: number): string {
  switch (p) {
    case 'desperate': return `Bitte... ${formatEuro(current)} ist mein absolutes Minimum.`
    case 'rushed': return `${formatEuro(current)} oder ich gehe.`
    case 'pragmatic': return `Unter ${formatEuro(current)} mache ich es nicht.`
    case 'sentimental': return `${formatEuro(current)} — denken Sie an die Geschichte.`
    case 'stubborn': return `${formatEuro(current)}. Ich bewege mich keinen Millimeter mehr.`
    case 'greedy': return `${formatEuro(current)}. Mehr Konzession kriegen Sie nicht.`
  }
}

function mulb(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function formatEuro(n: number): string {
  return '€' + Math.round(n).toLocaleString('de-DE')
}
