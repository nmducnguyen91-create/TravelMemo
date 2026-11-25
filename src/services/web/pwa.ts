/** Registers the offline service worker (HTTPS or localhost only; browsers ignore it elsewhere). */
export function registerServiceWorker(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !window.isSecureContext) return;
  if (process.env.NODE_ENV !== 'production') return;
  const base = process.env.EXPO_BASE_URL ?? '';
  void navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch(() => {});
}
