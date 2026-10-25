import { describe, expect, it } from 'vitest';
import { PROFILE_PRESETS } from '../../src/profiles';
import { profileGroups } from '../../src/ui/panels/ProfileRail';

/*
 * THE RAIL'S THREE GROUPS (round 66), the owner's: DPS, then Tank (Bear, Prot
 * Warr, Prot Pally, Fury Prot), then Healer (Piss Beam, Holy Pal). Labels, not
 * ids, because the labels are what the owner named.
 */
describe('the profile rail', () => {
  const groups = profileGroups();
  const labels = (index: number) => groups[index]!.presets.map((preset) => preset.label);

  it('has three headings, in order', () => {
    expect(groups.map((group) => group.label)).toEqual(['DPS Profiles', 'Tank Profiles', 'Healer Profiles']);
  });

  it('puts the four tanks and the two healers in their own groups', () => {
    expect([...labels(1)].sort()).toEqual(['Bear', 'Fury Prot', 'Prot Pally', 'Prot Warr']);
    expect([...labels(2)].sort()).toEqual(['Holy Pal', 'Piss Beam']);
  });

  it('shows every preset exactly once, so a new one lands under DPS', () => {
    const shown = groups.flatMap((group) => group.presets.map((preset) => preset.id));
    expect(shown.sort()).toEqual(PROFILE_PRESETS.map((preset) => preset.id).sort());
  });
});
