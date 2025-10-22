/*---------------------------------------------------------------------------------------------------------------------------
    Static Configuration
        These contracts import information from JSON configuration files and allow pass through to other functions,
        types, etc.
----------------------------------------------------------------------------------------------------------------------------*/


/*--------------------------------------------------------------------------Currencies-------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/

export type Tickets = number;
export type Contracts = number;


/*-------------------------------------------------------------------------Icon Related------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/

export const ICONS = [
  'lemon',
  'grape',
  'melon',
  'cherry',
  'diamond',
  'bar',
  'seven',
  'bell',
  'star'
] as const;

export type IconId = (typeof ICONS)[number];

export type IconMetaData = {
    id: string;
    name: string;
    glyph: string;
    assetURL?: string;
    baseScore: number;
    category: string;
    rarity: string;
    tags: string[];
    synergyGroup?: string[];  
}
export type IconMetaTable = Record<string, IconMetaData>;

export interface EffectiveIconInfo {
  id: IconId;
  weight: number;
  basemult: number;
}

/*-------------------------------------------------------------------------Fight Related-----------------------------*/
/*------------------------------------------------------------------------------Spins-Rounds-Fight-------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/
/*-------------------------------------------------
A Fight contains `R` Rounds.
A Round contains `S` spins.
-------------------------------------------------*/

export type Grid<T> = T[][];

export type RoundMode = 'safe' | 'risky';

export interface EnemyState {
    id: string;
    name: string;
    maxHP: number;
    currentHP: number;
    effects: Modifier[];
}

export interface FightOutcome {
    success: boolean;
    ticketsEarned: number;
    totalCredits: number;
    heatEnd: number;
    log: string[];
}

export type RoundState = {
    phase: 'awaitingChoice' | 'active' | 'resolved';
    spinsRemaining: number;
    roundMode: RoundMode;
    creditsThisRound: number;
    heatThisRound: number;
}

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

/*--------------------
Spins
----------------------*/

export type SpinState = 'preSpin' | 'spinning' | 'slowing' | 'preScore' | 'scoring' | 'postScore' | 'logging';

export interface ReelState {
    strip: IconId[];
    position: number;
    offsetPx: number;
    velocity: number;
    isStopped: boolean;
    finalIndex?: number;
    finalIcon?: IconId;
    previewIcon?: IconId;
    spinStartTime?: number;
    stopRequestedAt?: number;
}

export interface SpinSession {
    reels: ReelState[];
    status: SpinState;
    activeReelIndex: number;
    startAt: number;
    deadline: number;
    spinResult?: SpinResult;
}

export interface SpinResult {
  grid: Grid<IconId>;   
  payout: number;       
  components?: PayoutComponent[]; 
  patterns?: WinPattern[];
}

export interface PayoutComponent {
    description: string;
    amount: number;
}

export type PatternFamily = FamilyShape | string;
export type PatternId = string;


