const FIRST = ['Anna', 'Lukas', 'Sophie', 'Felix', 'Maja', 'Jonas', 'Lena', 'Niklas', 'Hanna', 'Tobias', 'Mia', 'Paul', 'Emma', 'Tim', 'Clara', 'Jan', 'Lara', 'Max', 'Marie', 'Leon', 'Greta', 'Finn', 'Nora', 'David', 'Helena', 'Erik', 'Jana', 'Mats', 'Pia', 'Henri', 'Lisa', 'Robin', 'Tara', 'Yannick', 'Zoe']
const LAST = ['Mueller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Schaefer', 'Koch', 'Bauer', 'Richter', 'Klein', 'Wolf', 'Schroeder', 'Neumann', 'Schwarz', 'Zimmermann', 'Braun', 'Kruger', 'Hofmann', 'Hartmann', 'Lange']
const JOBS = ['Lehrer:in', 'Software-Entwickler:in', 'Pflegekraft', 'Designer:in', 'Beamt:in', 'Friseur:in', 'Architekt:in', 'Studierende:r', 'Manager:in', 'Anwalt/Anwaeltin', 'Kassierer:in', 'Polizist:in', 'Aerzt:in', 'Mechaniker:in', 'Barkeeper:in', 'Fotograf:in', 'Bauarbeiter:in', 'Kellner:in']

export const PROPERTY_NAMES: Record<string, string[]> = {
  house: ['Reihenhaus am Park', 'Stadthaus mit Garten', 'Familienhaus', 'Altbau-Haus', 'Sanierungsbeduerftiges Haus', 'Doppelhaushaelfte'],
  villa: ['Jugendstil-Villa', 'Stadtvilla', 'Architekten-Villa', 'Gruenderzeit-Villa', 'Bauhaus-Villa'],
  apartment: ['3-Zi-Altbau', 'Neubau-Wohnung', 'Maisonette', 'Dachgeschoss-Wohnung', 'Erdgeschoss-Wohnung', 'Loft mit Terrasse', 'Studentenwohnung', 'Familienwohnung'],
  shop: ['Eckladen', 'Cafe-Lokal', 'Boutique', 'Spaetkauf', 'Bistro-Flaeche', 'Friseursalon-Lokal'],
  office: ['Buero-Etage', 'Praxis-Raeume', 'Coworking-Flaeche', 'Kanzlei-Etage', 'Startup-Loft'],
  tower: ['Hochhaus-Etagen', 'Tower-Office', 'Highrise-Gewerbe', 'Sky-Loft Block'],
}

export function pickName(rng: () => number): string {
  return `${FIRST[Math.floor(rng() * FIRST.length)]} ${LAST[Math.floor(rng() * LAST.length)]}`
}
export function pickJob(rng: () => number): string {
  return JOBS[Math.floor(rng() * JOBS.length)]
}
export function pickPropertyName(kind: string, rng: () => number): string {
  const arr = PROPERTY_NAMES[kind] ?? ['Immobilie']
  return arr[Math.floor(rng() * arr.length)]
}

import type { SellerPersona } from './types'
const PERSONAS: SellerPersona[] = ['desperate', 'stubborn', 'greedy', 'pragmatic', 'rushed', 'sentimental']
const REASONS: Record<SellerPersona, string[]> = {
  desperate: ['Steuerschulden — muss schnell verkaufen', 'Insolvenz droht, Bank macht Druck', 'Scheidung, beide brauchen Cash sofort'],
  stubborn: ['Erbstueck der Familie — nur fuer den richtigen Preis', '20 Jahre selbst saniert, das ist Gold wert', 'Soll im Wert steigen, ich habe Zeit'],
  greedy: ['Will dramatisch ueber Marktwert verkaufen', 'Sieht das nur als Investment, kein Sentiment', 'Vergleicht mit Mitte-Preisen, egal wo es liegt'],
  pragmatic: ['Aufloesung Erbe, will fairen Deal', 'Vermieter im Ruhestand, Cashflow gefragt', 'Portfolio-Optimierung'],
  rushed: ['Zieht ins Ausland, Termin steht', 'Neuer Job in Muenchen, sofort weg', 'Scheidung schon final, will abschliessen'],
  sentimental: ['Familienhaus seit 1953 — wer wird gut zu ihm sein?', 'Hier sind ihre Kinder gross geworden', 'Es muss in gute Haende'],
}
const FLAVOR: Record<SellerPersona, string> = {
  desperate: 'wirkt nervoes, schaut auf die Uhr',
  stubborn: 'verschraenkte Arme, knappe Antworten',
  greedy: 'rechnet bei jedem Cent nach',
  pragmatic: 'sachlich, hoert zu, handelt fair',
  rushed: 'standig am Handy, will schnell durch',
  sentimental: 'erzaehlt Geschichten ueber das Haus',
}

import type { Applicant, BrokerPersonality, ListingChannel, SellerInfo, TenantPersonality } from './types'

