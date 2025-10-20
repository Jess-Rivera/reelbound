import { buildRuntime, SlotMachine } from './core/slotMachine';
import { ReelHandler } from './core/reelHandler';
import { ReelInspector } from './ui/reelInspector';
import { iconMeta } from './data/iconMetaTable';
import machineConfigData from './data/machines/selectableMachines.json';
import { isMachineConfig, MachineConfig, RNG, RNGSeed, ICONS, IconId, ManualSpinSession } from './types/index';
import { createRoundManager } from './game/run/roundManager';
import { createHeatSystem } from './game/systems/heatSystem';
import { ROUND_MODE_PRESETS, RoundModePreset } from './game/types';




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

async function bootstrap() {
  const debugPanel = document.querySelector<HTMLPreElement>('#debug');
  const machineLabel = document.querySelector<HTMLSpanElement>('#machine-name');

  const print = (lines: string[]) => {
    if (debugPanel) debugPanel.textContent = lines.join('\n');
    console.log('[Slotspire]', ...lines);
  };

  print(['Bootstrapping...']);

  const cfgCandidate = machineConfigData as unknown;
  if (!isMachineConfig(cfgCandidate)) {
    print(['Failed to validate machine config JSON.', JSON.stringify(cfgCandidate, null, 2)]);
    return;
  }
  const machineConfig = cfgCandidate as MachineConfig;

  const runtime = buildRuntime(machineConfig, iconMeta);
  console.log(`[debug] runtime icons:`, Object.fromEntries(
    Object.entries(runtime.icons).map(([id, info]) => [id, info.weight]
  )))

  const params = new URLSearchParams(window.location.search);
  const seedParam = params.get('seed') ?? params.get('rngSeed');
  const rng = new SimpleRNG(seedParam ?? undefined);

  const slotMachine = new SlotMachine(runtime, rng);
  const heatSystem = createHeatSystem();
  slotMachine.beginRound();
  let currentOrder: number[] = [];
  let orderLocked = false;
  let lockButton: HTMLButtonElement | null = null;
  let spinButtonEl: HTMLButtonElement;
  let stopButtonEl: HTMLButtonElement;
  let manualSession: ManualSpinSession | null = null;
  let stopButtonLocked = false;
  let manualRafId: number | null = null;
  let manualLastTimestamp = 0;

  const DEMO_TOTAL_ROUNDS = 3;
  const DEMO_TARGET_CREDITS = 10;
  const fightState ={
    currentRound: 0,
    totalCredits: 0,
    heat: 0,
    modeChoice: null as RoundModePreset | null,
  };
  const roundManager = createRoundManager(slotMachine, heatSystem);

  const reel = new ReelHandler('#reels');
  await reel.loadIcons(iconMeta);
  
  // Initialize Reel Inspector
  const inspector = new ReelInspector('#reel-inspector-content', {
    onOrderChange: (order) => {
      if (orderLocked) return;
      currentOrder = [...order];
      slotMachine.reorderReels(order);
      reel.render(slotMachine.getVisibleGrid());
      inspector.resetOrder();
      updateInspector();
    },
  });
  await inspector.loadIcons(iconMeta);
  
  // Function to update inspector display
  const updateInspector = () => {
    const reelStrips = slotMachine.getAllReelStrips();
    const positions = slotMachine.getReelPositions();
    if (currentOrder.length === 0) {
      currentOrder = reelStrips.map((_, idx) => idx);
    }
    inspector.render(reelStrips, positions);
  };
  
  // Helper function to get reel composition summary
  const getReelComposition = () => {
    const reelStrips = slotMachine.getAllReelStrips();
    return reelStrips.map((strip, idx) => {
      const counts: Record<string, number> = {};
      strip.forEach(icon => {
        counts[icon] = (counts[icon] || 0) + 1;
      });
      const summary = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([icon, count]) => `${icon}:${count}`)
        .join(' ');
      return `Reel ${idx + 1}: ${summary}`;
    });
  };

  const spinButton = document.querySelector<HTMLButtonElement>('#spin');
  if (!spinButton) throw new Error('Spin button not found');
  spinButtonEl = spinButton;

  const stopButton = document.querySelector<HTMLButtonElement>('#stop');
  if (!stopButton) throw new Error('Stop button not found');
  stopButtonEl = stopButton;
  stopButtonEl.disabled = true;
  const timerEl = document.querySelector<HTMLSpanElement>('#manual-timer');

  const modeButtons = {
    safe: document.querySelector<HTMLButtonElement>('#choose-safe'),
    risky: document.querySelector<HTMLButtonElement>('#choose-risky'),
  };

  function showRoundChoice() {
    if (modeButtons.safe) modeButtons.safe.disabled = false;
    if (modeButtons.risky) modeButtons.risky.disabled = false;
  }

  function hideRoundChoice() {
    if (modeButtons.safe) modeButtons.safe.disabled = true;
    if (modeButtons.risky) modeButtons.risky.disabled = true;
  }

  function onModeChosen(preset: RoundModePreset) {
    fightState.modeChoice = preset;
    hideRoundChoice();
    startRound();
  }

  modeButtons.safe?.addEventListener('click', () => onModeChosen(ROUND_MODE_PRESETS.safe));
  modeButtons.risky?.addEventListener('click', () => onModeChosen(ROUND_MODE_PRESETS.risky));
  
  function startRound() {
    const preset = fightState.modeChoice;
    if (!preset) return;

    fightState.currentRound += 1;

    roundManager.start(
      {
        spinsAllowed: preset.spinsAllowed,
        betCost: 0,
        targetCredits: DEMO_TARGET_CREDITS,
      },
      {
        spinsRemaining: preset.spinsAllowed,
        creditsThisRound: 0,
        heat: fightState.heat,
        multiplier: preset.multiplier,
        mode: preset.mode,
      }
    );

    fightState.modeChoice = null;
    spinButtonEl.disabled = false;
    print([
      `Round ${fightState.currentRound}/${DEMO_TOTAL_ROUNDS} started (${preset.label}).`,
      `Spins remaining: ${preset.spinsAllowed}`,
    ]);
  }

  function finishCurrentRound() {
    const outcome = roundManager.finish();
    fightState.totalCredits += outcome.creditsGained;
    fightState.heat = outcome.heatEnd;

    print([
      `Round ${fightState.currentRound} (${outcome.mode}) complete.`,
      `Credits gained: ${outcome.creditsGained.toFixed(2)} (multiplier x${outcome.multiplier.toFixed(1)})`,
      `Total credits: ${fightState.totalCredits.toFixed(2)}`,
      `Spins used: ${outcome.spinsUsed} / ${ROUND_MODE_PRESETS[outcome.mode].spinsAllowed}`,
      `Heat now: ${outcome.heatEnd}`,
      '',
      ...outcome.log,
    ]);

    if (fightState.currentRound >= DEMO_TOTAL_ROUNDS) {
      concludeFight();
    } else {
      showRoundChoice();
    }
  }

  function concludeFight() {
    const success = fightState.totalCredits >= DEMO_TARGET_CREDITS;

    print([
      `Fight finished with ${fightState.totalCredits.toFixed(2)} credits (target ${DEMO_TARGET_CREDITS}).`,
      success ? 'Victory!' : 'Defeat.',
      '',
      'Select a mode to start a new fight.',
    ]);

    fightState.currentRound = 0;
    fightState.totalCredits = 0;
    showRoundChoice();
  }

  function handleReelSettled(column: number) {
    if (!manualSession) return;

    slotMachine.confirmReelStopped(column);
    const session = manualSession;
    const allStopped = session.reels.every((reel) => reel.state === `stopped`);

    if (allStopped) {
      finalizeManualSpin();
    } else if (!session.timedOut) {
      stopButtonLocked = false;
      stopButtonEl.disabled = false;
    }
  }

  function finalizeManualSpin() {
    if (!manualSession) return;
    stopButtonEl.disabled = true;
    stopButtonLocked = false;
    stopManualTimer();

    const result = slotMachine.completeManualSession();
    const state = roundManager.applyManualResult(result);
    fightState.heat = state.heat;
    reel.render(result.grid);
    updateInspector();
    manualSession = null;

    const totalCreditsFight = state.creditsThisRound + fightState.totalCredits;
    const lines: string[] = [
      `Spins remaining: ${state.spinsRemaining}`,
      '',
      `Credits this round: ${state.creditsThisRound.toFixed(2)}`,
      '',
      `Target Credits: ${DEMO_TARGET_CREDITS}`,
      '',
      `Total Credits: ${totalCreditsFight.toFixed(2)}`,
    ];

    if (result.patterns && result.patterns.length > 0) {
      lines.push('', 'Wins:');
      let runningTotal = 0;
      for (const pattern of result.patterns) {
        const firstCell = pattern.cells[0];
        const sameRow = pattern.cells.every(({ r }) => r === firstCell.r);
        const sameCol = pattern.cells.every(({ c }) => c === firstCell.c);
        const orientation =
          pattern.type === 'diagonal'
            ? 'Diagonal'
            : sameRow
              ? 'Horizontal'
              : sameCol
                ? 'Vertical'
                : 'Line';
        const length = pattern.cells.length;
        const icon = pattern.icons[0];
        const iconInfo = runtime.icons[icon];
        const iconName = iconMeta[icon]?.id ?? icon;
        const baseMult = iconInfo?.basemult ?? 1;
        runningTotal += pattern.multiplier;
        lines.push(
          `${orientation} ${length}x ${iconName}: ${baseMult} x ${length} = ${pattern.multiplier.toFixed(
            2
          )}`
        );
      }
      if (Math.abs(runningTotal - (result.payout ?? 0)) > 1e-6) {
        lines.push(
          '',
          `Payout mismatch: breakdown total ${runningTotal.toFixed(
            2
          )} vs result ${(result.payout ?? 0).toFixed(2)}`
        );
      }
    } else {
      lines.push('', 'Wins: none');
    }

    print(lines);

    if (!roundManager.canSpin()) finishCurrentRound();
    else spinButtonEl.disabled = false;
  }

  function manualFrame(timestamp: number): void {
    if (!manualSession) {
      stopManualLoop();
      return;
    }

    if (manualLastTimestamp === 0) {
      manualLastTimestamp = timestamp;
    }
    const deltaMs = timestamp - manualLastTimestamp;
    manualLastTimestamp = timestamp;

    slotMachine.updateManualSession(deltaMs);
    if (manualSession) {
      updateManualTimer(manualSession);
    }

    if (manualSession) {
      manualRafId = requestAnimationFrame(manualFrame);
    } else {
      stopManualLoop();
    }
  }

  function startManualLoop() {
    stopManualLoop();
    manualLastTimestamp = 0;
    manualRafId = requestAnimationFrame(manualFrame);
  }

  function stopManualLoop() {
    if (manualRafId !== null) {
      cancelAnimationFrame(manualRafId);
      manualRafId = null;
    }
    manualLastTimestamp = 0;
  }

  function startManualTimer(session: ManualSpinSession) {
    if (timerEl) {
      timerEl.classList.remove('hidden');
    }
    updateManualTimer(session);
    startManualLoop();
  }

  function updateManualTimer(session: ManualSpinSession) {
    const remainingMs = Math.max(
      0,
      session.timeRemaining ?? session.deadline - performance.now()
    );

    if (remainingMs <= 0 && !session.timedOut) {
      slotMachine.forceTimeoutStop();
      stopButtonLocked = true;
      stopButtonEl.disabled = true;
    }

    if (timerEl) {
      timerEl.textContent = `Timer: ${(remainingMs / 1000).toFixed(2)}s`;
    }
  }

  function stopManualTimer() {
    stopManualLoop();
    if (timerEl) {
      timerEl.classList.add('hidden');
      timerEl.textContent = 'Timer: 0.00s';
    }
  }

  // Expose debug interface (all at once)
  if (typeof window !== 'undefined') {
    const globalWithDebug = window as typeof window & {
      slotspireDebug?: { 
        setSeed(seed: RNGSeed): void;
        regenerateReels(): void;
        slotMachine: SlotMachine;
      };
    };
    globalWithDebug.slotspireDebug = {
      setSeed: (seed: RNGSeed) => rng.setSeed(seed),
      regenerateReels: () => {
        slotMachine.regenerateReels();
        slotMachine.beginRound();          // clear any previous lock state
        currentOrder = [];
        orderLocked = false;
        inspector.setLocked(false);
        inspector.resetOrder();
        if (lockButton) {
          lockButton.disabled = false;
          lockButton.textContent = 'Lock Order';
        }
        updateInspector();
        reel.render(slotMachine.getVisibleGrid());
        print(['Reels regenerated!', '', ...getReelComposition()]);
      },
      slotMachine,
    };
  }
  
  // Show initial state
  updateInspector();
  const initialGrid = slotMachine.getVisibleGrid();
  reel.render(initialGrid);
  
  // Toggle inspector visibility
  const toggleButton = document.querySelector<HTMLButtonElement>('#toggle-inspector');
  const inspectorContent = document.querySelector<HTMLElement>('#reel-inspector-content');
  let inspectorVisible = true;
  
  if (toggleButton && inspectorContent) {
    toggleButton.addEventListener('click', () => {
      inspectorVisible = !inspectorVisible;
      inspectorContent.classList.toggle('hidden', !inspectorVisible);
      toggleButton.textContent = inspectorVisible ? 'Hide Inspector' : 'Show Inspector';
    });
  }

  lockButton = document.querySelector<HTMLButtonElement>('#lock-order');

  const lockReelsForRound = (source: 'button' | 'spin') => {
    if (orderLocked) return;
    slotMachine.lockReelOrder();
    inspector.setLocked(true);
    orderLocked = true;
    if (lockButton) {
      lockButton.disabled = true;
      lockButton.textContent = 'Order Locked';
    }
    if (source === 'button') {
      print(['Reel order locked for this round.']);
    } else {
      console.log('[Slotspire] Reel order locked automatically on first spin.');
    }
  };

  if (lockButton) {
    lockButton.disabled = false;
    lockButton.textContent = 'Lock Order';
    lockButton.addEventListener('click', () => lockReelsForRound('button'));
  }

  if (machineLabel) {
    machineLabel.textContent = runtime.name;
  }
  const seedInfo = seedParam ?? '(time-based start)';

  print([
    `Machine: ${runtime.name}`,
    `Grid: ${runtime.gridWidth}x${runtime.gridHeight}`,
    `Available icons: ${Object.keys(runtime.icons).length}`,
    `RNG seed: ${seedInfo}`,
    '',
    'Reel Strip Composition:',
    ...getReelComposition(),
    '',
    'Press SPIN to start.',
  ]);

  spinButtonEl.addEventListener('click', async () => {
    if (!roundManager.canSpin()) return;

    lockReelsForRound('spin');
    spinButtonEl.disabled = true;    
    
    manualSession = slotMachine.startManualSession();
    stopButtonEl.disabled = false;
    stopButtonLocked = false;

    reel.beginManualAnimation(manualSession, handleReelSettled);
    startManualTimer(manualSession);
    /*
    const { spin, state } = roundManager.spin(); 
    
    // Get reel strips for animation
    const reelStrips = slotMachine.getAllReelStrips();
    
    // Animate with actual reel strips
    await reel.animateWithReels(spin.grid, reelStrips);*/
    
    // Update inspector to show new positions
    updateInspector();
    spinButtonEl.disabled = !roundManager.canSpin();

    // Manual spins finalize asynchronously; logging occurs in finalizeManualSpin once all reels stop.
  });

  stopButtonEl.addEventListener('click', async () => {
    if (!manualSession || stopButtonLocked) return;

    stopButtonLocked = true;
    slotMachine.requestStopNextReel();
    reel.markReelStopping(manualSession);
    updateManualTimer(manualSession);
    
  });

  showRoundChoice();
}

bootstrap().catch((err) => {
  const debugPanel = document.querySelector<HTMLPreElement>('#debug');
  if (debugPanel) {
    const message =
      err instanceof Error
        ? `${err.name}: ${err.message}\n${err.stack ?? ''}`
        : typeof err === 'object'
          ? JSON.stringify(err, null, 2)
          : String(err);
    debugPanel.textContent = `Bootstrap failed:\n${message}`;
  }
  console.error('Failed to bootstrap slot machine', err);
});
