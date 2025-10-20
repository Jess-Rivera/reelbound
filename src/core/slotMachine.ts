// src/engine/SlotMachine.ts
import {
  IconId,
  IconMetaTable,
  EffectiveIconInfo,
  MachineConfig,
  MachineRuntime,
  SpinResult,
  RNG,
  ICONS,
  RNGSeed,
  ManualReelState,
  ManualSpinSession,
  CELL_SIZE,
  SPIN_SPEED,
  AUTO_STOP_DECEL_DISTANCE,
  DECEL_DISTANCE,
  AUTO_STOP_MIN_SPEED,
  MIN_SPEED,
} from "../types/index";
import { defaultPool as DEFAULT_ICON_POOL } from "../data/defaultPool";
import { evaluateGrid } from "./winEvaluator";

/* ------------------------------
   Runtime builder (merges config)
   ------------------------------ */

/** Merge DEFAULT pool + deltas + pool overrides + exclude + icon overrides → MachineRuntime */
export function buildRuntime(
  cfg: MachineConfig,
  meta: IconMetaTable,
  defaultPool: Partial<Record<IconId, number>> = DEFAULT_ICON_POOL
): MachineRuntime {
  // 1) start from either defaults or zero
  const base: Record<IconId, number> = {} as any;
  for (const id of ICONS) {
    base[id] = cfg.inheritDefaults
      ? Math.max(
          0,
          defaultPool[id] ??
            cfg.defaultNewIconWeight /* may be undefined */ ??
            0
        )
      : 0;
  }

  // 2) relative deltas
  if (cfg.weightDeltas) {
    for (const [k, dv] of Object.entries(cfg.weightDeltas)) {
      const id = k as IconId;
      base[id] = Math.max(0, (base[id] ?? 0) + (dv as number));
    }
  }

  // 3) absolute overrides
  if (cfg.pool) {
    for (const [k, v] of Object.entries(cfg.pool)) {
      base[k as IconId] = Math.max(0, v as number);
    }
  }

  // 4) excludes
  if (cfg.exclude?.length) {
    for (const id of cfg.exclude) base[id] = 0;
  }

  // 5) build effective icon infos (apply per-icon overrides)
  const icons: Record<IconId, EffectiveIconInfo> = {} as any;
  for (const id of ICONS) {
    const m = meta[id];
    if (!m) continue;
    const ov = cfg.overrides?.[id];
    icons[id] = {
      id,
      weight: ov?.weight ?? base[id] ?? 0,
      basemult: ov?.basemult ?? m.basemult,
      effects: (() => {
        const original = m.effects ?? [];
        if (!ov) return original.slice();
        const removed = new Set(ov.removeEffectsKinds ?? []);
        const kept = original.filter((e) => !removed.has(e.kind));
        return ov.addEffects ? kept.concat(ov.addEffects) : kept;
      })(),
    };
  }

  return {
    id: cfg.id,
    name: cfg.name,
    gridWidth: cfg.gridWidth,
    gridHeight: cfg.gridHeight,
    reelLength: cfg.reelLength,
    totalHeat: cfg.totalHeat,
    HP: cfg.HP,
    onFireCurvepp: cfg.onFireCurvepp,
    corruptionpp: cfg.corruptionpp,
    spinDuration: cfg.spinDuration,
    icons,
    themeColor: cfg.themeColor,
    volatility: cfg.volatility,
  };
}

/* ------------------------------
   Reel Strip Generation
   ------------------------------ */

export function generateReelStrips(
  icons: Record<IconId, EffectiveIconInfo>,
  numReels: number,
  reelLength: number,
  rng: RNG
): IconId[][] {
  const cumulative: { id: IconId; max: number }[] = [];
  let running = 0;

  for (const [id, info] of Object.entries(icons) as [IconId, EffectiveIconInfo][]) {
    const weight = Math.max(0, info.weight);
    if (!weight) continue;
    running += weight;
    cumulative.push({ id, max: running });
  }

  if (running <= 0 || !reelLength) {
    const fallbackIcon = ICONS[0] as IconId;
    return Array.from({ length: numReels }, () =>
      Array.from({ length: Math.max(1, reelLength) }, () => fallbackIcon)
    );
  }

  const pickIcon = (): IconId => {
    const target = rng.next() * running;
    for (const entry of cumulative) {
      if (target < entry.max) return entry.id;
    }
    return cumulative[cumulative.length - 1].id;
  };

  const reelStrips: IconId[][] = [];

  for (let reelIdx = 0; reelIdx < numReels; reelIdx++) {
    const strip: IconId[] = [];
    for (let slot = 0; slot < reelLength; slot++) {
      strip.push(pickIcon());
    }
    reelStrips.push(strip);
  }

  return reelStrips;
}

