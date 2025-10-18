
import { IconId, MachineRuntime, WinPattern } from '../types/index';

export interface EvaluationResult {
  payout: number;
  patterns: WinPattern[];
}

export function evaluateGrid(grid: IconId[][], runtime: MachineRuntime): EvaluationResult {
  const width = grid[0]?.length ?? 0;
  const height = grid.length;
  const patterns: WinPattern[] = [];
  let payout = 0;

  const addRun = (
    cells: { r: number; c: number }[],
    type: WinPattern['type']
  ) => {
    if (cells.length < 3) return;
    const id = grid[cells[0].r][cells[0].c];
    const base = runtime.icons[id]?.basemult ?? 1;
    const amount = base * cells.length;
    payout += amount;
    patterns.push({
      type,
      multiplier: amount,
      cells,
      icons: cells.map(({ r, c }) => grid[r][c]),
    });
  };

  // Rows
  for (let r = 0; r < height; r++) {
    let start = 0;
    for (let c = 1; c <= width; c++) {
      const same = c < width && grid[r][c] === grid[r][start];
      if (!same) {
        addRun(rangeCellsRow(r, start, c - 1), 'line');
        start = c;
      }
    }
  }

  // Columns
  for (let c = 0; c < width; c++) {
    let start = 0;
    for (let r = 1; r <= height; r++) {
      const same = r < height && grid[r][c] === grid[start][c];
      if (!same) {
        addRun(rangeCellsCol(c, start, r - 1), 'line');
        start = r;
      }
    }
  }

  // Diagonals
  if (width >= 3 && height >= 3) {
    for (let sr = 0; sr < height; sr++) {
      payout += scanDiag(grid, sr, 0, +1, +1, runtime, patterns);
    }
    for (let sc = 1; sc < width; sc++) {
      payout += scanDiag(grid, 0, sc, +1, +1, runtime, patterns);
    }

    for (let sr = 0; sr < height; sr++) {
      payout += scanDiag(grid, sr, width - 1, +1, -1, runtime, patterns);
    }
    for (let sc = width - 2; sc >= 0; sc--) {
      payout += scanDiag(grid, 0, sc, +1, -1, runtime, patterns);
    }
  }

  return { payout, patterns };
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
      type: 'diagonal',
      multiplier: amount,
      cells,
      icons: cells.map(({ r, c }) => grid[r][c]),
    });
  };

  let r = sr,
    c = sc;
  let run: { r: number; c: number }[] = [];
  while (r >= 0 && r < h && c >= 0 && c < w) {
    const id = grid[r][c];
    if (run.length === 0 || grid[run[run.length - 1].r][run[run.length - 1].c] === id) {
      run.push({ r, c });
    } else {
      addRun(run);
      run = [{ r, c }];
    }
    r += dr;
    c += dc;
  }
  addRun(run);
  return payout;
}
