/* ---------------------------------------------------------
   Slotspire Engine Types
   Keep data (what things are) separate from logic (what they do)
   --------------------------------------------------------- */

/* ---------- Miscellaneous ---------- */
export type Difficulty = 'easy' | 'medium' | 'hard' | 'extreme';
export type RoundMode = 'safe' | 'risky';

/* ---------- Canonical Icons ---------- */
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

/* Generic NxM grid helpers */
export type Grid<T> = T[][];
export type Cell = { r: number; c: number };

/* ---------- RNG contract ---------- */
//  Seed can be number or string for convenience
export type RNGSeed = number | string;
//  Simple RNG interface (e.g. for slot reels)
export interface RNG {
  /** Returns a float in [0, 1) */
  next(): number;
  /** Set/reset the seed for determinism */
  setSeed(seed: RNGSeed): void;
}


/* ---------- Icon classification ---------- */
export type IconCategory =
  | 'fruit'
  | 'gem'
  | 'wild'
  | 'hazard'
  | 'machine'
  | 'token';

export type IconSubgroup =
  | 'citrus'
  | 'berry'
  | 'tropical'
  | 'seed'
  | 'precious'
  | 'synthetic'
  | 'none';

export type Material = 
  |'organic' 
  | 'mineral' 
  | 'metal' 
  | 'glass' 
  | 'ethereal' 
  | 'unknown';

export type CorruptionType = 
  |'none' 
  | 'glimmer' 
  | 'rot' 
  | 'static' 
  | 'ashen' 
  | 'void';

export type Rarity = 
  |'common' 
  | 'uncommon' 
  | 'rare' 
  | 'epic' 
  | 'legendary' 
  | 'mythic';

export type SynergyGroup =
  | 'fruit_set'
  | 'gem_set'
  | 'heat_booster'
  | 'near_miss_helper'
  | 'corruption_engine'
  | 'none';

/** Free-form aspects (allow arbitrary future tags) */
export type AspectTag =
  | 'flammable'
  | 'conductive'
  | 'juicy'
  | 'brittle'
  | 'volatile'
  | 'cursed'
  | 'sweet'
  | 'sour'
  | 'lucky'
  | string;

/* ---------- Effects (data-driven) ---------- */
//  When the effect triggers
export type EffectHook = 
  | 'on_spin' 
  | 'on_win' 
  | 'on_pattern' 
  | 'on_heat_stage';

//  Different kinds of effects
export type Effect =
  | {
      kind: 'add_multiplier';
      hook: EffectHook;
      amount: number; // e.g., +0.15
      appliesTo?: IconCategory | IconSubgroup | SynergyGroup;
    }
  | {
      kind: 'add_payout';
      hook: EffectHook;
      amount: number; // flat credits
    }
  | {
      kind: 'bias_icon';
      hook: EffectHook;
      target: IconId;
      weightDelta: number; // ±weight change
    }
  | {
      kind: 'add_heat';
      hook: EffectHook;
      amount: number; // heat units
    }
  | {
      kind: 'convert_icon';
      hook: EffectHook;
      from: IconId | IconCategory;
      to: IconId;
      chance?: number; // 0..1
    }
  | {
      kind: 'custom';
      hook: EffectHook;
      payload: Record<string, unknown>;
    };
//  Effective icon info after applying machine overrides
export interface EffectiveIconInfo {
  id: IconId;
  weight: number;
  basemult: number;
  effects: Effect[];
}

/* ---------- Icon metadata ---------- */
//  Complete metadata for a single icon
export type IconMeta = {
  id: string;
  category: string;
  subgroup: string;
  basemult: number;
  material: string;
  aspects: string[];
  corruptionType: string;
  rarity: string;
  synergyGroup: string;
  effects: any[];
  spriteUrl: string;
};

export type IconMetaTable = Record<string, IconMeta>;

/* ---------- Machine config (JSON-driven) ---------- */
export interface IconOverride {
  basemult?: number;                 // tweak base mult for this machine
  rarity?: Rarity;                   // cosmetic / drop signalling
  weight?: number;                   // convenience weight override
  addEffects?: Effect[];             // add machine-specific effects
  removeEffectsKinds?: Effect['kind'][]; // strip certain effect kinds
}

// Full machine config as parsed from JSON
export interface MachineConfig {
  id: string;
  name: string;
  gridWidth: number;
  gridHeight: number;
  reelLength: number;                  // base health for this machine
  totalHeat: number; 
  HP: number;            // heat capacity for this machine
  onFireCurvepp: number;
  corruptionpp: number;      // heat stage thresholds

