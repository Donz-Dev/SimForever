import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Anchor {
  readonly x: number;
  readonly y: number;
}

/**
 * Something that shows a card while the pointer is on it.
 *
 * ==============================================================================
 * THE CARD IS PORTALLED AND POSITIONED `fixed`, which is the only arrangement
 * that works here. An absolutely positioned child is clipped by the first
 * scrolling ancestor, and every gear row lives inside a panel body that
 * scrolls -- so an item card rendered in place would be cut in half by the
 * panel it is in, which is exactly where a tooltip is least useful.
 *
 * IT IS ONLY MOUNTED WHILE HOVERED, and that is what keeps the static test
 * renders working: `react-dom/server` cannot render a portal at all, and a
 * component that portalled unconditionally would throw the moment
 * `renderToStaticMarkup` touched the panel.
 *
 * ------------------------------------------------------------------------------
 * FOCUS COUNTS AS HOVER. Every row in this panel is a button, so a keyboard
 * user tabbing through a slot list gets the same card a mouse user gets. It
 * costs two handlers and it is the difference between the card being a
 * feature and being a mouse trick.
 * ------------------------------------------------------------------------------
 */
export function HoverCard({
  card,
  children,
  className,
}: {
  /** Built lazily, so a list of 200 rows does not build 200 cards. */
  readonly card: () => ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  const [anchor, setAnchor] = useState<Anchor | undefined>(undefined);
  const host = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => {
    const box = host.current?.getBoundingClientRect();
    if (box) setAnchor({ x: box.right + 10, y: box.top });
  }, []);
  const hide = useCallback(() => setAnchor(undefined), []);

  return (
    <span
      ref={host}
      className={className}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {anchor && typeof document !== 'undefined'
        ? createPortal(<PositionedCard anchor={anchor}>{card()}</PositionedCard>, document.body)
        : null}
    </span>
  );
}

/**
 * The card, nudged back on screen.
 *
 * MEASURED AFTER MOUNTING rather than guessed from a width constant: the card
 * is as tall as the item has lines, and a 30-line set piece near the bottom of
 * the window would otherwise hang off it. The first paint is at the anchor and
 * the correction lands immediately after, which is invisible -- and it degrades
 * to "slightly off screen" rather than to "nothing" if the measurement fails.
 */
function PositionedCard({ anchor, children }: { readonly anchor: Anchor; readonly children: ReactNode }) {
  const [box, setBox] = useState<{ width: number; height: number } | undefined>(undefined);
  const measure = useCallback((node: HTMLDivElement | null) => {
    if (node) setBox({ width: node.offsetWidth, height: node.offsetHeight });
  }, []);

  const margin = 8;
  let left = anchor.x;
  let top = anchor.y;
  if (box) {
    if (left + box.width + margin > window.innerWidth) {
      left = Math.max(margin, window.innerWidth - box.width - margin);
    }
    if (top + box.height + margin > window.innerHeight) {
      top = Math.max(margin, window.innerHeight - box.height - margin);
    }
  }

  return (
    <div ref={measure} className="hover-card" style={{ left, top }} role="tooltip">
      {children}
    </div>
  );
}
