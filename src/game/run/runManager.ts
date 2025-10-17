import { GameState, FightOutcome } from "../types";
import { saveRun, loadRun } from "../../persistence/saveAdapter";

/**
 * Persisted snapshot of a player's run used for continuing or resuming progress.
 */
export interface RunProgress {
  /** Structural version for migrations. */
  saveVersion: "0.1";
  /** Seed powering deterministic systems for the run. */
  seed: number;
  /** Current in-run day counter. */
  day: number;
  /** Index of the next node (encounter/shop/etc.) to resolve. */
  nodeIndex: number;
  /** Tickets currently owned by the player. */
  tickets: number;
  /** Total credits accumulated across the run. */
  totalCredits: number;
  /** Slice of slot-machine related state that must persist between encounters. */
  machineState: { heat: number; lastPayout: number; };
  /** Snapshot of the current enemy the player is facing. */
  enemyState: { tier: number; hp: number; };
}

/**
 * Public API for the run state machine that orchestrates encounters, shops, and persistence.
 */
export interface RunManager {
  /** Current high-level state of the run lifecycle (encounter, shop, end, etc.). */
  state: GameState;
  /** Writable snapshot of the player's progress that is persisted between sessions. */
  progress: RunProgress;
  /** Starts a brand-new run, optionally with a provided deterministic seed. */
  newRun(seed?: number): void;
  /** Attempts to load a saved run, returning true when successful. */
  continueRun(): boolean;
  /** Transitions the run into an encounter state. */
  enterEncounter(): void;
  /** Resolves an encounter and applies its outcome to run progress. */
  resolveEncounter(outcome: FightOutcome): void;
  /** Enters the shop phase of the run. */
  enterShop(): void;
  /** Applies a shop action such as heat reduction or healing. */
  applyShopAction(id: "reduce_heat" | "heal" | "reroll_mod"): void;
  /** Advances to the next node on the current run path. */
  advanceNode(): void;
  /** Ends the run, marking the state as complete and emitting the final result. */
  endRun(win: boolean): void;
}

/**
 * Factory for a run manager that coordinates run progression and persistence.
 *
 * @param initial Initial progress snapshot to seed in-memory state.
 * @returns A run manager capable of moving through encounters and shops while saving progress.
 */
export function createRunManager(initial: RunProgress): RunManager {
  let state: GameState = "START";
  let progress = initial;

  const save = () => saveRun(progress);

  return {
    get state() { return state; },
    get progress() { return progress; },

    newRun(seed = Date.now()) {
      progress = {
        saveVersion: "0.1",
        seed, day: 1, nodeIndex: 0, tickets: 0, totalCredits: 0,
        machineState: { heat: 0, lastPayout: 0 },
        enemyState: { tier: 1, hp: 100 },
      };
      state = "ENCOUNTER";
      save();
    },

    continueRun() {
      const loaded = loadRun();
      if (!loaded) return false;
      progress = loaded;
      state = "ENCOUNTER"; // or infer from node type
      return true;
    },

    enterEncounter() {
      state = "ENCOUNTER";
    },

    resolveEncounter(outcome) {
      progress.totalCredits += outcome.totalCredits;
      progress.machineState.heat = outcome.heatEnd;
      progress.tickets += outcome.ticketsEarned;
      state = "SHOP";
      save();
    },

    enterShop() {
      state = "SHOP";
    },

    applyShopAction(id) {
      if (id === "reduce_heat" && progress.tickets >= 1) {
        progress.tickets -= 1;
        progress.machineState.heat = Math.max(0, progress.machineState.heat - 25);
      }
      // (heal / reroll_mod placeholders)
      save();
    },

    advanceNode() {
      progress.nodeIndex++;
      // toy path: encounter -> shop -> encounter -> end
      if (progress.nodeIndex >= 3) {
        state = "END";
      } else {
        state = progress.nodeIndex === 1 ? "SHOP" : "ENCOUNTER";
      }
      save();
    },

    endRun(win) {
      state = "END";
      // show summary; optionally clear or keep for “Continue”
      save();
    },
  };
}
