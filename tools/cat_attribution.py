"""
What each of the four Cat changes is worth, isolated.

    python tools/cat_attribution.py

The Cat moved +142.4 in one commit and is now the highest profile in the project
by a wide margin, so the split wants measuring rather than guessing. Each variant
REVERTS one change in the source and re-measures -- the method CLAUDE.md
documents, and the one the Moonkin APL probe used.

The seeds come from the seed INDEX inside `measure_profiles.ts`, so every run
sees the same thirty fights and the figures are comparable to each other. Every
file is restored from its original text whatever happens.

Not a test and not a baseline.
"""

import os
import subprocess
import sys

ROTATION = 'src/game/rotations/druid.ts'
EFFECTS = 'src/game/talents/druidEffects.ts'
COEFFS = 'src/game/combat/coefficients.ts'
DAMAGE = 'src/engine/combat/damage.ts'

# (label, [(file, find, replace), ...]) -- each reverts ONE change.
VARIANTS = [
    ('all four, as committed', []),
    (
        'without Clearcasting -> Shred',
        [(ROTATION, "  { abilityId: 'shred', condition: selfActive('clearcasting') },\n", '')],
    ),
    (
        "without the AUTO-ATTACK half of Rend and Tear only (ticks still in)",
        [(EFFECTS, "tables: ['melee-auto', 'melee-special']", "tables: ['melee-special']")],
    ),
    (
        'without Rend and Tear widened AT ALL (as it shipped: specials only)',
        [
            (EFFECTS, "tables: ['melee-auto', 'melee-special']", "tables: ['melee-special']"),
            (DAMAGE, 'bleedingTargetModifier(request, request.attackTable ?? request.critFrom)',
             'bleedingTargetModifier(request, request.attackTable)'),
        ],
    ),
    (
        "without Primal Fury's combo point clause",
        [(
            EFFECTS,
            """    {
      kind: 'reaction',
      reactionId: 'primal_fury_combo_point',
      valueIndex: 2,
      requires: { styles: ['cat'] },
    },
""",
            '',
        )],
    ),
    (
        "without Rake's 5.5% tick (back to 1%)",
        [(COEFFS, 'export const RAKE_TICK_AP_COEFFICIENT = 0.055;',
          'export const RAKE_TICK_AP_COEFFICIENT = 0.01;')],
    ),
]


def main() -> int:
    originals = {p: open(p, encoding='utf-8').read() for p in (ROTATION, EFFECTS, COEFFS, DAMAGE)}
    env = dict(os.environ, SEEDS='30', ITERATIONS='10', PROFILES='druid_cat,druid_bear')

    try:
        for label, reverts in VARIANTS:
            for path, find, replace in reverts:
                text = originals[path]
                # COUNTS, AND REFUSES UNLESS THERE IS EXACTLY ONE. A presence
                # check is what let this script patch the first of two identical
                # call sites and measure the same build twice; the header has
                # claimed it counts since that commit, and now it does.
                found = text.count(find)
                if found != 1:
                    print(f'{found} matches in {path} for "{label}":\n{find[:160]}')
                    return 1
                open(path, 'w', encoding='utf-8', newline='').write(text.replace(find, replace, 1))
            # Anything not reverted in this variant goes back to committed.
            for path, text in originals.items():
                if not any(r[0] == path for r in reverts):
                    open(path, 'w', encoding='utf-8', newline='').write(text)

            result = subprocess.run(
                ['npx.cmd', 'vite-node', 'tools/measure_profiles.ts'],
                env=env, capture_output=True, text=True,
            )
            if result.returncode != 0:
                print(result.stdout[-2500:], result.stderr[-2500:])
                return result.returncode
            figures = [
                line.strip() for line in result.stdout.splitlines()
                if ' DPS ' in line and not line.startswith('SEEDS=')
            ]
            print(f'{label}')
            for figure in figures:
                print(f'    {figure}')
            print(flush=True)
    finally:
        for path, text in originals.items():
            open(path, 'w', encoding='utf-8', newline='').write(text)
        print('sources restored', flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
