import { create } from "zustand";
import { GameEngine } from "@/engine/core/GameEngine";
import { InvalidActionError } from "@/engine/core/GameReducer";
import type { GameAction } from "@/engine/core/GameAction";
import type { GameEvent, ScoreStepKind } from "@/engine/core/GameEvent";
import type { GameState } from "@/engine/core/GameState";
import type { PlayingCard } from "@/engine/cards/Card";
import { MAX_PLAYED_CARDS } from "@/engine/poker/HandEvaluator";
import { HAND_BASE } from "@/engine/poker/HandRank";
import { sfx, setMuted, setVolume } from "@/ui/audio/sfx";
import { celebrate } from "@/ui/fx/confetti";
import { sleep } from "@/ui/format";
import { cloudConfigured } from "@/services/firebase";
import * as cloud from "@/services/cloud";
import {
  SAVE_VERSION,
  applyRunToStats,
  parseRunSave,
  pickNewerSave,
  summarizeRun,
  type PlayerStats,
  type RunSave,
} from "@/services/saveFormat";

/**
 * Application layer: React <-> Engine bridge.
 *
 * The engine resolves an action instantly. The store keeps two states:
 *  - `game`: engine truth
 *  - `view`: what the player currently sees
 * During a scoring sequence `view` lags behind `game` while the events are
 * replayed one by one (popups, sounds, counters); at the end view = game.
 */

export type PopupKind = ScoreStepKind | "INFO";

export interface Popup {
  id: number;
  /** "card:<id>" | "joker:<id>" | "held:<id>" | "boss" | "hud" */
  target: string;
  text: string;
  kind: PopupKind;
}

export interface ScoringSequence {
  played: PlayingCard[];
  scoringIds: string[];
  phase: "enter" | "steps" | "total" | "exit";
  handName: string;
  level: number;
  chips: number;
  mult: number;
  score: number | null;
  /** id being triggered right now + a counter to restart its pulse. */
  active: string | null;
  pulse: number;
  destroyed: string[];
  onFire: boolean;
}

export interface Settings {
  speed: 1 | 2 | 4;
  muted: boolean;
  crt: boolean;
}

export interface CloudState {
  /**
   * off = no Firebase config · signedOut = local-only · connecting = loading profile
   * ready = synced · error = profile could not be loaded (still playable locally)
   */
  status: "off" | "signedOut" | "connecting" | "ready" | "error";
  account: cloud.CloudAccount | null;
  /** Totals across all finished runs (null until loaded from the server). */
  stats: PlayerStats | null;
  message: string | null;
}

interface GameStore {
  game: GameState;
  view: GameState;
  seq: ScoringSequence | null;
  busy: boolean;
  popups: Popup[];
  shake: number;
  selectedCardIds: string[];
  selectedJokerId: string | null;
  selectedConsumableId: string | null;
  lastEvents: GameEvent[];
  error: string | null;
  settings: Settings;
  hasSave: boolean;
  cloud: CloudState;

  dispatch: (action: GameAction) => void;
  toggleCard: (cardId: string) => void;
  clearSelection: () => void;
  selectJoker: (id: string | null) => void;
  selectConsumable: (id: string | null) => void;
  setSettings: (patch: Partial<Settings>) => void;
  continueRun: () => void;
  abandonRun: () => void;
  popup: (target: string, text: string, kind: PopupKind) => void;
  exportReplay: () => string;
  /** Auth actions resolve to an error message, or null on success. */
  signInGoogle: () => Promise<string | null>;
  signInEmail: (email: string, password: string) => Promise<string | null>;
  signUpEmail: (email: string, password: string, displayName: string) => Promise<string | null>;
  resetPassword: (email: string) => Promise<string | null>;
  signOutCloud: () => Promise<void>;
}

const SAVE_KEY = "balatro-fake/save-v3";
const LEGACY_SAVE_KEY = "balatro-fake/save-v2";
const SETTINGS_KEY = "balatro-fake/settings";
const CLOUD_SYNC_DELAY_MS = 2500;

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { speed: 1, muted: false, crt: true, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { speed: 1, muted: false, crt: true };
}

