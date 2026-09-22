import { describe, expect, it } from "vitest";
import { createTrainingDummy } from "../../src/game/actors/createTrainingDummy";
import { createPlayer } from "../../src/game/actors/createPlayer";
import { startingEquipmentFor } from "../../src/game/items/startingSets";
import { warriorRotation } from "../../src/game/rotations/warrior";
import { runProfileBatch } from "../../src/simulator";
import {
  createDefaultProfile,
  loadProfile,
  CURRENT_PROFILE_VERSION,
} from "../../src/profiles";
import {
  PLACEHOLDER_BOSS_SWING_DAMAGE,
  PLACEHOLDER_BOSS_SWING_SECONDS,
} from "../../src/game/encounters/raidBoss";

const geared = (style: "dual_wield" | "one_hand_shield", talents = {}) => ({
  ...createDefaultProfile(),
  character: { ...createDefaultProfile().character, combatStyle: style },
  equipment: startingEquipmentFor("warrior", style),
  talents,
});

const fight = (
  profile: ReturnType<typeof geared>,
  attacks: boolean,
  seed = 3,
) =>
  runProfileBatch({
    ...profile,
    encounter: { ...profile.encounter, targetAttacks: attacks },
    simulation: { ...profile.simulation, seed, iterations: 1 },
  });

describe("a target that stands still", () => {
  it("has no weapon and swings at nothing", () => {
    const dummy = createTrainingDummy();
    expect(dummy.weapons.mainHand).toBeUndefined();
    expect(dummy.autoAttack).toBe("none");
  });

  it("is the default, because a damage warrior is not the one being hit", () => {
    expect(createDefaultProfile().encounter.targetAttacks).toBe(false);
  });

  it("leaves the player untouched", () => {
    const log = fight(geared("dual_wield"), false).representative.combatLog;
    expect(
      log.some((line) => /Training Dummy Main Hand Auto-Attack/.test(line)),
    ).toBe(false);
  });
});

describe("a target that swings back", () => {
  it("is armed with the placeholder boss melee", () => {
    const dummy = createTrainingDummy({ attacks: true });
    expect(dummy.autoAttack).toBe("main-hand");
    expect(dummy.weapons.mainHand?.baseDamage).toBe(
      PLACEHOLDER_BOSS_SWING_DAMAGE,
    );
    expect(dummy.weapons.mainHand?.swingTimerMs).toBe(
      PLACEHOLDER_BOSS_SWING_SECONDS * 1000,
    );
    // No attack power term: the damage figure IS the whole swing.
    expect(dummy.weapons.mainHand?.powerCoefficient).toBe(0);
  });

  it("actually hits the player", () => {
    const log = fight(geared("dual_wield"), true).representative.combatLog;
    expect(
      log.some((line) => /Training Dummy Main Hand Auto-Attack/.test(line)),
    ).toBe(true);
  });

  it("resolves against the attacks-received table, not the melee one", () => {
    /*
     * The received table is the one with CRUSHING BLOWS, which no table the
     * player attacks with can produce. Finding one proves the right table ran.
     */
    const log = fight(geared("dual_wield"), true, 3).representative.combatLog;
    const incoming = log.filter((line) =>
      /Training Dummy Main Hand Auto-Attack/.test(line),
    );
    expect(incoming.some((line) => /crushing/.test(line))).toBe(true);
  });

  it("kills the player without ending the fight", () => {
    /*
     * A geared warrior has under 4,000 health and the target opens at 5,000 a
     * swing and ramps from there, so it kills them -- repeatedly. The fight
     * still runs its full length, because the character is stood back up every
     * time rather than being made immortal.
     *
     * This used to assert the opposite. `survivesLethalDamage` held health at
     * one and nothing could ever die, which kept the fight running at the
     * price of making "did that kill them" unanswerable.
     */
    const run = fight(geared("dual_wield"), true).representative;
    expect(run.endReason).toBe("duration_expired");
    expect(run.timeline.some((event) => event.type === "death")).toBe(true);
  });

  it("reports overkill, now that there is something to overkill", () => {
    /*
     * The other half of dropping the immunity. An immortal character had no
     * overkill by definition -- the engine suppressed it, because reporting
     * "3,765 overkill" against somebody still standing is nonsense. A
     * character who genuinely died has a real number there.
     */
    const log = fight(geared("dual_wield"), true).representative.combatLog;
    expect(log.some((line) => /overkill/.test(line))).toBe(true);
  });
});