  // If true, start from a global default pool and then apply overrides/excludes.
  inheritDefaults?: boolean;   // default: false
  defaultNewIconWeight?: number; // default: 0
  weightDeltas?: Partial<Record<IconId, number>>;
  // Ban specific icons even if they exist in defaults.
  exclude?: IconId[];

  overrides?: Partial<Record<IconId, IconOverride>>;

  // Absolute weight overrides for specific icons (partial).
  pool?: Partial<Record<IconId, number>>;

  themeColor?: string;
  volatility?: number;
  extras?: Record<string, unknown>;
}



/** Runtime guard for parsed machine JSON */
//  (does not check cross-field consistency)
export function isMachineConfig(x: unknown): x is MachineConfig {
  // Basic shape checks
    if (!isRecord(x)) return false;
  const o = x as Record<string, unknown>;
  // Required fields
  if (typeof o.id !== 'string' || typeof o.name !== 'string') return false;
  //  Grid dimensions
  if (!isPositiveInteger(o.gridWidth) || !isPositiveInteger(o.gridHeight)) return false;
  if (!isPositiveInteger(o.reelLength)) return false;
  if (!isPositiveInteger(o.HP)) return false;
  if (!isFiniteNonNegativeNumber(o.totalHeat)) return false;
  if (!isFiniteNonNegativeNumber(o.onFireCurvepp)) return false;
  if (!isFiniteNonNegativeNumber(o.corruptionpp)) return false;

  // Optional fields
  if ('inheritDefaults' in o && o.inheritDefaults !== undefined && typeof o.inheritDefaults !== 'boolean') {
    return false;
  }
  //  defaultNewIconWeight
  if (
    'defaultNewIconWeight' in o &&
    o.defaultNewIconWeight !== undefined &&
    !isFiniteNonNegativeNumber(o.defaultNewIconWeight)
  ) {
    return false;
  }
  //  themeColor
  if ('themeColor' in o && o.themeColor !== undefined && typeof o.themeColor !== 'string') {
    return false;
  }
  //  volatility
  if ('volatility' in o && o.volatility !== undefined && !isFiniteNonNegativeNumber(o.volatility)) {
    return false;
  }
  //  pool
  if ('pool' in o && o.pool !== undefined) {
    if (!isRecord(o.pool)) return false;
    for (const [k, v] of Object.entries(o.pool)) {
      if (!isIconId(k)) return false;
      if (!isFinitePositiveNumber(v)) return false;
    }
  }
  //  weightDeltas
  if ('weightDeltas' in o && o.weightDeltas !== undefined) {
    if (!isRecord(o.weightDeltas)) return false;
    for (const [k, v] of Object.entries(o.weightDeltas)) {
      if (!isIconId(k)) return false;
      if (!isFiniteNumber(v)) return false;
    }
  }
    //  exclude
  if ('exclude' in o && o.exclude !== undefined) {
    if (!Array.isArray(o.exclude) || !o.exclude.every(isIconId)) return false;
  }
    //  overrides
  if ('overrides' in o && o.overrides !== undefined) {
    if (!isRecord(o.overrides)) return false;
    for (const [k, v] of Object.entries(o.overrides)) {
      if (!isIconId(k) || !isIconOverride(v)) return false;
    }
  }
    //  extras
  if ('extras' in o && o.extras !== undefined) {
    if (!isRecord(o.extras)) return false;
  }

  return true;
}

//  Machine info after applying defaults and overrides
export interface MachineRuntime {
  id: string;
  name: string;
  gridWidth: number;
  gridHeight: number;
  reelLength: number;
  totalHeat: number;
  HP: number;
  onFireCurvepp: number;
  corruptionpp: number;
  icons: Record<IconId, EffectiveIconInfo>;
  themeColor?: string;
  volatility?: number;
  extras?: Record<string, unknown>;
}

/* -------------------------------------------------------
   Machine Unlocks: per-machine state, timestamps, badges
   ------------------------------------------------------- */

export type UnlockState = 'locked' | 'unlocked';

/** One machine's unlock info */
export interface MachineUnlockEntry {
  state: UnlockState;      // locked | unlocked
  discoveredAt?: number;   // epoch ms when THIS machine was first unlocked
  isNew?: boolean;         // show "NEW" badge in UI until acknowledged
  unlockHint?: string;     // optional hint text for locked machines
}

/** Registry of all machines, keyed by machineId */
export type MachineUnlockRegistry = Record<string, MachineUnlockEntry>;

