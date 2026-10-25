import { useMemo, useState } from 'react';
import type { BatchResult } from '../../simulator';
import type { RaidFrame } from './raidFrameSnapshots';
import { raidFrames } from './raidFrameSnapshots';

/**
 * RAID FRAMES (round 62): the raid's health every few seconds through the
 * representative fight, one column a party, for troubleshooting a raid healer.
 * A slider steps through the frames; "every frame" lays them all out in order
 * so they can be compared side by side. See `raidFrames` for what a frame is.
 */
export function RaidFrames({ batch }: { readonly batch: BatchResult }) {
  const [stepMs, setStepMs] = useState(2000);
  const [index, setIndex] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const fight = batch.representative;
  const frames = useMemo(
    () => raidFrames(fight.actors, fight.timeline, fight.durationMs, stepMs, batch.playerId),
    [fight, stepMs, batch.playerId],
  );
  if (frames.length === 0) return null;
  const at = Math.min(index, frames.length - 1);

  return (
    <div className="raid-frames">
      <h3>Raid frames</h3>
      <div className="raid-frames-controls">
        <label>
          every{' '}
          <select
            value={stepMs}
            aria-label="Seconds between frames"
            onChange={(event) => {
              setStepMs(Number(event.target.value));
              setIndex(0);
            }}
          >
            <option value={2000}>2s</option>
            <option value={3000}>3s</option>
          </select>
        </label>
        <button type="button" aria-label="Previous frame" disabled={at === 0} onClick={() => setIndex(at - 1)}>
          Prev
        </button>
        <input
          type="range"
          min={0}
          max={frames.length - 1}
          value={at}
          aria-label="Frame"
          onChange={(event) => setIndex(Number(event.target.value))}
        />
        <button
          type="button"
          aria-label="Next frame"
          disabled={at === frames.length - 1}
          onClick={() => setIndex(at + 1)}
        >
          Next
        </button>
        <label>
          <input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} /> every
          frame
        </label>
      </div>
      {showAll ? (
        <div className="raid-frames-all">
          {frames.map((frame) => (
            <Frame key={frame.timeMs} frame={frame} small />
          ))}
        </div>
      ) : (
        <Frame frame={frames[at]} />
      )}
    </div>
  );
}

function Frame({ frame, small = false }: { readonly frame: RaidFrame; readonly small?: boolean }) {
  const parties = [...new Set(frame.members.map((member) => member.party))];
  return (
    <figure className={small ? 'raid-frame raid-frame-small' : 'raid-frame'}>
      <figcaption>{(frame.timeMs / 1000).toFixed(0)}s</figcaption>
      <div className="raid-frame-grid" style={{ gridTemplateColumns: `repeat(${parties.length}, 1fr)` }}>
        {parties.map((party) => (
          <div key={party} className="raid-party">
            {frame.members
              .filter((member) => member.party === party)
              .map((member) => (
                <div
                  key={member.id}
                  className={member.died ? 'raid-cell raid-cell-died' : 'raid-cell'}
                  title={`${member.label}: ${Math.round(member.health * 100)}%${member.died ? ', died' : ''}${
                    member.auras.length > 0 ? ` -- ${member.auras.join(', ')}` : ''
                  }`}
                >
                  <div className="raid-fill" style={{ width: `${member.health * 100}%` }} />
                  <span className="raid-label">
                    {member.label}
                    {member.died ? <span className="raid-died"> (Died)</span> : null}
                  </span>
                  {!small && member.auras.length > 0 ? (
                    <span className="raid-auras">{member.auras.join(', ')}</span>
                  ) : null}
                </div>
              ))}
          </div>
        ))}
      </div>
    </figure>
  );
}
