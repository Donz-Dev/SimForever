import type { CharacterProfile } from './CharacterProfile';
import { migrateProfile } from './migrateProfile';
import type { ValidationIssue } from './validateProfile';
import { validateProfile } from './validateProfile';

export type ProfileLoadResult =
  | { readonly ok: true; readonly profile: CharacterProfile; readonly migrated: boolean }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

/**
 * Serialise a profile to JSON text.
 *
 * Indented, because profiles are meant to be readable, diffable and editable by
 * hand. This is what save, export and copy-to-clipboard all produce.
 */
export function serializeProfile(profile: CharacterProfile): string {
  return JSON.stringify(profile, null, 2);
}

/**
 * Load a profile from JSON text: parse, migrate, then validate.
 *
 * That order matters. An old file is not valid against the current schema until
 * it has been migrated, so validating first would reject files that are
 * perfectly loadable.
 */
export function parseProfile(json: string): ProfileLoadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, issues: [{ path: '', message: `Not valid JSON: ${message}` }] };
  }

  return loadProfile(parsed);
}

/** Migrate and validate an already-parsed value. */
export function loadProfile(value: unknown): ProfileLoadResult {
  const migration = migrateProfile(value);
  if (!migration.ok) {
    return { ok: false, issues: [{ path: 'version', message: migration.message }] };
  }

  const validation = validateProfile(migration.value);
  if (!validation.ok) {
    return { ok: false, issues: validation.issues };
  }

  return { ok: true, profile: validation.profile, migrated: migration.migrated };
}
