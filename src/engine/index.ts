/**
 * The simulation engine's public surface.
 *
 * The engine is plain TypeScript with no dependency on React, the DOM, or
 * anything else browser-specific. Anything that can run TypeScript can run it:
 * the web UI, the test suite, a future CLI, a Web Worker, or a server.
 *
 * Nothing outside `src/engine` should reach past this file into internal
 * modules. Import from here, or from a subsystem barrel such as
 * `engine/events`, and never from a deep path like
 * `engine/events/EventQueue`.
 */

export * from './time';
export * from './rng';
export * from './events';
export * from './stats';
export * from './resources';
export * from './effects';
export * from './abilities';
export * from './actors';
export * from './combat';
export {
  AUTO_ATTACK_NAMES,
  AUTO_ATTACK_RESOURCE_SOURCES,
  extraAttack,
  startAutoAttack,
  swingingSlots,
} from './combat/autoAttack';
export * from './rotation';
export * from './logging';
export * from './simulation';
