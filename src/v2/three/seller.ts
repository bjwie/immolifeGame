/**
 * The person showing you round: a Makler on agent listings, the owner on a
 * private sale — and they behave differently, because that is how a viewing
 * actually goes.
 *
 * The rule that makes it feel real: they never volunteer a defect you have not
 * found yourself. Ask directly and they answer about what is already on the
 * table; anything you missed gets "davon ist mir nichts bekannt". A private
 * owner, being no professional, occasionally lets something slip.
 */
import type { Property } from '../sim/types'
import type { Finding } from './InteriorTour'
import { formatEuro } from '../sim/Engine'

export interface QAItem {
  id: string
  q: string
  a: string
  /** leak = they gave away something you had not found */
  tone: 'ok' | 'evasive' | 'leak'
}

export interface Dialogue {
  name: string
  role: string
  greeting: string
  items: QAItem[]
}

/** Rough Energieausweis class from age, condition and window quality. */
export function energyClass(p: Property, hasOldWindows: boolean): { cls: string; kwh: number } {
  let kwh = 90
  if (p.yearBuilt < 1920) kwh += 110
  else if (p.yearBuilt < 1978) kwh += 90
  else if (p.yearBuilt < 1995) kwh += 55
  else if (p.yearBuilt < 2010) kwh += 20
  kwh += Math.max(0, (70 - p.condition)) * 1.4
  if (hasOldWindows) kwh += 35
  kwh = Math.round(kwh)
  const cls = kwh < 30 ? 'A+' : kwh < 50 ? 'A' : kwh < 75 ? 'B' : kwh < 100 ? 'C'
    : kwh < 130 ? 'D' : kwh < 160 ? 'E' : kwh < 200 ? 'F' : kwh < 250 ? 'G' : 'H'
  return { cls, kwh }
}