function readSave(): RunSave | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY) ?? localStorage.getItem(LEGACY_SAVE_KEY);
    return raw ? parseRunSave(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function storeLocalSave(save: RunSave | null) {
  try {
    localStorage.removeItem(LEGACY_SAVE_KEY);
    if (save) localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    else localStorage.removeItem(SAVE_KEY);
  } catch {
    /* storage full / disabled: the run still works */
  }
}

const isRunOver = (s: GameState) => s.status === "GAME_OVER" || s.status === "VICTORY" || s.status === "MENU";

/** Saves locally right away; returns the save (null = no resumable run). */
function writeSave(state: GameState, log: readonly GameAction[]): RunSave | null {
  const first = log[0];
  const save =
    isRunOver(state) || first?.type !== "START_RUN"
      ? null
      : { version: SAVE_VERSION, seed: first.seed, actions: [...log], updatedAt: Date.now() };
  storeLocalSave(save);
  return save;
}

/* --- Cloud sync ------------------------------------------------------------
 * Local storage stays the source of truth while playing; the active run is
 * pushed to Firestore a few seconds after the last action (and right away when
 * the tab is hidden). Firestore's offline cache queues writes made offline.
 */
let cloudUid: string | null = null;
let pendingRun: RunSave | null | undefined; // undefined = nothing to push
let syncTimer: ReturnType<typeof setTimeout> | undefined;

function flushRunSync() {
  clearTimeout(syncTimer);
  syncTimer = undefined;
  if (!cloudUid || pendingRun === undefined) return;
  const run = pendingRun;
  pendingRun = undefined;
  const uid = cloudUid;
  const p = run ? cloud.saveActiveRun(uid, run) : cloud.clearActiveRun(uid);
  p.catch((err) => console.warn("[cloud] run sync failed", err));
}

function queueRunSync(run: RunSave | null, immediate = false) {
  if (!cloudConfigured) return;
  pendingRun = run;
  clearTimeout(syncTimer);
  if (immediate) flushRunSync();
  else syncTimer = setTimeout(flushRunSync, CLOUD_SYNC_DELAY_MS);
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushRunSync();
  });
}

let engine = new GameEngine();
let popupId = 0;
const initialSettings = loadSettings();
setMuted(initialSettings.muted);
setVolume(0.5);

