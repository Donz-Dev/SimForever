import { useState } from 'react';
import type { ReactNode } from 'react';

interface PanelProps {
  readonly title: string;
  readonly subtitle?: string;
  /**
   * Rendered inline beside the title, for something that identifies the panel
   * at a glance while it is SHUT -- the Talents panel's "38/13/0".
   *
   * It earns its place because a collapsed panel is a title and nothing else,
   * and a column of five identical shut panels is worse than the long scroll it
   * replaced. A badge is what makes one of them worth opening.
   */
  readonly badge?: ReactNode;
  readonly actions?: ReactNode;
  /**
   * Give the panel a toggle, and START IT SHUT.
   *
   * Collapsed by default is the owner's call and it applies to every panel that
   * takes this. The app opens on a character and a Run button, and everything
   * that configures the run is one click away rather than one scroll.
   *
   * THE STATE LIVES HERE AND NOT IN `App`. It used to live there for the
   * Talents panel alone, which meant `applyPreset` had to remember to shut it
   * -- a panel whose default was "open" and which was forced shut by whichever
   * caller thought of it. Five panels doing that would be five chances to
   * forget.
   */
  readonly collapsible?: boolean;
  /**
   * Start a collapsible panel OPEN.
   *
   * The default is shut, and that is the owner's call for every panel that
   * CONFIGURES a run: the app opens on a character and a Run button, and the
   * settings are one click away rather than one scroll. A RESULTS panel is the
   * other kind -- it appears because a run just finished, so shutting it by
   * default would hide the thing the run was for and leave a bare title bar in
   * its place. It still gets the toggle, which is what was asked for.
   */
  readonly startOpen?: boolean;
  readonly className?: string;
  readonly bodyClassName?: string;
  readonly children: ReactNode;
}

/** A titled section. Every panel in the app is one of these. */
export function Panel({
  title,
  subtitle,
  badge,
  actions,
  collapsible = false,
  startOpen = false,
  className,
  bodyClassName,
  children,
}: PanelProps) {
  const [collapsed, setCollapsed] = useState(!startOpen);
  // Only a collapsible panel can be shut. Read through a constant rather than
  // trusting the state, so a panel that stops being collapsible cannot keep a
  // stale `true` and render as an empty title bar.
  const shut = collapsible && collapsed;

  return (
    <section className={className ? `panel ${className}` : 'panel'}>
      <header className="panel-header">
        <div className="panel-heading">
          <h2>{title}</h2>
          {badge ? <span className="panel-badge">{badge}</span> : null}
          {subtitle ? <p className="panel-subtitle">{subtitle}</p> : null}
        </div>
        {actions || collapsible ? (
          <div className="panel-actions">
            {actions}
            {collapsible ? (
              <button
                type="button"
                className="panel-toggle"
                onClick={() => setCollapsed((was) => !was)}
                aria-expanded={!collapsed}
                title={collapsed ? `Expand ${title.toLowerCase()}` : `Collapse ${title.toLowerCase()}`}
              >
                {collapsed ? '▢' : '▁'}
              </button>
            ) : null}
          </div>
        ) : null}
      </header>
      {shut ? null : (
        <div className={bodyClassName ? `panel-body ${bodyClassName}` : 'panel-body'}>
          {children}
        </div>
      )}
    </section>
  );
}
