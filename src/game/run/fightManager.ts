import {
  FightConfig,
  RoundState,
  SpinResult,
  RoundOutcome,
  FightOutcome
} from "../types";
import { createRoundManager } from "./roundManager";

/**
 * Coordinates the lifecycle of a fight across multiple rounds.
 */
export interface FightManager {
  /**
   * Initializes a new fight using the provided configuration and starting heat.
   *
   * @param config - Fight configuration that includes round settings.
   * @param initialHeat - Heat value to seed into the first round.
   */
  start(config: FightConfig, initialHeat: number): void;
  /**
   * Returns the most recently cached round state snapshot.
   */
  getRoundState(): RoundState;
  /**
   * Performs the next spin in the active round.
   *
   * @returns Spin results paired with the updated round state.
   */
  nextSpin(): { spin: SpinResult; state: RoundState };  // delegates to RoundManager
  /**
   * Finalizes the current round and prepares the next one if needed.
   *
   * @returns The finished round number, its outcome, and a flag indicating overall completion.
   */
  finishRound(): { round: number; outcome: RoundOutcome; done: boolean };
  /**
   * Generates the overall fight summary after all rounds are complete.
   *
   * @returns Fight outcome data or null if the fight is still running.
   */
  summary(): FightOutcome | null;
}

/**
 * Factory for creating fight managers that orchestrate multiple rounds via round managers.
 *
 * @param roundMgrFactory - Produces a fresh round manager instance when called.
 * @returns A fight manager implementation bound to the supplied factory.
 */
export function createFightManager(roundMgrFactory: () => ReturnType<typeof createRoundManager>) : FightManager {
  let cfg: FightConfig;
  let currentRound = 0;
  let rm = roundMgrFactory();
  let totalCredits = 0;
  let heat = 0;
  let fightLog: string[] = [];
  let finished = false;

  return {
    /**
     * Starts a fight by resetting counters and delegating to the round manager.
     *
     * @param config - Configuration for the fight and the initial round.
     * @param initialHeat - Starting heat value for the first round.
     */
    start(config, initialHeat) {
      cfg = config;
      currentRound = 1;
      finished = false;
      heat = initialHeat;
      rm = roundMgrFactory();
      rm.start(cfg.round, { spinsRemaining: cfg.round.spinsAllowed, creditsThisRound: 0, heat });
    },
    /**
     * Exposes a lightweight snapshot of the current round state.
     */
    getRoundState() {
      // minimal mirror; expand if you track HP etc.
      return { spinsRemaining: 0, creditsThisRound: 0, heat } as any; // optional to expose
    },
    /**
     * Executes the next spin and synchronizes cached heat with the round manager.
     *
     * @returns The spin outcome along with the updated round state.
     */
    nextSpin() {
      const { spin, state } = rm.spin();
      heat = state.heat;
      return { spin, state };
    },
    /**
     * Wraps up the current round, aggregates totals, and prepares the next round.
     *
     * @returns Round metadata, its outcome, and whether the fight has concluded.
     */
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
    /**
     * Produces a summary of the fight once all rounds have completed.
     *
     * @returns Fight outcome data or null if the fight is still in progress.
     */
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
