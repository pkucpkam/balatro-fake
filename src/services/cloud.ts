import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { collection, deleteDoc, doc, getDoc, increment, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import type { Settings } from "@/features/game/gameStore";
import { firebase } from "./firebase";
import { EMPTY_STATS, parseRunSave, type PlayerStats, type RunSave, type RunSummary } from "./saveFormat";

/**
 * Firestore layout (rules in firestore.rules):
 *   users/{uid}                    profile: displayName, settings, stats, timestamps
 *   users/{uid}/meta/activeRun     the run in progress (RunSave)
 *   users/{uid}/runs/{runId}       finished runs (RunSummary + action log)
 *
 * Sign-in: email/password or Google. While signed out the game is local-only.
 * Every function is a no-op when Firebase is not configured.
 */

export interface CloudAccount {
  uid: string;
  displayName: string | null;
  email: string | null;
}

export interface CloudProfile {
  settings: Partial<Settings> | null;
  stats: PlayerStats;
  activeRun: RunSave | null;
}

const userRef = (uid: string) => doc(firebase!.db, "users", uid);
const activeRunRef = (uid: string) => doc(firebase!.db, "users", uid, "meta", "activeRun");

function toAccount(u: User): CloudAccount {
  return { uid: u.uid, displayName: u.displayName, email: u.email };
}

/** Calls `cb` with the signed-in account, or null while signed out. */
export function watchAccount(cb: (account: CloudAccount | null) => void): () => void {
  if (!firebase) return () => {};
  return onAuthStateChanged(firebase.auth, (u) => cb(u ? toAccount(u) : null));
}

export async function loadProfile(account: CloudAccount): Promise<CloudProfile> {
  const { uid } = account;
  const [profile, run] = await Promise.all([getDoc(userRef(uid)), getDoc(activeRunRef(uid))]);
  const data = profile.data();
  const stats = { ...EMPTY_STATS, ...((data?.stats as Partial<PlayerStats> | undefined) ?? {}) };
  if (!profile.exists()) {
    await setDoc(
      userRef(uid),
      { displayName: account.displayName, createdAt: serverTimestamp(), lastSeenAt: serverTimestamp(), stats },
      { merge: true },
    );
  } else {
    void setDoc(userRef(uid), { displayName: account.displayName, lastSeenAt: serverTimestamp() }, { merge: true });
  }
  return {
    settings: (data?.settings as Partial<Settings> | undefined) ?? null,
    stats,
    activeRun: parseRunSave(run.data()),
  };
}

export async function saveSettings(uid: string, settings: Settings): Promise<void> {
  await setDoc(userRef(uid), { settings }, { merge: true });
}

export async function saveActiveRun(uid: string, run: RunSave): Promise<void> {
  await setDoc(activeRunRef(uid), run);
}

export async function clearActiveRun(uid: string): Promise<void> {
  await deleteDoc(activeRunRef(uid));
}

/**
 * Stores a finished run and updates the totals in one batch.
 * Counters use increment() so two devices cannot overwrite each other; the
 * best-of fields are only written when `knownStats` came from the server.
 */
export async function recordFinishedRun(
  uid: string,
  summary: RunSummary,
  actions: unknown[],
  knownStats: PlayerStats | null,
): Promise<void> {
  const batch = writeBatch(firebase!.db);
  batch.set(doc(collection(firebase!.db, "users", uid, "runs")), { ...summary, actions, createdAt: serverTimestamp() });
  const stats: Record<string, unknown> = {
    runsPlayed: increment(1),
    runsWon: increment(summary.result === "WIN" ? 1 : 0),
    handsPlayed: increment(summary.handsPlayed),
  };
  if (knownStats) {
    stats.bestHandScore = Math.max(knownStats.bestHandScore, summary.bestHandScore);
    stats.highestAnte = Math.max(knownStats.highestAnte, summary.ante);
  }
  batch.set(userRef(uid), { stats }, { merge: true });
  batch.delete(activeRunRef(uid));
  await batch.commit();
}

function auth() {
  if (!firebase) throw new Error("Cloud save is not configured");
  return firebase.auth;
}

export async function signInGoogle(): Promise<void> {
  await signInWithPopup(auth(), new GoogleAuthProvider());
}

export async function signInEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth(), email.trim(), password);
}

export async function signUpEmail(email: string, password: string, displayName: string): Promise<CloudAccount> {
  const cred = await createUserWithEmailAndPassword(auth(), email.trim(), password);
  const name = displayName.trim();
  if (name) await updateProfile(cred.user, { displayName: name });
  return toAccount(cred.user);
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth(), email.trim());
}

export async function signOutCloud(): Promise<void> {
  if (firebase) await signOut(firebase.auth);
}

export function describeCloudError(err: unknown): string {
  const code = (err as { code?: string }).code ?? "";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "Sign-in cancelled";
  if (code === "auth/popup-blocked") return "Popup blocked by the browser";
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found")
    return "Wrong email or password";
  if (code === "auth/invalid-email") return "Invalid email";
  if (code === "auth/email-already-in-use") return "Email already has an account — sign in instead";
  if (code === "auth/weak-password") return "Password must be at least 6 characters";
  if (code === "auth/too-many-requests") return "Too many attempts, try again later";
  if (code === "auth/account-exists-with-different-credential")
    return "This email already uses another sign-in method";
  if (code === "auth/network-request-failed") return "No connection";
  if (code === "auth/operation-not-allowed" || code === "auth/admin-restricted-operation")
    return "Enable this sign-in method in Firebase console → Authentication";
  if (code === "auth/unauthorized-domain") return "Add this domain in Firebase console → Authentication → Settings";
  if (code === "permission-denied") return "Cloud save rejected (check Firestore rules)";
  return code ? `Cloud error: ${code}` : "Cloud error";
}