/** UI option for a selection list (convenience shape) */
export interface MachineSelectionOption {
  id: string;                  // machine id (cfg.id)
  config: MachineConfig;       // machine config
  state: UnlockState;          // convenience mirror of entry.state
  isNew?: boolean;             // convenience mirror of entry.isNew
  discoveredAt?: number;       // convenience mirror of entry.discoveredAt
  unlockHint?: string;         // convenience mirror of entry.unlockHint
}

/* ---------------------------
   Tiny convenience utilities
   --------------------------- */

/** Ensure an entry exists; create a default locked one if missing (MUTATES registry) */
export function ensureMachineEntry(
  reg: MachineUnlockRegistry,
  id: string
): MachineUnlockEntry {
  if (!reg[id]) reg[id] = { state: 'locked' };
  return reg[id];
}

/** Read helpers */
export function getUnlockEntry(
  reg: MachineUnlockRegistry,
  id: string
): MachineUnlockEntry | undefined {
  return reg[id];
}

export function getUnlockState(
  reg: MachineUnlockRegistry,
  id: string
): UnlockState {
  return reg[id]?.state ?? 'locked';
}

export function isMachineUnlocked(
  reg: MachineUnlockRegistry,
  id: string
): boolean {
  return getUnlockState(reg, id) === 'unlocked';
}

/** Mark as unlocked. If first time, set discoveredAt and isNew=true (MUTATES registry) */
export function markUnlocked(
  reg: MachineUnlockRegistry,
  id: string,
  now: number = Date.now()
): void {
  const entry = ensureMachineEntry(reg, id);
  if (entry.state !== 'unlocked') {
    entry.state = 'unlocked';
    if (!entry.discoveredAt) entry.discoveredAt = now;
    entry.isNew = true;
  }
}

/** Mark as locked (MUTATES registry) */
export function markLocked(
  reg: MachineUnlockRegistry,
  id: string
): void {
  const entry = ensureMachineEntry(reg, id);
  entry.state = 'locked';
  // keep discoveredAt for history; remove if you want a hard reset:
  // entry.discoveredAt = undefined;
  entry.isNew = false;
}

/** Clear the "NEW" badge once shown (MUTATES registry) */
export function acknowledgeNewBadge(
  reg: MachineUnlockRegistry,
  id: string
): void {
  const entry = ensureMachineEntry(reg, id);
  entry.isNew = false;
}

/** Optional: set or update a hint (MUTATES registry) */
export function setUnlockHint(
  reg: MachineUnlockRegistry,
  id: string,
  hint?: string
): void {
  const entry = ensureMachineEntry(reg, id);
  entry.unlockHint = hint;
}

/** Build a list of selection options for the UI from configs + registry */
export function buildSelectionOptions(
  configs: MachineConfig[],
  reg: MachineUnlockRegistry
): MachineSelectionOption[] {
  return configs.map(cfg => {
    const e = reg[cfg.id];
    return {
      id: cfg.id,
      config: cfg,
      state: e?.state ?? 'locked',
      isNew: e?.isNew,
      discoveredAt: e?.discoveredAt,
      unlockHint: e?.unlockHint,
    };
  });
}

/* ---------------------------------------
   Immutable variants (if you prefer immutability)
   --------------------------------------- */

export function markUnlockedImmutable(
  reg: MachineUnlockRegistry,
  id: string,
  now: number = Date.now()
): MachineUnlockRegistry {
  const prev = reg[id];
  const firstTime = !prev || prev.state !== 'unlocked';
  const entry: MachineUnlockEntry = {
    state: 'unlocked',
    discoveredAt: prev?.discoveredAt ?? (firstTime ? now : prev?.discoveredAt),
    isNew: firstTime ? true : (prev?.isNew ?? false),
    unlockHint: prev?.unlockHint,
  };
  return { ...reg, [id]: entry };
}

export function acknowledgeNewBadgeImmutable(
  reg: MachineUnlockRegistry,
  id: string
): MachineUnlockRegistry {
  const prev = reg[id] ?? { state: 'locked' as UnlockState };
  return { ...reg, [id]: { ...prev, isNew: false } };
}


/* ---------- Roguelike runtime state ---------- */
export interface EnemyState {
  id: string;
  name: string;
  maxHP: number;
  currentHP: number;
  corruption?: CorruptionType;
  statusEffects?: string[];
}

export interface MachineState {
  machine: MachineRuntime;
  currentGrid: Grid<IconId>;
  credits: number;
  heat: number;
  spinCount: number;
  activeEffects: Effect[];
}

