/**
 * Defect catalogue for the Besichtigung.
 *
 * Defects are not handed to the player as a list — the visible clue (a stain,
 * a crack, a scorched patch) is placed in the flat and only becomes a named,
 * priced finding once the player walks up and actually looks at it. Miss one
 * and you buy it with the flat.
 */
export type Severity = 'warn' | 'bad'
export type Surface = 'wall' | 'floor' | 'ceiling'

export interface DefectDef {
  id: string
  /** room ids it can sit in; 'living' / 'wet' match any room of that kind */
  rooms: string[]
  label: string
  detail: string
  /** what the player sees before identifying it */
  hint: string
  baseCost: number
  severity: Severity
  /** only rolls when the building is at or below this condition */
  maxCondition: number
  /** probability once eligible */
  chance: number
  surface: Surface
  /** stain tint */
  tint: number
}

export const DEFECT_CATALOGUE: DefectDef[] = [
  // ---- bathroom
  {
    id: 'schimmel_dusche', rooms: ['bad'], label: 'Schimmel an der Duschwand',
    detail: 'Feuchteschaden in der Fuge, vermutlich undichte Abdichtung.',
    hint: 'Dunkle Flecken entlang der Fuge', baseCost: 1800, severity: 'bad',
    maxCondition: 68, chance: 0.85, surface: 'wall', tint: 0x2f3a2c,
  },
  {
    id: 'wanne_rost', rooms: ['bad'], label: 'Wanne mit Rostkante',
    detail: 'Emaille durchgescheuert, die Wanne muss raus.',
    hint: 'Braune Kante an der Wanne', baseCost: 1500, severity: 'warn',
    maxCondition: 45, chance: 0.7, surface: 'floor', tint: 0x6b4a2a,
  },
  {
    id: 'silikon', rooms: ['bad'], label: 'Silikonfugen durchgehend erneuern',
    detail: 'Fugen vergilbt und rissig, dahinter zieht Wasser.',
    hint: 'Vergilbte Fugen', baseCost: 600, severity: 'warn',
    maxCondition: 75, chance: 0.55, surface: 'wall', tint: 0x6e6a52,
  },
  {
    id: 'bleirohr', rooms: ['bad'], label: 'Bleileitung im Bad',
    detail: 'Trinkwasserleitung aus Blei — Austausch ist Pflicht.',
    hint: 'Altes, weiches Rohr unter dem Becken', baseCost: 4800, severity: 'bad',
    maxCondition: 42, chance: 0.4, surface: 'wall', tint: 0x4a4a52,
  },

  // ---- kitchen
  {
    id: 'fi_fehlt', rooms: ['kueche'], label: 'Elektrik ohne FI-Schutzschalter',
    detail: 'Verteilung auf Stand der 70er. Neuinstallation faellig.',
    hint: 'Uralter Sicherungskasten', baseCost: 5200, severity: 'bad',
    maxCondition: 60, chance: 0.75, surface: 'wall', tint: 0x3a3228,
  },
  {
    id: 'fettwand', rooms: ['kueche'], label: 'Verrusste Wand ueber dem Herd',
    detail: 'Keine Abluft installiert, Putz ist durchgefettet.',
    hint: 'Dunkler Schatten ueber dem Herd', baseCost: 900, severity: 'warn',
    maxCondition: 70, chance: 0.6, surface: 'wall', tint: 0x38322c,
  },
  {
    id: 'spuele_leck', rooms: ['kueche'], label: 'Wasserschaden unter der Spuele',
    detail: 'Siphon undicht, Unterschrank aufgequollen.',
    hint: 'Aufgequollener Boden am Unterschrank', baseCost: 1400, severity: 'warn',
    maxCondition: 58, chance: 0.55, surface: 'floor', tint: 0x4a3a26,
  },
  {
    id: 'gasleitung', rooms: ['kueche'], label: 'Gasleitung ohne Pruefplakette',
    detail: 'Letzte Pruefung nicht dokumentiert, Freigabe noetig.',
    hint: 'Gelbes Rohr ohne Plakette', baseCost: 2200, severity: 'warn',
    maxCondition: 55, chance: 0.35, surface: 'wall', tint: 0x6b5c22,
  },

  // ---- living / bedrooms
  {
    id: 'setzriss', rooms: ['living'], label: 'Setzrisse ueber dem Sturz',
    detail: 'Diagonale Risse ueber der Tuer. Der Gutachter schaut genau hin.',
    hint: 'Riss im Putz', baseCost: 1200, severity: 'warn',
    maxCondition: 55, chance: 0.6, surface: 'wall', tint: 0x2f2a25,
  },
  {
    id: 'parkett', rooms: ['living'], label: 'Parkett aufgequollen',
    detail: 'Dielen werfen sich, darunter war laenger Feuchtigkeit.',
    hint: 'Welliger Boden', baseCost: 3200, severity: 'warn',
    maxCondition: 50, chance: 0.5, surface: 'floor', tint: 0x4a3520,
  },
  {
    id: 'deckenfleck', rooms: ['living'], label: 'Wasserfleck an der Decke',
    detail: 'Zulauf von oben — die Wohnung darueber hat ein Problem.',
    hint: 'Brauner Rand an der Decke', baseCost: 2800, severity: 'bad',
    maxCondition: 62, chance: 0.45, surface: 'ceiling', tint: 0x5a4326,
  },
  {
    id: 'waermebruecke', rooms: ['living'], label: 'Schimmel in der Raumecke',
    detail: 'Waermebruecke an der Aussenwand, Tapete loest sich.',
    hint: 'Dunkle Ecke hinter dem Schrank', baseCost: 2400, severity: 'bad',
    maxCondition: 52, chance: 0.55, surface: 'wall', tint: 0x2c332c,
  },
  {
    id: 'einfachglas', rooms: ['living'], label: 'Einfachverglasung, undicht',
    detail: 'Zugluft und hohe Heizkosten. Fenstertausch faellig.',
    hint: 'Klapprige Fenster ohne Dichtung', baseCost: 4200, severity: 'warn',
    maxCondition: 64, chance: 0.65, surface: 'wall', tint: 0x4a4a44,
  },
  {
    id: 'rolladen', rooms: ['living'], label: 'Rolladengurt gerissen',
    detail: 'Kasten offen, Gurt gerissen, Daemmung fehlt.',
    hint: 'Offener Rolladenkasten', baseCost: 450, severity: 'warn',
    maxCondition: 70, chance: 0.4, surface: 'wall', tint: 0x3e3a34,
  },

  // ---- hallway
  {
    id: 'boden_flur', rooms: ['flur'], label: 'Bodenbelag ausgetreten',
    detail: 'Dielen ausgeschlagen, Trittschall grenzwertig.',
    hint: 'Abgelaufener Boden', baseCost: 2600, severity: 'warn',
    maxCondition: 50, chance: 0.6, surface: 'floor', tint: 0x40301e,
  },
  {
    id: 'verteiler_offen', rooms: ['flur'], label: 'Verteilerdose offen',
    detail: 'Blanke Klemmen ohne Abdeckung — akut gefaehrlich.',
    hint: 'Offene Dose an der Wand', baseCost: 350, severity: 'bad',
    maxCondition: 58, chance: 0.4, surface: 'wall', tint: 0x2a2a2e,
  },

  // ---- cellar
  {
    id: 'keller_feucht', rooms: ['keller'], label: 'Feuchte Kellerwand',
    detail: 'Aufsteigende Feuchte, Salzausbluehungen am Sockel.',
    hint: 'Weisse Ausbluehungen am Sockel', baseCost: 6800, severity: 'bad',
    maxCondition: 76, chance: 0.7, surface: 'wall', tint: 0x6a6a60,
  },
  {
    id: 'steigstrang', rooms: ['keller'], label: 'Steigstrang von 1962',
    detail: 'Verzinkte Leitungen, Rostwasser. Austausch empfohlen.',
    hint: 'Rostiges Steigrohr', baseCost: 9500, severity: 'warn',
    maxCondition: 68, chance: 0.6, surface: 'wall', tint: 0x5a3a24,
  },
  {
    id: 'therme_alt', rooms: ['keller'], label: 'Heizkessel ueberaltert',
    detail: 'Baujahr jenseits der Austauschpflicht, Wirkungsgrad mies.',
    hint: 'Sehr alter Kessel', baseCost: 12000, severity: 'bad',
    maxCondition: 60, chance: 0.55, surface: 'wall', tint: 0x4a4238,
  },
  {
    id: 'asbest', rooms: ['keller'], label: 'Asbestverdacht an Rohrisolierung',
    detail: 'Alte Leitungsdaemmung — vor Arbeiten beproben lassen.',
    hint: 'Bruechige weisse Rohrummantelung', baseCost: 5600, severity: 'bad',
    maxCondition: 48, chance: 0.35, surface: 'wall', tint: 0x8a8a82,
  },
  {
    id: 'hausschwamm', rooms: ['keller'], label: 'Verdacht auf Hausschwamm',
    detail: 'Watteartiges Myzel am Balkenkopf. Meldepflichtig.',
    hint: 'Weisses Geflecht am Holz', baseCost: 22000, severity: 'bad',
    maxCondition: 32, chance: 0.3, surface: 'wall', tint: 0x8e7f66,
  },
  {
    id: 'kellerdecke', rooms: ['keller'], label: 'Kellerdecke ungedaemmt',
    detail: 'Kalte Fuesse im Erdgeschoss, GEG-Nachruestpflicht.',
    hint: 'Blanke Betondecke', baseCost: 3400, severity: 'warn',
    maxCondition: 72, chance: 0.45, surface: 'ceiling', tint: 0x5c5c58,
  },
]

/** Which catalogue entries actually apply to this building. */
export function rollDefects(
  condition: number,
  rng: () => number,
  roomIds: string[],
  roomKind: (id: string) => string,
  max = 8,
): DefectDef[] {
  const eligible = DEFECT_CATALOGUE.filter(def => {
    if (condition > def.maxCondition) return false
    return def.rooms.some(want =>
      roomIds.includes(want) || roomIds.some(id => roomKind(id) === want))
  })
  const picked: DefectDef[] = []
  for (const def of eligible) {
    if (rng() < def.chance) picked.push(def)
  }
  // a spotless flat should still be possible; a wreck should not list 20 items
  while (picked.length > max) picked.splice(Math.floor(rng() * picked.length), 1)
  return picked
}
