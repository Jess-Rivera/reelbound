import { buildRuntime, SlotMachine } from './core/slotMachine';
import { ReelHandler } from './core/reelHandler';
import { ReelInspector } from './ui/reelInspector';
import { iconMeta } from './data/iconMetaTable';
import machineConfigData from './data/machines/selectableMachines.json';
import { isMachineConfig, MachineConfig, RNG, RNGSeed, ICONS, IconId } from './types/index';

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
  const params = new URLSearchParams(window.location.search);
  const seedParam = params.get('seed') ?? params.get('rngSeed');
  const rng = new SimpleRNG(seedParam ?? undefined);

  const slotMachine = new SlotMachine(runtime, rng);
  slotMachine.beginRound();
  let currentOrder: number[] = [];
  let orderLocked = false;
  let lockButton: HTMLButtonElement | null = null;

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


  const spinButton = document.querySelector<HTMLButtonElement>('#spin');
  if (!spinButton) {
    print(['Spin button not found; aborting.']);
    return;
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

  spinButton.addEventListener('click', async () => {
    lockReelsForRound('spin');
    spinButton.disabled = true;
    
    const result = slotMachine.spin();
    
    // Get reel strips for animation
    const reelStrips = slotMachine.getAllReelStrips();
    
    // Animate with actual reel strips
    await reel.animateWithReels(result.grid, reelStrips);
    
    // Update inspector to show new positions
    updateInspector();
    
    spinButton.disabled = false;
    
    const lines: string[] = [
      `Payout: ${result.payout.toFixed(2)}`,
      '',
      'Grid:',
      result.grid.map((row: IconId[]) => row.join(' ')).join('\n'),
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
      if (Math.abs(runningTotal - result.payout) > 1e-6) {
        lines.push('', `Payout mismatch: breakdown total ${runningTotal.toFixed(2)} vs result ${result.payout.toFixed(2)}`);
      }
    } else {
      lines.push('', 'Wins: none');
    }

    print(lines);
  });
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