/* ------------------------------
   SlotMachine (with reel strips)
   ------------------------------ */

export class SlotMachine {
  private width: number;
  private height: number;
  private reelStrips: IconId[][] = [];
  private reelPositions: number[] = [];
  private reelLength: number;
  private manualSession: ManualSpinSession | null = null;
  private activeReelIndex = 0;
  private readonly MANUAL_SPIN_ROWS_PER_MS = 5;

  constructor(
    private runtime: MachineRuntime,
    private rng: RNG
  ) {
    this.width = runtime.gridWidth;
    this.height = runtime.gridHeight;
    this.reelLength = runtime.reelLength;
    this.initializeReels();
  }

  /** Generate reel strips for each column by distributing the exact pool */
  private initializeReels() {
    // Generate all reel strips at once (pool is consumed exactly)
    this.reelStrips = generateReelStrips(this.runtime.icons, this.width, this.reelLength, this.rng);
    this.reelPositions = [];
    
    // Start each reel at a random position
    for (let col = 0; col < this.width; col++) {
      const stripLength = this.reelStrips[col].length;
      this.reelPositions.push(Math.floor(this.rng.next() * stripLength));
    }
  }

  private buildManualReelStates(): ManualReelState[] {
    return this.reelStrips.map((strip, col) => {
      const position = this.reelPositions[col];
      const nextIndex = (position +1) % strip.length;
      const spinSpeed = SPIN_SPEED;

      return{
        strip,
        position,
        offsetPx: 0,
        velocity: spinSpeed,
        state: `spinning`,
        previewIcon: strip[nextIndex],
        finalIcon: undefined,
        finalIndex: undefined,
      };
    });
  }

  /** Get the current visible grid based on reel positions */
  getVisibleGrid(): IconId[][] {
    const grid: IconId[][] = [];
    
    for (let row = 0; row < this.height; row++) {
      const gridRow: IconId[] = [];
      for (let col = 0; col < this.width; col++) {
        const strip = this.reelStrips[col];
        const pos = (this.reelPositions[col] + row) % strip.length;
        gridRow.push(strip[pos]);
      }
      grid.push(gridRow);
    }
    
    return grid;
  }

  /** Get a preview of the reel strip for a specific column */
  getReelPreview(col: number, visibleCount: number = 10): IconId[] {
    if (col < 0 || col >= this.reelStrips.length) {
      return [];
    }
    
    const strip = this.reelStrips[col];
    const pos = this.reelPositions[col];
    const preview: IconId[] = [];
    
    for (let i = 0; i < visibleCount; i++) {
      preview.push(strip[(pos + i) % strip.length]);
    }
    
    return preview;
  }

  /** Get all reel strips (for debugging/display) */
  getAllReelStrips(): IconId[][] {
    return this.reelStrips.map(strip => [...strip]);
  }

  /** Get current reel positions (for debugging) */
  getReelPositions(): number[] {
    return [...this.reelPositions];
  }

  /** Regenerate reels with a new seed (useful for testing) */
  regenerateReels(seed?: RNGSeed): void {
    if (seed !== undefined) {
      this.rng.setSeed(seed);
    }
    this.initializeReels();
  }
  /** Reordering Functions **/
  
  private reelOrderLocked = false;

  beginRound(): void {
    this.reelOrderLocked = false;
  }

  reorderReels(order: number[]): void {
    if (this.reelOrderLocked) return;
    if (order.length != this.reelStrips.length) return;

    const seen = new Set<number>();
    for (const idx of order) {
      if (idx < 0 || idx >= this.reelStrips.length || seen.has(idx)) return;
      seen.add(idx);
    }

    const newStrips: IconId[][] = [];
    const newPositions: number[] = [];

    for (let slot = 0; slot < order.length; slot++){
      const source = order[slot];
      newStrips.push(this.reelStrips[source]);
      newPositions.push(this.reelPositions[source]);
    }

    this.reelStrips = newStrips;
    this.reelPositions = newPositions;
  }

  lockReelOrder(): void {
    this.reelOrderLocked = true;
  }
  

  /** Advance reels by random amounts */
  private advanceReels(): void {
    for (let col = 0; col < this.width; col++) {
      const stripLength = this.reelStrips[col].length;
      // Advance each reel by a random amount (minimum 1 full rotation)
      const minAdvance = stripLength;
      const extraAdvance = Math.floor(this.rng.next() * stripLength);
      const advance = minAdvance + extraAdvance;
      
      this.reelPositions[col] = (this.reelPositions[col] + advance) % stripLength;
    }
  }

