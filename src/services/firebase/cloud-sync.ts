import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import {
  browserLocalPersistence,
  GoogleAuthProvider,
  initializeAuth,
  browserPopupRedirectResolver,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

import { resolveFirebaseConfig } from './config';
import { FirestoreRemote } from './firestore-remote';

export interface CloudAccount {
  readonly uid: string;
  readonly email: string | null;
  readonly name: string | null;
}

interface Connection {
  readonly app: FirebaseApp;
  readonly auth: Auth;
  readonly db: Firestore;
}

let connection: Connection | null = null;
let config: FirebaseOptions | null = null;

/** Lazily connects; returns null when the build has no Firebase config (sync then stays off). */
function connect(): Connection | null {
  if (connection) return connection;
  if (!config) return null;
  const app = initializeApp(config);
  const auth = initializeAuth(app, { persistence: browserLocalPersistence, popupRedirectResolver: browserPopupRedirectResolver });
  connection = { app, auth, db: getFirestore(app) };
  return connection;
}

const SIGN_IN_ERRORS: Record<string, string> = {
  'auth/popup-blocked': 'Trình duyệt đã chặn cửa sổ đăng nhập. Hãy cho phép cửa sổ bật lên rồi thử lại.',
  'auth/popup-closed-by-user': 'Bạn đã đóng cửa sổ đăng nhập.',
  'auth/cancelled-popup-request': 'Bạn đã đóng cửa sổ đăng nhập.',
  'auth/network-request-failed': 'Không kết nối được tới Google. Hãy kiểm tra mạng rồi thử lại.',
  'auth/unauthorized-domain': 'Tên miền này chưa được phép đăng nhập. Cần thêm tên miền vào Firebase Authentication > Settings > Authorized domains.',
  'auth/internal-error': 'Không tải được dịch vụ đăng nhập của Google. Hãy kiểm tra mạng hoặc trình chặn quảng cáo rồi thử lại.',
};

function signInMessage(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : '';
  return SIGN_IN_ERRORS[code] ?? (error instanceof Error ? error.message : String(error));
}

const toAccount = (u: User): CloudAccount => ({ uid: u.uid, email: u.email, name: u.displayName });

export const cloud = {
  /** Resolves the project config once; sync is unavailable when there is none. */
  async init(): Promise<boolean> {
    config = await resolveFirebaseConfig();
    return config !== null;
  },

  available: (): boolean => config !== null,

  /** Calls back with the signed-in account (or null) now and on every change. */
  watchAccount(listener: (account: CloudAccount | null) => void): () => void {
    const c = connect();
    if (!c) {
      listener(null);
      return () => {};
    }
    return onAuthStateChanged(c.auth, (u) => listener(u ? toAccount(u) : null));
  },

  async signInWithGoogle(): Promise<CloudAccount> {
    const c = connect();
    if (!c) throw new Error('Bản build này chưa được cấu hình Firebase.');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(c.auth, provider);
      return toAccount(result.user);
    } catch (error) {
      throw new Error(signInMessage(error));
    }
  },

  async signOut(): Promise<void> {
    const c = connect();
    if (c) await signOut(c.auth);
  },

  remote(uid: string, schemaVersion: number): FirestoreRemote {
    const c = connect();
    if (!c) throw new Error('Bản build này chưa được cấu hình Firebase.');
    return new FirestoreRemote(c.db, uid, schemaVersion);
  },
};
