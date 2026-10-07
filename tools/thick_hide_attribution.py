"""
What Thick Hide and Feral Swiftness are each worth to the Bear, isolated.

    python tools/thick_hide_attribution.py

The two fixes land on the same profile and PULL IN OPPOSITE DIRECTIONS, which
is the whole reason this exists:

  - Feral Swiftness read index 0 and granted +30 dodge instead of +4. Fixing it
    REMOVES 26 points of avoidance, so the Bear takes much more damage, and
    rage is a share of damage taken -- so its DPS goes UP and it dies more.
  - Thick Hide was 3% of item armor, about 54, and is 274. Fixing it ADDS 220
    armor, which was predicted to earn LESS rage and cost DPS. IT DOES NOT:
    rage from damage taken is `D x 10 / H` off the PRE-ARMOR figure, so armor
    is the one mitigation that does not touch it. Measured at 751 rage against
    750, and -1.7 DPS inside the interval.

A net of +8.7 could be almost any pair of components, so the pair gets measured
rather than described -- and the prediction for one of the two was wrong against
a rule already written down in `resourceRules.ts` and CLAUDE.md. Each variant
REVERTS one fix in the source, the method CLAUDE.md documents.

THE LAST VARIANT REVERTS BOTH and must reproduce the published 514.4. That is
the cross-check the Cat probe learned the hard way: a variant that silently
fails to apply measures the state next to it, and two figures agreeing exactly
look like a finding rather than a bug.

The seeds come from the seed INDEX inside `measure_profiles.ts`, so every run
sees the same thirty fights and the figures are comparable. Every file is
restored from its original text whatever happens.

Not a test and not a baseline.
"""

import os
import subprocess
import sys

EFFECTS = 'src/game/talents/druidEffects.ts'

FERAL_SWIFTNESS_FIXED = "{ kind: 'stat', stat: 'dodgeChance', operation: 'flat', valueIndex: 1 },"
FERAL_SWIFTNESS_AS_SHIPPED = "{ kind: 'stat', stat: 'dodgeChance', operation: 'flat' },"

THICK_HIDE_FIXED = """  thick_hide: [
    {
      kind: 'statFromLevel',
      to: 'armor',
      valueIndex: 0,
      scale: 1,
      requires: { styles: ['bear', 'cat', 'moonkin'] },
    },
    {
      kind: 'statFromStat',
      from: 'defenseSkill',
      to: 'armor',
      valueIndex: 1,
      scale: 1,
      requires: { styles: ['bear', 'cat', 'moonkin'] },
    },
  ],"""
THICK_HIDE_AS_SHIPPED = "  thick_hide: [{ kind: 'itemArmorPercent' }],"

REVERT_FERAL = (EFFECTS, FERAL_SWIFTNESS_FIXED, FERAL_SWIFTNESS_AS_SHIPPED)
REVERT_THICK = (EFFECTS, THICK_HIDE_FIXED, THICK_HIDE_AS_SHIPPED)

# (label, [(file, find, replace), ...]) -- each list reverts those fixes.
VARIANTS = [
    ('both, as committed', []),
    ('without the Feral Swiftness index (dodge back to 30)', [REVERT_FERAL]),
    ('without the Thick Hide rule (back to 3% of item armor)', [REVERT_THICK]),
    ('NEITHER -- must reproduce the published 514.4', [REVERT_FERAL, REVERT_THICK]),
]


def apply(originals, reverts):
    """Write each file once, with every revert that targets it.

    COUNTS THE MATCHES AND REFUSES UNLESS THERE IS EXACTLY ONE. A one-shot
    `replace(find, replace, 1)` on a string that appears twice patches whichever
    comes first, which is how the Cat probe reverted an inert call site and
    measured the same build twice. Two variants agreeing to the decimal are a
    patch that did not apply, not a change worth nothing.

    Both reverts here touch ONE file, so they are applied together rather than
    in separate passes -- writing per revert would undo the previous one.
    """
    for path, text in originals.items():
        patched = text
        for target, find, replace in reverts:
            if target != path:
                continue
            found = patched.count(find)
            if found != 1:
                print(f'{found} matches in {path} for:\n{find[:200]}')
                return False
            patched = patched.replace(find, replace, 1)
        open(path, 'w', encoding='utf-8', newline='').write(patched)
    return True


def main() -> int:
    originals = {EFFECTS: open(EFFECTS, encoding='utf-8').read()}
    # The Cat is here as a CONTAINMENT check: it takes Feral Swiftness and no
    # Thick Hide, and nothing attacks it, so every variant must read 937.7.
    env = dict(os.environ, SEEDS='30', ITERATIONS='10', PROFILES='druid_bear,druid_cat')

    try:
        for label, reverts in VARIANTS:
            if not apply(originals, reverts):
                return 1

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

            # THE SECOND RUN IS WHY THE PREDICTION WAS CAUGHT. A DPS figure
            # inside the interval says "no difference" and not WHICH mechanism
            # failed to fire; armor, dodge, deaths, damage taken and rage side
            # by side say that armor moved and rage did not.
            survival = subprocess.run(
                ['npx.cmd', 'vite-node', 'tools/bear_survival.ts'],
                env=env, capture_output=True, text=True,
            )
            if survival.returncode != 0:
                print(survival.stdout[-2500:], survival.stderr[-2500:])
                return survival.returncode

            print(f'{label}')
            for figure in figures:
                print(f'    {figure}')
            print(f'    {survival.stdout.strip().splitlines()[-1]}')
            print(flush=True)
    finally:
        for path, text in originals.items():
            open(path, 'w', encoding='utf-8', newline='').write(text)
        print('sources restored', flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
