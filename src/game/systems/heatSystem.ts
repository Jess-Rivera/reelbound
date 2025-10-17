import {
    HeatTier,
    SpinResult
} from "../types";


/**
 * Contract for systems that translate spin outcomes into heat adjustments and tiers.
 */
export interface HeatSystem {
    /** Returns the current heat tier label for a numeric heat value. */
    getHeatTier(heat: number): HeatTier;
    /**
     * Computes the new heat level immediately after a spin finishes.
     * Implementations may use the previous heat, the spin result, and current streak.
     */
    onSpin(heat: number, spinResult: SpinResult, streak: number): number;
    /**
     * Applies passive heat decay (or growth) between discrete gameplay nodes such as rounds.
     */
    onBetweenNodes(heat: number): number;
}

/**
 * Builds a simple heat system with tier thresholds and additive adjustments.
 *
 * @param thresholds Map of tier breakpoints; values are inclusive upper bounds for each tier.
 */
export function createHeatSystem(thresholds = {WARMED_UP: 0, ON_FIRE: 33, CORRUPTION: 66, BREAKDOWN: 100}): HeatSystem {
    const {WARMED_UP, ON_FIRE, CORRUPTION} = thresholds;
    return {
        /** Categorizes a heat value into its tier label. */
        getHeatTier(h) {
            if (h >= CORRUPTION) return "CORRUPTION";
            if (h >= ON_FIRE) return "ON_FIRE";
            if (h >= WARMED_UP) return "WARMED_UP";
            return "COLD";
        },
        /**
         * Raises heat according to the spin result: wins apply a stronger bump and streaks add minor bonuses.
         */
        onSpin(h, spin, streak) {
            const k = spin.totalPayout > 0 ? 7 : 1;
            const streakBonus = Math.min(0, streak -1 );
            return Math.max(0, h + k + streakBonus);
        },
        /** Applies a small decay when transitioning between gameplay nodes. */
        onBetweenNodes(h) {
            return Math.max(0, h - 5);
        }
    };
}
