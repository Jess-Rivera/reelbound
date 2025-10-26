import { Grid, IconId, ReelState, RNG } from '../contracts/MainTypes';
import { ReelCore, ReelCoreOptions, ReelSpinConfig } from './ReelCore';
import { ResolvedMachineSpec } from './machineLoader';

export interface ReelManagerOptions {
  machine: ResolvedMachineSpec;
  rng: RNG;
  spinConfig?: ReelSpinConfig;
}

export interface SpinRequest {
  targets?: Array<number | null>;
  config?: ReelSpinConfig;
}

export class ReelManager {
  private readonly machine: ResolvedMachineSpec;
  private readonly rng: RNG;
  private readonly reels: ReelCore[];

  constructor(options: ReelManagerOptions) {
    this.machine = options.machine;
    this.rng = options.rng;
    const windowSize = options.machine.spec.gridHeight;

    this.reels = Array.from({ length: options.machine.spec.gridWidth }, (_, index) => {
      const symbols = this.generateStrip(options.machine.iconWeights, options.machine.spec.reelLength);
      const reelOptions: ReelCoreOptions = {
        id: `${options.machine.spec.id}-reel-${index}`,
        symbols,
        windowSize,
        initialIndex: this.randomInt(0, symbols.length - 1),
        spinConfig: options.spinConfig
      };
      return new ReelCore(reelOptions);
    });
  }

  /*-------------------------------------------------------
  getReelCount �?" total number of managed reels.
  Example: const count = reelManager.getReelCount();
  -------------------------------------------------------*/
  getReelCount(): number {
    return this.reels.length;
  }

  /*-------------------------------------------------------
  snapshotReel �?" capture a single reel state for diagnostics/ui.
  Example: const reelState = reelManager.snapshotReel(0);
  -------------------------------------------------------*/
  snapshotReel(index: number): ReelState {
    const reel = this.reels[index];
    if (!reel) {
      throw new Error(`[ReelManager] snapshotReel out of range (index: ${index})`);
    }
    return reel.snapshot();
  }

  /*-------------------------------------------------------
  snapshotAll �?" capture state of every reel simultaneously.
  Example: const reels = reelManager.snapshotAll();
  -------------------------------------------------------*/
  snapshotAll(): ReelState[] {
    return this.reels.map((reel) => reel.snapshot());
  }


  /*-------------------------------------------------------
  update – advance every reel by the elapsed time step.
  Example: reelManager.update(dt);
  -------------------------------------------------------*/
  update(dt: number): void {
    this.reels.forEach((reel) => reel.update(dt));
  }

  /*-------------------------------------------------------
  spinAll – start all reels spinning with optional targets.
  Example: reelManager.spinAll({ targets: [null, 5, 2] });
  -------------------------------------------------------*/
  spinAll(request: SpinRequest = {}): void {
    const { targets, config } = request;
    this.reels.forEach((reel, index) => {
      const target = targets ? targets[index] ?? null : null;
      reel.spin({ targetIndex: target, config });
    });
  }

  /*-------------------------------------------------------
  forceStopAll – snap every reel to the provided indices.
  Example: reelManager.forceStopAll([1, 3, 0]);
  -------------------------------------------------------*/
  forceStopAll(indices: number[]): void {
    this.reels.forEach((reel, index) => {
      const target = indices[index] ?? 0;
      reel.forceStop(target);
    });
  }

  /*-------------------------------------------------------
  forceStopAt �?" snap a specific reel to a target index immediately.
  Example: reelManager.forceStopAt(1, 5);
  -------------------------------------------------------*/
  forceStopAt(index: number, targetIndex?: number): void {
    const reel = this.reels[index];
    if (!reel) {
      throw new Error(`[ReelManager] forceStopAt out of range (index: ${index})`);
    }
    const stopIndex = targetIndex ?? Math.floor(reel.getPosition());
    reel.forceStop(stopIndex);
  }

  /*-------------------------------------------------------
  requestGracefulStop �?" ask a reel to glide to a halt.
  Example: reelManager.requestGracefulStop(2);
  -------------------------------------------------------*/
  requestGracefulStop(index: number): void {
    const reel = this.reels[index];
    if (!reel) { 
      throw new Error(`[ReelManager] requestGracefulStop out of range (index: ${index})`);
    }
    reel.spin({ targetIndex: null, config: { maxSpeed: 0 } });
  }

  /*-------------------------------------------------------
  isAllStopped – check whether every reel has finished spinning.
  Example: if (reelManager.isAllStopped()) { … }
  -------------------------------------------------------*/
  isAllStopped(): boolean {
    return this.reels.every((reel) => reel.getPhase() === 'stopped');
  }

  /*-------------------------------------------------------
  getVisibleGrid – build the current icon grid from all reels.
  Example: const grid = reelManager.getVisibleGrid();
  -------------------------------------------------------*/
  getVisibleGrid(): Grid<IconId> {
    const height = this.machine.spec.gridHeight;
    const width = this.machine.spec.gridWidth;
    const grid: Grid<IconId> = Array.from({ length: height }, () => Array<IconId>(width));

    this.reels.forEach((reel, column) => {
      const window = reel.getWindow();
      for (let row = 0; row < height; row++) {
        grid[row][column] = window[row];
      }
    });

    return grid;
  }

  /*-------------------------------------------------------
  generateStrip – create a reel strip via weighted sampling.
  Example: const strip = generateStrip(weights, 20);
  -------------------------------------------------------*/
  private generateStrip(weights: Record<IconId, number>, length: number): IconId[] {
    const entries = Object.entries(weights).filter(([, weight]) => weight > 0) as Array<[IconId, number]>;
    if (entries.length === 0) {
      throw new Error('[ReelManager] No icons available to populate reel strip.');
    }

    const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
    const strip: IconId[] = [];

    for (let i = 0; i < length; i++) {
      const pickValue = this.rng.next() * totalWeight;
      let cumulative = 0;
      for (const [icon, weight] of entries) {
        cumulative += weight;
        if (pickValue <= cumulative) {
          strip.push(icon);
          break;
        }
      }
    }

    return strip;
  }

  /*-------------------------------------------------------
  randomInt – helper to pick a random integer in range.
  Example: const index = this.randomInt(0, 10);
  -------------------------------------------------------*/
  private randomInt(min: number, max: number): number {
    return Math.floor(this.rng.next() * (max - min + 1)) + min;
  }
}
