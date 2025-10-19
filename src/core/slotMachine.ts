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
    const pickIcon = (): IconId => {
      const target = rng.next() * running;
      for (const entry of cumulative) {
        if (target < entry.max) return entry.id;
      } 
      return cumulative[cumulative.length - 1].id;
    };
        

   
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

