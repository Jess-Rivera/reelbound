import {
  Grid,
  IconId,
  SpinSession,
  SpinState,
  RNG,
  RNGSeed,
} from './contracts/MainTypes';
import { Clock } from './core/Clock';
import { ReelManager } from './core/ReelManager';
import { StopSequencer } from './core/StopSequencer';
import { SpinTimer } from './core/SpinTimer';
import { loadMachineResources } from './core/machineLoader';
import { createUIBindings } from './ui/UIbindings';



/*------------------------------------------------Set Seed-----------------------------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/
class SimpleRNG implements RNG {
  private state: number;

  constructor(seed?: RNGSeed) {
    this.state =
      typeof seed === 'undefined'
        ? Date.now() >>> 0
        : this.hashSeed(seed);
  }

  private hashSeed(seed: RNGSeed): number {
    const text = seed.toString();
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  setSeed(seed: RNGSeed): void {
    this.state = this.hashSeed(seed);
  }
}

type RuntimeState = {
  spinState: SpinState;
  session: SpinSession | null;
  lastGrid: Grid<IconId> | null;
  spinStartAt: number | null;
};

/*-------------------------------------------------Bootstrap---------------------------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/

/*-------------------------------------------------------
bootstrap – wire up seed, load machines, and prep initial state.
Example: bootstrap().catch(console.error);
-------------------------------------------------------*/
async function bootstrap() {
  const params = new URLSearchParams(window.location.search);
  const seedParam = params.get('seed') ?? params.get('rngSeed');
  const rng = new SimpleRNG(seedParam ?? undefined);

  const ui = createUIBindings();
  ui.appendLog('UI ready; seeding RNG');

  const { machines } = loadMachineResources();
  if (machines.length === 0) {
    throw new Error('[Spike] Machine loader produced zero machines.');
  }
  const machine = machines[0];
  ui.appendLog(`Selected machine: ${machine.spec.name ?? machine.spec.id}`);

  const clock = new Clock();
  const reelManager = new ReelManager({
    machine,
    rng,
    spinConfig: {
      acceleration: 0.0002,
      deceleration: 0.0001,
      maxSpeed: 0.01,
      holdDuration: Number.POSITIVE_INFINITY,
    },
  });
  const stopSequencer = new StopSequencer(reelManager);
  const spinTimer = new SpinTimer(clock, stopSequencer, { intervalMs: 320 });

  const runtime: RuntimeState = {
    spinState: 'preSpin',
    session: null,
    lastGrid: null,
    spinStartAt: null,
  };

  function renderGridSnapshot() {
    const grid = reelManager.getVisibleGrid();
    runtime.lastGrid = grid;
    ui.renderGrid(grid);
  }

  function updateSpinState(state: SpinState) {
    runtime.spinState = state;
    ui.setSpinState(state);
  }

  function beginSpin() {
    if (runtime.spinState !== 'preSpin' && runtime.spinState !== 'postScore') {
      ui.appendLog('Ignoring spin request; already active');
      return;
    }

    stopSequencer.reset();
    reelManager.spinAll();
    const startAt = performance.now();
    const session: SpinSession = {
      reels: reelManager.snapshotAll(),
      status: 'spinning',
      activeReelIndex: 0,
      startAt,
      deadline: startAt + 10_000,
    };
    runtime.session = session;
    runtime.spinStartAt = startAt;

    updateSpinState('spinning');
    ui.appendLog('Spin started');
  }

  function triggerStop() {
    if (!runtime.session) {
      ui.appendLog('Stop ignored; no active spin');
      return;
    }

    if (runtime.spinState === 'slowing' || runtime.spinState === 'preScore') {
      spinTimer.triggerStop();
      return;
    }

    const now = performance.now();
    runtime.session.startAt = now;
    runtime.session.deadline = now + 10_000;

    stopSequencer.startSequence(runtime.session.startAt, runtime.session.deadline);
    spinTimer.begin(runtime.session, runtime.session.startAt, runtime.session.deadline);
    updateSpinState('slowing');
    ui.appendLog('Slowing reels');

    spinTimer.triggerStop();
  }

  function finalizeSpin() {
    updateSpinState('postScore');
    runtime.spinStartAt = null;
    runtime.session = null;
    ui.appendLog('Spin complete; ready for next.');
    stopSequencer.reset();
  }

  clock.onTick((dt) => {
    reelManager.update(dt);
    const spinElapsed = runtime.spinStartAt ? Math.max(0, performance.now() - runtime.spinStartAt) : 0;
    ui.setElapsed(spinElapsed);
    renderGridSnapshot();

    const session = stopSequencer.getSession();
    if (!session) {
      return;
    }

    if (session.status === 'preScore' && runtime.spinState !== 'postScore') {
      finalizeSpin();
    } else if (session.status === 'slowing' && runtime.spinState !== 'slowing') {
      updateSpinState('slowing');
      ui.appendLog('Entering slowing phase');
    }
  });

  renderGridSnapshot();
  updateSpinState('preSpin');
  ui.setElapsed(0);

  const disposeSpinBtn = ui.onSpin(() => beginSpin());
  const disposeStopBtn = ui.onTriggerStop(() => triggerStop());
  const disposeKeys = ui.onKeyCommand((key) => {
    if (key === 'spin') beginSpin();
    else triggerStop();
  });
  ui.appendLog('Controls wired (Enter=spin, Space=stop)');

  clock.start();

  window.addEventListener('beforeunload', () => {
    disposeSpinBtn();
    disposeStopBtn();
    disposeKeys();
    clock.stop();
  });
}



/*-------------------------------------------------Call-Bootstrap----------------------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/
bootstrap().catch((err) => {
  console.error('[Spike] bootstrap failed', err);
});
