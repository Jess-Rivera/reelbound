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
    defaultAmount?: number;  
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

export type MachineConfigValidationResult =
  | { ok: true; value: MachineSpec }
  | { ok: false; error: string };

export function validateMachineConfig(
  mach: unknown,
  validPatternIds?: Set<PatternId>
): MachineConfigValidationResult {
  if (!isRecord(mach)) {
    return { ok: false, error: 'Machine config must be an object' };
  }

  const m = mach as Record<string, unknown>;
  const ICON_SET = new Set<IconId>(ICONS);

  if (typeof m.id !== 'string') {
    return { ok: false, error: 'Machine config must include a string id' };
  }

  const machineId = m.id;

  if (typeof m.name !== 'string') {
    return { ok: false, error: `Machine ${machineId}: name must be a string` };
  }
  if (!isPositiveInteger(m.gridWidth)) {
    return { ok: false, error: `Machine ${machineId}: gridWidth must be a positive integer` };
  }
  if (!isPositiveInteger(m.gridHeight)) {
    return { ok: false, error: `Machine ${machineId}: gridHeight must be a positive integer` };
  }
  if (!isPositiveInteger(m.reelLength) || (typeof m.gridHeight === 'number' && m.reelLength < m.gridHeight)) {
    return {
      ok: false,
      error: `Machine ${machineId}: reelLength must be a positive integer at least as large as gridHeight`
    };
  }
  if (typeof m.inheritDefaults !== 'boolean') {
    return { ok: false, error: `Machine ${machineId}: inheritDefaults must be a boolean` };
  }
  if (!isFiniteNonNegativeNumber(m.warmUpThreshold)) {
    return { ok: false, error: `Machine ${machineId}: warmUpThreshold must be a non-negative number` };
  }
  if (!isFinitePositiveNumber(m.onFireThreshold)) {
    return { ok: false, error: `Machine ${machineId}: onFireThreshold must be a positive number` };
  }
  if (Number(m.onFireThreshold) <= Number(m.warmUpThreshold)) {
    return {
      ok: false,
      error: `Machine ${machineId}: onFireThreshold must be greater than warmUpThreshold`
    };
  }
  if (!isFinitePositiveNumber(m.baseHeatScalar)) {
    return { ok: false, error: `Machine ${machineId}: baseHeatScalar must be a positive number` };
  }
  if (!isFinitePositiveNumber(m.heatNormalizer)) {
    return { ok: false, error: `Machine ${machineId}: heatNormalizer must be a positive number` };
  }

  if (!Array.isArray(m.patternIds)) {
    return { ok: false, error: `Machine ${machineId}: patternIds must be an array` };
  }
  for (let i = 0; i < m.patternIds.length; i++) {
    const patternId = m.patternIds[i];
    if (typeof patternId !== 'string') {
      return {
        ok: false,
        error: `Machine ${machineId}: patternIds[${i}] must be a string`
      };
    }
    if (validPatternIds && validPatternIds.size > 0 && !validPatternIds.has(patternId as PatternId)) {
      return {
        ok: false,
        error: `Machine ${machineId}: patternIds[${i}] "${patternId}" is not defined in the pattern table`
      };
    }
  }

  if ('exclude' in m) {
    if (!Array.isArray(m.exclude)) {
      return { ok: false, error: `Machine ${machineId}: exclude must be an array` };
    }
    for (let i = 0; i < m.exclude.length; i++) {
      const icon = m.exclude[i];
      if (typeof icon !== 'string' || !ICON_SET.has(icon as IconId)) {
        return {
          ok: false,
          error: `Machine ${machineId}: exclude[${i}] "${String(icon)}" is not a recognised icon id`
        };
      }
    }
  }

  const describeIconMap = (value: unknown, label: string): string | null => {
    if (!isRecord(value)) {
      return `${label} must be an object whose keys are icon ids and values are numbers`;
    }
    for (const key of Object.keys(value)) {
      if (!ICON_SET.has(key as IconId)) {
        return `${label} uses unknown icon id "${key}"`;
      }
      if (!isFiniteNumber(value[key])) {
        return `${label} entry for "${key}" must be a finite number`;
      }
    }
    return null;
  };

  if (m.poolAdjustments !== undefined) {
    if (!isRecord(m.poolAdjustments)) {
      return { ok: false, error: `Machine ${machineId}: poolAdjustments must be an object` };
    }
    const pa = m.poolAdjustments as Record<string, unknown>;
    if (pa.overrides !== undefined) {
      const error = describeIconMap(pa.overrides, 'poolAdjustments.overrides');
      if (error) {
        return { ok: false, error: `Machine ${machineId}: ${error}` };
      }
    }
    if (pa.deltas !== undefined) {
      const error = describeIconMap(pa.deltas, 'poolAdjustments.deltas');
      if (error) {
        return { ok: false, error: `Machine ${machineId}: ${error}` };
      }
    }
  }

  const validateModifier = (mod: unknown, path: string): string | null => {
    if (!isRecord(mod) || typeof mod.type !== 'string') {
      return `${path} must be an object with a string "type"`;
    }

    switch (mod.type) {
      case 'iconBaseDelta':
      case 'iconWeightDelta':
      case 'iconWeightPercentageDelta': {
        if (!isRecord(mod.target)) {
          return `${path}: target must be an object with iconId and/or tag`;
        }
        const target = mod.target as Record<string, unknown>;
        const { iconId, tag } = target;
        if (!iconId && !tag) {
          return `${path}: target must include iconId or tag`;
        }
        if (iconId) {
          if (typeof iconId !== 'string' || !ICON_SET.has(iconId as IconId)) {
            return `${path}: target.iconId "${String(iconId)}" is not recognised`;
          }
        }
        const valueKey = mod.type === 'iconWeightPercentageDelta' ? 'ppDelta' : 'delta';
        if (!isFiniteNumber((mod as Record<string, unknown>)[valueKey])) {
          return `${path}: ${valueKey} must be a finite number`;
        }
        return null;
      }
      case 'patternMultiplier': {
        const target = (mod.target ?? {}) as Record<string, unknown>;
        const { patternId, family } = target;
        if (!patternId && !family) {
          return `${path}: target must include patternId or family`;
        }
        if (patternId !== undefined) {
          if (typeof patternId !== 'string') {
            return `${path}: target.patternId must be a string`;
          }
          if (validPatternIds && validPatternIds.size > 0 && !validPatternIds.has(patternId as PatternId)) {
            return `${path}: patternId "${patternId}" is not defined in the pattern table`;
          }
        }
        if (family !== undefined && typeof family !== 'string') {
          return `${path}: target.family must be a string`;
        }
        if (!isFiniteNumber((mod as Record<string, unknown>).newMult)) {
          return `${path}: newMult must be a finite number`;
        }
        return null;
      }
      case 'basePayoutPercentage': {
        if (!isFinitePositiveNumber((mod as Record<string, unknown>).flat)) {
          return `${path}: flat must be a positive number`;
        }
        return null;
      }
      case 'heatGainScale': {
        if (!isFinitePositiveNumber((mod as Record<string, unknown>).scale)) {
          return `${path}: scale must be a positive number`;
        }
        if (
          (mod as Record<string, unknown>).family !== undefined &&
          typeof (mod as Record<string, unknown>).family !== 'string'
        ) {
          return `${path}: family must be a string if provided`;
        }
        return null;
      }
      default:
        return `${path}: unsupported modifier type "${mod.type}"`;
    }
  };

  const requireModifierArray = (value: unknown, label: string): string | null => {
    if (!Array.isArray(value)) {
      return `${label} must be an array`;
    }
    for (let i = 0; i < value.length; i++) {
      const error = validateModifier(value[i], `${label}[${i}]`);
      if (error) {
        return error;
      }
    }
    return null;
  };

  const modifierArrays: Array<[unknown, string]> = [
    [m.warmedUpBonus, 'warmedUpBonus'],
    [m.onFireBonus, 'onFireBonus'],
    [m.burningUpBonus, 'burningUpBonus'],
    [m.burningUpPenalty, 'burningUpPenalty'],
    [m.breakdownBonus, 'breakdownBonus'],
    [m.breakdownPenalty, 'breakdownPenalty']
  ];

  for (const [value, label] of modifierArrays) {
    const error = requireModifierArray(value, label);
    if (error) {
      return { ok: false, error: `Machine ${machineId}: ${error}` };
    }
  }

  const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
  if (m.themeColor !== undefined) {
    if (typeof m.themeColor !== 'string' || !HEX_COLOR_RE.test(m.themeColor)) {
      return { ok: false, error: `Machine ${machineId}: themeColor must be a valid hex color string` };
    }
  }

  const typedMachine = m as unknown as MachineSpec;
  return { ok: true, value: typedMachine };
}

export function isMachineConfig(mach: unknown, validPatternIds?: Set<PatternId>): mach is MachineSpec {
  return validateMachineConfig(mach, validPatternIds).ok;
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
