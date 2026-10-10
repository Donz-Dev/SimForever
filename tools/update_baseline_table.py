"""
Rebuild HANDOVER.md's 24-profile baseline table from a measurement.

    npx vite-node tools/measure_profiles.ts   # with SAVE=figures.json
    python tools/update_baseline_table.py figures.json [moved_id,moved_id,...]

The optional second argument is the preset ids THIS change moved, which are the
rows the table shows in bold. It is an argument rather than something inferred
from a diff because "which rows did my commit move" is a fact about the commit,
not about the numbers -- a row can move by 0.0 and a row can move without being
the subject. Omitting it bolds nothing, which is also what to pass when the
previous commit's emphasis should simply be cleared.

WHY THIS EXISTS: HANDOVER.md has claimed since the Hemo commit that "the table
is rebuilt by a script now rather than edited a row at a time", and there was no
such script in the repository. The note above the code was the false part, which
is this project's recurring failure mode -- the same one `cat_attribution.py`'s
header had, and the same one that let `weapons.ts` list Lacerate as a paw
ability. **A lesson is not landed until the tool that learned it exists.**

WHAT IT DOES, which is what that sentence promised:

  - parses the table's OWN rows for each profile's class and talents, so those
    are never retyped and a row cannot silently lose them;
  - takes every DPS from the measurement JSON, keyed by preset id;
  - derives the ordering and the two-column split rather than preserving it,
    because a single row moving re-sorts the table -- adding Hemo moved five
    rows between the columns, and that is exactly the edit that goes wrong
    silently;
  - ASSERTS that the set it measured and the set the table carries are the same
    25, so a profile added to the presets and not to the table is an error
    rather than a quiet omission;
  - re-sums the mean FROM THE ROWS it just wrote and updates the sentence under
    the table, because a count adjusted by hand is how this project's totals
    have gone wrong before.

THE TABLE'S LABELS ARE NOT THE PRESETS' LABELS -- it says "Cat Druid" where the
preset says "Cat" -- so the map below is explicit and is itself checked against
both sides. Not a test and not a measurement.
"""

import json
import re
import sys

HANDOVER = 'HANDOVER.md'

# table label -> preset id. Checked against the presets AND the table below.
LABELS = {
    '2H Arms': 'two_hand_arms',
    'DW Fury': 'dw_fury',
    'Prot Warr': 'prot_warr',
    'Venom Rogue': 'rogue_venom',
    'Combat Rogue': 'rogue_combat',
    'Rupture Rogue': 'rogue_rupture',
    'Hemo Rogue': 'rogue_hemo',
    'Moonkin': 'druid_moonkin',
    'Cat Druid': 'druid_cat',
    'Bear Druid': 'druid_bear',
    'Ele Shaman': 'shaman_elemental',
    'Enh Shaman': 'shaman_enhancement',
    'Frostfire Mage': 'mage_frostfire',
    'Arcane Mage': 'mage_arcane',
    'Fire Mage': 'mage_fire',
    'Seal Twist Ret': 'pally_ret',
    'Shockadin': 'pally_shockadin',
    'Prot Pally': 'prot_pally',
    'BM Hunter': 'bm_hunter',
    'LW Ranged': 'lw_ranged',
    'LW Melee': 'lw_melee',
    'Hawk Melee': 'hawk_melee',
    'SM/DS': 'warlock_smds',
    'Firelock': 'warlock_firelock',
    'Shadow Priest': 'shadow_priest',
}

ROW = re.compile(
    r'\|\s*(?:\*\*)?([^|*]+?)(?:\*\*)?\s*\|\s*(\w[\w ]*?)\s*\|\s*([\d/]+)\s*\|'
    r'\s*(?:\*\*)?([\d.]+)(?:\*\*)?\s*\|'
)