export function buildDialogue(
  p: Property,
  findings: Finding[],
  rng: () => number,
  currentMonth: number,
): Dialogue {
  const isAgent = p.seller?.channel === 'agent'
  const name = (isAgent ? p.seller?.agentName : p.seller?.ownerName) ?? 'Verkaeufer'
  const role = isAgent ? 'Makler' : 'Eigentuemer'

  const found = (id: string) => findings.find(f => f.def.id === id && f.found)
  const exists = (id: string) => findings.find(f => f.def.id === id)
  const unfound = findings.filter(f => !f.found)

  // A private owner is not media-trained. Roughly a third of the time they
  // hand you something you had not spotted.
  let leaked: Finding | null = null
  if (!isAgent && unfound.length && rng() < 0.34) {
    leaked = unfound[Math.floor(rng() * unfound.length)]
  }

  const dodge = isAgent
    ? 'Dazu liegt mir nichts vor. Der Eigentuemer hat nichts angezeigt.'
    : 'Davon weiss ich nichts, ehrlich gesagt.'

  const answerFor = (id: string, whenFound: (cost: number) => string, whenNot: string): { a: string; tone: QAItem['tone'] } => {
    const f = found(id)
    if (f) return { a: whenFound(f.cost), tone: 'ok' }
    if (leaked && leaked.def.id === id) {
      return { a: `Ehrlich gesagt… ${leaked.def.detail} Das muesste man angehen.`, tone: 'leak' }
    }
    return { a: exists(id) ? whenNot : dodge, tone: exists(id) ? 'evasive' : 'ok' }
  }

  const items: QAItem[] = []
  const add = (id: string, q: string, a: string, tone: QAItem['tone'] = 'ok') => items.push({ id, q, a, tone })

  // --- the building
  const age = currentMonth > 0 ? Math.max(0, Math.round(currentMonth / 12) + 2026 - p.yearBuilt) : 2026 - p.yearBuilt
  add('baujahr', 'Aus welchem Jahr ist das Haus?',
    `Baujahr ${p.yearBuilt}, also gut ${age} Jahre alt. ${p.yearBuilt < 1930
      ? 'Klassischer Altbau — hohe Decken, aber eben auch Altbau-Technik.'
      : p.yearBuilt < 1980 ? 'Nachkriegsbau, solide Substanz.'
        : 'Vergleichsweise jung, da ist wenig Ueberraschung zu erwarten.'}`)

  add('flaeche', 'Wie gross ist die Wohnung genau?',
    `${p.units?.[0]?.sqm ?? Math.round(p.baseRent / 11)} Quadratmeter nach Wohnflaechenverordnung. ${p.buildingForm === 'mfh'
      ? `Es geht um das ganze Haus mit ${p.units.length} Einheiten.` : ''}`)

  const renovated = p.lastRenovationMonth != null
  add('sanierung', 'Wann wurde zuletzt saniert?',
    renovated
      ? 'Da ist in den letzten Jahren etwas gemacht worden, das sehen Sie ja.'
      : p.condition > 75
        ? 'Laufend instandgehalten. Grosse Massnahmen waren nicht noetig.'
        : 'Die letzte groessere Massnahme ist eine Weile her. Da ist Luft nach oben.')

  // --- technology
  const heiz = answerFor('therme_alt',
    c => `Sie haben den Kessel ja gesehen. Der ist ueberaltert, Austausch liegt bei etwa ${formatEuro(c)}.`,
    'Die Heizung laeuft. Ueber das Alter muesste ich in die Unterlagen schauen.')
  add('heizung', 'Was ist das fuer eine Heizung?',
    `${p.yearBuilt < 1995 ? 'Gas-Zentralheizung im Keller.' : 'Gas-Brennwert, zentral.'} ${heiz.a}`, heiz.tone)

  const fenster = answerFor('einfachglas',
    c => `Die Fenster sind ein Thema, ja. Tausch liegt in der Groessenordnung ${formatEuro(c)}.`,
    'Die Fenster sind altersgemaess in Ordnung.')
  add('fenster', 'Wie ist der Zustand der Fenster?', fenster.a, fenster.tone)

  const elektro = answerFor('fi_fehlt',
    c => `Stimmt, die Verteilung ist alt und ohne FI. Neuinstallation etwa ${formatEuro(c)}.`,
    'Die Elektrik hat bisher keine Probleme gemacht.')
  add('elektrik', 'Ist die Elektrik erneuert?', elektro.a, elektro.tone)

  const leitungen = answerFor('steigstrang',
    c => `Der Steigstrang ist original, das ist bekannt. Rund ${formatEuro(c)} fuer den Austausch.`,
    'Zu den Leitungen kann ich Ihnen nichts Genaues sagen.')
  add('leitungen', 'Wie alt sind die Wasserleitungen?', leitungen.a, leitungen.tone)

  const keller = answerFor('keller_feucht',
    c => `Der Keller ist feucht, das haben Sie gesehen. Trockenlegung liegt bei ungefaehr ${formatEuro(c)}.`,
    'Der Keller ist wie bei jedem Altbau — nicht wohnraumtauglich, aber trocken genug.')
  add('keller', 'Gibt es Feuchtigkeit im Keller?', keller.a, keller.tone)

  // --- money
  add('nebenkosten', 'Wie hoch sind die Nebenkosten?',
    `Rund ${formatEuro(p.nebenkosten)} im Monat, warm also etwa ${formatEuro(p.baseRent + p.nebenkosten)}. ${p.condition < 55 ? 'Bei dem Daemmstandard eher am oberen Rand.' : ''}`)

  if (p.wegMembership) {
    add('weg', 'Gibt es eine Eigentuemergemeinschaft?',
      `Ja, WEG mit mehreren Parteien. Hausgeld faellt monatlich an, Beschluesse laufen ueber die Eigentuemerversammlung.`)
    add('ruecklage', 'Wie hoch ist die Instandhaltungsruecklage?',
      p.condition < 60
        ? 'Die Ruecklage ist ueberschaubar. Bei anstehenden Massnahmen wird es auf eine Sonderumlage hinauslaufen.'
        : 'Die Ruecklage ist ordentlich dotiert, da ist Puffer drin.')
  }

  const monthsOn = p.monthsOnMarket ?? 0
  add('preis', 'Ist beim Preis etwas zu machen?',
    monthsOn > 5
      ? 'Wir sind seit einer Weile am Markt. Ein ernsthaftes Angebot wird der Eigentuemer sich ansehen.'
      : isAgent
        ? 'Der Preis ist marktgerecht kalkuliert. Aber machen Sie mir gern ein Angebot.'
        : 'Ich haenge nicht am letzten Euro, aber verschenken will ich auch nichts.')

  // --- letting
  const anyTenant = p.tenant || p.units?.some(u => u.tenant)
  add('vermietung', 'Ist die Wohnung vermietet?',
    anyTenant
      ? `Vermietet. Kaltmiete aktuell ${formatEuro(p.baseRent)}. Eigenbedarf muessten Sie anmelden, das dauert.`
      : 'Bezugsfrei. Sie koennen direkt selbst einziehen oder neu vermieten.')

  add('mietspiegel', 'Was gibt der Mietspiegel her?',
    `Vergleichsmiete liegt bei etwa ${formatEuro(p.mietspiegelKalt)} kalt. ${p.baseRent < p.mietspiegelKalt * 0.9
      ? 'Da ist also noch Potenzial nach oben, im Rahmen der Kappungsgrenze.'
      : 'Viel Luft nach oben ist da ehrlicherweise nicht.'}`)

  // --- paperwork
  const oldWindows = !!exists('einfachglas')
  const e = energyClass(p, oldWindows)
  add('energieausweis', 'Haben Sie den Energieausweis dabei?',
    `Ja — Endenergiebedarf rund ${e.kwh} kWh pro Quadratmeter und Jahr, Klasse ${e.cls}. ${e.cls >= 'E' ? 'Das ist kein Glanzwert, das sehe ich auch.' : ''}`)

  add('grund', 'Warum wird verkauft?', p.seller?.reason
    ? `${p.seller.reason}` : 'Eine private Veraenderung, mehr moechte der Eigentuemer dazu nicht sagen.')

  // --- the direct question
  const foundList = findings.filter(f => f.found)
  let maengelA: string
  let maengelTone: QAItem['tone'] = 'ok'
  if (foundList.length === 0) {
    maengelA = isAgent
      ? 'Mir sind keine wesentlichen Maengel angezeigt worden. Schauen Sie sich in Ruhe um.'
      : 'Nichts Grosses, denke ich. Aber gucken Sie ruhig genau hin.'
    maengelTone = findings.length ? 'evasive' : 'ok'
  } else {
    const total = foundList.reduce((a, f) => a + f.cost, 0)
    maengelA = `Was Sie gefunden haben, will ich nicht kleinreden: ${foundList.map(f => f.def.label).join(', ')}. `
      + `Das sind grob ${formatEuro(total)}.`
    if (unfound.length && !leaked) maengelA += ' Darueber hinaus ist mir nichts bekannt.'
    maengelTone = unfound.length && !leaked ? 'evasive' : 'ok'
  }
  add('maengel', 'Gibt es bekannte Maengel?', maengelA, maengelTone)

  if (leaked) {
    add('leak', 'Sonst noch etwas, das ich wissen sollte?',
      `Ehrlich gesagt: ${leaked.def.detail} Das wollte ich nicht verschweigen.`, 'leak')
  }

  const greeting = isAgent
    ? `${name}, ich betreue den Verkauf. Schauen Sie sich um, fragen Sie mich alles.`
    : `${name}. Ich wohne selbst hier — fragen Sie ruhig, ich sag Ihnen was ich weiss.`

  return { name, role, greeting, items }
}