/*------------------------------------------------------------------------Macine Related-----------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/
export type HeatTier = 'Cold' | 'WarmedUp' | 'OnFire' | 'BurningUp' | 'Breakdown';



export interface MachineSpec {
    id: string;
    name: string;
    gridWidth: number;
    gridHeight: number;
    reelLength: number;
    inheritDefaults: boolean;
    poolAdjustments?: {
        overrides?: Record<IconId, number>;
        deltas?: Record<IconId, number>;
    };
    warmUpThreshold: number;
    warmedUpBonus: Modifier[];
    onFireThreshold: number;
    onFireBonus: Modifier[];
    burningUpBonus: Modifier[];
    burningUpPenalty: Modifier[];
    breakdownBonus: Modifier[];
    breakdownPenalty: Modifier[];
    baseHeatScalar: number;
    heatNormalizer: number;
    exclude?: IconId[];
    patternIds: PatternId[];
    themeColor?: string;
}

export function isMachineConfig(mach: unknown, validPatternIds?: Set<PatternId>): mach is MachineSpec {
    if (!isRecord(mach)) return false;

    const m = mach as Record<string, unknown>;
    const ICON_SET = new Set<IconId>(ICONS);

    if (typeof m.id !== 'string'  || typeof m.name !== 'string') return false; // check id and name
    if (!isPositiveInteger(m.gridWidth) || !isPositiveInteger(m.gridHeight)) return false; //check that height and width are >= 1
    if (!isPositiveInteger(m.reelLength) || m.reelLength < m.gridHeight) return false; // check that reel length is >= 1 and is at least as large as grid Height
    if (typeof m.inheritDefaults !== 'boolean') return false; //inherit defaults is a boolean
    if (!isFiniteNonNegativeNumber(m.warmUpThreshold)) return false; // check that warmup Threshold is a zero or positive value
    if (!isFinitePositiveNumber(m.onFireThreshold) || m.onFireThreshold <= m.warmUpThreshold) return false; // verify that On Fire is positive AND larger than Warmed Up
    if (!isFinitePositiveNumber(m.baseHeatScalar)) return false;
    if (!isFinitePositiveNumber(m.heatNormalizer)) return false;
    
    if (
        !Array.isArray(m.patternIds) ||
        m.patternIds.some((id) => {
            if (typeof id !== 'string') return true;
            if (validPatternIds && validPatternIds.size > 0) {
                return !validPatternIds.has(id as PatternId);
            }
            return false;
        })
    ) {
        return false;
    }

    if ('exclude' in m) {
        if (
            !Array.isArray(m.exclude) ||
            m.exclude.some((id) => typeof id !== 'string' || !ICON_SET.has(id as IconId))
        ) {
            return false;
        }
    }



    const validateIconMap = (value: unknown): value is Record<IconId, number> =>
        isRecord(value) && Object.keys(value).every((key) => ICON_SET.has(key as IconId) && isFiniteNumber(value[key]));

    if (m.poolAdjustments) {
        if (!isRecord(m.poolAdjustments)) return false;
        const { overrides, deltas } = m.poolAdjustments;
        if (overrides && !validateIconMap(overrides)) return false;
        if (deltas && !validateIconMap(deltas)) return false;
    }

    const validateModifier = (mod: unknown): mod is Modifier => {
        if (!isRecord(mod) || typeof mod.type !== 'string') return false;

        switch (mod.type) {
            case 'iconBaseDelta':
            case 'iconWeightDelta':
            case 'iconWeightPercentageDelta': {
                if (!isRecord(mod.target)) return false;
                const { iconId, tag } = mod.target as Record<string, unknown>;
                if (!iconId && !tag) return false;
                if (iconId && !ICON_SET.has(iconId as IconId)) return false;
                const valueKey = mod.type === 'iconWeightPercentageDelta' ? 'ppDelta' : 'delta';
                return isFiniteNumber(mod[valueKey]);
            }
            case 'patternMultiplier': {
                const { patternId, family } = (mod.target ?? {}) as Record<string, unknown>;
                if (!patternId && !family) return false;
                if (patternId) {
                    if (typeof patternId !== 'string') return false;
                    if (validPatternIds && validPatternIds.size > 0 && !validPatternIds.has(patternId as PatternId)) {
                        return false;
                    }
                }
                if (family && typeof family !== 'string') return false;
                return isFiniteNumber(mod.newMult);
            }
            case 'basePayoutPercentage':
            return isFinitePositiveNumber(mod.flat);
            case 'heatGainScale':
            return isFinitePositiveNumber(mod.scale);
            default:
            return false;
        }
    };

    const validateModifierArray = (value: unknown) =>
    Array.isArray(value) && value.every((entry) => validateModifier(entry));

    if (
        !validateModifierArray(m.warmedUpBonus) ||
        !validateModifierArray(m.onFireBonus) ||
        !validateModifierArray(m.burningUpBonus) ||
        !validateModifierArray(m.burningUpPenalty) ||
        !validateModifierArray(m.breakdownBonus) ||
        !validateModifierArray(m.breakdownPenalty)
    ) return false;

    const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
    if (m.themeColor !== undefined) {
        if (typeof m.themeColor !== 'string' || !HEX_COLOR_RE.test(m.themeColor)) {
            return false;
        }
    }

    
  return true;
}

export interface MachineFinal {
        id: string;
    name: string;
    gridWidth: number;
    gridHeight: number;
    reelLength: number;
    inheritDefaults: boolean;
    poolAdjustments?: {
        overrides?: Record<IconId, number>;
        deltas?: Record<IconId, number>;
    };
    warmUpThreshold: number;
    warmedUpBonus: Modifier[];
    onFireThreshold: number;
    onFireBonus: Modifier[];
    burningUpBonus: Modifier[];
    burningUpPenalty: Modifier[];
    breakdownBonus: Modifier[];
    breakdownPenalty: Modifier[];
    baseHeatScalar: number;
    heatNormalizer: number;
    exclude?: IconId[];
    patternIds: PatternId[];
    themeColor?: string;
}

/*---------------------------------------------------------------------Manipulators----------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/

export type Modifier =
  | { type: 'iconBaseDelta'; target: { iconId?: IconId; tag?: string }; delta: number }
  | { type: 'patternMultiplier'; target: { patternId?: string; family?: PatternFamily }; newMult: number }
  | { type: 'basePayoutPercentage'; flat: number }
  | { type: 'heatGainScale'; family?: PatternFamily; scale: number }
  | { type: 'iconWeightDelta'; target: { iconId?: IconId; tag?: string }; delta: number }
  | { type: 'iconWeightPercentageDelta'; target: { iconId?: IconId; tag?: string }; ppDelta: number }

  

/*-------------------------------------------------------------------RNG-Gen-----------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/

export type RNGSeed = number | string;

export interface RNG {
  next(): number;
  setSeed(seed: RNGSeed): void;
}

/*-------------------------------------------------------------------Run-State---------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/

export interface Difficulty {
    id: string;
    name: string;
    mapLength: number;
    difficultyMult: number;
    baseTicketsPerWin: number;
    contractMult: number;
    unlockFlag?: string[];
}

export interface RunState  {
    runId: number;
    machineId: number;
    difficultyId: number;
    seed: number;
    currentNodeId: number;
    tickets: Tickets;
    contracts: Contracts;
    health: number;
    heatState: HeatTier;
    heatValue: number;
    totalCredits: number;
    log: string[];
}


/*--------------------------------------------------------------------Save/Load/Persistence--------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/

export interface PlayerProfile {
  version: '0.1.0';
  name: string;
  stats: {
    totalRuns: number;
    totalCreditsEarned: number;
    bestRunMap: number;
    bestRunNode: number;
    bestRunCredits: number;
  };
  lastRunAt?: number | null;
}


/*-------------------------------------------------------------------Shop Related-----------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/

export interface ShopSpec {
    id: string;
    name: string;
    description: string;
    items: ShopStockItem[];
}

export interface ShopStockItem {
    id: string;
    name: string;
    description: string;
    effects: Modifier[];
}


/*-------------------------------------------------------------------State Related-----------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/

export type Cell = {
    r: number;
    c: number;
}

export type FamilyShape = 'horizontal' | 'vertical' | 'diagonal' | 'square' | 'plus' | 'corner' | 'chevron';
/*----
Custom Win Patterns Flow

In your WinPattern entry, set kind: 'custom' and provide a required shapeId.
Keep a separate JSON (e.g., customShapes.json) keyed by those shapeId values, each storing the data your detector needs (mask matrix, offsets, any sizing hints).
When you load the machine config, validate that every custom pattern’s shapeId exists in the shapes table.
At runtime, the scoring system switches on pattern.kind: for line/mask/path it uses the generic logic; for custom it looks up the shapeId, pulls the shape data, and applies the bespoke handler (which can generate offsets or masks dynamically using the machine’s grid dimensions).
The result is a data-driven pipeline: add new shapes by adding a JSON entry + handler, and your WinPattern schema stays stable.
*/
export interface ScoringPattern {
    id: PatternId;
    name?: string;
    kind: 'line' | 'mask' | 'path' | 'custom';
    shapeId?: string;
    family: PatternFamily;
    familyShape?: FamilyShape;
    multiplier: number;
    mask?: number[][];
    offsets?: Array<{dx: number; dy: number }>;
    length?: number;
    constraints?: {
        minWidth?: number;
        maxWidth?: number;
        minHeight?: number;
        maxHeight?: number;
    };
}

export interface WinPattern {
    type: FamilyShape;
    multiplier: number;
    cells: Cell[];
    icons: IconId[];
}


/*-----------------------------------------------UI-Handlers---------------------------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/

export interface ReelView {
  render(grid: Grid<IconId>): void;       
  animate?(grid: Grid<IconId>): Promise<void>;
}


/*---------------------------------------------------------------------Helper-Functions------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isFinitePositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
