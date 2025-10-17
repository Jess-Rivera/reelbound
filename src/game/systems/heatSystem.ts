import {
    HeatTier,
    SpinResult
} from "../types";


export interface HeatSystem {
    getHeatTier(heat: number): HeatTier;
    onSpin(heat: number, spinResult: SpinResult, streak: number): number;
    onBetweenNodes(heat: number): number;
}

export function createHeatSystem(thresholds = {WARMED_UP: 0, ON_FIRE: 33, CORRUPTION: 66, BREAKDOWN: 100}): HeatSystem {
    const {WARMED_UP, ON_FIRE, CORRUPTION} = thresholds;
    return {
        getHeatTier(h) {
            if (h >= CORRUPTION) return "CORRUPTION";
            if (h >= ON_FIRE) return "ON_FIRE";
            if (h >= WARMED_UP) return "WARMED_UP";
            return "COLD";
        },
        onSpin(h, spin, streak) {
            const k = spin.totalPayout > 0 ? 7 : 1;
            const streakBonus = Math.min(0, streak -1 );
            return Math.max(0, h + k + streakBonus);
        },
        onBetweenNodes(h) {
            return Math.max(0, h - 5);
        }
    };
}