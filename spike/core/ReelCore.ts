import { IconId, ReelState } from '../contracts/MainTypes';

export type ReelPhase = 'idle' | 'accelerating' | 'spinning' | 'slowing' | 'stopped';

export interface ReelSpinConfig {
  acceleration?: number;
  deceleration?: number;
  maxSpeed?: number;
  holdDuration?: number;
}

export interface ReelCoreOptions {
  id: string;
  symbols: IconId[];
  windowSize: number;
  initialIndex?: number;
  spinConfig?: ReelSpinConfig;
}

export class ReelCore {
  private readonly id: string;
  private readonly symbols: IconId[];
  private readonly windowSize: number;
  private readonly length: number;

  private phase: ReelPhase = 'idle';
  private position = 0;
  private velocity = 0;
  private targetIndex: number | null = null;
  private elapsedSinceStart = 0;
  private spinConfig: Required<ReelSpinConfig>;

  constructor(options: ReelCoreOptions) {
    if (options.symbols.length === 0) {
      throw new Error(`[ReelCore] reel "${options.id}" requires at least one symbol`);
    }
    this.id = options.id;
    this.symbols = options.symbols.slice();
    this.windowSize = options.windowSize;
    this.length = this.symbols.length;
    this.position = options.initialIndex ?? 0;

    this.spinConfig = {
      acceleration: options.spinConfig?.acceleration ?? 0.005,
      deceleration: options.spinConfig?.deceleration ?? 0.005,
      maxSpeed: options.spinConfig?.maxSpeed ?? 0.02,
      holdDuration: options.spinConfig?.holdDuration ?? 0
    };

    this.wrapPosition();
  }

  /*-------------------------------------------------------
  getId – return the reel identifier.
  Example: const name = reel.getId();
  -------------------------------------------------------*/
  getId(): string {
    return this.id;
  }

  /*-------------------------------------------------------
  getPhase – current motion phase of the reel.
  Example: if (reel.getPhase() === 'stopped') { … }
  -------------------------------------------------------*/
  getPhase(): ReelPhase {
    return this.phase;
  }

  /*-------------------------------------------------------
  getPosition – floating index representing current top symbol.
  Example: const pos = reel.getPosition();
  -------------------------------------------------------*/
  getPosition(): number {
    return this.position;
  }

  /*-------------------------------------------------------
  getVelocity – current spin velocity (indexes per ms).
  Example: const speed = reel.getVelocity();
  -------------------------------------------------------*/
  getVelocity(): number {
    return this.velocity;
  }

  /*-------------------------------------------------------
  getTargetIndex – index the reel is aiming to stop on, if any.
  Example: const target = reel.getTargetIndex();
  -------------------------------------------------------*/
  getTargetIndex(): number | null {
    return this.targetIndex;
  }

  /*-------------------------------------------------------
  snapshot – capture state for debugging or serialization.
  Example: console.log(reel.snapshot());
  -------------------------------------------------------*/
  snapshot(): ReelState {
    const isStopped = this.phase === 'stopped';
    const finalIndex = isStopped ? this.wrapIndex(Math.round(this.position)) : undefined;
    const finalIcon = typeof finalIndex === 'number' ? this.symbols[finalIndex] : undefined;

    return {
      strip: this.symbols.slice(),
      position: this.position,
      offsetPx: 0,
      velocity: this.velocity,
      isStopped,
      finalIndex,
      finalIcon,
    };
  }

  /*-------------------------------------------------------
  spin – start spinning toward an optional target index.
  Example: reel.spin({ targetIndex: 12 });
  -------------------------------------------------------*/
  spin(params: { targetIndex?: number | null; config?: ReelSpinConfig } = {}): void {
    const { targetIndex = null, config } = params;
    if (config) {
      this.spinConfig = {
        acceleration: config.acceleration ?? this.spinConfig.acceleration,
        deceleration: config.deceleration ?? this.spinConfig.deceleration,
        maxSpeed: config.maxSpeed ?? this.spinConfig.maxSpeed,
        holdDuration: config.holdDuration ?? this.spinConfig.holdDuration
      };
    }

    this.targetIndex = targetIndex === null ? null : this.wrapIndex(targetIndex);
    this.phase = 'accelerating';
    this.elapsedSinceStart = 0;
  }

  /*-------------------------------------------------------
  forceStop – snap immediately to a specific index.
  Example: reel.forceStop(3);
  -------------------------------------------------------*/
  forceStop(index: number): void {
    this.position = this.wrapIndex(index);
    this.velocity = 0;
    this.phase = 'stopped';
    this.targetIndex = this.wrapIndex(index);
  }

  /*-------------------------------------------------------
  update – advance the reel based on elapsed time.
  Example: const stopped = reel.update(dt);
  -------------------------------------------------------*/
  update(dt: number): boolean {
    if (this.phase === 'idle' || this.phase === 'stopped') {
      return this.phase === 'stopped';
    }

    this.elapsedSinceStart += dt;

    switch (this.phase) {
      case 'accelerating':
        this.velocity += this.spinConfig.acceleration * dt;
        if (this.velocity >= this.spinConfig.maxSpeed) {
          this.velocity = this.spinConfig.maxSpeed;
          this.phase = this.spinConfig.holdDuration > 0 ? 'spinning' : 'slowing';
          this.elapsedSinceStart = 0;
        }
        break;
      case 'spinning':
        if (this.elapsedSinceStart >= this.spinConfig.holdDuration) {
          this.phase = 'slowing';
        }
        break;
      case 'slowing':
        if (this.targetIndex !== null) {
          this.approachTarget(dt);
        } else {
          this.velocity -= this.spinConfig.deceleration * dt;
          if (this.velocity <= 0) {
            this.velocity = 0;
            this.phase = 'stopped';
          }
        }
        break;
    }

    this.position += this.velocity * dt;
    this.wrapPosition();

    if (this.phase === 'stopped') {
      if (this.targetIndex !== null) {
        this.position = this.targetIndex;
      } else {
        this.position = Math.round(this.position) % this.length;
      }
      this.wrapPosition();
      return true;
    }

    return false;
  }

  /*-------------------------------------------------------
  getWindow – return the icons currently visible in the reel window.
  Example: const symbols = reel.getWindow();
  -------------------------------------------------------*/
  getWindow(): IconId[] {
    const results: IconId[] = [];
    const baseIndex = Math.floor(this.position);

    for (let i = 0; i < this.windowSize; i++) {
      const index = this.wrapIndex(baseIndex + i);
      results.push(this.symbols[index]);
    }

    return results;
  }

  private approachTarget(dt: number): void {
    if (this.targetIndex === null) return;
    const currentIndex = this.position % this.length;
    const distance = this.shortestDistance(currentIndex, this.targetIndex);

    const decelDistance = (this.velocity * this.velocity) / (2 * this.spinConfig.deceleration);
    if (distance <= decelDistance || this.velocity <= 0) {
      this.velocity -= this.spinConfig.deceleration * dt;
      if (this.velocity <= 0) {
        this.velocity = 0;
        this.phase = 'stopped';
      }
    }
  }

  private shortestDistance(from: number, to: number): number {
    let diff = (to - from) % this.length;
    if (diff < 0) diff += this.length;
    return diff;
  }

  private wrapIndex(index: number): number {
    const mod = index % this.length;
    return mod < 0 ? mod + this.length : mod;
  }

  private wrapPosition(): void {
    this.position = this.wrapIndex(this.position);
  }
}
