import { GameState, FightOutcome } from "../types";
import { saveRun, loadRun } from "../../persistence/saveAdapter";

export interface RunProgress {
  saveVersion: "0.1";
  seed: number;
  day: number;
  nodeIndex: number;
  tickets: number;
  totalCredits: number;
  machineState: { heat: number; lastPayout: number; };
  enemyState: { tier: number; hp: number; };
}

export interface RunManager {
  state: GameState;
  progress: RunProgress;
  newRun(seed?: number): void;
  continueRun(): boolean;
  enterEncounter(): void;
  resolveEncounter(outcome: FightOutcome): void;
  enterShop(): void;
  applyShopAction(id: "reduce_heat" | "heal" | "reroll_mod"): void;
  advanceNode(): void;
  endRun(win: boolean): void;
}

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