const AGENCY_NAMES = ['Berlin Estate', 'Mayer & Partner', 'Capital Real', 'Stadtblick Immobilien', 'Engel & Tochter', 'Hauptstadt Properties', 'KW Berlin', 'Premium Wohnen']
const AGENT_PERSONALITIES: BrokerPersonality[] = ['charming', 'pushy', 'analytical', 'discreet', 'enthusiastic']
const AGENT_BLURBS: Record<BrokerPersonality, string[]> = {
  charming: ['hat zigarrettenstimme und ein Laecheln', 'kennt jeden Verkaeufer beim Vornamen', 'macht jeden Termin zum Plausch'],
  pushy: ['drueckt aufs Tempo', 'ruft staendig zurueck', 'verteilt seine Karten wie Konfetti'],
  analytical: ['kommt mit Excel-Tabellen', 'spricht in Bodenrichtwerten', 'kennt jede Quadratmeter-Statistik'],
  discreet: ['kommt im Anzug, fluestert', 'arbeitet nur ueber Empfehlung', 'gibt keine Preise am Telefon'],
  enthusiastic: ['hat 1000 Watt im Tonfall', 'feiert jede Besichtigung', 'glaubt fest an dieses Objekt'],
}

// =========== TENANT APPLICANTS ===========

// Real personas seen in the applicant pool. Note that 'nomad' appears here too —
// but as a disguised entry: the displayed persona is something innocuous (quiet/
// tidy/family) while the underlying personality stays 'nomad'.
const TENANT_PERSONAS: TenantPersonality[] = ['tidy', 'partyer', 'quiet', 'demanding', 'family', 'student']
// Personas a Mietnomad can hide behind in the application — they look squeaky-clean.
const NOMAD_DISGUISES: TenantPersonality[] = ['quiet', 'tidy', 'family']

const TENANT_BLURBS: Record<TenantPersonality, string[]> = {
  tidy: ['hat im Lebenslauf "ordentlich" als Hobby', 'kommt mit Putzplan-Vorschlag', 'fragt zuerst nach der Hausordnung'],
  partyer: ['will wissen ob WG-Partys ok sind', 'erwaehnt seine DJ-Anlage beilaeufig', 'lebt fuer das Wochenende'],
  quiet: ['arbeitet von zuhause, braucht Ruhe', 'liest gerne, sammelt Buecher', 'macht zwar nichts kaputt aber redet auch nicht viel'],
  demanding: ['fragt nach Smart-Home-Features', 'will wissen ob die Heizung neu ist', 'hat Liste mit Wuenschen mitgebracht'],
  family: ['Eltern mit zwei Kindern', 'sucht 5+ Jahre Stabilitaet', 'hat 3 Generationen-Foto im Portfolio'],
  student: ['noch im Bachelor, hat Buergen', 'hat 4 WG-Mitbewohner als Backup', 'Geld kommt von Eltern'],
  nomad: ['hat nichts zu verbergen, alles glatt', 'sehr freundlich am Telefon', 'will sofort einziehen, druckt morgen'],
}

const RELIABILITY_BY_PERSONA: Record<TenantPersonality, [number, number]> = {
  tidy: [80, 95], partyer: [55, 80], quiet: [85, 98], demanding: [75, 92], family: [80, 92], student: [50, 80],
  // displayed reliability for nomad is high (cover) — actual reliability is overridden to 0 in signLease
  nomad: [78, 92],
}
const INCOME_MULT_BY_PERSONA: Record<TenantPersonality, number> = {
  tidy: 3.5, partyer: 4.0, quiet: 3.2, demanding: 5.0, family: 3.6, student: 2.4,
  // nomad fakes a comfortable income multiplier so the player sees "✓ income OK"
  nomad: 4.0,
}
const RENT_BUDGET_MULT: Record<TenantPersonality, number> = {
  tidy: 1.05, partyer: 1.10, quiet: 0.95, demanding: 1.20, family: 0.98, student: 0.85,
  nomad: 1.10,
}
const LEASE_PREF: Record<TenantPersonality, number[]> = {
  tidy: [24, 36], partyer: [12, 24], quiet: [24, 36], demanding: [12, 24], family: [36], student: [12, 24],
  nomad: [12, 24, 36],
}

/**
 * District "Milieu" — weighted likelihood of each tenant persona showing up in
 * the applicant pool, reflecting the social character of each Berlin district.
 * Weights don't have to sum to 1; pickWeighted normalises them.
 */
const DISTRICT_MILIEU: Record<string, Partial<Record<TenantPersonality, number>>> = {
  mitte:          { demanding: 3, quiet: 2, tidy: 2, family: 1, partyer: 1, student: 0.5 },
  charlottenburg: { demanding: 3, quiet: 3, tidy: 2, family: 2, partyer: 0.3, student: 0.3 },
  prenzlauer:     { family: 4, tidy: 2, quiet: 2, demanding: 1.5, student: 1, partyer: 0.5 },
  kreuzberg:      { partyer: 3, student: 2.5, tidy: 1, quiet: 1, family: 1, demanding: 0.5 },
  neukoelln:      { student: 2.5, partyer: 2.5, tidy: 1, quiet: 1, family: 1.5, demanding: 0.3 },
  wedding:        { student: 2.5, family: 2, quiet: 2, partyer: 1, tidy: 1, demanding: 0.2 },
}

