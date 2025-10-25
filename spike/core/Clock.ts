type TickHandler = (dt: number, now: number) => void;
type TimerHandle = { cancel: () => void };
type ScheduledTimer = {
    id: number;
    targetTime: number;
    callback: () => void;
    cancelled: boolean;
};

export class Clock {
    private running = false;
    private speed = 1;
    private lastTimestamp = 0;
    private elapsed = 0;
    private frameId: number | null = null;
    private listeners = new Set<TickHandler>();
    private timers: ScheduledTimer[] = [];
    private nextTimerId = 0;

    /*-------------------------------------------------------
    runFrame – RAF callback that advances time and notifies listeners.
    Example: (internal) requestAnimationFrame(this.runFrame);
    -------------------------------------------------------*/
    private runFrame = (timestamp: number) => {
        if (!this.running) return;  // Guard for pause/stop toggles mid-frame.

        if (this.lastTimestamp === 0) {
            this.lastTimestamp = timestamp;  // Seed baseline on the first tick.
        }

        const rawDelta = timestamp - this.lastTimestamp;
        const dt = rawDelta * this.speed;
        this.elapsed += dt;
        this.lastTimestamp = timestamp;

        for (const handler of this.listeners) {
            handler(dt, this.elapsed);
        }

        this.frameId = requestAnimationFrame(this.runFrame);
        this.flushDueTimers();
    };

    /*-------------------------------------------------------
    start – kick off the RAF-driven update loop.
    Example: clock.start(); // begin ticking before showing the main menu
    -------------------------------------------------------*/
    start(): void {
        if (this.running) return;  // Ignore redundant starts.
        this.running = true;
        this.frameId = requestAnimationFrame(this.runFrame);
    }

    /*-------------------------------------------------------
    stop – halt the loop and reset elapsed time to zero.
    Example: clock.stop(); // clean shutdown when leaving the game
    -------------------------------------------------------*/
    stop(): void {
        if (!this.running) return;
        this.running = false;

        if (this.frameId !== null) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }

        this.lastTimestamp = 0;
        this.elapsed = 0;
        this.timers = [];
    }

    /*-------------------------------------------------------
    pause – freeze the loop without clearing accumulated time.
    Example: clock.pause(); // suspend updates while the menu is open
    -------------------------------------------------------*/
    pause(): void {
        if (!this.running) return;
        this.running = false;

        if (this.frameId !== null) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
    }

    /*-------------------------------------------------------
    resume – continue ticking after a pause, ignoring paused duration.
    Example: clock.resume(); // resume gameplay after closing the menu
    -------------------------------------------------------*/
    resume(): void {
        if (this.running) return;
        this.running = true;
        this.frameId = requestAnimationFrame((timestamp) => {
            if (!this.running) return;
            this.lastTimestamp = timestamp;
            this.frameId = requestAnimationFrame(this.runFrame);
        });
    }

    /*-------------------------------------------------------
    setSpeed – scale time progression (slow-mo, fast-forward).
    Example: clock.setSpeed(0.5); // run at half speed for debugging
    -------------------------------------------------------*/
    setSpeed(multiplier: number): void {
        if (!Number.isFinite(multiplier) || multiplier <= 0) {
            throw new Error(`Clock speed must be a positive finite number (got ${multiplier})`);
        }
        this.speed = multiplier;
    }

    /*-------------------------------------------------------
    onTick – subscribe to per-frame ticks.
    Example: const off = clock.onTick(updateReels);
    -------------------------------------------------------*/
    onTick(handler: TickHandler): () => void {
        this.listeners.add(handler);
        return () => {
            this.listeners.delete(handler);
        };
    }

    /*-------------------------------------------------------
    step – simulate one or more frames manually.
    Example: clock.step(10); // advance ten frames in a unit test
    -------------------------------------------------------*/
    step(frames = 1, frameDurationMs = 16.6667): void {
        const dt = frameDurationMs * this.speed;
        for (let i = 0; i < frames; i++) {
            this.elapsed += dt;
            for (const handler of this.listeners) {
                handler(dt, this.elapsed);
            }
            this.flushDueTimers();
        }
    }

    /*-------------------------------------------------------
    schedule – fire a callback after the given delay.
    Example: const handle = clock.schedule(150, stopReel);
    -------------------------------------------------------*/
    schedule(delayMs: number, callback: () => void): TimerHandle {
        if (!Number.isFinite(delayMs) || delayMs < 0) {
            throw new Error(`Timer delay must be a non-negative finite number (got ${delayMs})`);
        }
        const timer: ScheduledTimer = {
            id: this.nextTimerId++,
            targetTime: this.elapsed + delayMs,
            callback,
            cancelled: false,
        };
        this.timers.push(timer);

        return {
            cancel: () => {
                timer.cancelled = true;
            },
        };
    }

    /*-------------------------------------------------------
    flush – immediately process any due timers.
    Example: clock.flush(); // ensure timers fire before assertions
    -------------------------------------------------------*/
    flush(): void {
        this.flushDueTimers();
    }
    
    /*-------------------------------------------------------
    flushDueTimers – helper to fire and remove timers whose time has come.
    Example: (internal) called after each runFrame to trigger timers.
    -------------------------------------------------------*/
    private flushDueTimers(): void {
        if (this.timers.length === 0) return;

        const due = this.timers.filter((timer) => !timer.cancelled && timer.targetTime <= this.elapsed);
        if (due.length === 0) return;

        this.timers = this.timers.filter((timer) => timer.cancelled || timer.targetTime > this.elapsed);

        for (const timer of due) {
            try {
                timer.callback();
            } catch (err) {
                console.error('[Clock] timer callback threw', err);
            }
        }
    }


}
