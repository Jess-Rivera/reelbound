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
   SlotMachine (math/RNG only)
   ------------------------------ */

export class SlotMachine {
  private width: number;
  private height: number;

  // weighted sampler tables
  private ids: IconId[] = [];
  private cum: number[] = [];
  private total = 0;

  constructor(
    private runtime: MachineRuntime,
    private rng: RNG
  ) {
    this.width = runtime.gridWidth;
    this.height = runtime.gridHeight;
    this.rebuildSampler();
  }

  /** Recompute cumulative weights (call if you mutate runtime icons) */
  private rebuildSampler() {
    this.ids = [];
    this.cum = [];
    this.total = 0;

    for (const id of Object.keys(this.runtime.icons) as IconId[]) {
      const w = this.runtime.icons[id]?.weight ?? 0;
      if (w > 0) {
        this.total += w;
        this.ids.push(id);
        this.cum.push(this.total);
      }
    }
  }

  /** Draw one IconId using cumulative weights */
  private sample(): IconId {
    if (this.total <= 0 || this.ids.length === 0) {
      // Failsafe: no weights → just return first known icon
      return this.ids[0] ?? (ICONS[0] as IconId);
    }
    const r = this.rng.next() * this.total;
    const i = lowerBound(this.cum, r);
    return this.ids[i]!;
  }

  /** Produce a rectangular grid by weighted sampling */
  private buildGrid(): IconId[][] {
    const grid: IconId[][] = [];
    for (let r = 0; r < this.height; r++) {
      const row: IconId[] = [];
      for (let c = 0; c < this.width; c++) {
        row.push(this.sample());
      }
      grid.push(row);
    }
    return grid;
  }

  /** Evaluate simple lines/diagonals: any run of 3+ identical icons */
  private evaluate(grid: IconId[][]): { payout: number; patterns: WinPattern[] } {
    const pats: WinPattern[] = [];
    let payout = 0;

    const addRun = (cells: { r: number; c: number }[]) => {
      if (cells.length < 3) return;
      const id = grid[cells[0].r][cells[0].c];
      const base = this.runtime.icons[id]?.basemult ?? 1;
      // Simple scoring: basemult * runLength
      const amount = base * cells.length;
      payout += amount;
      pats.push({
        type: "line",
        multiplier: amount, // using this field as contribution for now
        cells,
        icons: cells.map(({ r, c }) => grid[r][c]),
      });
    };

    // Rows
    for (let r = 0; r < this.height; r++) {
      let start = 0;
      for (let c = 1; c <= this.width; c++) {
        const same =
          c < this.width && grid[r][c] === grid[r][start];
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
        const same =
          r < this.height && grid[r][c] === grid[start][c];
        if (!same) {
          addRun(rangeCellsCol(c, start, r - 1));
          start = r;
        }
      }
    }

    // Diagonals (top-left → bottom-right)
    if (this.width >= 3 && this.height >= 3) {
      for (let sr = 0; sr < this.height; sr++) {
        // start each diagonal from left or top border
        payout += scanDiag(grid, sr, 0, +1, +1, this.runtime, pats);
      }
      for (let sc = 1; sc < this.width; sc++) {
        payout += scanDiag(grid, 0, sc, +1, +1, this.runtime, pats);
      }

      // Anti-diagonals (top-right → bottom-left)
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
    const grid = this.buildGrid();

    // TODO later: apply effects that trigger on_spin (bias, conversions, etc.)
    // For the slice: evaluate simple lines/diagonals
    const { payout, patterns } = this.evaluate(grid);

    return { grid, payout, patterns };
  }
}

/* ------------------------------
   Helpers
   ------------------------------ */

/** lower_bound on cumulative weights */
function lowerBound(arr: number[], x: number): number {
  let lo = 0, hi = arr.length - 1, ans = hi;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] >= x) {
      ans = mid; hi = mid - 1;
    } else lo = mid + 1;
  }
  return ans;
}

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

/** Scan a diagonal with direction (dr, dc), collect runs ≥ 3 */
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
