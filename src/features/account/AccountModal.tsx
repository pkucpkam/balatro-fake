import clsx from "clsx";
import { useState } from "react";
import { fmt } from "@/ui/format";
import { Modal } from "../game/Modals";
import { useGameStore } from "../game/gameStore";

type Mode = "signin" | "signup" | "reset";

function SignedIn() {
  const c = useGameStore((s) => s.cloud);
  const signOut = useGameStore((s) => s.signOutCloud);
  const stats = c.stats;
  return (
    <div className="account">
      <p className="modal-note">
        Signed in as <b>{c.account?.displayName || c.account?.email}</b>
        {c.account?.displayName && c.account.email ? ` · ${c.account.email}` : ""}
      </p>
      <p className={clsx("account-sync", c.status)}>
        {c.status === "ready" && "Cloud save is on — your run and stats sync automatically."}
        {c.status === "connecting" && "Loading your profile…"}
        {c.status === "error" && (c.message ?? "Cloud save unavailable — playing locally.")}
      </p>
      {stats && (
        <dl className="end-stats">
          <div>
            <dt>Runs played</dt>
            <dd>{stats.runsPlayed}</dd>
          </div>
          <div>
            <dt>Runs won</dt>
            <dd>{stats.runsWon}</dd>
          </div>
          <div>
            <dt>Best hand</dt>
            <dd>{fmt(stats.bestHandScore)}</dd>
          </div>
          <div>
            <dt>Highest ante</dt>
            <dd>{stats.highestAnte}</dd>
          </div>
          <div>
            <dt>Hands played</dt>
            <dd>{stats.handsPlayed}</dd>
          </div>
        </dl>
      )}
      <button type="button" className="btn btn-ghost" onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  );
}

function SignInForm() {
  const signInGoogle = useGameStore((s) => s.signInGoogle);
  const signInEmail = useGameStore((s) => s.signInEmail);
  const signUpEmail = useGameStore((s) => s.signUpEmail);
  const resetPassword = useGameStore((s) => s.resetPassword);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const run = async (fn: () => Promise<string | null>, success?: string) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    const err = await fn();
    setBusy(false);
    if (err) setError(err);
    else if (success) setInfo(success);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signin") void run(() => signInEmail(email, password));
    else if (mode === "signup") void run(() => signUpEmail(email, password, name));
    else void run(() => resetPassword(email), "Reset link sent — check your inbox.");
  };

  return (
    <div className="account">
      <p className="modal-note">Sign in to keep your run and stats in the cloud and continue on another device.</p>
      <div className="seg account-tabs" role="tablist">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={clsx("btn btn-seg", mode === m && "on")}
            onClick={() => {
              setMode(m);
              setError(null);
              setInfo(null);
            }}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form className="account-form" onSubmit={submit}>
        {mode === "signup" && (
          <label className="field">
            <span className="label">Display name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoComplete="nickname" />
          </label>
        )}
        <label className="field">
          <span className="label">Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus />
        </label>
        {mode !== "reset" && (
          <label className="field">
            <span className="label">Password</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </label>
        )}
        {error && (
          <p className="account-msg error" role="alert">
            {error}
          </p>
        )}
        {info && <p className="account-msg">{info}</p>}
        <button type="submit" className="btn btn-play" disabled={busy}>
          {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
        </button>
        {mode === "signin" && (
          <button type="button" className="btn-link" onClick={() => setMode("reset")}>
            Forgot password?
          </button>
        )}
        {mode === "reset" && (
          <button type="button" className="btn-link" onClick={() => setMode("signin")}>
            Back to sign in
          </button>
        )}
      </form>

      <div className="account-or">or</div>
      <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void run(signInGoogle)}>
        Continue with Google
      </button>
    </div>
  );
}

export function AccountModal({ onClose }: { onClose: () => void }) {
  const status = useGameStore((s) => s.cloud.status);
  return (
    <Modal title="Account" onClose={onClose}>
      {status === "off" ? (
        <p className="modal-note">Cloud save is not configured for this build (missing VITE_FIREBASE_* env vars).</p>
      ) : status === "signedOut" ? (
        <SignInForm />
      ) : (
        <SignedIn />
      )}
    </Modal>
  );
}

/** Short label for buttons: "Sign in" or the player's name. */
export function useAccountLabel(): string | null {
  const c = useGameStore((s) => s.cloud);
  if (c.status === "off") return null;
  if (!c.account) return "Sign in";
  return c.account.displayName || c.account.email?.split("@")[0] || "Account";
}
