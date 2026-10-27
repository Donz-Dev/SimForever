/*
 * ROUND 80: RE-PRICING REVELATION AFTER THE OWNER'S ONCE-PER-CAST RULING.
 *
 * Each group is the shipped preset (Revelation on its weapon) against the
 * weapon enchant it wore before round 80. Run with WEIGHTED=1, one preset at a
 * time: PRESET=<id> FILE=tools/optimise/revelationReprice80.ts VARIANTS=<group>.
 */
import type { Variant } from '../buildVariants';
import { enchant } from '../buildVariants';

const control: Variant = { label: 'shipped (Revelation)', apply: (p) => p };

export const VARIANT_GROUPS: Record<string, readonly Variant[]> = {
  // The three Mages and the Shadow Priest wore +65 Spell Power on the staff.
  revStaff: [control, { label: 'staff +65 Spell Power', apply: enchant('twoHand', 900029) }],
  // The Ele Shaman wore Enchant Weapon - Spell Power on the main hand.
  revMainHand: [control, { label: 'main hand Enchant Weapon - Spell Power', apply: enchant('mainHand', 22749) }],
};
