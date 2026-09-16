import { useState } from 'react';
import type { CharacterProfile } from '../../profiles';
import { createDefaultProfile, parseProfile, serializeProfile } from '../../profiles';
import { Panel } from '../components/Panel';

interface ProfilePanelProps {
  readonly profile: CharacterProfile;
  readonly onChange: (profile: CharacterProfile) => void;
}

/**
 * NOT CURRENTLY MOUNTED.
 *
 * Taken out of the interface, which now offers Import and Load buttons above
 * the character name instead. Kept because the round-trip wiring below —
 * `serializeProfile` out, `parseProfile` in, validation issues rendered — is
 * exactly what those buttons need, and rewriting it from scratch would be
 * worse than reading it.
 *
 * Import and export the current profile as JSON.
 *
 * Deliberately a plain text box rather than a file picker: it proves the
 * serialization round-trips, and it is the simplest thing that lets a profile
 * be shared. File and URL import are the same two functions with different
 * plumbing.
 */
export function ProfilePanel({ profile, onChange }: ProfilePanelProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [issues, setIssues] = useState<readonly string[]>([]);

  const text = draft ?? serializeProfile(profile);

  const handleImport = () => {
    const result = parseProfile(text);
    if (result.ok) {
      setIssues([]);
      setDraft(null);
      onChange(result.profile);
    } else {
      setIssues(
        result.issues.map((issue) => (issue.path ? `${issue.path}: ${issue.message}` : issue.message)),
      );
    }
  };

  return (
    <Panel
      title="Profile"
      subtitle={`Format version ${profile.version}`}
      actions={
        <>
          <button type="button" onClick={handleImport}>
            Import
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(null);
              setIssues([]);
              onChange(createDefaultProfile());
            }}
          >
            Reset
          </button>
        </>
      }
    >
      <textarea
        className="profile-json"
        spellCheck={false}
        value={text}
        onChange={(event) => setDraft(event.target.value)}
      />
      {issues.length > 0 ? (
        <ul className="issues">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}
