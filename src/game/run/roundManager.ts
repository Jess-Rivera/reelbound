/* ---------------------------------------------------------

    roundManager owns the spin budget, per spin heat updates 
    and round summary

   --------------------------------------------------------- */

import {
    RoundConfig,
    RoundState,
    RoundOutcome,
    SpinResult
} from "../types";
import { HeatSystem } from "../systems/heatSystem";

/**
 * Minimal contract the slot machine must follow so the round manager can ask for spins.
 */
export interface SlotMachinePort {
    spin(seed?: number): SpinResult;
}

/**
 * External surface for the round manager state machine that owns a single round lifecycle.
 */
export interface RoundManager {
    start(config: RoundConfig, initial: RoundState): void;
    canSpin(): boolean;
    spin(): {spin: SpinResult; state: RoundState};
    finish(): RoundOutcome;
}

/**
 * Builds a fresh round manager that tracks spins, heat, and a log for the given slot machine.
 */
export function createRoundManager(machine: SlotMachinePort, heat: HeatSystem): RoundManager {
    let cfg: RoundConfig;
    let st: RoundState;
    let log: string[] = [];
    let winStreak = 0;

    return {
        /**
         * Resets the round using the provided config and starting state, and seeds the log
         * with an entry so we know how many spins, credits, and heat we began with.
         */
        start(config, initial) {
            cfg = config;
            st = initial;
            log = [];
            winStreak = 0;
            log.push(`Round started with ${st.spinsRemaining} spins, ${st.creditsThisRound} credits, and heat level ${st.heat}.`);
        },
        /**
         * Answers whether we still have spins left to spend this round.
         */
        canSpin() {
            return st.spinsRemaining > 0;
        },
        /**
         * Executes a single spin, updates credits, heat, and streak tracking, then records
         * a human-friendly log entry describing what just happened.
         */
        spin() {
            if (!this.canSpin()) throw new Error("No spins remaining");
            const spinResult = machine.spin();
            st.spinsRemaining -= 1;
            st.creditsThisRound += (spinResult.totalPayout ?? 0);
            
            if (spinResult.totalPayout > 0) winStreak++; else winStreak = 0;
            st.heat = heat.onSpin(st.heat, spinResult, winStreak);

            log.push(
                `Spin: payout=${spinResult.totalPayout} streak=${winStreak} heat=${st.heat} tier=${heat.getHeatTier(st.heat)}`
            ); 
            return {spin: spinResult, state: {...st}};  
        },
        /**
         * Closes the round, evaluates whether we met the credit goal, and bundles all
         * the stats plus the log so the caller can summarize the encounter.
         */
        finish() {
            const success = cfg.targetCredits == null 
            ? true
            : st.creditsThisRound >= cfg.targetCredits;

            return {
                success,
                creditsGained: st.creditsThisRound,
                heatEnd: st.heat,
                damageTaken: success ? 0 : Math.max(0, (cfg.targetCredits ?? 0) - st.creditsThisRound),
                log,
            };
        }   
    }
}
