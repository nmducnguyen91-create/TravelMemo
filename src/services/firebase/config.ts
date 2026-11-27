import type { FirebaseOptions } from 'firebase/app';

/**
 * Firebase web config, inlined at build time from EXPO_PUBLIC_FIREBASE_* (see .env.example).
 * These values identify the project; they are not secrets — access is enforced by firestore.rules.
 * Each variable must be read literally so Expo can inline it.
 */
export function firebaseConfig(): FirebaseOptions | null {
  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.EXPO_PUBLIC_FIREBASE_APP_ID;
  if (!apiKey || !projectId || !appId) return null;
  return {
    apiKey,
    projectId,
    appId,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? `${projectId}.firebaseapp.com`,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? `${projectId}.firebasestorage.app`,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  };
}

let resolved: Promise<FirebaseOptions | null> | null = null;

/**
 * Build-time config if present; otherwise, when served from Firebase Hosting, the project's own reserved
 * same-origin URL /__/firebase/init.json (so no key has to live in the repository or CI settings).
 */
export function resolveFirebaseConfig(): Promise<FirebaseOptions | null> {
  resolved ??= (async () => {
    const built = firebaseConfig();
    if (built) return built;
    if (typeof fetch === 'undefined' || typeof location === 'undefined') return null;
    try {
      const res = await fetch('/__/firebase/init.json', { cache: 'no-store' });
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return null;
      const json = (await res.json()) as Partial<FirebaseOptions>;
      if (!json.apiKey || !json.projectId || !json.appId) return null;
      return {
        apiKey: json.apiKey,
        projectId: json.projectId,
        appId: json.appId,
        // Same-origin auth handler (Hosting serves /__/auth/*): keeps popup sign-in working on Safari/iPhone.
        authDomain: location.host,
        storageBucket: json.storageBucket ?? `${json.projectId}.firebasestorage.app`,
        messagingSenderId: json.messagingSenderId ?? '',
      };
    } catch {
      return null;
    }
  })();
  return resolved;
}
