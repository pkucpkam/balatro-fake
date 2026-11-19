import { initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

/**
 * Firebase bootstrap. Config comes from VITE_FIREBASE_* (see .env.example).
 * Without config the game runs in local-only mode: `firebase` is null and every
 * cloud call is skipped.
 */

const env = import.meta.env;

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

/** VITE_FIREBASE_EMULATOR=1 → use `firebase emulators:start` (auth :9099, firestore :8080). */
const useEmulator = env.VITE_FIREBASE_EMULATOR === "1";

export const cloudConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

export interface FirebaseHandles {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

function init(): FirebaseHandles | null {
  if (!cloudConfigured) return null;
  try {
    const app = initializeApp(config);
    // Persistent cache: writes made offline (or on pagehide) are queued in IndexedDB
    // and sent the next time the game is opened.
    const db = initializeFirestore(app, {
      localCache: useEmulator ? memoryLocalCache() : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
    const auth = getAuth(app);
    if (useEmulator) {
      connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
      connectFirestoreEmulator(db, "127.0.0.1", 8080);
    }
    return { app, auth, db };
  } catch (err) {
    console.warn("[cloud] Firebase init failed, running local-only", err);
    return null;
  }
}

export const firebase = init();
