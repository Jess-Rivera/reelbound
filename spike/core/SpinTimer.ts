import {
    SpinSession, 
    SpinState 
} from '../contracts/MainTypes'
import { Clock } from './Clock'
import { StopSequencer } from './StopSequencer'

/*-------------------------------------------------------
SpinTimer – orchestrate reel stop cadence during slowing.
Example: const timer = new SpinTimer(clock, sequencer);
-------------------------------------------------------*/
export class SpinTimer {
    private active = false;
    private stopIntervalMs: number;
    private accumulator = 0;
    private disposeTick: (() => void) | null = null;
    private session: SpinSession | null = null;

    constructor (
        private readonly clock: Clock,
        private readonly sequencer: StopSequencer,
        options: { intervalMs?: number } = {}
    ){
        this.stopIntervalMs = options.intervalMs ?? 300;
    }

    /*-------------------------------------------------------
    begin – enter slowing state and register clock ticks.
    Example: timer.begin(spinSession, performance.now());
    -------------------------------------------------------*/
    begin(session: SpinSession, startAt: number, deadline:number): void {
        if (this.active) return;

        session.status = 'slowing';
        session.startAt = startAt;
        session.deadline = deadline;

        this.session = session;
        this.active = true;
        this.accumulator = 0;

        this.disposeTick = this.clock.onTick((dt) => this.handleTick(dt));
    }

    /*-------------------------------------------------------
    triggerStop – respond to user input immediately.
    Example: stopButton.onclick = () => timer.triggerStop();
    -------------------------------------------------------*/
    triggerStop(): void {
        if (!this.active) return;
        this.stopNextReel();
        this.accumulator = 0;
    }

    /*-------------------------------------------------------
    handleTick – accumulate time and fire scheduled stops.
    Example: (internal) invoked via clock.onTick.
    -------------------------------------------------------*/
    private handleTick(dt: number): void {
        if (!this.active) return;

        this.accumulator += dt;
        if (this.accumulator >= this.stopIntervalMs) {
        this.stopNextReel();
        this.accumulator = 0;
        }
    }

    /*-------------------------------------------------------
    stopNextReel – delegate to sequencer and conclude if done.
    Example: (internal) called by triggerStop/handleTick.
    -------------------------------------------------------*/
    private stopNextReel(): void {
        if (!this.sequencer.stopNext('force')) {
        this.finish();
        return;
        }

        const session = this.sequencer.getSession();
        if (session && session.status === 'preScore') {
        this.finish();
        }
    }

    /*-------------------------------------------------------
    finish – unregister clock tick and reset state.
    Example: (internal) invoked when slowing completes.
    -------------------------------------------------------*/
    private finish(): void {
        this.active = false;
        this.session = null;

        if (this.disposeTick) {
        this.disposeTick();
        this.disposeTick = null;
        }
    }

    /*-------------------------------------------------------
    cancel – abort mid-run (e.g., exiting the spin).
    Example: timer.cancel();
    -------------------------------------------------------*/
    cancel(): void {
        if (!this.active) return;
        this.finish();
        this.sequencer.reset();
    }


}

