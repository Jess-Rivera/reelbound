import {
  FightConfig,
  RoundState,
  SpinResult,
  RoundOutcome,
  FightOutcome
} from "../types";
import { createRoundManager } from "./roundManager";


export interface FightManager {
  start(config: FightConfig, initialHeat: number): void;
  getRoundState(): RoundState;
  nextSpin(): { spin: SpinResult; state: RoundState };  // delegates to RoundManager
  finishRound(): { round: number; outcome: RoundOutcome; done: boolean };
  summary(): FightOutcome | null;
}

export function createFightManager(roundMgrFactory: () => ReturnType<typeof createRoundManager>) : FightManager {
  let cfg: FightConfig;
  let currentRound = 0;
  let rm = roundMgrFactory();
  let totalCredits = 0;
  let heat = 0;
  let fightLog: string[] = [];
  let finished = false;

  return {
    start(config, initialHeat) {
      cfg = config;
      currentRound = 1;
      finished = false;
      heat = initialHeat;
      rm = roundMgrFactory();
      rm.start(cfg.round, { spinsRemaining: cfg.round.spinsAllowed, creditsThisRound: 0, heat });
    },
    getRoundState() {
      // minimal mirror; expand if you track HP etc.
      return { spinsRemaining: 0, creditsThisRound: 0, heat } as any; // optional to expose
    },
    nextSpin() {
      const { spin, state } = rm.spin();
      heat = state.heat;
      return { spin, state };
    },
    finishRound() {
      const outcome = rm.finish();
      totalCredits += outcome.creditsGained;
      heat = outcome.heatEnd;
      fightLog.push(...outcome.log, `Round ${currentRound} ${outcome.success ? "✓" : "✗"}`);

      if (currentRound >= cfg.rounds) {
        finished = true;
        return { round: currentRound, outcome, done: true };
      }
      currentRound++;
      rm = roundMgrFactory();
      rm.start(cfg.round, { spinsRemaining: cfg.round.spinsAllowed, creditsThisRound: 0, heat });
      return { round: currentRound - 1, outcome, done: false };
    },
    summary() {
      if (!finished) return null;
      // v0.1.0: 1 ticket if overall success (all rounds met target), else 0
      const success = fightLog.filter(l => l.includes("✗")).length === 0;
      return {
        success,
        ticketsEarned: success ? 1 : 0,
        totalCredits,
        heatEnd: heat,
        log: fightLog,
      };
    },
  };
}
