/* ---------------------------------------------------------

    Single-Game Level Types & Contracts
    These types are for use in a single run/game. 

   --------------------------------------------------------- */

export type { SpinResult } from "../types/index";

export type RoundMode = 'safe' | 'risky';

export interface RoundModePreset {
    mode: RoundMode;
    label: string;
    spinsAllowed: number;
    multiplier: number;
}

export const ROUND_MODE_PRESETS: Record<RoundMode, RoundModePreset> = {
    safe: {
        mode: 'safe',
        label: 'Safe (6 spins, 1.0x)',
        spinsAllowed: 6,
        multiplier: 1.0,
    },
    risky: {
        mode: 'risky',
        label: 'Risky (3 spins, 2.0x)',
        spinsAllowed: 3,
        multiplier: 2.0,
    },
};

export type GameState = "START" | "ENCOUNTER" | "SHOP" | "END";

export type HeatTier = "COLD" | "WARMED_UP" | "ON_FIRE" | "CORRUPTION" | "BREAKDOWN";

export interface RoundConfig {
    spinsAllowed: number;
    betCost: number;
    targetCredits?: number;
}

export interface RoundState {
    spinsRemaining: number;
    creditsThisRound: number;
    heat: number;
    multiplier: number;
    mode: RoundMode;
}

export interface RoundOutcome {
    success: boolean;
    creditsGained: number;
    heatEnd: number;
    damageTaken?: number;
    multiplier: number;
    mode: RoundMode;
    spinsUsed: number;
    log: string[];
}

export interface FightConfig {
    rounds: number;
    round: RoundConfig;
    enemyTier: number;
}

export interface FightOutcome {
    success: boolean;
    ticketsEarned: number;
    totalCredits: number;
    heatEnd: number;
    log: string[];
}