describe("what being attacked brings to life", () => {
  it("lets a shield warrior BLOCK, and says so in the log", () => {
    const log = fight(
      geared("one_hand_shield", { shield_slam: 1, deflection: 5 }),
      true,
    ).representative.combatLog;
    // A block LANDS, so it reads as a hit with a qualifier.
    expect(
      log.some((line) =>
        /Training Dummy Main Hand Auto-Attack hits .* \(blocked\)/.test(line),
      ),
    ).toBe(true);
  });

  it("opens the Revenge window, and the rotation uses it", () => {
    const log = fight(
      geared("one_hand_shield", { shield_slam: 1, deflection: 5 }),
      true,
    ).representative.combatLog;
    expect(log.some((line) => /casts Revenge/.test(line))).toBe(true);
  });

  it("never casts Revenge when nothing is attacking", () => {
    // Its window cannot open, and `canCast` refuses rather than the rotation
    // needing to know why.
    const log = fight(geared("one_hand_shield", { shield_slam: 1 }), false)
      .representative.combatLog;
    expect(log.some((line) => /casts Revenge/.test(line))).toBe(false);
  });

  it("puts Revenge in the list for every melee style", () => {
    for (const style of [
      "dual_wield",
      "two_hander",
      "one_hand_shield",
    ] as const) {
      const rotation = warriorRotation(style) as unknown as {
        entries: readonly { abilityId: string }[];
      };
      expect(rotation.entries.map((entry) => entry.abilityId)).toContain(
        "revenge",
      );
    }
  });

  it("generates rage from damage taken", () => {
    const still = fight(geared("dual_wield"), false).dps.mean;
    const hit = fight(geared("dual_wield"), true).dps.mean;
    /*
     * Rage from damage taken is real and large. This is exactly why the default
     * is OFF: a dual-wielding damage warrior is not the one the boss is hitting,
     * and handing them this rage would flatter every number they produce.
     */
    expect(hit).toBeGreaterThan(still);
  });
});

describe("profile version 6", () => {
  it("migrates a version 5 profile to a target that stands still", () => {
    const v5 = { ...createDefaultProfile(), version: 5 } as unknown as Record<
      string,
      unknown
    >;
    const encounter = { ...(v5.encounter as Record<string, unknown>) };
    delete encounter.targetAttacks;
    delete encounter.targetSwingDamage;
    delete encounter.targetSwingSeconds;
    v5.encounter = encounter;

    const result = loadProfile(v5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.version).toBe(CURRENT_PROFILE_VERSION);
    /*
     * False, deliberately. A migration that silently started hitting every
     * saved character would move every number they had already recorded.
     */
    expect(result.profile.encounter.targetAttacks).toBe(false);
  });
});

describe("the assumed healer", () => {
  it("is only assumed when something is attacking", () => {
    const still = createPlayer({ race: "human", characterClass: "warrior" });
    expect(still.revivesOnDeath).toBe(false);
    expect(still.openingAuras.map((aura) => aura.id)).not.toContain("external_healer");

    const hit = createPlayer({
      race: "human",
      characterClass: "warrior",
      revivesOnDeath: true,
      externalHealing: true,
    });
    expect(hit.revivesOnDeath).toBe(true);
    expect(hit.openingAuras.map((aura) => aura.id)).toContain("external_healer");
  });

  it("no longer makes the character immortal", () => {
    /*
     * It used to. `survivesLethalDamage` stopped health at one and made a
     * death impossible, so "how close was that" had no answer at all. The
     * character now dies and is stood back up, and the deaths are counted.
     */
    const hit = createPlayer({
      race: "human",
      characterClass: "warrior",
      revivesOnDeath: true,
      externalHealing: true,
    });
    expect(hit.survivesLethalDamage).toBe(false);
  });
});
