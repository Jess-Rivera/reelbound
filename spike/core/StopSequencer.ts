import {
    ReelState,
    SpinSession,
    SpinState
 } from "../contracts/MainTypes";
 import { ReelManager } from './ReelManager'

type StopMode = 'force' | 'graceful';

export class StopSequencer {
  private session: SpinSession | null = null;
  private readonly order: number[];

  /*-------------------------------------------------------
  constructor �?" establish reel manager link and optional order.
  Example: new StopSequencer(reelManager, [0, 2, 1]);
  -------------------------------------------------------*/
  constructor(private readonly reels: ReelManager, order: number[] = []) {
    this.order = order.length > 0 ? order.slice(): [];
  }

  /*-------------------------------------------------------
  startSequence �?" begin the slowing phase and seed session state.
  Example: sequencer.startSequence(performance.now(), deadlineMs);
  -------------------------------------------------------*/
  startSequence(startAt: number, deadline: number): void {
    if (this.session && this.session.status === 'slowing') return;

    const reelStates = this.reels.snapshotAll();
    this.session = {
        reels: reelStates,
        status: 'slowing',
        activeReelIndex: 0,
        startAt,
        deadline,
    };
  }

  /*-------------------------------------------------------
  stopNext �?" halt the next armed reel using the chosen stop mode.
  Example: sequencer.stopNext('force');
  -------------------------------------------------------*/
  stopNext(mode: StopMode = 'force'): boolean {
    if (!this.session || this.session.status !== 'slowing') return false;

    const order = this.resolveOrder();
    const reelIndex = order[this.session.activeReelIndex];
    if (reelIndex == null) {
        this.finish();
        return false;
    }

    if (mode === 'force') {
        this.reels.forceStopAt(reelIndex);
    } else {
        this.reels.requestGracefulStop(reelIndex);
    }

    this.session.reels[reelIndex] = this.reels.snapshotReel(reelIndex);
    this.session.activeReelIndex += 1;

    if (this.session.activeReelIndex >= order.length) {
        this.finish();
    }

    return true;
  }

  /*-------------------------------------------------------
  getSession �?" expose the active spin session for observers.
  Example: const session = sequencer.getSession();
  -------------------------------------------------------*/
  getSession(): SpinSession | null {
    return this.session;
  }

  /*-------------------------------------------------------
  reset �?" clear any session data and return to idle.
  Example: sequencer.reset();
  -------------------------------------------------------*/
  reset(): void {
    this.session = null;
  }

  /*-------------------------------------------------------
  finish �?" transition the session into post-slowing state.
  Example: (internal) invoked once all reels are stopped.
  -------------------------------------------------------*/
  private finish(): void {
    if (this.session) {
        this.session.status = 'preScore';
    }
  }

  /*-------------------------------------------------------
  resolveOrder �?" determine the reel stop order for this run.
  Example: const order = sequencer.resolveOrder();
  -------------------------------------------------------*/
  private resolveOrder(): number[] {
    if (this.order.length > 0) return this.order;
    return Array.from({ length: this.reels.getReelCount() }, (_, index) => index);
  }
}