export const useGameStore = create<GameStore>((set, get) => {
  const wait = (ms: number) => sleep(ms / get().settings.speed);

  const popup = (target: string, text: string, kind: PopupKind) => {
    const id = ++popupId;
    set((s) => ({ popups: [...s.popups, { id, target, text, kind }] }));
    setTimeout(() => set((s) => ({ popups: s.popups.filter((p) => p.id !== id) })), 900 / get().settings.speed);
  };

  /** Side effects for events that are not part of a scoring sequence. */
  const react = (events: GameEvent[]) => {
    for (const e of events) {
      switch (e.type) {
        case "CARDS_DRAWN":
          e.cardIds.slice(0, 8).forEach((_, i) => sfx.deal(i));
          break;
        case "CARDS_DISCARDED":
          sfx.discard();
          break;
        case "JOKER_MESSAGE":
          popup(`joker:${e.jokerId}`, e.text, "INFO");
          break;
        case "MONEY_EARNED":
          sfx.money();
          break;
        case "ITEM_BOUGHT":
          sfx.buy();
          break;
        case "JOKER_SOLD":
        case "CONSUMABLE_SOLD":
        case "CASHED_OUT":
          sfx.money();
          break;
        case "CONSUMABLE_USED":
          sfx.tarot();
          if (e.text) popup("hud", e.text, "INFO");
          break;
        case "SHOP_REROLLED":
          sfx.click();
          break;
        case "ROUND_WON":
          sfx.win();
          celebrate(e.score >= e.targetScore * 2);
          break;
        case "VICTORY":
          celebrate(true);
          break;
        case "GAME_OVER":
          sfx.lose();
          break;
        case "JOKER_DESTROYED":
          popup("hud", "Extinct!", "DESTROY");
          break;
        default:
          break;
      }
    }
  };

  const runScoring = async (prev: GameState, played: PlayingCard[], events: GameEvent[], final: GameState) => {
    const evaluated = events.find((e) => e.type === "HAND_EVALUATED");
    const finalized = events.find((e) => e.type === "SCORE_FINALIZED");
    const steps = events.filter((e): e is Extract<GameEvent, { type: "SCORE_STEP" }> => e.type === "SCORE_STEP");
    const playedIds = new Set(played.map((c) => c.id));

    // View: remove the played cards from the hand; nothing else changes yet.
    set({
      busy: true,
      view: { ...prev, deck: { ...prev.deck, hand: prev.deck.hand.filter((c) => !playedIds.has(c.id)) } },
      seq: {
        played,
        scoringIds: evaluated?.type === "HAND_EVALUATED" ? evaluated.scoringCardIds : [],
        phase: "enter",
        handName: evaluated?.type === "HAND_EVALUATED" ? HAND_BASE[evaluated.handType].name : "",
        level: evaluated?.type === "HAND_EVALUATED" ? evaluated.level : 1,
        chips: 0,
        mult: 0,
        score: null,
        active: null,
        pulse: 0,
        destroyed: [],
        onFire: false,
      },
    });
    sfx.deal(0);
    await wait(520);
    if (evaluated?.type === "HAND_EVALUATED") {
      sfx.handName();
      set((s) => ({ seq: s.seq && { ...s.seq, phase: "steps", chips: evaluated.chips, mult: evaluated.mult } }));
      await wait(380);
    }

    const target = prev.round.targetScore;
    let i = 0;
    for (const step of steps) {
      const tgt =
        step.source === "CARD"
          ? `card:${step.sourceId}`
          : step.source === "HELD"
            ? `held:${step.sourceId}`
            : step.source === "JOKER"
              ? `joker:${step.sourceId}`
              : step.source === "BOSS"
                ? "boss"
                : "hud";
      const counts = step.kind !== "MESSAGE" && step.kind !== "RETRIGGER" && step.kind !== "DEBUFFED";
      set((s) => {
        if (!s.seq) return {};
        const chips = step.kind === "BASE" || counts ? step.chips : s.seq.chips;
        const mult = step.kind === "BASE" || counts ? step.mult : s.seq.mult;
        return {
          seq: {
            ...s.seq,
            chips,
            mult,
            active: step.sourceId ? tgt : null,
            pulse: s.seq.pulse + 1,
            onFire: prev.round.currentScore + chips * mult >= target,
            destroyed: step.kind === "DESTROY" && step.sourceId ? [...s.seq.destroyed, step.sourceId] : s.seq.destroyed,
          },
        };
      });
      if (step.kind !== "BASE") popup(tgt, step.text, step.kind);
      switch (step.kind) {
        case "CHIPS":
          sfx.chips(i);
          break;
        case "MULT":
          sfx.mult(i);
          break;
        case "XMULT":
          sfx.xmult(i);
          set((s) => ({ shake: s.shake + 1 }));
          break;
        case "MONEY":
          sfx.money();
          break;
        case "RETRIGGER":
          sfx.retrigger();
          break;
        case "DEBUFFED":
          sfx.debuff();
          break;
        case "DESTROY":
          sfx.shatter();
          break;
        default:
          break;
      }
      i++;
      await wait(step.kind === "BASE" ? 120 : step.kind === "XMULT" ? 520 : 360);
    }

    if (finalized?.type === "SCORE_FINALIZED") {
      sfx.total();
      set((s) => ({
        seq: s.seq && { ...s.seq, phase: "total", score: finalized.score, active: null },
        view: { ...s.view, round: { ...s.view.round, currentScore: finalized.roundScore }, player: { ...s.view.player, money: final.player.money } },
        shake: finalized.score >= target ? s.shake + 1 : s.shake,
      }));
      await wait(900);
    }
    set((s) => ({ seq: s.seq && { ...s.seq, phase: "exit" } }));
    await wait(380);
    set({ view: final, seq: null, busy: false });
    react(events.filter((e) => e.type !== "SCORE_STEP"));
  };

  const authAction = async (fn: () => Promise<unknown>): Promise<string | null> => {
    try {
      await fn();
      return null;
    } catch (err) {
      return cloud.describeCloudError(err);
    }
  };

  /** Finished run: history entry + totals in the cloud, no more active run. */
  const recordRunEnd = (final: GameState, log: readonly GameAction[]) => {
    clearTimeout(syncTimer);
    pendingRun = undefined;
    const summary = summarizeRun(final, log.length, Date.now());
    const { cloud: c } = get();
    if (c.stats) set({ cloud: { ...c, stats: applyRunToStats(c.stats, summary) } });
    if (!cloudUid) return;
    cloud.recordFinishedRun(cloudUid, summary, [...log], c.status === "ready" ? c.stats : null).catch((err) => {
      console.warn("[cloud] could not record run", err);
    });
  };

  return {
    game: engine.state,
    view: engine.state,
    seq: null,
    busy: false,
    popups: [],
    shake: 0,
    selectedCardIds: [],
    selectedJokerId: null,
    selectedConsumableId: null,
    lastEvents: [],
    error: null,
    settings: initialSettings,
    hasSave: readSave() !== null,
    cloud: { status: cloudConfigured ? "signedOut" : "off", account: null, stats: null, message: null },

    dispatch: (action) => {
      if (get().busy) return;
      const prev = engine.state;
      let events: GameEvent[];
      try {
        events = engine.dispatch(action);
      } catch (err) {
        if (err instanceof InvalidActionError) {
          sfx.error();
          set({ error: err.message.replace(/^[A-Z_]+: /, "") });
          setTimeout(() => set({ error: null }), 2200);
          return;
        }
        throw err;
      }
      const final = engine.state;
      const save = writeSave(final, engine.actionLog);
      const runEnded = !isRunOver(prev) && isRunOver(final) && action.type !== "START_RUN";
      if (runEnded && final.status !== "MENU") recordRunEnd(final, engine.actionLog);
      else if (save) queueRunSync(save, action.type === "START_RUN" || action.type === "CASH_OUT");
      else queueRunSync(null, true);
      const keepSelection = action.type === "SORT_HAND" || action.type === "REORDER_HAND" || action.type === "SELL_JOKER" || action.type === "MOVE_JOKER";
      set((s) => ({
        game: final,
        lastEvents: events,
        error: null,
        selectedCardIds: keepSelection ? s.selectedCardIds : [],
        selectedJokerId: null,
        selectedConsumableId: null,
        hasSave: final.status !== "GAME_OVER" && final.status !== "VICTORY",
      }));

      if (action.type === "PLAY_HAND") {
        const byId = new Map(prev.deck.hand.map((c) => [c.id, c]));
        const played = action.cardIds.map((id) => byId.get(id)).filter((c): c is PlayingCard => !!c);
        void runScoring(prev, played, events, final);
      } else {
        set({ view: final });
        react(events);
      }
    },

    toggleCard: (cardId) => {
      const { selectedCardIds, busy } = get();
      if (busy) return;
      if (selectedCardIds.includes(cardId)) {
        sfx.deselect();
        set({ selectedCardIds: selectedCardIds.filter((id) => id !== cardId) });
      } else if (selectedCardIds.length < MAX_PLAYED_CARDS) {
        sfx.select();
        set({ selectedCardIds: [...selectedCardIds, cardId] });
      } else {
        sfx.error();
      }
    },

    clearSelection: () => set({ selectedCardIds: [] }),
    selectJoker: (id) => {
      sfx.click();
      set({ selectedJokerId: id, selectedConsumableId: null });
    },
    selectConsumable: (id) => {
      sfx.click();
      set({ selectedConsumableId: id, selectedJokerId: null });
    },

    setSettings: (patch) => {
      const settings = { ...get().settings, ...patch };
      setMuted(settings.muted);
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch {
        /* ignore */
      }
      set({ settings });
    },

    continueRun: () => {
      const save = readSave();
      if (!save) return;
      try {
        engine = GameEngine.replay(save.actions);
        set({ game: engine.state, view: engine.state, seq: null, busy: false, selectedCardIds: [] });
      } catch {
        localStorage.removeItem(SAVE_KEY);
        set({ hasSave: false, error: "Save file could not be loaded" });
      }
    },

    abandonRun: () => {
      engine = new GameEngine();
      try {
        localStorage.removeItem(SAVE_KEY);
      } catch {
        /* ignore */
      }
      queueRunSync(null, true);
      set({ game: engine.state, view: engine.state, seq: null, busy: false, hasSave: false, selectedCardIds: [] });
    },

    popup,
    exportReplay: () => JSON.stringify(engine.actionLog),

    signInGoogle: () => authAction(() => cloud.signInGoogle()),
    signInEmail: (email, password) => authAction(() => cloud.signInEmail(email, password)),
    signUpEmail: (email, password, displayName) =>
      authAction(async () => {
        const account = await cloud.signUpEmail(email, password, displayName);
        // onAuthStateChanged fired before updateProfile; refresh the shown name.
        set((s) => ({ cloud: { ...s.cloud, account } }));
      }),
    resetPassword: (email) => authAction(() => cloud.resetPassword(email)),
    signOutCloud: async () => {
      flushRunSync();
      await cloud.signOutCloud();
    },
  };
});

