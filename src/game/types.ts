/* ---------------------------------------------------------

    Single-Game Level Types & Contracts
    These types are for use in a single run/game. 

   --------------------------------------------------------- */

export type GameState = "START" | "ENCOUNTER" | "SHOP" | "END";

export type HeatTier = "COLD" | "WARMED_UP" | "ON_FIRE" | "CORRUPTION" | "BREAKDOWN";

export interface SpinResult {
        seed: number;
        grid: string[][];
        wins: Array<{wincondition: "H" | "V" | "D";
                     symbol: string;
                     count: number;
                     payout: number; 
                    }>;
        totalPayout: number;
        }

export interface RoundConfig {
    spinsAllowed: number;
    betCost: number;
    targetCredits?: number;
}

export interface RoundState {
    spinsRemaining: number;
    creditsThisRounds: number;
    heat: number;
}

export interface RoundOutcome {
    success: boolean;
}