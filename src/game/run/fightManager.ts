import {
  FightConfig,
  RoundState,
  SpinResult,
  RoundOutcome,
  FightOutcome,
  ROUND_MODE_PRESETS,
} from "../types";
import { createRoundManager } from "./roundManager";

/**
 * Coordinates the lifecycle of a fight across multiple rounds.
 */
export interface FightManager {
  start(config: FightConfig, initialHeat: number): void;
  getRoundState(): RoundState;
  nextSpin(): { spin: SpinResult; state: RoundState };
  finishRound(): { round: number; outcome: RoundOutcome; done: boolean };
  summary(): FightOutcome | null;
}

export function createFightManager(
  roundMgrFactory: () => ReturnType<typeof createRoundManager>
): FightManager {
  let cfg: FightConfig;
  let currentRound = 0;
  let rm = roundMgrFactory();
  let totalCredits = 0;
  let heat = 0;
  let fightLog: string[] = [];
  let finished = false;
  let lastState: RoundState = {
    spinsRemaining: 0,
    creditsThisRound: 0,
    heat: 0,
    multiplier: ROUND_MODE_PRESETS.safe.multiplier,
    mode: ROUND_MODE_PRESETS.safe.mode,
  };

  const defaultPreset = ROUND_MODE_PRESETS.safe;

  return {
    start(config, initialHeat) {
      cfg = config;
      currentRound = 1;
      finished = false;
      heat = initialHeat;
      rm = roundMgrFactory();

      lastState = {
        spinsRemaining: cfg.round.spinsAllowed,
        creditsThisRound: 0,
        heat,
        multiplier: defaultPreset.multiplier,
        mode: defaultPreset.mode,
      };

      rm.start(cfg.round, { ...lastState });
    },

    getRoundState() {
      return { ...lastState };
    },

    nextSpin() {
      const { spin, state } = rm.spin();
      heat = state.heat;
      lastState = state;
      return { spin, state };
    },

    finishRound() {
      const outcome = rm.finish();
      totalCredits += outcome.creditsGained;
      heat = outcome.heatEnd;
      fightLog.push(...outcome.log, `Round ${currentRound} ${outcome.success ? 'PASS' : 'FAIL'}`);

      lastState = {
        spinsRemaining: 0,
        creditsThisRound: outcome.creditsGained,
        heat: outcome.heatEnd,
        multiplier: outcome.multiplier,
        mode: outcome.mode,
      };

      if (currentRound >= cfg.rounds) {
        finished = true;
        return { round: currentRound, outcome, done: true };
      }

      currentRound += 1;
      rm = roundMgrFactory();
      lastState = {
        spinsRemaining: cfg.round.spinsAllowed,
        creditsThisRound: 0,
        heat,
        multiplier: defaultPreset.multiplier,
        mode: defaultPreset.mode,
      };
      rm.start(cfg.round, { ...lastState });
      return { round: currentRound - 1, outcome, done: false };
    },

    summary() {
      if (!finished) return null;
      const success = fightLog.every((entry) => !entry.includes('FAIL'));
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
