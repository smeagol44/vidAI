import {useCallback, useEffect, useState} from 'react';

/** One wall-clock lifetime per notification, including repeated identical text.
 * Replacing a message cancels its predecessor's timer; unmount cancels the last.
 * Simulation pause/speed never affects notification expiry. */
export function useNotification(lifetimeMs = 2500): [string | null, (message: string) => void] {
  const [notice, setNotice] = useState<{message: string} | null>(null);
  const show = useCallback((message: string) => setNotice({message}), []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(current => current === notice ? null : current), lifetimeMs);
    return () => window.clearTimeout(timer);
  }, [notice, lifetimeMs]);
  return [notice?.message ?? null, show];
}