function pickWeighted<T extends string>(rng: () => number, weights: Partial<Record<T, number>>, fallback: T[]): T {
  const entries = Object.entries(weights) as Array<[T, number | undefined]>
  const total = entries.reduce((s, [, w]) => s + (w ?? 0), 0)
  if (total <= 0) return fallback[Math.floor(rng() * fallback.length)]
  let r = rng() * total
  for (const [k, w] of entries) {
    r -= (w ?? 0)
    if (r <= 0) return k
  }
  return fallback[Math.floor(rng() * fallback.length)]
}

/** `baseKalt` is the property's reference Kaltmiete (used to size the applicant's
 *  budget tier); `askingKalt` is what the player is actually asking. `nebenkosten`
 *  is added to both so the qualification compares Warmmiete to budget.
 *  `district` biases the persona pool toward the local milieu. */
export function generateApplicants(rng: () => number, baseKalt: number, condition: number, askingKalt: number, nebenkosten: number, count: number, district?: string): Applicant[] {
  const out: Applicant[] = []
  const askingWarm = askingKalt + nebenkosten
  const milieu = district ? DISTRICT_MILIEU[district] : undefined
  for (let i = 0; i < count; i++) {
    // Mietnomad-Roll: ~2% chance regardless of milieu. They masquerade as a
    // benign persona; we keep the real personality 'nomad' but the displayed
    // reliability/income come from a disguise.
    const isNomad = rng() < 0.02
    const realPersona: TenantPersonality = isNomad
      ? 'nomad'
      : milieu
        ? pickWeighted<TenantPersonality>(rng, milieu, TENANT_PERSONAS)
        : TENANT_PERSONAS[Math.floor(rng() * TENANT_PERSONAS.length)]
    // Visible persona — disguised for nomads
    const visiblePersona: TenantPersonality = isNomad
      ? NOMAD_DISGUISES[Math.floor(rng() * NOMAD_DISGUISES.length)]
      : realPersona
    const [rMin, rMax] = RELIABILITY_BY_PERSONA[visiblePersona]
    const reliability = Math.round(rMin + rng() * (rMax - rMin))
    const blurbs = TENANT_BLURBS[visiblePersona]
    const blurb = blurbs[Math.floor(rng() * blurbs.length)]
    const incomeMult = INCOME_MULT_BY_PERSONA[visiblePersona] * (0.85 + rng() * 0.3)
    const baseInc = Math.max(1500, Math.round(askingWarm * incomeMult))
    // budget tier is sized to the property's reference Warmmiete
    const baseBudget = (baseKalt + nebenkosten) * RENT_BUDGET_MULT[visiblePersona] * (0.85 + rng() * 0.3)
    // demanding tenants only consider properties in good condition
    const conditionPenalty = visiblePersona === 'demanding' && condition < 60 ? 0.7 : 1.0
    const maxRentBudget = Math.round(baseBudget * conditionPenalty)
    // applicant compares warm asking vs warm budget
    if (askingWarm > maxRentBudget * 1.05) continue
    const leaseOpts = LEASE_PREF[visiblePersona]
    out.push({
      id: 'a_' + Math.random().toString(36).slice(2, 9),
      name: pickName(rng),
      occupation: pickJob(rng),
      personality: visiblePersona,
      ...(isNomad ? { secretPersonality: 'nomad' as TenantPersonality } : {}),
      reliability,
      income: baseInc,
      maxRentBudget,
      preferredLeaseMonths: leaseOpts[Math.floor(rng() * leaseOpts.length)],
      blurb,
    })
  }
  return out
}

export function pickSeller(rng: () => number): SellerInfo {
  const persona = PERSONAS[Math.floor(rng() * PERSONAS.length)]
  const reason = REASONS[persona][Math.floor(rng() * REASONS[persona].length)]
  const ownerName = pickName(rng)
  const flavor = FLAVOR[persona]

  // 55% chance the property is listed by a private seller, 45% via an agent
  const channel: ListingChannel = rng() < 0.55 ? 'private' : 'agent'
  const base: SellerInfo = { channel, ownerName, ownerPersona: persona, reason, flavor }
  if (channel === 'private') return base

  const agentPersonality = AGENT_PERSONALITIES[Math.floor(rng() * AGENT_PERSONALITIES.length)]
  const agency = AGENCY_NAMES[Math.floor(rng() * AGENCY_NAMES.length)]
  const agentName = `${pickName(rng)} (${agency})`
  const blurbs = AGENT_BLURBS[agentPersonality]
  const agentBlurb = blurbs[Math.floor(rng() * blurbs.length)]
  return {
    ...base,
    agentName,
    agentPersonality,
    agentBlurb,
    agentCommissionPct: 0.025 + rng() * 0.025,  // 2.5%..5% (paid by seller)
  }
}
