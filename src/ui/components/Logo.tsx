/**
 * The SimForever wordmark.
 *
 * Drawn in the visual language of the World of Warcraft: Forever logo the
 * project is built around — an ornate gold medallion over a teal disc, a
 * beveled gold upper word, a brighter silver lower word — but it is ORIGINAL
 * ARTWORK for this project, not a copy of that logo or of any Blizzard mark.
 * Nothing here traces their lettering or their emblem.
 *
 * EVERY COLOUR IS A TOKEN, so the wordmark belongs to whichever scheme is
 * showing: gold over teal in Midnight, bronze over ember in Graphite, copper
 * over deep teal in Abyssal, platinum over violet in Obsidian. A logo that
 * stayed gold on a violet page would be the one thing on screen that had not
 * been designed.
 *
 * Inline SVG rather than an image file so it inherits the page's colours,
 * stays sharp at any size, and costs no extra request. It is decorative: the
 * accessible name comes from the `title` element, and the tagline beside it is
 * real text.
 */
export function Logo() {
  return (
    <svg
      className="logo"
      viewBox="0 0 420 132"
      role="img"
      aria-labelledby="logo-title"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title id="logo-title">SimForever</title>

      <defs>
        {/* Gold, lit from above: highlight at the top, deep amber in the body. */}
        <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--logo-metal-1)" />
          <stop offset="38%" stopColor="var(--logo-metal-2)" />
          <stop offset="62%" stopColor="var(--logo-metal-3)" />
          <stop offset="100%" stopColor="var(--logo-metal-4)" />
        </linearGradient>

        {/* Silver for the lower word, so the two read as different metals. */}
        <linearGradient id="silver" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--logo-second-1)" />
          <stop offset="45%" stopColor="var(--logo-second-2)" />
          <stop offset="70%" stopColor="var(--logo-second-3)" />
          <stop offset="100%" stopColor="var(--logo-second-4)" />
        </linearGradient>

        {/* The disc behind the medallion. */}
        <radialGradient id="disc" cx="50%" cy="42%" r="62%">
          <stop offset="0%" stopColor="var(--logo-disc-1)" />
          <stop offset="55%" stopColor="var(--logo-disc-2)" />
          <stop offset="100%" stopColor="var(--logo-disc-3)" />
        </radialGradient>

        <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--logo-rim-1)" />
          <stop offset="50%" stopColor="var(--logo-rim-2)" />
          <stop offset="100%" stopColor="var(--logo-rim-3)" />
        </linearGradient>

        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* --- medallion ------------------------------------------------- */}
      <g transform="translate(66 66)">
        {/* Outer octagon, the ornate frame. */}
        <path
          d="M0 -58 L41 -41 L58 0 L41 41 L0 58 L-41 41 L-58 0 L-41 -41 Z"
          fill="url(#rim)"
          stroke="var(--logo-metal-edge)"
          strokeWidth="1.5"
        />
        {/* Inset shoulder, which is what makes the frame read as forged metal
            rather than as a flat outline. */}
        <path
          d="M0 -48 L34 -34 L48 0 L34 34 L0 48 L-34 34 L-48 0 L-34 -34 Z"
          fill="var(--logo-inset)"
          stroke="var(--logo-metal-edge)"
          strokeWidth="1"
        />
        <circle cx="0" cy="0" r="39" fill="url(#disc)" />
        <circle cx="0" cy="0" r="39" fill="none" stroke="url(#rim)" strokeWidth="3" />

        {/* Points at the compass corners, echoing the source's spikes. */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <path
            key={angle}
            d="M0 -58 L6 -50 L0 -44 L-6 -50 Z"
            fill="url(#gold)"
            transform={`rotate(${angle})`}
          />
        ))}

        {/* A stylised blade over the disc: this is a combat simulator, and the
            emblem should say so in one glance. */}
        <g fill="url(#gold)" stroke="var(--logo-metal-edge)" strokeWidth="0.8">
          <path d="M0 -30 L5 -16 L5 14 L-5 14 L-5 -16 Z" />
          <path d="M-15 14 L15 14 L13 20 L-13 20 Z" />
          <path d="M-3 20 L3 20 L3 30 L0 33 L-3 30 Z" />
        </g>
      </g>

      {/* --- wordmark --------------------------------------------------- */}
      <g filter="url(#glow)">
        {/* Both words share a centre line, so the short one sits over the
            middle of the long one rather than hanging off its left edge.
            `text-anchor` does that without hard-coding either width, which
            would drift the moment the font fell back to a different serif. */}
        <text
          x="274"
          y="56"
          textAnchor="middle"
          className="logo-sim"
          fill="url(#gold)"
          stroke="var(--logo-metal-edge)"
          strokeWidth="0.6"
        >
          SIM
        </text>
        <text
          x="274"
          y="108"
          textAnchor="middle"
          className="logo-forever"
          fill="url(#silver)"
          stroke="var(--logo-second-edge)"
          strokeWidth="0.6"
        >
          FOREVER
        </text>
      </g>

      {/* No flourish under the lower word. There was a hooked rule there,
          echoing the source mark, and at the size the wordmark actually
          renders it sat close enough to FOREVER's baseline to read as an
          underline through the descenders rather than as an ornament. */}
    </svg>
  );
}