export interface RunProgress {
  day: number;
  encounterIndex: number;
  totalCreditsEarned: number;
  machineState: MachineState;
  enemyState: EnemyState;
  log?: UIMessage[];
}

export interface PlayerProfile {
  version: 1;
  name: string;
  unlockedMachines: MachineUnlockRegistry;
  stats: {
    totalRuns: number;
    totalCreditsEarned: number;
    bestRunMap: number;
    bestRunNode: number;
    bestRunCredits: number;
  };
  lastRunAt?: number | null;
}

/* ---------- Manual Spin Contracts ---------- */

export interface ManualSpinSession {
 reels: ManualReelState[];
 status: `idle` | `spinning` | `stopping` | `complete` | `timed_out`;
 activeReelIndex: number;
 startAt: number;
 deadline: number;
 spinResult?: SpinResult;
}

export interface ManualReelState {
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

/* ---------- Spin result & patterns ---------- */
export type PatternType = 'line' | 'diagonal' | 'corner' | 'angle' | 'triangle' | 'square' | 'plus' | 'fullhouse';  // etc.

// One winning pattern found in a spin result
export interface WinPattern {
  type: PatternType;
  multiplier: number;   // contribution from this pattern
  cells: Cell[];        // which cells formed it (for highlight)
  icons: IconId[];      // convenience for UI/debug
}
//  One component of a payout (for detailed breakdown)
export interface PayoutComponent {
  description: string;  // e.g., "3 Cherries"
  amount: number;       // credits contributed
}
// Result of a single spin
export interface SpinResult {
  grid: Grid<IconId>;   // N×N icon grid
  payout: number;       // base credits before higher-level scaling
  components?: PayoutComponent[]; // detailed breakdown
  patterns?: WinPattern[];
}

/* ---------- Round / HUD contracts ---------- */
// Game state info for HUD display
// (also passed to UIBridge.update)
export interface HUDState {
  round: number;        // 1..3
  spinsLeft: number;
  enemyHP: number;
  credits: number;
  lastPayout: number;
}
//  Fight configuration (immutable during a fight)
export interface FightConfig {
  enemyHP: number;
  difficulty: Difficulty;
  rounds: number;           // usually 3
  safeSpins: number;        // 6
  riskySpins: number;       // 2
}
//  Messages to show in the UI
export interface UIMessage {
  kind: 'info' | 'warn' | 'victory' | 'defeat';
  text: string;
}


/* ---------- “Handshake” interfaces between modules ---------- */
//  Reel view (UI) contract
export interface ReelView {
  render(grid: Grid<IconId>): void;            // immediate draw
  animate?(grid: Grid<IconId>): Promise<void>; // optional tween
}
//  UI <-> Engine bridge
export interface UIBridge {
  update(state: HUDState): void;
  setButtonsEnabled(enabled: boolean): void;
  onSpin(handler: () => void): void;
  onChooseSafe(handler: () => void): void;
  onChooseRisky(handler: () => void): void;
}

/* ---------- Small helpers ---------- */
// Runtime guard for IconId
export function isIconId(v: unknown): v is IconId {
  return typeof v === 'string' && (ICONS as readonly string[]).includes(v);
}

const EFFECT_HOOKS: ReadonlySet<EffectHook> = new Set(['on_spin', 'on_win', 'on_pattern', 'on_heat_stage']);
const EFFECT_KINDS: ReadonlySet<Effect['kind']> = new Set([
  'add_multiplier',
  'add_payout',
  'bias_icon',
  'add_heat',
  'convert_icon',
  'custom'
]);
const ICON_CATEGORIES: ReadonlySet<IconCategory> = new Set([
  'fruit',
  'gem',
  'wild',
  'hazard',
  'machine',
  'token'
]);
const ICON_SUBGROUPS: ReadonlySet<IconSubgroup> = new Set([
  'citrus',
  'berry',
  'tropical',
  'seed',
  'precious',
  'synthetic',
  'none'
]);
const SYNERGY_GROUPS: ReadonlySet<SynergyGroup> = new Set([
  'fruit_set',
  'gem_set',
  'heat_booster',
  'near_miss_helper',
  'corruption_engine',
  'none'
]);
const RARITIES: ReadonlySet<Rarity> = new Set([
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'mythic'
]);

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

function isIconOverride(value: unknown): value is IconOverride {
  if (!isRecord(value)) return false;

  const override = value as Record<string, unknown>;

  if ('basemult' in override && override.basemult !== undefined && !isFiniteNumber(override.basemult)) {
    return false;
  }

  if ('rarity' in override && override.rarity !== undefined && !isRarity(override.rarity)) {
    return false;
  }

  if ('weight' in override && override.weight !== undefined && !isFinitePositiveNumber(override.weight)) {
    return false;
  }

  if ('addEffects' in override && override.addEffects !== undefined) {
    if (!Array.isArray(override.addEffects) || !override.addEffects.every(isEffect)) {
      return false;
    }
  }

  if ('removeEffectsKinds' in override && override.removeEffectsKinds !== undefined) {
    if (
      !Array.isArray(override.removeEffectsKinds) ||
      !override.removeEffectsKinds.every(
        (k) => typeof k === 'string' && EFFECT_KINDS.has(k as Effect['kind'])
      )
    ) {
      return false;
    }
  }

  return true;
}

function isEffect(value: unknown): value is Effect {
  if (!isRecord(value)) return false;

  const record = value as Record<string, unknown>;
  const { kind, hook } = record as { kind?: unknown; hook?: unknown };
  if (typeof kind !== 'string' || !EFFECT_KINDS.has(kind as Effect['kind'])) return false;
  if (typeof hook !== 'string' || !EFFECT_HOOKS.has(hook as EffectHook)) return false;

  switch (kind) {
    case 'add_multiplier': {
      if (!isFiniteNumber(record.amount)) return false;
      if (
        'appliesTo' in record &&
        record.appliesTo !== undefined &&
        !isCategoryLike(record.appliesTo)
      ) {
        return false;
      }
      return true;
    }
    case 'add_payout':
    case 'add_heat':
      return isFiniteNumber(record.amount);
    case 'bias_icon':
      return isIconId(record.target) && isFiniteNumber(record.weightDelta);
    case 'convert_icon': {
      if (!isIconId(record.to)) return false;
      if (!('from' in record)) return false;

      const from = record.from;
      if (!isIconId(from) && !isIconCategory(from)) return false;

      if ('chance' in record && record.chance !== undefined) {
        const chance = record.chance;
        if (!isFiniteNonNegativeNumber(chance)) return false;
        if (chance > 1) return false;
      }

      return true;
    }
    case 'custom':
      return 'payload' in record && isRecord(record.payload);
    default:
      return false;
  }
}

function isCategoryLike(value: unknown): value is IconCategory | IconSubgroup | SynergyGroup {
  return isIconCategory(value) || isIconSubgroup(value) || isSynergyGroup(value);
}

function isIconCategory(value: unknown): value is IconCategory {
  return typeof value === 'string' && ICON_CATEGORIES.has(value as IconCategory);
}

function isIconSubgroup(value: unknown): value is IconSubgroup {
  return typeof value === 'string' && ICON_SUBGROUPS.has(value as IconSubgroup);
}

function isSynergyGroup(value: unknown): value is SynergyGroup {
  return typeof value === 'string' && SYNERGY_GROUPS.has(value as SynergyGroup);
}

function isRarity(value: unknown): value is Rarity {
  return typeof value === 'string' && RARITIES.has(value as Rarity);
}

// Create an NxM grid filled with a specific value
export function makeGrid<T>(width: number, height: number, fill: T): Grid<T> {
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, () => fill)
  );
}
//  Get grid dimensions
export function gridDims<T>(grid: Grid<T>) {
  const height = grid.length || 0;
  const width = height ? grid[0].length : 0;
  return { width, height };
}

/*----- Telemetry / analytics -----*/
//  Events that can be emitted
export type TelemetryEvent =
  | { t: 'spin'; round: number; mode: RoundMode; payout: number; enemyHP: number }
  | { t: 'pattern'; label: string; amount: number }
  | { t: 'state'; key: string; value: number | string }
  | { t: 'error'; message: string };
//  Sink for telemetry events
export interface TelemetrySink {
  emit(ev: TelemetryEvent): void;
}

/*---- Utility Types ----*/
//  Nullable<T> is T or null
export type Nullable<T> = T | null;
//  DeepPartial<T> makes all fields in T optional, recursively
export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/*----- Asset & Color Hints -----*/
//  Sprite IDs include all IconIds plus any UI-specific ones
export type SpriteId = IconId | `ui_${string}`;
//  Sprite atlas mapping IDs to URLs
export type SpriteAtlas = {
  [key in SpriteId]: string;  // SpriteId -> URL
};
//  Color represented as a hex string, e.g. "#RRGGBB" or "#RRGGBBAA"
export type Color = string; 


