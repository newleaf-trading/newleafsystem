// Thin analytics wrapper for the Instinct Quiz. Uses Firebase Analytics when
// available (browser only), and is a safe no-op during SSR/prerender. Events let
// us find items that lose people (view vs. abandon per item).
import { app } from '@app-firebase/config';

let _analytics; // undefined = not tried, null = unavailable
async function getAnalyticsInstance() {
  if (typeof window === 'undefined') return null;
  if (_analytics !== undefined) return _analytics;
  try {
    const { getAnalytics, isSupported } = await import('firebase/analytics');
    _analytics = (await isSupported()) ? getAnalytics(app) : null;
  } catch {
    _analytics = null;
  }
  return _analytics;
}

export async function track(event, params = {}) {
  try {
    const a = await getAnalyticsInstance();
    if (a) {
      const { logEvent } = await import('firebase/analytics');
      logEvent(a, event, params);
    }
    if (import.meta.env && import.meta.env.DEV) console.debug('[track]', event, params);
  } catch {
    /* analytics must never break the quiz */
  }
}
