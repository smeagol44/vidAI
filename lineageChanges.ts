import type {LineageRecord} from './simulation';

type Lineage = Map<string, LineageRecord>;
const subscribers = new WeakMap<Lineage, Set<Set<string>>>();

/** Transient transport subscriptions; headless worlds retain no change journal.
 * Seed once on subscribe, then retain only IDs changed since the last frame. */
export function watchLineage(lineage: Lineage) {
  const pending = new Set(lineage.keys());
  let listeners = subscribers.get(lineage);
  if (!listeners) {listeners = new Set(); subscribers.set(lineage, listeners);}
  listeners.add(pending);
  return {pending, dispose: () => {listeners.delete(pending);}};
}

/** Call after every authoritative birth/spawn, offspring-count or death edit. */
export function markLineageChanged(lineage: Lineage, id: string): void {
  for (const pending of subscribers.get(lineage) ?? []) pending.add(id);
}
