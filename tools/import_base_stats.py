#!/usr/bin/env python3
"""Generate src/game/character/baseStats.ts from the base stats spreadsheet.

The spreadsheet is the source of truth. Transcribing 65 rows of eleven numbers
by hand would introduce errors that look exactly like real data, so the
TypeScript is generated instead and the generator is committed alongside it.

Usage:
    pip install openpyxl
    python tools/import_base_stats.py path/to/WoWForeverBaseStats.xlsx

Sheet layout: a block per race, each starting with a header row whose second
column is "Hit Points", followed by one row per class. Druid rows are labelled
"Druid (Caster Form)" and so on.
"""

from __future__ import annotations

import sys
from pathlib import Path

import openpyxl

# Spreadsheet display name -> the id used in the codebase.
RACE_IDS = {
    "Human": "human",
    "Dwarf": "dwarf",
    "Night Elf": "night_elf",
    "Gnome": "gnome",
    "High Order Skyborne": "high_order_skyborne",
    "Orc": "orc",
    "Undead": "undead",
    "Tauren": "tauren",
    "Troll": "troll",
    "Windshaper Skyborne": "windshaper_skyborne",
}

CLASS_IDS = {
    "Druid": "druid",
    "Hunter": "hunter",
    "Mage": "mage",
    "Paladin": "paladin",
    "Priest": "priest",
    "Rogue": "rogue",
    "Shaman": "shaman",
    "Warlock": "warlock",
    "Warrior": "warrior",
}

FORM_IDS = {
    "Caster Form": "caster",
    "Moonkin Form": "moonkin",
    "Bear Form": "bear",
    "Cat Form": "cat",
}

# Column order after the label column.
FIELDS = [
    "hitPoints",
    "mana",
    "strength",
    "agility",
    "stamina",
    "intellect",
    "spirit",
    "attackPower",
    "rangedAttackPower",
    "critChance",
    "spellCritChance",
]

# Percentages in the sheet carry floating point noise (1.1399999999999997).
DECIMALS = {"critChance": 2, "spellCritChance": 2}


def parse_label(label: str) -> tuple[str, str | None]:
    """'Druid (Bear Form)' -> ('druid', 'bear'); 'Mage' -> ('mage', None)."""
    label = label.strip()
    if "(" not in label:
        return CLASS_IDS[label], None
    name, _, rest = label.partition("(")
    form = rest.rstrip(")").strip()
    return CLASS_IDS[name.strip()], FORM_IDS[form]


def read(path: Path):
    sheet = openpyxl.load_workbook(path, data_only=True)["Sheet1"]
    data: dict[str, dict[str, list]] = {}
    race = None

    for row in sheet.iter_rows(values_only=True):
        if row[0] is None:
            continue
        label = str(row[0]).strip()

        # A header row marks the start of a race block.
        if row[1] is not None and str(row[1]).strip() == "Hit Points":
            if label not in RACE_IDS:
                raise SystemExit(f"Unknown race in spreadsheet: {label!r}")
            race = RACE_IDS[label]
            data.setdefault(race, {})
            continue

        if race is None or row[1] is None:
            continue

        class_id, form = parse_label(label)
        stats = {}
        for index, field in enumerate(FIELDS):
            value = row[index + 1]
            value = 0 if value is None else value
            stats[field] = round(float(value), DECIMALS[field]) if field in DECIMALS else int(value)
        data[race].setdefault(class_id, []).append((form, stats))

    return data


def number(value) -> str:
    return str(int(value)) if float(value).is_integer() else str(value)


def emit(data) -> str:
    lines = [
        "/*",
        " * GENERATED FILE - do not edit by hand.",
        " *",
        " * Produced by tools/import_base_stats.py from WoWForeverBaseStats.xlsx.",
        " * Re-run the generator when the spreadsheet changes; editing this file",
        " * directly guarantees it drifts from the source of truth.",
        " */",
        "",
        "import type { BaseStatVariant } from './baseStatTypes';",
        "import type { ClassId, RaceId } from './ids';",
        "",
        "export const BASE_STATS: Record<RaceId, Partial<Record<ClassId, readonly BaseStatVariant[]>>> = {",
    ]

    for race, classes in data.items():
        lines.append(f"  {race}: {{")
        for class_id, variants in classes.items():
            lines.append(f"    {class_id}: [")
            for form, stats in variants:
                form_literal = f"'{form}'" if form else "null"
                body = ", ".join(f"{k}: {number(v)}" for k, v in stats.items())
                lines.append(f"      {{ form: {form_literal}, stats: {{ {body} }} }},")
            lines.append("    ],")
        lines.append("  },")

    lines.append("};")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)

    data = read(Path(sys.argv[1]))

    total = sum(len(v) for classes in data.values() for v in classes.values())
    print(f"races: {len(data)}  entries: {total}")

    out = Path(__file__).resolve().parent.parent / "src/game/character/baseStats.ts"
    out.write_text(emit(data), encoding="utf-8")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
