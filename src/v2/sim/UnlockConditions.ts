import type { DistrictId } from '../render/CityRenderer'

export type UnlockConditionType = 'ownedCount' | 'netWorth' | 'reputation'

export interface UnlockCondition {
  type: UnlockConditionType
  threshold: number
  /** Short German label shown in the locked-district banner / hint. */
  label: string
}

/**
 * Registry of conditions per locked district. Districts not present (or null)
 * are either always-unlocked playable districts or unreachable. A district
 * unlocks the first month where the player meets the threshold for the
 * registered condition.
 */
export const UNLOCK_CONDITIONS: Partial<Record<DistrictId, UnlockCondition>> = {
  spandau: { type: 'ownedCount', threshold: 3, label: 'Besitze 3 Immobilien' },
  steglitz: { type: 'netWorth', threshold: 500_000, label: 'Vermoegen 500.000 EUR' },
  lichtenberg: { type: 'ownedCount', threshold: 7, label: 'Besitze 7 Immobilien' },
  marzahn: { type: 'netWorth', threshold: 1_500_000, label: 'Vermoegen 1.500.000 EUR' },
}