  /** Build grid from current reel positions */
  private buildGrid(): IconId[][] {
    return this.getVisibleGrid();
  }

  startManualSession(): ManualSpinSession {
    if (this.manualSession) throw new Error(`Manual session already active`);

    this.advanceReels();

    const reels = this.buildManualReelStates();
    const now = performance.now();
    const session: ManualSpinSession = {
      reels,
      status: `spinning`,
      activeReelIndex: 0,
      startedAt: now,
      deadline: now + this.runtime.spinDuration,
      timeRemaining: this.runtime.spinDuration,
      timedOut: false,
    };

    this.manualSession = session;
    this.activeReelIndex = 0;

    return session;
  }

  updateManualSession(elapsedMs: number): void {
    if (!this.manualSession) return;

    const session = this.manualSession;
    session.timeRemaining = Math.max(0, session.deadline - performance.now());
    
    console.log('[UPDATE] Time remaining:', session.timeRemaining, 'Timed out:', session.timedOut);
    
    if (session.timeRemaining === 0 && !session.timedOut) {
      console.log('[UPDATE] Forcing timeout stop');
      this.forceTimeoutStop();
    }
  }

  requestStopNextReel(): { reel: ManualReelState; column: number } | null {
    if (!this.manualSession) return null;

    const session = this.manualSession;

    const startIndex = this.activeReelIndex;
    let targetIndex: number | null = null;

    for (let offset = 0; offset < session.reels.length; offset++) {
      const idx = (startIndex + offset) % session.reels.length;
      if (session.reels[idx].state === 'spinning') {
        targetIndex = idx;
        break;
      }
    }

    if (targetIndex === null) return null;

    this.activeReelIndex = targetIndex;
    session.activeReelIndex = targetIndex;

    const reelState = session.reels[targetIndex];
    reelState.state = 'stopping';
    reelState.stopRequestedAt = performance.now();
    reelState.stopProfile = `manual`;
    session.status = 'stopping';

    return { reel: reelState, column: targetIndex };
  }

  confirmReelStopped(col: number): void {
    if (!this.manualSession) return;

    const session = this.manualSession;
    const reel = session.reels[col];
    if (!reel) return;
    
    // Only update the reel state if it's not already stopped
    if (reel.state !== 'stopped') {
      // Trust the animation's final position - it's what the player sees
      if (reel.finalIndex !== undefined) {
        this.reelPositions[col] = reel.finalIndex;  // Animation is truth
      }
      
      reel.state = 'stopped';
      reel.offsetPx = 0;

      this.activeReelIndex = Math.min(this.activeReelIndex + 1, this.width - 1);
      session.activeReelIndex = this.activeReelIndex;
    }

    // ALWAYS check if all reels are done
    if (session.reels.every((r) => r.state === 'stopped')) {
      const grid = this.buildGrid();  // Build from the CURRENT reelPositions
      const evaluation = evaluateGrid(grid, this.runtime);
      session.spinResult = { grid, ...evaluation };
      session.status = session.timedOut ? 'timed_out' : 'stopped';
    }
  }

  completeManualSession(): SpinResult {
    if (!this.manualSession) {
      throw new Error('Manual session not active');
    }
    if (
      this.manualSession.status !== 'stopped' &&
      this.manualSession.status !== 'timed_out'
    ) {
      throw new Error('Manual session not finished');
    }

    const grid = this.buildGrid();
    const outcome =
      this.manualSession.spinResult ?? { grid, ...evaluateGrid(grid, this.runtime) };

    this.manualSession = null;
    this.activeReelIndex = 0;

    return outcome;
  }

  forceTimeoutStop(): void {
    if (!this.manualSession || this.manualSession.timedOut) return;

    const session = this.manualSession;
    session.timedOut = true;
    session.status = 'stopping';
    session.timeRemaining = 0;

    session.reels.forEach((reel) => {
      if (reel.state !== 'spinning') return;
      console.log(`[TimeoutStop] Reel forced stop`);

      reel.state = 'stopping';
      reel.stopProfile = `forced`;
      reel.decelDistance = AUTO_STOP_DECEL_DISTANCE;
      reel.minSpeed = AUTO_STOP_MIN_SPEED;
    });
  }

  /** One complete spin */
  spin(): SpinResult {
    this.advanceReels();
    const grid = this.buildGrid();
    const { payout, patterns } = evaluateGrid(grid, this.runtime);

    return { grid, payout, patterns };
  }
}

/* ------------------------------
   Helpers
   ------------------------------ */