/* --- Account lifecycle --------------------------------------------------- */

async function onSignedIn(account: cloud.CloudAccount) {
  const store = useGameStore;
  store.setState((s) => ({ cloud: { ...s.cloud, status: "connecting", account, message: null } }));
  try {
    const profile = await cloud.loadProfile(account);
    if (cloudUid !== account.uid) return; // signed out / switched meanwhile

    if (profile.settings) {
      const settings = { ...store.getState().settings, ...profile.settings };
      setMuted(settings.muted);
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch {
        /* ignore */
      }
      store.setState({ settings });
    } else {
      void cloud.saveSettings(account.uid, store.getState().settings);
    }

    // Resume whichever run is newer. Only swap saves while on the menu: a run
    // being played right now always wins and is pushed up.
    const local = readSave();
    const inRun = store.getState().game.status !== "MENU";
    const choice = inRun ? "local" : pickNewerSave(local, profile.activeRun);
    if (choice === "cloud" && profile.activeRun) {
      storeLocalSave(profile.activeRun);
      store.setState({ hasSave: true });
    } else if (choice === "local" && local) {
      queueRunSync(local, true);
    }

    store.setState((s) => ({ cloud: { ...s.cloud, status: "ready", stats: profile.stats } }));
  } catch (err) {
    console.warn("[cloud] profile load failed", err);
    if (cloudUid !== account.uid) return;
    store.setState((s) => ({ cloud: { ...s.cloud, status: "error", message: cloud.describeCloudError(err) } }));
  }
}

cloud.watchAccount((account) => {
  if (account?.uid === cloudUid) return;
  flushRunSync();
  cloudUid = account?.uid ?? null;
  if (account) void onSignedIn(account);
  else useGameStore.setState({ cloud: { status: "signedOut", account: null, stats: null, message: null } });
});

let settingsTimer: ReturnType<typeof setTimeout> | undefined;
useGameStore.subscribe((s, prev) => {
  if (s.settings === prev.settings || !cloudUid || s.cloud.status !== "ready") return;
  clearTimeout(settingsTimer);
  const uid = cloudUid;
  settingsTimer = setTimeout(() => void cloud.saveSettings(uid, useGameStore.getState().settings).catch(() => {}), 1000);
});