def main(figures_path, moved):
    figures = json.load(open(figures_path, encoding='utf-8'))
    text = open(HANDOVER, encoding='utf-8').read()

    start = text.index('| Profile | Class | Talents | DPS |')
    end = text.index('\n\n', start)
    block = text[start:end]

    # Parse the table's own rows: the class and talents come from here, never
    # from this script, so they cannot be retyped wrong.
    rows = {}
    for line in block.splitlines()[2:]:
        for label, klass, talents, _dps in ROW.findall(line):
            label = label.strip()
            if label in ('Profile', ''):
                continue
            rows[label] = (klass.strip(), talents.strip())

    # The three sets must agree, or something was added in one place only.
    missing_from_map = set(rows) - set(LABELS)
    missing_from_table = set(LABELS) - set(rows)
    if missing_from_map or missing_from_table:
        print('table/map mismatch:')
        print('  in the table, not in the map:', sorted(missing_from_map))
        print('  in the map, not in the table:', sorted(missing_from_table))
        return 1
    unknown_moved = moved - set(LABELS.values())
    if unknown_moved:
        print('not preset ids:', sorted(unknown_moved))
        return 1
    unmeasured = {label for label in rows if LABELS[label] not in figures}
    extra = set(figures) - {LABELS[label] for label in rows}
    if unmeasured or extra:
        print('measurement/table mismatch:')
        print('  in the table, not measured:', sorted(unmeasured))
        print('  measured, not in the table:', sorted(extra))
        return 1

    ordered = sorted(rows, key=lambda label: -figures[LABELS[label]])
    half = (len(ordered) + 1) // 2
    left, right = ordered[:half], ordered[half:]

    def cell(label):
        klass, talents = rows[label]
        dps = f'{figures[LABELS[label]]:.1f}'
        if LABELS[label] in moved:
            return f'| **{label}** | {klass} | {talents} | **{dps}** |'
        return f'| {label} | {klass} | {talents} | {dps} |'

    lines = [
        '| Profile | Class | Talents | DPS | | Profile | Class | Talents | DPS |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ]
    for i in range(half):
        # The columns are separated by an EMPTY cell -- the header is nine wide,
        # four plus a spacer plus four -- so the two halves join with a space
        # and the doubled pipe is deliberate.
        #
        # AN ODD COUNT LEAVES THE LAST RIGHT-HAND CELL EMPTY, and the filler
        # has to be the same NINE columns wide as every other row: the spacer
        # plus four. `| | | |` is the obvious thing to write and renders a
        # seven-column row, which markdown accepts silently. First reached at
        # 25 profiles -- it had been even every time until then.
        right_cell = cell(right[i]) if i < len(right) else '| | | | | |'
        lines.append(cell(left[i]) + ' ' + right_cell)

    text = text[:start] + '\n'.join(lines) + text[end:]

    # RE-SUMMED FROM THE ROWS just written, never adjusted.
    mean = sum(figures[LABELS[label]] for label in ordered) / len(ordered)
    #
    # THE COUNT IS REWRITTEN TOO, NOT MATCHED ON. Keying the pattern to the
    # count this run produced meant the script could not add a profile: with 25
    # rows it looked for "mean across **25**", the sentence still said 24, and
    # the tool failed on the one edit it exists to make. Matching ANY count and
    # writing both numbers is also the stricter behaviour -- "the COUNT drifted
    # too, which is the same failure one level up" is in HANDOVER because the
    # sentence said twenty-three when Hemo had made it twenty-four.
    #
    # ANCHORED AFTER THE TABLE IT JUST REBUILT, which is the fix for a bug this
    # script had from the start: it replaced the FIRST match in the whole file,
    # and the first match was fifteen hundred lines ABOVE the table, inside a
    # dated paragraph about the Shatter round. So every run published the
    # current mean in the middle of a historical write-up and left the sentence
    # under the table -- there wasn't one -- untouched.
    #
    # `table_end` is where the rewritten table finishes in the NEW text, which
    # is `start` plus what was just written rather than the old `end`: the table
    # changes length whenever a profile is added.
    table_end = start + len('\n'.join(lines))
    head, tail = text[:table_end], text[table_end:]
    tail, n = re.subn(
        r'mean across \*\*\d+\*\* is \*\*[\d.]+\*\*',
        f'mean across **{len(ordered)}** is **{mean:.1f}**',
        tail,
        count=1,
    )
    text = head + tail
    if n != 1:
        print('could not find a mean sentence UNDER the table to update')
        return 1

    open(HANDOVER, 'w', encoding='utf-8', newline='').write(text)
    print(f'rebuilt {len(ordered)} rows; mean {mean:.1f}')
    print(f'  top: {ordered[0]} {figures[LABELS[ordered[0]]]:.1f}')
    print(f'  bottom: {ordered[-1]} {figures[LABELS[ordered[-1]]]:.1f}')
    return 0


if __name__ == '__main__':
    if len(sys.argv) not in (2, 3):
        print(__doc__)
        sys.exit(2)
    moved_ids = set(sys.argv[2].split(',')) if len(sys.argv) == 3 else set()
    sys.exit(main(sys.argv[1], moved_ids))
