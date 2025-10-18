// src/engine/SlotMachine.ts
import {
  IconId,
  IconMetaTable,
  EffectiveIconInfo,
  MachineConfig,
  MachineRuntime,
  SpinResult,
  WinPattern,
  RNG,
  ICONS,
  RNGSeed,
} from "../types/index";
import { defaultPool as DEFAULT_ICON_POOL } from "../data/defaultPool";

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
    icons,
    themeColor: cfg.themeColor,
    volatility: cfg.volatility,
  };
}

/* ------------------------------
   Reel Strip Generation
   ------------------------------ */

/**
 * Generate reel strips by distributing the exact icon pool across all reels.
 * The pool is completely consumed - no icons are added or removed from the total.
 * @param icons - Icon pool with weights (weights = count of that icon)
 * @param numReels - Number of reel strips to generate
 * @param rng - Random number generator for shuffling
 */
export function generateReelStrips(
  icons: Record<IconId, EffectiveIconInfo>,
  numReels: number,
  rng: RNG
): IconId[][] {
  // Step 1: Build a flat pool of all icons based on their weights
  const pool: IconId[] = [];
  
  for (const [id, info] of Object.entries(icons) as [IconId, EffectiveIconInfo][]) {
    const count = Math.floor(info.weight);
    for (let i = 0; i < count; i++) {
      pool.push(id);
    }
  }
  
  if (pool.length === 0) {
    // Fallback: no icons in pool
    const fallbackIcon = (ICONS[0] as IconId);
    return Array(numReels).fill([fallbackIcon]);
  }
  
  // Step 2: Shuffle the entire pool using Fisher-Yates
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  
  // Step 3: Distribute icons evenly across reels
  const baseLength = Math.floor(pool.length / numReels);
  const remainder = pool.length % numReels;
  
  const reelStrips: IconId[][] = [];
  let poolIndex = 0;
  
  for (let reelIdx = 0; reelIdx < numReels; reelIdx++) {
    // Some reels get one extra icon if there's a remainder
    const thisReelLength = baseLength + (reelIdx < remainder ? 1 : 0);
    const strip: IconId[] = [];
    
    for (let i = 0; i < thisReelLength; i++) {
      strip.push(pool[poolIndex++]);
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

  constructor(
    private runtime: MachineRuntime,
    private rng: RNG
  ) {
    this.width = runtime.gridWidth;
    this.height = runtime.gridHeight;
    this.initializeReels();
  }

  /** Generate reel strips for each column by distributing the exact pool */
  private initializeReels() {
    // Generate all reel strips at once (pool is consumed exactly)
    this.reelStrips = generateReelStrips(this.runtime.icons, this.width, this.rng);
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

  /** Evaluate simple lines/diagonals: any run of 3+ identical icons */
  private evaluate(grid: IconId[][]): { payout: number; patterns: WinPattern[] } {
    const pats: WinPattern[] = [];
    let payout = 0;

    const addRun = (cells: { r: number; c: number }[]) => {
      if (cells.length < 3) return;
      const id = grid[cells[0].r][cells[0].c];
      const base = this.runtime.icons[id]?.basemult ?? 1;
      const amount = base * cells.length;
      payout += amount;
      pats.push({
        type: "line",
        multiplier: amount,
        cells,
        icons: cells.map(({ r, c }) => grid[r][c]),
      });
    };

    // Rows
    for (let r = 0; r < this.height; r++) {
      let start = 0;
      for (let c = 1; c <= this.width; c++) {
        const same = c < this.width && grid[r][c] === grid[r][start];
        if (!same) {
          addRun(rangeCellsRow(r, start, c - 1));
          start = c;
        }
      }
    }

    // Columns
    for (let c = 0; c < this.width; c++) {
      let start = 0;
      for (let r = 1; r <= this.height; r++) {
        const same = r < this.height && grid[r][c] === grid[start][c];
        if (!same) {
          addRun(rangeCellsCol(c, start, r - 1));
          start = r;
        }
      }
    }

    // Diagonals
    if (this.width >= 3 && this.height >= 3) {
      for (let sr = 0; sr < this.height; sr++) {
        payout += scanDiag(grid, sr, 0, +1, +1, this.runtime, pats);
      }
      for (let sc = 1; sc < this.width; sc++) {
        payout += scanDiag(grid, 0, sc, +1, +1, this.runtime, pats);
      }

      for (let sr = 0; sr < this.height; sr++) {
        payout += scanDiag(grid, sr, this.width - 1, +1, -1, this.runtime, pats);
      }
      for (let sc = this.width - 2; sc >= 0; sc--) {
        payout += scanDiag(grid, 0, sc, +1, -1, this.runtime, pats);
      }
    }

    return { payout, patterns: pats };
  }

  /** One complete spin */
  spin(): SpinResult {
    this.advanceReels();
    const grid = this.buildGrid();
    const { payout, patterns } = this.evaluate(grid);

    return { grid, payout, patterns };
  }
}

/* ------------------------------
   Helpers
   ------------------------------ */

function rangeCellsRow(r: number, c0: number, c1: number) {
  const cells = [];
  for (let c = c0; c <= c1; c++) cells.push({ r, c });
  return cells;
}

function rangeCellsCol(c: number, r0: number, r1: number) {
  const cells = [];
  for (let r = r0; r <= r1; r++) cells.push({ r, c });
  return cells;
}

function scanDiag(
  grid: IconId[][],
  sr: number,
  sc: number,
  dr: 1 | -1,
  dc: 1 | -1,
  runtime: MachineRuntime,
  pats: WinPattern[]
): number {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  let payout = 0;

  const addRun = (cells: { r: number; c: number }[]) => {
    if (cells.length < 3) return;
    const id = grid[cells[0].r][cells[0].c];
    const base = runtime.icons[id]?.basemult ?? 1;
    const amount = base * cells.length;
    payout += amount;
    pats.push({
      type: "diagonal",
      multiplier: amount,
      cells,
      icons: cells.map(({ r, c }) => grid[r][c]),
    });
  };

  let r = sr, c = sc;
  let run: { r: number; c: number }[] = [];
  while (r >= 0 && r < h && c >= 0 && c < w) {
    const id = grid[r][c];
    if (run.length === 0 || grid[run[run.length - 1].r][run[run.length - 1].c] === id) {
      run.push({ r, c });
    } else {
      addRun(run);
      run = [{ r, c }];
    }
    r += dr; c += dc;
  }
  addRun(run);
  return payout;
}