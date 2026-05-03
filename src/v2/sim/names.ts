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

const TENANT_PERSONAS: TenantPersonality[] = ['tidy', 'partyer', 'quiet', 'demanding', 'family', 'student']
const TENANT_BLURBS: Record<TenantPersonality, string[]> = {
  tidy: ['hat im Lebenslauf "ordentlich" als Hobby', 'kommt mit Putzplan-Vorschlag', 'fragt zuerst nach der Hausordnung'],
  partyer: ['will wissen ob WG-Partys ok sind', 'erwaehnt seine DJ-Anlage beilaeufig', 'lebt fuer das Wochenende'],
  quiet: ['arbeitet von zuhause, braucht Ruhe', 'liest gerne, sammelt Buecher', 'macht zwar nichts kaputt aber redet auch nicht viel'],
  demanding: ['fragt nach Smart-Home-Features', 'will wissen ob die Heizung neu ist', 'hat Liste mit Wuenschen mitgebracht'],
  family: ['Eltern mit zwei Kindern', 'sucht 5+ Jahre Stabilitaet', 'hat 3 Generationen-Foto im Portfolio'],
  student: ['noch im Bachelor, hat Buergen', 'hat 4 WG-Mitbewohner als Backup', 'Geld kommt von Eltern'],
}

const RELIABILITY_BY_PERSONA: Record<TenantPersonality, [number, number]> = {
  tidy: [80, 95], partyer: [55, 80], quiet: [85, 98], demanding: [75, 92], family: [80, 92], student: [50, 80],
}
const INCOME_MULT_BY_PERSONA: Record<TenantPersonality, number> = {
  tidy: 3.5, partyer: 4.0, quiet: 3.2, demanding: 5.0, family: 3.6, student: 2.4,
}
const RENT_BUDGET_MULT: Record<TenantPersonality, number> = {
  tidy: 1.05, partyer: 1.10, quiet: 0.95, demanding: 1.20, family: 0.98, student: 0.85,
}
const LEASE_PREF: Record<TenantPersonality, number[]> = {
  tidy: [24, 36], partyer: [12, 24], quiet: [24, 36], demanding: [12, 24], family: [36], student: [12, 24],
}

export function generateApplicants(rng: () => number, baseRent: number, condition: number, askingRent: number, count: number): Applicant[] {
  const out: Applicant[] = []
  for (let i = 0; i < count; i++) {
    const persona = TENANT_PERSONAS[Math.floor(rng() * TENANT_PERSONAS.length)]
    const [rMin, rMax] = RELIABILITY_BY_PERSONA[persona]
    const reliability = Math.round(rMin + rng() * (rMax - rMin))
    const blurbs = TENANT_BLURBS[persona]
    const blurb = blurbs[Math.floor(rng() * blurbs.length)]
    const incomeMult = INCOME_MULT_BY_PERSONA[persona] * (0.85 + rng() * 0.3)
    const baseInc = Math.max(1500, Math.round(askingRent * incomeMult))
    const baseBudget = baseRent * RENT_BUDGET_MULT[persona] * (0.85 + rng() * 0.3)
    // demanding tenants only consider properties in good condition
    const conditionPenalty = persona === 'demanding' && condition < 60 ? 0.7 : 1.0
    const maxRentBudget = Math.round(baseBudget * conditionPenalty)
    // partyer/student less willing if rent extremely high
    if (askingRent > maxRentBudget * 1.05) continue
    const leaseOpts = LEASE_PREF[persona]
    out.push({
      id: 'a_' + Math.random().toString(36).slice(2, 9),
      name: pickName(rng),
      occupation: pickJob(rng),
      personality: persona,
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
